import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    elevenlabs_api_key: str = os.getenv("ELEVENLABS_API_KEY", "")
    elevenlabs_base_url: str = os.getenv("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io/v1")
    request_timeout_seconds: float = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "90"))
    cors_origins: str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:8000")
    max_text_chars: int = int(os.getenv("MAX_TEXT_CHARS", "2500"))


settings = Settings()
