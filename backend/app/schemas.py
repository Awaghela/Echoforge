from typing import Optional
from pydantic import BaseModel, Field


class VoiceSettings(BaseModel):
    stability: float = Field(default=0.5, ge=0, le=1)
    similarity_boost: float = Field(default=0.75, ge=0, le=1)
    style: float = Field(default=0.0, ge=0, le=1)
    use_speaker_boost: bool = True


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2500)
    voice_id: str = Field(..., min_length=3)
    model_id: str = "eleven_multilingual_v2"
    output_format: str = "mp3_44100_128"
    language_code: Optional[str] = None
    voice_settings: VoiceSettings = Field(default_factory=VoiceSettings)


class TTSResponse(BaseModel):
    audio_base64: str
    latency_ms: int
    characters: int
    bytes: int
    model_id: str
    voice_id: str


class VoiceCloneResponse(BaseModel):
    voice_id: str
    name: str
    status: str
