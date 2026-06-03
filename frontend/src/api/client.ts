import type { Model, TTSRequest, TTSResponse, Voice } from '../types/voice';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

export async function fetchVoices(): Promise<Voice[]> {
  const response = await fetch(`${API_BASE_URL}/api/voices`);
  if (!response.ok) throw new Error(await parseError(response));
  const data = await response.json();
  return data.voices || [];
}

export async function fetchModels(): Promise<Model[]> {
  const response = await fetch(`${API_BASE_URL}/api/models`);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function generateSpeech(payload: TTSRequest): Promise<TTSResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function streamSpeech(
  payload: TTSRequest,
  onProgress: (bytesReceived: number) => void
): Promise<{ blob: Blob; latencyMs: number; bytes: number }> {
  const started = performance.now();
  const response = await fetch(`${API_BASE_URL}/api/tts/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok || !response.body) throw new Error(await parseError(response));

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      onProgress(received);
    }
  }

  return {
    blob: new Blob(chunks, { type: 'audio/mpeg' }),
    latencyMs: Math.round(performance.now() - started),
    bytes: received
  };
}

export async function cloneVoice(name: string, description: string, files: File[]) {
  const form = new FormData();
  form.append('name', name);
  form.append('description', description);
  files.forEach((file) => form.append('files', file));

  const response = await fetch(`${API_BASE_URL}/api/voice-clone`, {
    method: 'POST',
    body: form
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}
