import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Download,
  Gauge,
  Globe2,
  Headphones,
  Loader2,
  Mic2,
  Play,
  RefreshCw,
  Sparkles,
  Upload,
  Wand2,
  Waves
} from 'lucide-react';
import { cloneVoice, fetchModels, fetchVoices, generateSpeech, streamSpeech } from './api/client';
import type { Generation, Model, TTSRequest, Voice, VoiceSettings } from './types/voice';

const sampleTexts = [
  'Welcome to EchoForge, an ElevenLabs-powered voice studio for generating natural, configurable, multilingual AI speech.',
  'Your deployment has completed successfully. The release passed validation, entered production, and is now visible in the pipeline dashboard.',
  'नमस्ते! यह एक multilingual voice synthesis demo है, built with React, FastAPI, and the ElevenLabs API.',
  'Bonjour! Cette démonstration transforme du texte en voix naturelle avec des contrôles de stabilité, style et similarité.'
];

const fallbackModels: Model[] = [
  { model_id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2', can_do_text_to_speech: true },
  { model_id: 'eleven_flash_v2_5', name: 'Eleven Flash v2.5', can_do_text_to_speech: true },
  { model_id: 'eleven_turbo_v2_5', name: 'Eleven Turbo v2.5', can_do_text_to_speech: true }
];

const languages = [
  { label: 'Auto detect', value: '' },
  { label: 'English', value: 'en' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Japanese', value: 'ja' }
];

const outputFormats = [
  'mp3_44100_128',
  'mp3_22050_32',
  'pcm_16000',
  'ulaw_8000'
];

function base64ToBlob(base64: string, mimeType: string) {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i += 1) byteNumbers[i] = slice.charCodeAt(i);
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mimeType });
}

function formatBytes(bytes: number) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function App() {
  const [text, setText] = useState(sampleTexts[0]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [models, setModels] = useState<Model[]>(fallbackModels);
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [modelId, setModelId] = useState('eleven_multilingual_v2');
  const [languageCode, setLanguageCode] = useState('');
  const [outputFormat, setOutputFormat] = useState('mp3_44100_128');
  const [settings, setSettings] = useState<VoiceSettings>({
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.05,
    use_speaker_boost: true
  });
  const [audioUrl, setAudioUrl] = useState('');
  const [history, setHistory] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamMode, setStreamMode] = useState(true);
  const [streamBytes, setStreamBytes] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Idle');
  const [voiceQuery, setVoiceQuery] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [cloneStatus, setCloneStatus] = useState('');
  const [activeGeneration, setActiveGeneration] = useState<Generation | null>(null);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voice_id === selectedVoiceId),
    [voices, selectedVoiceId]
  );

  const filteredVoices = useMemo(() => {
    const query = voiceQuery.trim().toLowerCase();
    if (!query) return voices;
    return voices.filter((voice) => {
      const labels = Object.values(voice.labels || {}).join(' ');
      return `${voice.name} ${voice.category || ''} ${labels}`.toLowerCase().includes(query);
    });
  }, [voices, voiceQuery]);

  useEffect(() => {
    async function bootstrap() {
      setStatus('Loading ElevenLabs voices');
      try {
        const [voiceList, modelList] = await Promise.allSettled([fetchVoices(), fetchModels()]);
        if (voiceList.status === 'fulfilled') {
          setVoices(voiceList.value);
          setSelectedVoiceId(voiceList.value[0]?.voice_id || '');
        }
        if (modelList.status === 'fulfilled') {
          const ttsModels = modelList.value.filter((model) => model.can_do_text_to_speech !== false);
          setModels(ttsModels.length ? ttsModels : fallbackModels);
        }
        setStatus('Ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not initialize the app.');
        setStatus('Initialization failed');
      }
    }
    bootstrap();
  }, []);

  const requestPayload: TTSRequest = {
    text,
    voice_id: selectedVoiceId,
    model_id: modelId,
    output_format: outputFormat,
    language_code: languageCode || undefined,
    voice_settings: settings
  };

  async function handleGenerate() {
    if (!text.trim()) return setError('Enter text before generating audio.');
    if (!selectedVoiceId) return setError('Select a voice first.');

    setLoading(true);
    setError('');
    setStreamBytes(0);
    setStatus(streamMode ? 'Streaming audio from ElevenLabs' : 'Generating audio');

    try {
      let url = '';
      let latencyMs = 0;
      let bytes = 0;

      if (streamMode) {
        const result = await streamSpeech(requestPayload, setStreamBytes);
        url = URL.createObjectURL(result.blob);
        latencyMs = result.latencyMs;
        bytes = result.bytes;
      } else {
        const result = await generateSpeech(requestPayload);
        const blob = base64ToBlob(result.audio_base64, 'audio/mpeg');
        url = URL.createObjectURL(blob);
        latencyMs = result.latency_ms;
        bytes = result.bytes;
      }

      setAudioUrl(url);
      const item: Generation = {
        id: crypto.randomUUID(),
        text,
        voiceName: selectedVoice?.name || 'Selected voice',
        modelId,
        latencyMs,
        characters: text.length,
        bytes,
        audioUrl: url,
        mode: streamMode ? 'stream' : 'standard',
        createdAt: new Date().toLocaleTimeString()
      };
      setActiveGeneration(item);
      setHistory((prev) => [item, ...prev].slice(0, 6));
      setStatus('Generation complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
      setStatus('Generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleCloneVoice() {
    if (!cloneName.trim()) return setCloneStatus('Add a name for the cloned voice.');
    if (!cloneFiles.length) return setCloneStatus('Upload at least one audio file.');

    setCloneStatus('Uploading sample to ElevenLabs voice cloning API...');
    try {
      const result = await cloneVoice(cloneName, cloneDescription, cloneFiles);
      setCloneStatus(`Voice clone created: ${result.name || cloneName} (${result.voice_id || 'voice id returned'})`);
      const refreshed = await fetchVoices();
      setVoices(refreshed);
    } catch (err) {
      setCloneStatus(err instanceof Error ? err.message : 'Voice cloning failed.');
    }
  }

  return (
    <main className="app-shell">
      <div className="background-orb orb-one" />
      <div className="background-orb orb-two" />

      <section className="hero">
        <div>
          <div className="eyebrow"><Sparkles size={16} /> ElevenLabs AI Voice Platform POC</div>
          <h1>EchoForge AI Voice Studio</h1>
          <p>
            A polished full-stack voice platform demo with secure FastAPI proxying, streaming playback,
            dynamic voice selection, multilingual synthesis, voice cloning, and API observability.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={handleGenerate} disabled={loading}>
              {loading ? <Loader2 className="spin" size={18} /> : <Wand2 size={18} />}
              {loading ? 'Generating...' : 'Generate Voice'}
            </button>
            <button className="secondary" onClick={() => setText(sampleTexts[(Math.floor(Math.random() * sampleTexts.length))])}>
              <RefreshCw size={17} /> Try sample
            </button>
          </div>
        </div>

        <div className="status-card glass">
          <div className="status-row"><CheckCircle2 size={18} /> Backend status: {status}</div>
          <div className="signal-bars"><span /><span /><span /><span /></div>
          <p>API key is stored only on the backend. Browser calls same-domain FastAPI routes.</p>
        </div>
      </section>

      <section className="grid-main">
        <div className="panel composer">
          <div className="panel-header">
            <div><h2>Script Composer</h2><p>Write a narration, product demo, support response, or multilingual sample.</p></div>
            <span className="pill">{text.length}/2500 chars</span>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2500} />
          {error && <div className="error"><AlertTriangle size={16} /> {error}</div>}
        </div>

        <aside className="panel controls">
          <div className="panel-header compact"><h2>Voice Controls</h2><Mic2 size={20} /></div>

          <label>Search voices</label>
          <input className="input" value={voiceQuery} onChange={(e) => setVoiceQuery(e.target.value)} placeholder="Rachel, Adam, narration..." />

          <label>Voice</label>
          <select value={selectedVoiceId} onChange={(e) => setSelectedVoiceId(e.target.value)}>
            {filteredVoices.map((voice) => <option key={voice.voice_id} value={voice.voice_id}>{voice.name} {voice.category ? `· ${voice.category}` : ''}</option>)}
          </select>

          <label>Model</label>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {models.map((model) => <option key={model.model_id} value={model.model_id}>{model.name || model.model_id}</option>)}
          </select>

          <div className="two-col">
            <div><label>Language</label><select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}>{languages.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}</select></div>
            <div><label>Format</label><select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>{outputFormats.map((format) => <option key={format}>{format}</option>)}</select></div>
          </div>

          <Slider label="Stability" value={settings.stability} hint="Higher = calmer, more consistent" onChange={(v) => setSettings({ ...settings, stability: v })} />
          <Slider label="Similarity Boost" value={settings.similarity_boost} hint="Higher = closer to selected voice" onChange={(v) => setSettings({ ...settings, similarity_boost: v })} />
          <Slider label="Style" value={settings.style} hint="Higher = more expressive" onChange={(v) => setSettings({ ...settings, style: v })} />

          <label className="toggle"><input type="checkbox" checked={settings.use_speaker_boost} onChange={(e) => setSettings({ ...settings, use_speaker_boost: e.target.checked })} /> Speaker boost</label>
          <label className="toggle"><input type="checkbox" checked={streamMode} onChange={(e) => setStreamMode(e.target.checked)} /> Streaming mode</label>
        </aside>
      </section>

      <section className="insights">
        <Metric icon={<Gauge />} label="Latency" value={activeGeneration ? `${activeGeneration.latencyMs} ms` : '-'} />
        <Metric icon={<Activity />} label="Audio size" value={activeGeneration ? formatBytes(activeGeneration.bytes) : streamBytes ? formatBytes(streamBytes) : '-'} />
        <Metric icon={<Globe2 />} label="Mode" value={streamMode ? 'Streaming' : 'Standard'} />
        <Metric icon={<Bot />} label="Model" value={modelId} />
      </section>

      <section className="grid-secondary">
        <div className="panel playback">
          <div className="panel-header"><div><h2>Live Playback</h2><p>Play or download the latest generated MP3.</p></div><Headphones size={22} /></div>
          {audioUrl ? (
            <div className="player-card">
              <div className="disc"><Waves size={34} /></div>
              <audio controls src={audioUrl} />
              <a className="download" href={audioUrl} download="echoforge-elevenlabs-output.mp3"><Download size={16} /> Download audio</a>
            </div>
          ) : <div className="empty-state">Generate a voice clip to see playback here.</div>}
        </div>

        <div className="panel clone">
          <div className="panel-header"><div><h2>Voice Cloning Lab</h2><p>Optional ElevenLabs voice clone endpoint for demo depth.</p></div><Upload size={22} /></div>
          <input className="input" placeholder="Clone voice name" value={cloneName} onChange={(e) => setCloneName(e.target.value)} />
          <input className="input" placeholder="Description" value={cloneDescription} onChange={(e) => setCloneDescription(e.target.value)} />
          <input className="file" type="file" accept="audio/*" multiple onChange={(e) => setCloneFiles(Array.from(e.target.files || []))} />
          <button className="secondary full" onClick={handleCloneVoice}>Create cloned voice</button>
          {cloneStatus && <p className="clone-status">{cloneStatus}</p>}
        </div>
      </section>

      <section className="panel history">
        <div className="panel-header"><div><h2>Generation History</h2><p>Session-level history with latency, model, voice, and replay controls.</p></div></div>
        <div className="history-list">
          {history.length === 0 ? <div className="empty-state">No generations yet.</div> : history.map((item) => (
            <article key={item.id} className="history-item">
              <div>
                <strong>{item.voiceName}</strong>
                <p>{item.text}</p>
                <span>{item.createdAt} · {item.mode} · {item.modelId} · {item.latencyMs} ms · {formatBytes(item.bytes)}</span>
              </div>
              <audio controls src={item.audioUrl} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Slider({ label, value, hint, onChange }: { label: string; value: number; hint: string; onChange: (value: number) => void }) {
  return <div className="slider"><div className="slider-top"><label>{label}</label><span>{value.toFixed(2)}</span></div><input type="range" min="0" max="1" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value))} /><small>{hint}</small></div>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="metric">{icon}<div><span>{label}</span><strong>{value}</strong></div></div>;
}
