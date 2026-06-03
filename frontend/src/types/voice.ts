export type Voice = {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
};

export type Model = {
  model_id: string;
  name?: string;
  can_do_text_to_speech?: boolean;
  can_do_voice_conversion?: boolean;
  description?: string;
};

export type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
};

export type TTSRequest = {
  text: string;
  voice_id: string;
  model_id: string;
  output_format: string;
  language_code?: string;
  voice_settings: VoiceSettings;
};

export type TTSResponse = {
  audio_base64: string;
  latency_ms: number;
  characters: number;
  bytes: number;
  model_id: string;
  voice_id: string;
};

export type Generation = {
  id: string;
  text: string;
  voiceName: string;
  modelId: string;
  latencyMs: number;
  characters: number;
  bytes: number;
  audioUrl: string;
  mode: 'standard' | 'stream';
  createdAt: string;
};
