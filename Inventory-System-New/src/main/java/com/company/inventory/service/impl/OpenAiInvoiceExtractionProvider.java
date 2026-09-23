package com.company.inventory.service.impl;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import com.company.inventory.dto.response.ExtractedInvoice;
import com.company.inventory.service.InvoiceExtractionProvider;
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
                  "suggestedType": "COMPONENT"|"EQUIPMENT"|"SERVICE"
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
            - If any character is genuinely unreadable, transcribe your best single reading — never guess a
              different plausible word or code.
            - Zoom into small text; invoice line-item rows and codes are the highest priority to get right.
            """;

    private final OpenAiClient openAi;
    private final ObjectMapper objectMapper;
    // Plain (non-Spring) instance used only for the graceful fallback path.
    private final MockInvoiceExtractionProvider fallback = new MockInvoiceExtractionProvider();

    public OpenAiInvoiceExtractionProvider(OpenAiClient openAi, ObjectMapper objectMapper) {
        this.openAi = openAi;
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
        try {
            Object userContent = buildUserContent(content, contentType, originalFilename);
            String json = openAi.chat(SYSTEM_PROMPT, userContent, true);
            ExtractedInvoice inv = objectMapper.readValue(json, ExtractedInvoice.class);
            if (inv.getItems() == null) {
                inv.setItems(new java.util.ArrayList<>());
            }
            return inv;
        } catch (Exception ex) {
            // The key IS configured, so a failure here is a real error (timeout, bad
            // image, API error). Surface it instead of silently returning mock data —
            // showing sample items as if they were the real invoice is worse than an
            // honest "please retake" message.
            log.error("OpenAI invoice extraction failed ({}): {}", originalFilename, ex.getMessage());
            throw new IllegalStateException(
                    "Could not read the invoice with AI. Please retake a clearer, well-lit photo and try again.");
        }
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
