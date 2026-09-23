package com.company.inventory.service;

import com.company.inventory.dto.request.VoiceExecuteRequest;
import com.company.inventory.dto.response.VoiceExecutionResult;
import com.company.inventory.dto.response.VoiceInterpretation;

/**
 * Turns a spoken command into an inventory action, in two steps:
 *   1. {@link #interpret(String)}  — parse + resolve, change nothing (user confirms).
 *   2. {@link #execute(VoiceExecuteRequest, String)} — apply the confirmed intent.
 */
public interface VoiceCommandService {

    /** Transcribes a recorded audio clip to text (OpenAI speech-to-text). */
    String transcribe(byte[] audio, String filename, String contentType);

    VoiceInterpretation interpret(String transcript);

    VoiceExecutionResult execute(VoiceExecuteRequest request, String username);
}
