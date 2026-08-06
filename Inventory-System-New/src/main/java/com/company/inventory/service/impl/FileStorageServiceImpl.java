package com.company.inventory.service.impl;

import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.service.FileStorageService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageServiceImpl implements FileStorageService {

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;
    private static final String[] ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png"};
    private static final Path INVOICE_FOLDER = Paths.get("uploads", "invoices").toAbsolutePath().normalize();

    public FileStorageServiceImpl() {
        try {
            Files.createDirectories(INVOICE_FOLDER);
        } catch (IOException ex) {
            throw new RuntimeException("Could not create upload directory", ex);
        }
    }

    @Override
    public String storeInvoice(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Invoice file is required");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size must be <= 10MB");
        }

        String contentType = file.getContentType();
        boolean allowed = false;
        for (String type : ALLOWED_TYPES) {
            if (type.equalsIgnoreCase(contentType)) {
                allowed = true;
                break;
            }
        }
        if (!allowed) {
            throw new IllegalArgumentException("Invalid invoice file type");
        }

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String extension = StringUtils.getFilenameExtension(originalFilename);
        String filename = UUID.randomUUID().toString() + (extension != null ? "." + extension : "");
        Path targetLocation = INVOICE_FOLDER.resolve(filename);

        try {
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new RuntimeException("Could not store invoice file", ex);
        }

        return Paths.get("uploads", "invoices", filename).toString().replace("\\", "/");
    }

    @Override
    public Resource loadInvoice(String storedPath) {
        Path file = resolveInsideInvoiceFolder(storedPath);
        if (!Files.exists(file) || !Files.isReadable(file)) {
            throw new ResourceNotFoundException("Invoice file is no longer available on the server");
        }
        try {
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResourceNotFoundException("Invoice file is no longer available on the server");
            }
            return resource;
        } catch (MalformedURLException ex) {
            throw new ResourceNotFoundException("Invoice file could not be read");
        }
    }

    @Override
    public String contentTypeOf(String storedPath) {
        Path file = resolveInsideInvoiceFolder(storedPath);
        try {
            String probed = Files.probeContentType(file);
            if (probed != null) {
                return probed;
            }
        } catch (IOException ignored) {
            // Fall through to the extension check below.
        }
        String name = file.getFileName().toString().toLowerCase();
        if (name.endsWith(".pdf")) return "application/pdf";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    /**
     * Resolves a stored path against the invoice folder and refuses anything that escapes it.
     *
     * <p>The path comes from the database rather than the request, but treating it as
     * untrusted costs nothing and stops a poisoned row from turning the download endpoint
     * into arbitrary file read (`../../application.properties`).</p>
     */
    private Path resolveInsideInvoiceFolder(String storedPath) {
        if (storedPath == null || storedPath.isBlank()) {
            throw new ResourceNotFoundException("This purchase has no invoice attached");
        }
        // Stored as "uploads/invoices/<name>" — only the file name is meaningful here.
        String fileName = Paths.get(storedPath.replace("\\", "/")).getFileName().toString();
        Path resolved = INVOICE_FOLDER.resolve(fileName).normalize();
        if (!resolved.startsWith(INVOICE_FOLDER)) {
            throw new IllegalArgumentException("Invalid invoice path");
        }
        return resolved;
    }
}
