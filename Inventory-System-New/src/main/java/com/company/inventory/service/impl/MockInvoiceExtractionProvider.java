package com.company.inventory.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import com.company.inventory.dto.response.ExtractedInvoice;
import com.company.inventory.dto.response.ExtractedInvoiceLineItem;
import com.company.inventory.service.InvoiceExtractionProvider;

/**
 * Development stand-in for the real OCR service.
 *
 * Active by default (app.invoice.ocr.provider=mock, or unset). Returns a
 * realistic Indian GST tax-invoice modelled on a real Robu.in / MACFOS invoice
 * (supplier part codes, HSN codes, 9%+9% CGST/SGST, a service line) so the full
 * upload → review → confirm workflow can be built and tested before the AI/ML
 * team plugs in a real provider. Values are deterministic for stable testing.
 */
@Service
@ConditionalOnProperty(prefix = "app.invoice.ocr", name = "provider", havingValue = "mock", matchIfMissing = true)
public class MockInvoiceExtractionProvider implements InvoiceExtractionProvider {

    private static final BigDecimal GST_RATE = new BigDecimal("18.0"); // 9% CGST + 9% SGST

    @Override
    public String name() {
        return "mock";
    }

    @Override
    public boolean isMock() {
        return true;
    }

    @Override
    public ExtractedInvoice extract(byte[] content, String contentType, String originalFilename) {
        ExtractedInvoice inv = new ExtractedInvoice();
        inv.setSupplierName("MACFOS LIMITED (Robu.in)");
        inv.setSupplierAddress("Sumant Building, Dynamic Logistics Trade Park, Survey No. 78/1 Dighi, "
                + "Bhosari Alandi Road, Pune 411015, Maharashtra, India");
        inv.setGstNumber("27AALCM3536H1ZA");
        inv.setInvoiceNumber("INV2627/142769");
        inv.setInvoiceDate(LocalDate.of(2026, 7, 15));
        inv.setPurchaseOrderNumber("3580227");
        inv.setCurrency("INR");
        inv.setPaymentTerms("Immediate Payment");
        inv.setPlaceOfSupply("27 - Maharashtra");

        List<ExtractedInvoiceLineItem> items = new ArrayList<>();
        items.add(line("R216425", "TPS61023DRLR - Texas Instruments - Boost Adjustable DC-DC Converter SOT-563",
                "85423100", "DC-DC Converters", "COMPONENT", 10, "27.118"));
        items.add(line("R178445", "AD8132ARZ - Analog Devices - Differential Amplifier, High Speed, 350 MHz",
                "85423100", "Amplifiers", "COMPONENT", 10, "154.238"));
        items.add(line("R151822", "OPA192IDR - Texas Instruments - Operational Amplifier, 10 MHz, SOIC-8",
                "85423100", "Amplifiers", "COMPONENT", 10, "114.406"));
        items.add(line("617729", "GoldenMorning 1.3 inch I2C OLED Display Module (Blue)",
                "85249100", "Display Modules", "COMPONENT", 1, "288.980"));
        items.add(line("582314", "10k Ohm 0.25W Metal Film Resistor",
                "85331000", "Passive Components", "COMPONENT", 100, "0.517"));
        items.add(line("1089857", "10uF 16V Tantalum Capacitor DIP",
                "85322990", "Passive Components", "COMPONENT", 50, "13.559"));
        items.add(line(null, "Same Day Delivery in Pune",
                "996819", "Shipping", "SERVICE", 1, "41.520"));
        inv.setItems(items);

        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        for (ExtractedInvoiceLineItem it : items) {
            BigDecimal beforeTax = it.getUnitPrice().multiply(it.getQuantity()).subtract(it.getDiscount());
            subTotal = subTotal.add(beforeTax);
            tax = tax.add(it.getTaxAmount());
        }
        subTotal = subTotal.setScale(2, RoundingMode.HALF_UP);
        tax = tax.setScale(2, RoundingMode.HALF_UP);

        inv.setSubTotal(subTotal);
        inv.setDiscountTotal(new BigDecimal("0.00"));
        inv.setTaxAmount(tax);
        inv.setShippingCharges(new BigDecimal("41.52")); // captured also as the service line above
        inv.setOtherCharges(new BigDecimal("0.00"));
        BigDecimal grand = subTotal.add(tax).setScale(2, RoundingMode.HALF_UP);
        inv.setGrandTotal(grand);
        inv.setFinalInvoiceAmount(grand);
        return inv;
    }

    private ExtractedInvoiceLineItem line(String code, String desc, String hsn, String category,
                                         String suggestedType, int qty, String rate) {
        ExtractedInvoiceLineItem item = new ExtractedInvoiceLineItem();
        item.setSupplierItemCode(code);
        item.setDescription(desc);
        item.setHsnCode(hsn);
        item.setCategory(category);
        item.setSuggestedType(suggestedType);
        item.setQuantity(new BigDecimal(qty));
        item.setUnit("pcs");
        item.setUnitPrice(new BigDecimal(rate));
        item.setDiscount(new BigDecimal("0.00"));
        item.setTaxPercentage(GST_RATE);

        BigDecimal beforeTax = item.getUnitPrice().multiply(item.getQuantity()).subtract(item.getDiscount());
        BigDecimal taxAmount = beforeTax.multiply(GST_RATE).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        item.setTaxAmount(taxAmount);
        item.setLineTotal(beforeTax.add(taxAmount).setScale(2, RoundingMode.HALF_UP));
        return item;
    }
}
