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

    public InvoiceExtractionServiceImpl(FileStorageService fileStorageService,
                                        InvoiceExtractionProvider extractionProvider,
                                        InvoiceExtractionRepository extractionRepository,
                                        ObjectMapper objectMapper) {
        this.fileStorageService = fileStorageService;
        this.extractionProvider = extractionProvider;
        this.extractionRepository = extractionRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public ExtractInvoiceResponse extractInvoice(MultipartFile file, String username) {
        // 1. Validate + store the file securely (PDF/JPG/JPEG/PNG, size-limited).
        String storedPath = fileStorageService.storeInvoice(file);

        // 2. Run extraction through whichever provider is active (mock today).
        ExtractedInvoice extracted;
        try {
            extracted = extractionProvider.extract(readBytes(file), file.getContentType(), file.getOriginalFilename());
        } catch (Exception ex) {
            log.error("Invoice extraction failed via provider '{}': {}", extractionProvider.name(), ex.getMessage());
            throw new IllegalStateException("Failed to extract invoice data");
        }

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
