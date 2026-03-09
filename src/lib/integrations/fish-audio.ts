import type {
  VoiceSynthesisProvider,
  VoiceSynthesisInput,
  VoiceSynthesisResult,
} from "./types";

const API_BASE = "https://api.fish.audio";
const DEFAULT_MODEL = "s1";

/**
 * Fish Audio TTS provider.
 *
 * Env vars:
 *   FISH_AUDIO_API_KEY   — Bearer token for the Fish Audio API
 *   FISH_AUDIO_VOICE_ID  — Default reference voice model ID (optional)
 */
export class FishAudioProvider implements VoiceSynthesisProvider {
  private apiKey: string;
  private defaultVoiceId: string | undefined;

  constructor() {
    const key = process.env.FISH_AUDIO_API_KEY;
    if (!key) throw new Error("FISH_AUDIO_API_KEY is not set");
    this.apiKey = key;
    this.defaultVoiceId = process.env.FISH_AUDIO_VOICE_ID || undefined;
  }

  async synthesize(input: VoiceSynthesisInput): Promise<VoiceSynthesisResult> {
    const voiceId = input.voiceId ?? this.defaultVoiceId;
    const format = input.format ?? "mp3";

    const body: Record<string, unknown> = {
      text: input.text,
      format,
      reference_id: voiceId || undefined,
      prosody: input.speed ? { speed: input.speed, volume: 0 } : undefined,
      latency: "normal",
      mp3_bitrate: 128,
    };

    const res = await fetch(`${API_BASE}/v1/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        model: DEFAULT_MODEL,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Fish Audio TTS failed (${res.status}): ${errText.slice(0, 200)}`
      );
    }

    const arrayBuf = await res.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuf).toString("base64");

    return { audioBase64, format };
  }
}
