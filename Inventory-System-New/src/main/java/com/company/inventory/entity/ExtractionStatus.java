package com.company.inventory.entity;

public enum ExtractionStatus {
    /** File uploaded and structured data produced, awaiting user confirmation. */
    EXTRACTED,
    /** User confirmed the data and a purchase was created from it. */
    CONFIRMED,
    /** User discarded the extraction without creating a purchase. */
    DISCARDED,
    /** Extraction failed (reserved for the real provider). */
    FAILED
}
