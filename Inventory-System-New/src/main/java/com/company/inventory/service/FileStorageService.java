package com.company.inventory.service;

import org.springframework.web.multipart.MultipartFile;

public interface FileStorageService {

    String storeInvoice(MultipartFile file);
}
