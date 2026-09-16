package com.company.inventory.controller;

import java.io.IOException;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.company.inventory.dto.request.VoiceCommandRequest;
import com.company.inventory.dto.request.VoiceExecuteRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.VoiceExecutionResult;
import com.company.inventory.dto.response.VoiceInterpretation;
import com.company.inventory.service.VoiceCommandService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * Hands-free inventory control. Two steps by design so a mis-heard command can
 * never silently change stock:
 *   POST /voice/interpret  -> parse speech + resolve against the catalogue (no change)
 *   POST /voice/execute    -> apply the intent the user confirmed
 *
 * Mapped under the central API prefix (e.g. /api/v1/voice/...) like every other
 * controller; both endpoints require an ADMIN (or MASTER_ADMIN) as they mutate stock.
 */
@RestController
@RequestMapping("/voice")
@Tag(name = "Voice Commands", description = "Add or remove inventory by voice")
public class VoiceController {

    private final VoiceCommandService voiceCommandService;

    public VoiceController(VoiceCommandService voiceCommandService) {
        this.voiceCommandService = voiceCommandService;
    }

    @Operation(summary = "Transcribe a recorded audio clip to text (works in any browser)")
    @PostMapping(value = "/transcribe", consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<Map<String, String>>> transcribe(
            @RequestParam("audio") MultipartFile audio) throws IOException {
        String text = voiceCommandService.transcribe(
                audio.getBytes(), audio.getOriginalFilename(), audio.getContentType());
        return ResponseEntity.ok(ApiResponse.success("Transcribed", Map.of("transcript", text)));
    }

    @Operation(summary = "Interpret a spoken command (changes nothing)")
    @PostMapping("/interpret")
    public ResponseEntity<ApiResponse<VoiceInterpretation>> interpret(
            @Valid @RequestBody VoiceCommandRequest request) {
        VoiceInterpretation interpretation = voiceCommandService.interpret(request.getTranscript());
        return ResponseEntity.ok(ApiResponse.success("Command interpreted", interpretation));
    }

    @Operation(summary = "Execute a confirmed voice command")
    @PostMapping("/execute")
    public ResponseEntity<ApiResponse<VoiceExecutionResult>> execute(
            @Valid @RequestBody VoiceExecuteRequest request,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "SYSTEM";
        VoiceExecutionResult result = voiceCommandService.execute(request, username);
        return ResponseEntity.ok(ApiResponse.success(result.getMessage(), result));
    }
}
