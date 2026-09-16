package com.company.inventory.service.impl;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.request.ComponentRequest;
import com.company.inventory.dto.request.StockInRequest;
import com.company.inventory.dto.request.StockOutRequest;
import com.company.inventory.dto.request.VoiceExecuteRequest;
import com.company.inventory.dto.response.ComponentResponse;
import com.company.inventory.dto.response.VoiceExecutionResult;
import com.company.inventory.dto.response.VoiceInterpretation;
import com.company.inventory.entity.ComponentCategory;
import com.company.inventory.entity.ComponentStatus;
import com.company.inventory.service.ComponentCategoryService;
import com.company.inventory.service.ComponentService;
import com.company.inventory.service.InventoryTransactionService;
import com.company.inventory.service.OpenAiClient;
import com.company.inventory.service.VoiceCommandService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * Voice command interpretation + execution.
 *
 * Interpretation uses OpenAI to turn free speech into a structured intent, then
 * resolves the item against the real catalogue so the confirmation dialog can show
 * exact stock numbers. Execution reuses the same services the REST API uses
 * (stock-in / stock-out / create component), so every rule, audit record and
 * notification behaves identically to a manual action.
 */
@Slf4j
@Service
public class VoiceCommandServiceImpl implements VoiceCommandService {

    private static final String SYSTEM_PROMPT = """
            You convert a spoken inventory command into a JSON object for an
            electronics-components inventory system. Return ONLY JSON (no prose):
            {
              "understood": boolean,      // true if this is a clear add/remove/create stock command
              "action": "ADD_STOCK" | "REMOVE_STOCK" | "CREATE_COMPONENT" | "UNKNOWN",
              "itemName": string|null,    // the component/sensor/part name, cleaned up
              "quantity": number|null,
              "unit": string|null,        // e.g. "pcs"; default null
              "category": string|null,    // best-guess category when creating, e.g. "Sensors"
              "specifications": string|null,
              "unitPrice": number|null,
              "reason": string|null       // when understood=false, why
            }

            Guidance:
            - "add", "put", "stock in", "increase", "received" => ADD_STOCK.
            - "remove", "take out", "use", "issue", "reduce", "stock out" => REMOVE_STOCK.
            - "create", "register a new", "add a new component/sensor" => CREATE_COMPONENT.
            - Extract the number spoken as the quantity; convert spoken numbers to digits
              ("fifty" -> 50, "a dozen" -> 12). If no clear number, set quantity=null.
            - itemName should be just the part name (e.g. "BC547 transistor", "DHT11 sensor"),
              without the verb or quantity.
            - Normalize part names that were dictated with spaces or letter-by-letter:
              "E S P 32" / "ESP 32" / "esp thirty two" -> "ESP32";
              "B C 547" -> "BC547"; "D H T 11" -> "DHT11"; "H C S R 04" -> "HC-SR04".
              These are common electronics parts (ESP32, ESP8266, Arduino, Raspberry Pi,
              BC547, 2N2222, DHT11, DHT22, HC-SR04, MPU6050, NE555, LM358, resistor,
              capacitor, LED, relay, servo, breadboard, OLED display).
            - Even if the transcript is slightly garbled, do your best to recover the most
              likely part name and action rather than giving up.
            - If the command is truly not about adding/removing/creating inventory,
              set understood=false, action=UNKNOWN.
            """;

    private final OpenAiClient openAi;
    private final ComponentService componentService;
    private final ComponentCategoryService categoryService;
    private final InventoryTransactionService transactionService;
    private final ObjectMapper objectMapper;

    public VoiceCommandServiceImpl(OpenAiClient openAi,
                                   ComponentService componentService,
                                   ComponentCategoryService categoryService,
                                   InventoryTransactionService transactionService,
                                   ObjectMapper objectMapper) {
        this.openAi = openAi;
        this.componentService = componentService;
        this.categoryService = categoryService;
        this.transactionService = transactionService;
        this.objectMapper = objectMapper;
    }

    @Override
    public String transcribe(byte[] audio, String filename, String contentType) {
        if (!openAi.isConfigured()) {
            throw new IllegalStateException("Voice AI is not configured on the server. Set OPENAI_API_KEY to enable voice.");
        }
        if (audio == null || audio.length == 0) {
            throw new IllegalArgumentException("No audio was received. Please record again.");
        }
        return openAi.transcribe(audio, filename, contentType);
    }

    @Override
    public VoiceInterpretation interpret(String transcript) {
        VoiceInterpretation out = new VoiceInterpretation();
        out.setRawTranscript(transcript);

        if (!openAi.isConfigured()) {
            out.setUnderstood(false);
            out.setAction("UNKNOWN");
            out.setWarning("Voice AI is not configured on the server. Set OPENAI_API_KEY to enable voice commands.");
            return out;
        }

        JsonNode intent;
        try {
            String json = openAi.chat(SYSTEM_PROMPT, transcript, true);
            intent = objectMapper.readTree(json);
        } catch (Exception ex) {
            log.error("Voice interpretation failed: {}", ex.getMessage());
            out.setUnderstood(false);
            out.setAction("UNKNOWN");
            out.setWarning("Sorry, I couldn't process that command. Please try again.");
            return out;
        }

        String action = text(intent, "action", "UNKNOWN");
        boolean understood = intent.path("understood").asBoolean(false)
                && !"UNKNOWN".equalsIgnoreCase(action);
        String itemName = text(intent, "itemName", null);
        Integer quantity = intent.hasNonNull("quantity") ? intent.get("quantity").asInt() : null;
        String unit = text(intent, "unit", null);
        String category = text(intent, "category", null);

        out.setAction(action);
        out.setItemName(itemName);
        out.setQuantity(quantity);
        out.setUnit(unit);
        out.setCategory(category);
        out.setSpecifications(text(intent, "specifications", null));
        if (intent.hasNonNull("unitPrice")) {
            out.setUnitPrice(BigDecimal.valueOf(intent.get("unitPrice").asDouble()));
        }

        if (!understood || itemName == null || itemName.isBlank()) {
            out.setUnderstood(false);
            out.setWarning(text(intent, "reason", "I didn't catch a clear inventory command."));
            return out;
        }
        out.setUnderstood(true);

        String unitLabel = (unit == null || unit.isBlank()) ? "" : " " + unit;
        ComponentResponse match = findComponent(itemName);
        if (match != null) {
            out.setMatchedComponentId(match.getId());
            out.setMatchedComponentName(match.getComponentName());
            out.setCurrentQuantity(match.getQuantity());
        }

        switch (action.toUpperCase()) {
            case "ADD_STOCK" -> {
                int qty = quantity == null ? 0 : quantity;
                if (match != null) {
                    out.setNeedsCreate(false);
                    out.setConfirmationText(String.format("Add %d%s to \"%s\" (stock %d → %d)?",
                            qty, unitLabel, match.getComponentName(),
                            match.getQuantity(), match.getQuantity() + qty));
                } else {
                    // Adding stock of something not in the catalogue = create it with initial stock.
                    out.setAction("CREATE_COMPONENT");
                    out.setNeedsCreate(true);
                    out.setConfirmationText(String.format(
                            "\"%s\" isn't in the catalogue yet. Create it%s with %d%s in stock?",
                            itemName, category == null ? "" : " under " + category, qty, unitLabel));
                }
                if (quantity == null) {
                    out.setWarning("I couldn't tell how many — please set the quantity before confirming.");
                }
            }
            case "REMOVE_STOCK" -> {
                int qty = quantity == null ? 0 : quantity;
                if (match == null) {
                    out.setConfirmationText(null);
                    out.setWarning(String.format("\"%s\" was not found in the inventory, so there is nothing to remove.", itemName));
                } else {
                    out.setNeedsCreate(false);
                    int after = match.getQuantity() - qty;
                    out.setConfirmationText(String.format("Remove %d%s from \"%s\" (stock %d → %d)?",
                            qty, unitLabel, match.getComponentName(), match.getQuantity(), Math.max(after, 0)));
                    if (quantity == null) {
                        out.setWarning("I couldn't tell how many — please set the quantity before confirming.");
                    } else if (qty > match.getQuantity()) {
                        out.setWarning(String.format("Only %d in stock — you can remove at most that many.", match.getQuantity()));
                    }
                }
            }
            case "CREATE_COMPONENT" -> {
                out.setNeedsCreate(true);
                int qty = quantity == null ? 0 : quantity;
                if (match != null) {
                    // Already exists — treat as adding stock instead of creating a duplicate.
                    out.setAction("ADD_STOCK");
                    out.setNeedsCreate(false);
                    out.setConfirmationText(String.format(
                            "\"%s\" already exists. Add %d%s to it (stock %d → %d)?",
                            match.getComponentName(), qty, unitLabel, match.getQuantity(), match.getQuantity() + qty));
                } else {
                    out.setConfirmationText(String.format("Create component \"%s\"%s with %d%s in stock?",
                            itemName, category == null ? "" : " under " + category, qty, unitLabel));
                }
            }
            default -> {
                out.setUnderstood(false);
                out.setWarning("I didn't catch a clear inventory command.");
            }
        }
        return out;
    }

    @Override
    @Transactional
    public VoiceExecutionResult execute(VoiceExecuteRequest req, String username) {
        String action = req.getAction() == null ? "" : req.getAction().toUpperCase();
        int qty = req.getQuantity() == null ? 0 : req.getQuantity();
        if (qty <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than zero");
        }
        VoiceExecutionResult result = new VoiceExecutionResult();
        result.setAction(action);
        result.setQuantityChanged(qty);

        switch (action) {
            case "ADD_STOCK" -> {
                requireComponentId(req);
                StockInRequest in = new StockInRequest();
                in.setComponentId(req.getComponentId());
                in.setQuantity(qty);
                in.setRemarks(req.getRemarks() != null ? req.getRemarks() : "Added via voice command");
                var tx = transactionService.stockIn(in, username);
                ComponentResponse c = componentService.getComponentById(tx.getComponentId());
                result.setComponentId(c.getId());
                result.setComponentName(c.getComponentName());
                result.setNewQuantity(c.getQuantity());
                result.setMessage(String.format("Added %d to %s. Stock is now %d.", qty, c.getComponentName(), c.getQuantity()));
            }
            case "REMOVE_STOCK" -> {
                requireComponentId(req);
                StockOutRequest outReq = new StockOutRequest();
                outReq.setComponentId(req.getComponentId());
                outReq.setQuantity(qty);
                outReq.setRemarks(req.getRemarks() != null ? req.getRemarks() : "Removed via voice command");
                var tx = transactionService.stockOut(outReq, username);
                ComponentResponse c = componentService.getComponentById(tx.getComponentId());
                result.setComponentId(c.getId());
                result.setComponentName(c.getComponentName());
                result.setNewQuantity(c.getQuantity());
                result.setMessage(String.format("Removed %d from %s. Stock is now %d.", qty, c.getComponentName(), c.getQuantity()));
            }
            case "CREATE_COMPONENT" -> {
                if (req.getComponentName() == null || req.getComponentName().isBlank()) {
                    throw new IllegalArgumentException("Component name is required to create a component");
                }
                ComponentCategory category = categoryService.resolveOrCreate(req.getCategoryName());
                ComponentRequest cr = new ComponentRequest();
                cr.setComponentName(req.getComponentName().trim());
                cr.setCategoryId(category.getId());
                cr.setQuantity(qty);
                cr.setMinimumQuantity(req.getMinimumQuantity() != null ? req.getMinimumQuantity() : 0);
                cr.setUnitPrice(req.getUnitPrice());
                cr.setUnit(req.getUnit());
                cr.setDescription(req.getDescription());
                cr.setStatus(ComponentStatus.ACTIVE);
                ComponentResponse c = componentService.createComponent(cr);
                result.setComponentId(c.getId());
                result.setComponentName(c.getComponentName());
                result.setNewQuantity(c.getQuantity());
                result.setMessage(String.format("Created %s with %d in stock.", c.getComponentName(), c.getQuantity()));
            }
            default -> throw new IllegalArgumentException("Unsupported voice action: " + req.getAction());
        }
        return result;
    }

    private void requireComponentId(VoiceExecuteRequest req) {
        if (req.getComponentId() == null) {
            throw new IllegalArgumentException("A component must be selected for this action");
        }
    }

    /** Best-match lookup: exact name (case-insensitive) wins, else the first search hit. */
    private ComponentResponse findComponent(String name) {
        try {
            List<ComponentResponse> hits = componentService
                    .searchComponents(name, null, null, null, null, 0, 10, "componentName", "asc")
                    .getContent();
            if (hits == null || hits.isEmpty()) {
                return null;
            }
            String target = name.trim().toLowerCase();
            return hits.stream()
                    .filter(c -> c.getComponentName() != null
                            && c.getComponentName().trim().equalsIgnoreCase(target))
                    .findFirst()
                    .orElse(hits.get(0));
        } catch (Exception ex) {
            log.warn("Component lookup failed for '{}': {}", name, ex.getMessage());
            return null;
        }
    }

    private static String text(JsonNode node, String field, String fallback) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) {
            return fallback;
        }
        String s = v.asText();
        return (s == null || s.isBlank() || "null".equals(s)) ? fallback : s;
    }
}
