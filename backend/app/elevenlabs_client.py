import base64
import time
from typing import AsyncIterator, Optional

import httpx
from fastapi import HTTPException, UploadFile

from app.config import settings
from app.schemas import TTSRequest


class ElevenLabsClient:
    def __init__(self) -> None:
        self.base_url = settings.elevenlabs_base_url.rstrip("/")
        self.timeout = settings.request_timeout_seconds

    def _headers(self, content_type: Optional[str] = "application/json") -> dict[str, str]:
        if not settings.elevenlabs_api_key:
            raise HTTPException(
                status_code=500,
                detail="ELEVENLABS_API_KEY is not configured on the backend.",
            )
        headers = {"xi-api-key": settings.elevenlabs_api_key}
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    async def list_voices(self) -> dict:
        url = f"{self.base_url}/voices"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, headers=self._headers())
        self._raise_for_elevenlabs_error(response)
        return response.json()

    async def list_models(self) -> list[dict]:
        url = f"{self.base_url}/models"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, headers=self._headers())
        self._raise_for_elevenlabs_error(response)
        return response.json()

    async def generate_speech(self, payload: TTSRequest) -> dict:
        start = time.perf_counter()
        url = f"{self.base_url}/text-to-speech/{payload.voice_id}"
        params = {"output_format": payload.output_format}
        body = self._tts_body(payload)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                params=params,
                headers=self._headers(),
                json=body,
            )
        self._raise_for_elevenlabs_error(response)
        audio = response.content
        latency_ms = int((time.perf_counter() - start) * 1000)
        return {
            "audio_base64": base64.b64encode(audio).decode("utf-8"),
            "latency_ms": latency_ms,
            "characters": len(payload.text),
            "bytes": len(audio),
            "model_id": payload.model_id,
            "voice_id": payload.voice_id,
        }

    async def stream_speech(self, payload: TTSRequest) -> AsyncIterator[bytes]:
        url = f"{self.base_url}/text-to-speech/{payload.voice_id}/stream"
        params = {"output_format": payload.output_format}
        body = self._tts_body(payload)

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                url,
                params=params,
                headers=self._headers(),
                json=body,
            ) as response:
                if response.status_code >= 400:
                    error_body = await response.aread()
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=self._format_error(error_body.decode("utf-8", errors="ignore")),
                    )
                async for chunk in response.aiter_bytes():
                    if chunk:
                        yield chunk

    async def clone_voice(self, name: str, description: str, files: list[UploadFile]) -> dict:
        url = f"{self.base_url}/voices/add"
        multipart_files = []
        try:
            for file in files:
                content = await file.read()
                multipart_files.append(("files", (file.filename, content, file.content_type or "audio/mpeg")))

            data = {"name": name, "description": description or "Created from EchoForge POC"}
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(
                    url,
                    headers=self._headers(content_type=None),
                    data=data,
                    files=multipart_files,
                )
        finally:
            for file in files:
                await file.close()

        self._raise_for_elevenlabs_error(response)
        return response.json()

    def _tts_body(self, payload: TTSRequest) -> dict:
        body = {
            "text": payload.text,
            "model_id": payload.model_id,
            "voice_settings": payload.voice_settings.model_dump(),
        }
        if payload.language_code:
            body["language_code"] = payload.language_code
        return body

    @staticmethod
    def _format_error(text: str) -> str:
        if not text:
            return "ElevenLabs API returned an error."
        return text[:700]

    def _raise_for_elevenlabs_error(self, response: httpx.Response) -> None:
        if response.status_code < 400:
            return
        raise HTTPException(
            status_code=response.status_code,
            detail=self._format_error(response.text),
        )
