import axiosClient from './axiosClient';

// Transcribe a recorded audio clip to text via OpenAI Whisper (browser-independent).
export const transcribeAudio = (blob, filename = 'command.webm') => {
  const form = new FormData();
  form.append('audio', blob, filename);
  return axiosClient
    .post('/voice/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};

// Two-step voice flow: interpret (no change) then execute (applies the confirmed intent).
export const interpretVoiceCommand = (transcript) =>
  axiosClient.post('/voice/interpret', { transcript }).then((r) => r.data);

export const executeVoiceCommand = (payload) =>
  axiosClient.post('/voice/execute', payload).then((r) => r.data);
