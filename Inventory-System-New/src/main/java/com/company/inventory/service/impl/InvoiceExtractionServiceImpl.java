package com.company.inventory.service.impl;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.company.inventory.dto.response.ExtractInvoiceResponse;
import com.company.inventory.dto.response.ExtractedInvoice;
import com.company.inventory.entity.ExtractionStatus;
import com.company.inventory.entity.InvoiceExtraction;
import com.company.inventory.exception.InvoiceExtractionException;
import com.company.inventory.exception.NotAnInvoiceException;
import com.company.inventory.repository.InvoiceExtractionRepository;
import com.company.inventory.service.FileStorageService;
import com.company.inventory.service.InvoiceExtractionProvider;
import com.company.inventory.service.InvoiceExtractionService;
import com.company.inventory.service.InvoiceTotalsReconciler;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * Orchestrates invoice extraction. Depends only on the {@link InvoiceExtractionProvider}
 * interface, so the concrete OCR engine can be swapped via configuration with no
 * change here. Storage is reused from {@link FileStorageService}.
 */
@Slf4j
@Service
@Transactional
public class InvoiceExtractionServiceImpl implements InvoiceExtractionService {

    private final FileStorageService fileStorageService;
    private final InvoiceExtractionProvider extractionProvider;
    private final InvoiceExtractionRepository extractionRepository;
    private final InvoiceTotalsReconciler totalsReconciler;
    private final ObjectMapper objectMapper;
    private final com.company.inventory.service.ComponentClassifier classifier;
    private final com.company.inventory.repository.ComponentRepository componentRepository;

    public InvoiceExtractionServiceImpl(FileStorageService fileStorageService,
                                        InvoiceExtractionProvider extractionProvider,
                                        InvoiceExtractionRepository extractionRepository,
                                        InvoiceTotalsReconciler totalsReconciler,
                                        ObjectMapper objectMapper,
                                        com.company.inventory.service.ComponentClassifier classifier,
                                        com.company.inventory.repository.ComponentRepository componentRepository) {
        this.fileStorageService = fileStorageService;
        this.extractionProvider = extractionProvider;
        this.extractionRepository = extractionRepository;
        this.totalsReconciler = totalsReconciler;
        this.objectMapper = objectMapper;
        this.classifier = classifier;
        this.componentRepository = componentRepository;
    }

    @Override
    public ExtractInvoiceResponse extractInvoice(MultipartFile file, String username) {
        // 1. Validate + store the file securely (PDF/JPG/JPEG/PNG, size-limited).
        String storedPath = fileStorageService.storeInvoice(file);

        // 2. Run extraction through whichever provider is active (mock today).
        ExtractedInvoice extracted;
        try {
            extracted = extractionProvider.extract(readBytes(file), file.getContentType(), file.getOriginalFilename());
        } catch (NotAnInvoiceException | InvoiceExtractionException ex) {
            // These already carry a message written for the operator ("this isn't an
            // invoice", "retake the photo"). Replacing it with a generic one here is
            // what made every failure look like a server error.
            throw ex;
        } catch (com.company.inventory.exception.AiServiceException ex) {
            log.error("Invoice extraction failed via provider '{}': {}", extractionProvider.name(), ex.getMessage());
            throw ex;
        } catch (Exception ex) {
            log.error("Invoice extraction failed via provider '{}': {}", extractionProvider.name(), ex.getMessage());
            throw new InvoiceExtractionException("Failed to extract invoice data", ex);
        }

        // 2b. Cross-check the arithmetic. A vision model can misplace a decimal point,
        // which is invisible on the line but silently changes the purchase value; the
        // reconciler repairs what the invoice's own totals prove wrong and reports the rest.
        List<String> warnings = new java.util.ArrayList<>(totalsReconciler.reconcile(extracted));
        // Anything the extractor itself flagged (a figure it read two different ways)
        // belongs in front of the reviewer alongside the arithmetic findings.
        if (extracted.getReadingNotes() != null) {
            warnings.addAll(extracted.getReadingNotes());
        }

        // 2c. Suggest where each new item would be filed (Category › Type › Value) so the
        //     review screen can show the path for the user to verify. Never fatal.
        suggestInventoryPaths(extracted);

        // 2d. Is each line a part already in stock? Then confirming should add to that
        //     component's quantity rather than create a second copy. Never fatal.
        matchExistingStock(extracted);

        // 3. Persist an audit record with the raw structured output.
        InvoiceExtraction record = InvoiceExtraction.builder()
                .filePath(storedPath)
                .originalFilename(file.getOriginalFilename())
                .contentType(file.getContentType())
                .provider(extractionProvider.name())
                .status(ExtractionStatus.EXTRACTED)
                .rawJson(toJson(extracted))
                .createdBy(username)
                .build();
        record = extractionRepository.save(record);

        // 4. Return editable data + references for the confirm step.
        ExtractInvoiceResponse response = new ExtractInvoiceResponse();
        response.setExtractionId(record.getId());
        response.setInvoiceFilePath(storedPath);
        response.setOriginalFilename(file.getOriginalFilename());
        response.setProvider(extractionProvider.name());
        response.setMock(extractionProvider.isMock());
        response.setExtracted(extracted);
        response.setWarnings(warnings);
        response.setTotalsBalanced(warnings.isEmpty());
        return response;
    }

    @Override
    public org.springframework.core.io.Resource loadExtractionFile(Long extractionId) {
        InvoiceExtraction rec = extractionRepository.findById(extractionId)
                .orElseThrow(() -> new com.company.inventory.exception.ResourceNotFoundException(
                        "Extraction not found: " + extractionId));
        return fileStorageService.loadInvoice(rec.getFilePath());
    }

    @Override
    public String extractionContentType(Long extractionId) {
        return extractionRepository.findById(extractionId)
                .map(r -> (r.getContentType() != null && !r.getContentType().isBlank())
                        ? r.getContentType()
                        : fileStorageService.contentTypeOf(r.getFilePath()))
                .orElse("application/octet-stream");
    }

    @Override
    public void markConfirmed(Long extractionId, Long purchaseId) {
        if (extractionId == null) {
            return;
        }
        extractionRepository.findById(extractionId).ifPresent(rec -> {
            rec.setStatus(ExtractionStatus.CONFIRMED);
            rec.setPurchaseId(purchaseId);
            extractionRepository.save(rec);
        });
    }

    private void matchExistingStock(ExtractedInvoice extracted) {
        if (extracted == null || extracted.getItems() == null || extracted.getItems().isEmpty()) {
            return;
        }
        try {
            List<BomMatcher.Indexed> inventory = new java.util.ArrayList<>();
            for (com.company.inventory.entity.ComponentItem c : componentRepository.findAll()) {
                if (c.getStatus() != com.company.inventory.entity.ComponentStatus.ARCHIVED) {
                    inventory.add(new BomMatcher.Indexed(c));
                }
            }
            for (com.company.inventory.dto.response.ExtractedInvoiceLineItem it : extracted.getItems()) {
                String kind = it.getSuggestedType();
                if ("SERVICE".equalsIgnoreCase(kind) || "EQUIPMENT".equalsIgnoreCase(kind)) {
                    continue;
                }
                InvoiceLineMatcher.Decision d = InvoiceLineMatcher.decide(
                        it.getDescription(), it.getSupplierItemCode(), it.getPackageName(), inventory);
                if (d == null) {
                    continue;
                }
                it.setMatchedComponentId(d.target().c.getId());
                it.setMatchedComponentName(d.target().c.getComponentName());
                it.setMatchedComponentStock(d.target().c.getQuantity());
                it.setMatchConfidence(d.confidence());
                it.setMatchNote(d.note());
            }
        } catch (Exception ex) {
            log.warn("Could not match invoice lines to existing stock: {}", ex.getMessage());
        }
    }

    private void suggestInventoryPaths(ExtractedInvoice extracted) {
        if (extracted == null || extracted.getItems() == null || extracted.getItems().isEmpty()) {
            return;
        }
        try {
            com.company.inventory.service.ComponentClassifier.Session session = classifier.session();
            for (com.company.inventory.dto.response.ExtractedInvoiceLineItem it : extracted.getItems()) {
                String kind = it.getSuggestedType();
                if ("SERVICE".equalsIgnoreCase(kind)) {
                    continue;
                }
                if ("EQUIPMENT".equalsIgnoreCase(kind)) {
                    String cat = it.getCategory() != null && !it.getCategory().isBlank() ? it.getCategory().trim() : "Uncategorized";
                    it.setInventoryCategory(cat);
                    it.setInventoryPath("Equipment › " + cat);
                    continue;
                }
                com.company.inventory.dto.response.ComponentClassification c = session.classify(
                        it.getDescription(), it.getPackageName(), it.getCategory(), it.getMounting());
                it.setInventoryCategoryId(c.getCategoryId());
                it.setInventoryCategory(c.getCategory());
                it.setInventoryCategoryIsNew(c.isCategoryIsNew());
                it.setInventoryType(c.getType());
                it.setInventoryValue(c.getValue());
                it.setInventoryPath(c.getPath());
                it.setInventoryReason(c.getReason());
            }
        } catch (Exception ex) {
            log.warn("Could not suggest inventory paths: {}", ex.getMessage());
        }
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (Exception ex) {
            throw new IllegalStateException("Could not read uploaded file");
        }
    }

    private String toJson(ExtractedInvoice extracted) {
        try {
            return objectMapper.writeValueAsString(extracted);
        } catch (Exception ex) {
            log.warn("Could not serialize extracted invoice to JSON: {}", ex.getMessage());
            return null;
        }
    }
}
