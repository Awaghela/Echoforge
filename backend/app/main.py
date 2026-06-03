import os
import time
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.elevenlabs_client import ElevenLabsClient
from app.rate_limit import rate_limit
from app.schemas import TTSRequest

app = FastAPI(
    title="EchoForge ElevenLabs Voice Platform POC",
    description="React + FastAPI app for ElevenLabs TTS, streaming, voice settings, voice cloning, and latency metrics.",
    version="1.0.0",
)

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = ElevenLabsClient()


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time-Ms"] = str(int((time.perf_counter() - start) * 1000))
    return response


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "echoforge-elevenlabs-poc",
        "api_key_configured": bool(settings.elevenlabs_api_key),
    }


@app.get("/api/voices")
async def get_voices(_: Annotated[None, Depends(rate_limit)] = None):
    return await client.list_voices()


@app.get("/api/models")
async def get_models(_: Annotated[None, Depends(rate_limit)] = None):
    return await client.list_models()


@app.post("/api/tts")
async def text_to_speech(payload: TTSRequest, _: Annotated[None, Depends(rate_limit)] = None):
    if len(payload.text) > settings.max_text_chars:
        raise HTTPException(status_code=413, detail=f"Text exceeds {settings.max_text_chars} characters.")
    return await client.generate_speech(payload)


@app.post("/api/tts/stream")
async def stream_text_to_speech(payload: TTSRequest, _: Annotated[None, Depends(rate_limit)] = None):
    if len(payload.text) > settings.max_text_chars:
        raise HTTPException(status_code=413, detail=f"Text exceeds {settings.max_text_chars} characters.")
    return StreamingResponse(
        client.stream_speech(payload),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=echoforge-stream.mp3"},
    )


@app.post("/api/voice-clone")
async def clone_voice(
    name: Annotated[str, Form()],
    description: Annotated[str, Form()] = "",
    files: Annotated[list[UploadFile], File()] = None,
    _: Annotated[None, Depends(rate_limit)] = None,
):
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one audio sample.")
    return await client.clone_voice(name=name, description=description, files=files)


# Serve React build in production. API routes must stay above this catch-all.
frontend_dist = os.path.join(os.getcwd(), "frontend_dist")
assets_dir = os.path.join(frontend_dist, "assets")

if os.path.isdir(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "EchoForge API is running. Start frontend separately in local development."}
