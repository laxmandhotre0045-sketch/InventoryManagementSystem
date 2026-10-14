package com.company.inventory.service.impl;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import com.company.inventory.dto.response.ExtractedInvoice;
import com.company.inventory.exception.InvoiceExtractionException;
import com.company.inventory.exception.NotAnInvoiceException;
import com.company.inventory.service.InvoiceExtractionProvider;
import com.company.inventory.service.InvoiceTotalsReconciler;
import com.company.inventory.service.OpenAiClient;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * Real invoice extraction using OpenAI vision (GPT-4o class models).
 *
 * Activated with {@code app.invoice.ocr.provider=openai} (env INVOICE_OCR_PROVIDER=openai).
 * Handles three input shapes, all mapped to the same {@link ExtractedInvoice} contract
 * the rest of the app already consumes:
 *   - images (png/jpg)  -> sent as an image_url data-URI to the vision model
 *   - PDF               -> sent as a base64 "file" content part
 *   - CSV / plain text  -> the text is embedded in the prompt
 *
 * Fails safe: if the API key is missing, or the OpenAI call fails, it falls back to
 * the deterministic mock so the upload -> review -> confirm workflow never breaks.
 * The response's {@code mock} flag then tells the UI it is showing sample data.
 */
@Slf4j
@Service
@ConditionalOnProperty(prefix = "app.invoice.ocr", name = "provider", havingValue = "openai")
public class OpenAiInvoiceExtractionProvider implements InvoiceExtractionProvider {

    private static final String SYSTEM_PROMPT = """
            You are an expert accounts-payable clerk that extracts structured data from
            supplier invoices for an electronics-components inventory system.

            Return ONLY a JSON object (no prose, no markdown fences) matching EXACTLY this shape:
            {
              "isInvoice": boolean,           // see DOCUMENT CHECK below — decide this FIRST
              "documentType": string|null,    // when isInvoice is false, what the document actually is
              "supplierName": string|null,
              "supplierAddress": string|null,
              "gstNumber": string|null,
              "invoiceNumber": string|null,
              "invoiceDate": "YYYY-MM-DD"|null,
              "purchaseOrderNumber": string|null,
              "currency": string|null,
              "paymentTerms": string|null,
              "placeOfSupply": string|null,
              "items": [
                {
                  "description": string,          // the item/part name as printed
                  "supplierItemCode": string|null,// supplier part / catalogue code
                  "hsnCode": string|null,         // HSN / SAC tax code
                  "category": string|null,        // best-guess category e.g. "Resistors", "Sensors", "Display Modules"
                  "quantity": number,
                  "unit": string|null,            // e.g. "pcs"
                  "unitPrice": number,            // price for ONE unit, before tax
                  "discount": number,             // discount amount on the line (0 if none)
                  "taxPercentage": number,        // e.g. 18.0
                  "taxAmount": number,            // tax amount for the line
                  "lineTotal": number,            // qty*price - discount + tax
                  "suggestedType": "COMPONENT"|"EQUIPMENT"|"SERVICE",
                  "packageName": string|null,     // package/footprint if stated or obvious, e.g. "0805", "SOT-23", "DIP-8", "TO-220"
                  "mounting": "SMD"|"THT"|null    // surface-mount or through-hole; null if you cannot tell
                }
              ],
              "subTotal": number|null,
              "discountTotal": number|null,
              "taxAmount": number|null,
              "shippingCharges": number|null,
              "otherCharges": number|null,
              "grandTotal": number|null,
              "finalInvoiceAmount": number|null
            }

            DOCUMENT CHECK (do this before anything else):
            - A valid document here is a supplier invoice, bill, purchase receipt, delivery
              challan or quotation — something with a seller, and priced line items.
            - If the file is anything else — a photo of a person, a landscape, a circuit board,
              a screenshot, an ID card, a resume, a letter, handwritten notes, a blank or
              unreadable page — then set "isInvoice": false, put a short plain-English
              description in "documentType" (e.g. "a photograph of a cat"), set "items": [],
              and set EVERY other field to null.
            - In that case you MUST NOT output any line item. Do not infer products from a
              picture of objects, do not turn a price list or a screenshot of a shop page into
              line items, and never fabricate a supplier or invoice number to fill the shape.
              Returning isInvoice=false is always the correct, expected answer for such a file —
              it is not a failure on your part.
            - Only set "isInvoice": true when you can actually see invoice-like content.

            Rules:
            - Use numbers (not strings) for all numeric fields; use null only where a value is truly absent.
            - suggestedType: physical stockable parts = COMPONENT; instruments/tools/machines = EQUIPMENT;
              delivery/shipping/handling/labour lines = SERVICE.
            - Infer a sensible short category for each item from its description.
            - Never invent line items that are not on the document.

            ACCURACY (very important — this is a machine-printed invoice, transcribe it EXACTLY):
            - Copy every part/catalogue code and description CHARACTER BY CHARACTER, exactly as printed.
              Do NOT drop or add digits, do NOT autocorrect, do NOT normalize spelling or spacing.
              Examples of mistakes to avoid: "R256980" must not become "R25698"; "Nu-Link" must not
              become "N-Link"; "ARM/51" must not become "ARM51". Keep separators like "/", "-", "." and
              bracketed codes like "[R256980]" verbatim.
            - Read every number digit by digit. unitPrice is the printed per-unit RATE (before tax),
              copied exactly including all decimal places. Do not round or infer.

            DECIMAL POINTS AND ARITHMETIC (the most common and most costly error):
            - The decimal point's POSITION is as important as the digits. A rate printed as
              "30.51" is thirty rupees and fifty-one paise — never 305.1 and never 3.051.
              Columns are narrow and the point is small: look at it specifically.
            - Self-check EVERY line before you answer:
                  quantity x unitPrice - discount ( + taxAmount )  ==  the printed line amount
              If your numbers do not satisfy that equation, you have misread one of them.
              Go back to the document and re-read the rate and the amount digit by digit —
              do NOT "fix" the mismatch by adjusting a number you did not actually read.
            - Then check the invoice as a whole: the line amounts must add up to the printed
              sub-total, and sub-total + tax + shipping - discount must equal the printed
              grand total. If they don't, re-read the lines that are off.
            - Copy the printed sub-total, tax, and grand total exactly as shown. Never compute
              a total yourself and report it as the printed one.
            - If any character is genuinely unreadable, transcribe your best single reading — never guess a
              different plausible word or code.
            - Zoom into small text; invoice line-item rows and codes are the highest priority to get right.
            """;

    private final OpenAiClient openAi;
    private final InvoiceTotalsReconciler reconciler;
    private final ObjectMapper objectMapper;
    // Plain (non-Spring) instance used only for the graceful fallback path.
    private final MockInvoiceExtractionProvider fallback = new MockInvoiceExtractionProvider();

    public OpenAiInvoiceExtractionProvider(OpenAiClient openAi,
                                           InvoiceTotalsReconciler reconciler,
                                           ObjectMapper objectMapper) {
        this.openAi = openAi;
        this.reconciler = reconciler;
        // A tolerant mapper: ignore any extra keys the model might add.
        this.objectMapper = objectMapper.copy()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    @Override
    public String name() {
        return "openai";
    }

    @Override
    public boolean isMock() {
        // Reports mock=true only when we are actually about to fall back (no key).
        return !openAi.isConfigured();
    }

    @Override
    public ExtractedInvoice extract(byte[] content, String contentType, String originalFilename) {
        if (!openAi.isConfigured()) {
            log.warn("OPENAI_API_KEY is not set — returning mock invoice data.");
            return fallback.extract(content, contentType, originalFilename);
        }
        ExtractedInvoice inv;
        Object userContent;
        try {
            userContent = buildUserContent(content, contentType, originalFilename);
            inv = readInvoice(userContent);
        } catch (com.company.inventory.exception.AiServiceException ex) {
            throw ex; // rejected key / quota / no connection — the message says what to do
        } catch (Exception ex) {
            // The key IS configured, so a failure here is a real error (timeout, bad
            // image, API error). Surface it instead of silently returning mock data —
            // showing sample items as if they were the real invoice is worse than an
            // honest "please retake" message.
            log.error("OpenAI invoice extraction failed ({}): {}", originalFilename, ex.getMessage());
            throw new InvoiceExtractionException(
                    "Could not read the invoice with AI. Please retake a clearer, well-lit photo and try again.");
        }

        rejectIfNotAnInvoice(inv, originalFilename);
        return correctIfItDoesNotAddUp(inv, userContent, originalFilename);
    }

    /** One model call: prompt in, parsed invoice out. */
    private ExtractedInvoice readInvoice(Object userContent) throws Exception {
        String json = openAi.chat(SYSTEM_PROMPT, userContent, true);
        ExtractedInvoice inv = objectMapper.readValue(json, ExtractedInvoice.class);
        if (inv.getItems() == null) {
            inv.setItems(new java.util.ArrayList<>());
        }
        return inv;
    }

    /**
     * Reads an invoice a second time when the first reading doesn't add up, and reports
     * where the two readings disagree.
     *
     * <p>A misplaced decimal point the reconciler can prove wrong is simply corrected.
     * What arithmetic alone cannot catch is a rate and an amount misread <em>together</em>:
     * reading "1.50 / 300.00" as "1.30 / 260.00" is internally consistent, so only the
     * invoice's own grand total reveals that anything is off — and it can't say which
     * line is to blame.</p>
     *
     * <p>The tempting move is to tell the model its totals are right and have it adjust
     * the lines to match. That is actively harmful: the model complies by inventing a
     * figure that balances (1.60, say) instead of re-reading the one that's printed, and
     * the result <em>looks</em> verified while being wrong — worse than an honest
     * mismatch. So the re-read is asked for neutrally, and its value is taken to be the
     * comparison rather than the correction: where two independent readings of the same
     * document disagree, that line is flagged for the operator, who can see the invoice.
     * A figure both readings agree on is the one worth trusting.</p>
     */
    private ExtractedInvoice correctIfItDoesNotAddUp(ExtractedInvoice first, Object userContent,
                                                     String originalFilename) {
        List<String> issues = reconciler.reconcile(first);
        if (issues.isEmpty()) {
            return first; // Adds up on the first read; a second opinion buys nothing.
        }

        log.info("Invoice '{}' did not reconcile on the first read ({} issue(s)); reading it again.",
                originalFilename, issues.size());

        ExtractedInvoice second;
        try {
            second = readInvoice(withRereadRequest(userContent));
            if (second.getItems().isEmpty()) {
                return first;
            }
        } catch (Exception ex) {
            // The first reading still stands, and its warnings still reach the operator.
            log.warn("Second reading of '{}' failed: {}", originalFilename, ex.getMessage());
            return first;
        }

        List<String> remaining = reconciler.reconcile(second);
        ExtractedInvoice chosen = remaining.size() < issues.size() ? second : first;
        ExtractedInvoice other = chosen == second ? first : second;

        List<String> disagreements = disagreementsBetween(chosen, other);
        if (!disagreements.isEmpty()) {
            log.info("The two readings of '{}' disagree on {} line(s).", originalFilename, disagreements.size());
            chosen.getReadingNotes().addAll(disagreements);
        }
        return chosen;
    }

    /**
     * Lines the two readings priced differently. Each one is a figure the AI is not sure
     * about, so it is surfaced rather than quietly resolved by picking a side.
     */
    private List<String> disagreementsBetween(ExtractedInvoice a, ExtractedInvoice b) {
        List<String> notes = new java.util.ArrayList<>();
        int shared = Math.min(a.getItems().size(), b.getItems().size());
        for (int i = 0; i < shared; i++) {
            var left = a.getItems().get(i);
            var right = b.getItems().get(i);
            if (left.getUnitPrice() == null || right.getUnitPrice() == null
                    || left.getUnitPrice().compareTo(right.getUnitPrice()) == 0) {
                continue;
            }
            String name = left.getDescription() == null || left.getDescription().isBlank()
                    ? "Line " + (i + 1) : left.getDescription();
            notes.add(String.format(
                    "%s: the AI read this unit price two different ways (%s and %s). "
                    + "Check it against the invoice — the figure shown is the first reading.",
                    name, left.getUnitPrice().toPlainString(), right.getUnitPrice().toPlainString()));
        }
        if (a.getItems().size() != b.getItems().size()) {
            notes.add(String.format(
                    "The two readings found a different number of line items (%d and %d). "
                    + "Check the list against the invoice before confirming.",
                    a.getItems().size(), b.getItems().size()));
        }
        return notes;
    }

    /**
     * Asks for an independent second reading. Deliberately says nothing about what the
     * first reading produced: naming the expected total would invite the model to
     * reverse-engineer figures that match it instead of reading what is printed.
     */
    @SuppressWarnings("unchecked")
    private Object withRereadRequest(Object userContent) {
        String note = """
                Read this document again from scratch, as carefully as you can.

                Pay particular attention to every printed number: the quantity, the rate and
                the line amount on each row, and where the decimal point falls in each of them.
                Report exactly what is printed. Do not adjust any figure to make a total come
                out right — if the document's own numbers do not add up, report them as they
                are printed anyway.""";

        if (userContent instanceof List<?> parts) {
            List<Object> combined = new java.util.ArrayList<>((List<Object>) parts);
            combined.add(Map.of("type", "text", "text", note));
            return combined;
        }
        return userContent + "\n\n" + note;
    }

    /**
     * Stops a non-invoice before it can reach the review screen.
     *
     * <p>Two things are refused: a document the model itself classified as something
     * other than an invoice, and one that came back with no line items and no supplier
     * or invoice number — which in practice means the same thing. Letting either
     * through would put the operator in front of item suggestions that correspond to
     * nothing on any document, and the "Confirm Purchase" button would happily move
     * that phantom stock.</p>
     */
    private void rejectIfNotAnInvoice(ExtractedInvoice inv, String originalFilename) {
        boolean classifiedAsNonInvoice = Boolean.FALSE.equals(inv.getIsInvoice());
        boolean hasNothingInvoiceLike = inv.getItems().isEmpty()
                && isBlank(inv.getSupplierName())
                && isBlank(inv.getInvoiceNumber());

        if (!classifiedAsNonInvoice && !hasNothingInvoiceLike) {
            return;
        }

        String looksLike = isBlank(inv.getDocumentType()) ? null : inv.getDocumentType().trim();
        log.info("Rejected non-invoice upload '{}' (documentType={})", originalFilename, looksLike);

        throw new NotAnInvoiceException(looksLike == null
                ? "This file doesn't look like an invoice, so nothing was extracted from it. "
                  + "Please upload a clear photo or PDF of an actual supplier invoice."
                : "This file doesn't look like an invoice — it looks like " + looksLike
                  + ". Please upload a clear photo or PDF of an actual supplier invoice.");
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /** Builds the OpenAI "content parts" array for the user message per file type. */
    private Object buildUserContent(byte[] content, String contentType, String originalFilename) {
        String ct = contentType == null ? "" : contentType.toLowerCase();
        String name = originalFilename == null ? "" : originalFilename.toLowerCase();
        String instruction = "Extract the invoice into the required JSON object.";

        boolean isImage = ct.startsWith("image/") || name.matches(".*\\.(png|jpe?g|webp|gif)$");
        boolean isPdf = ct.contains("pdf") || name.endsWith(".pdf");
        boolean isCsvOrText = ct.contains("csv") || ct.startsWith("text/")
                || name.matches(".*\\.(csv|txt|tsv)$");

        if (isImage) {
            String dataUri = "data:" + (ct.isBlank() ? "image/png" : contentType)
                    + ";base64," + Base64.getEncoder().encodeToString(content);
            return List.of(
                    Map.of("type", "text", "text", instruction),
                    // detail=high tiles the image so small invoice line-item text is read
                    // accurately (the photos are downscaled client-side to keep it fast).
                    Map.of("type", "image_url", "image_url", Map.of("url", dataUri, "detail", "high"))
            );
        }
        if (isPdf) {
            String dataUri = "data:application/pdf;base64," + Base64.getEncoder().encodeToString(content);
            return List.of(
                    Map.of("type", "text", "text", instruction),
                    Map.of("type", "file", "file", Map.of(
                            "filename", originalFilename == null ? "invoice.pdf" : originalFilename,
                            "file_data", dataUri))
            );
        }
        if (isCsvOrText) {
            String text = new String(content, StandardCharsets.UTF_8);
            return instruction + "\n\nThe invoice / line items are provided below as CSV/text:\n\n" + text;
        }
        // Unknown type: best effort as text.
        return instruction + "\n\n" + new String(content, StandardCharsets.UTF_8);
    }
}
