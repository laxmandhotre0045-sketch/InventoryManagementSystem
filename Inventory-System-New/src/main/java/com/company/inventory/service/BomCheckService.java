package com.company.inventory.service;

import com.company.inventory.dto.response.BomCheckResponse;

/**
 * Checks a Bill of Materials against the inventory: for every BOM line, is the part
 * in stock, partly in stock, or does it need ordering. Strictly read-only — it never
 * creates, changes or deletes any data.
 */
public interface BomCheckService {

    /**
     * @param content  raw bytes of the uploaded BOM (.xlsx, .xls, .csv, .tsv, .txt)
     * @param filename original file name (used to pick the parser)
     * @param boards   how many boards will be built; every BOM quantity is multiplied by it
     */
    BomCheckResponse check(byte[] content, String filename, int boards);
}
