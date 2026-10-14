package com.company.inventory.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.company.inventory.dto.response.ExtractInvoiceResponse;
import com.company.inventory.dto.response.ExtractedInvoice;
import com.company.inventory.entity.ExtractionStatus;
import com.company.inventory.entity.InvoiceExtraction;
import com.company.inventory.repository.InvoiceExtractionRepository;
import com.company.inventory.service.FileStorageService;
import com.company.inventory.service.InvoiceExtractionProvider;
import com.company.inventory.service.InvoiceExtractionService;

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
    private final ObjectMapper objectMapper;
    private final com.company.inventory.service.ComponentClassifier classifier;

    public InvoiceExtractionServiceImpl(FileStorageService fileStorageService,
                                        InvoiceExtractionProvider extractionProvider,
                                        InvoiceExtractionRepository extractionRepository,
                                        ObjectMapper objectMapper,
                                        com.company.inventory.service.ComponentClassifier classifier) {
        this.fileStorageService = fileStorageService;
        this.extractionProvider = extractionProvider;
        this.extractionRepository = extractionRepository;
        this.objectMapper = objectMapper;
        this.classifier = classifier;
    }

    @Override
    public ExtractInvoiceResponse extractInvoice(MultipartFile file, String username) {
        // 1. Validate + store the file securely (PDF/JPG/JPEG/PNG, size-limited).
        String storedPath = fileStorageService.storeInvoice(file);

        // 2. Run extraction through whichever provider is active (mock today).
        ExtractedInvoice extracted;
        try {
            extracted = extractionProvider.extract(readBytes(file), file.getContentType(), file.getOriginalFilename());
        } catch (com.company.inventory.exception.AiServiceException ex) {
            log.error("Invoice extraction failed via provider '{}': {}", extractionProvider.name(), ex.getMessage());
            throw ex;
        } catch (Exception ex) {
            log.error("Invoice extraction failed via provider '{}': {}", extractionProvider.name(), ex.getMessage());
            // Show the provider's own advice (e.g. "retake a clearer photo") instead of a generic 500.
            throw new IllegalArgumentException(ex.getMessage() != null ? ex.getMessage() : "Failed to extract invoice data");
        }

        // 2b. Suggest where each new item would be filed (Category › Type › Value) so the
        //     review screen can show the path for the user to verify. Never fatal.
        suggestInventoryPaths(extracted);

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
