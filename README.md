# EchoForge — ElevenLabs AI Voice Platform POC

EchoForge is a full-stack ElevenLabs voice platform proof-of-concept built with **React**, **TypeScript**, **FastAPI**, and the **ElevenLabs API**.

It is designed to look like a serious engineering demo, not just a one-button text-to-speech app.

## What It Includes

- ElevenLabs text-to-speech generation
- Streaming text-to-speech endpoint
- Dynamic voice loading from ElevenLabs
- Model selection
- Multilingual synthesis via language code selection
- Voice settings controls:
  - Stability
  - Similarity boost
  - Style
  - Speaker boost
- Audio playback and download
- Session-level generation history
- Latency, bytes, model, and mode metrics
- Secure FastAPI backend proxy so the API key is never exposed in the browser
- Optional voice cloning upload endpoint
- In-memory rate limiting for POC safety
- Dockerfile for one-service Railway deployment
- FastAPI serving the built React app in production

## Architecture

```txt
Browser / React / TypeScript
        |
        | same-domain API calls
        v
FastAPI backend
        |
        | xi-api-key stored only as backend env var
        v
ElevenLabs API
```

In production, FastAPI serves the built React app from `frontend_dist` and also exposes:

```txt
GET  /health
GET  /api/voices
GET  /api/models
POST /api/tts
POST /api/tts/stream
POST /api/voice-clone
```

## Local Setup

### 1. Clone / unzip project

```bash
cd echoforge-elevenlabs-poc
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_BASE_URL=https://api.elevenlabs.io/v1
REQUEST_TIMEOUT_SECONDS=90
MAX_TEXT_CHARS=2500
CORS_ORIGINS=http://localhost:5173,http://localhost:8000
```

Run backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Check:

```bash
curl http://localhost:8000/health
```

### 3. Frontend setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

```txt
http://localhost:5173
```

The Vite dev server proxies `/api` and `/health` to `http://localhost:8000`.

## Run with Docker Locally

From project root:

```bash
docker build -t echoforge-elevenlabs-poc .
docker run -p 8000:8000 -e ELEVENLABS_API_KEY=your_key_here echoforge-elevenlabs-poc
```

Open:

```txt
http://localhost:8000
```

## Railway Deployment

This project is prepared for **one Railway service** using Docker.

### Steps

1. Push this folder to GitHub.
2. Go to Railway.
3. Create **New Project**.
4. Select **Deploy from GitHub Repo**.
5. Choose this repo.
6. Railway should use the root `Dockerfile`.
7. Add environment variable:

```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

Optional env vars:

```env
ELEVENLABS_BASE_URL=https://api.elevenlabs.io/v1
REQUEST_TIMEOUT_SECONDS=90
MAX_TEXT_CHARS=2500
CORS_ORIGINS=https://your-railway-domain.up.railway.app
```

8. Deploy.
9. Generate a public Railway domain.
10. Open the Railway URL.

## Important Security Note

Do **not** put your ElevenLabs key in frontend `.env` variables like this:

```env
VITE_ELEVENLABS_API_KEY=bad_idea
```

Anything beginning with `VITE_` can be exposed to the browser bundle.

Only use:

```env
ELEVENLABS_API_KEY=your_key_here
```

on the backend/Railway service.

## Resume Bullet

```txt
Built and deployed EchoForge, a full-stack ElevenLabs AI voice platform POC using React, TypeScript, FastAPI, Docker, and Railway, integrating text-to-speech, streaming audio generation, dynamic voice selection, multilingual synthesis, voice settings, voice cloning, latency metrics, and secure backend-managed API credentials.
```

## Demo Talking Points

- The frontend never calls ElevenLabs directly, which protects the API key.
- FastAPI acts as the secure integration layer and normalizes API responses/errors.
- Streaming mode uses a backend streaming proxy and browser `ReadableStream` consumption.
- The UI exposes voice/model/settings controls instead of hardcoding a single voice.
- The app includes observability-style metrics such as latency, bytes, model, and request mode.
- Railway deploys the React frontend and FastAPI backend as one Dockerized service.
