/**
 * Integration feature flags and provider registry.
 *
 * Each integration can be enabled/disabled via environment variables.
 * Providers are lazily instantiated on first access.
 */

import type {
  VoiceSynthesisProvider,
  MemoryProvider,
  MeetingRecordingProvider,
} from "./types";

// ---------------------------------------------------------------------------
// Feature flags (server-side, read from env)
// ---------------------------------------------------------------------------

export const integrations = {
  voiceSynthesis: {
    enabled: !!process.env.FISH_AUDIO_API_KEY,
    provider: "fish-audio" as const,
  },
  memory: {
    enabled: !!process.env.MEM9_SPACE_ID || !!process.env.MEM9_ENABLED,
    provider: "mem9" as const,
  },
  meetingRecording: {
    enabled: false,
    provider: null as string | null,
  },
} as const;

// ---------------------------------------------------------------------------
// Provider registry (lazy singletons)
// ---------------------------------------------------------------------------

let _voiceSynthesis: VoiceSynthesisProvider | null = null;
let _memory: MemoryProvider | null = null;
let _meetingRecording: MeetingRecordingProvider | null = null;

export async function getVoiceSynthesis(): Promise<VoiceSynthesisProvider | null> {
  if (!integrations.voiceSynthesis.enabled) return null;
  if (!_voiceSynthesis) {
    const { FishAudioProvider } = await import("./fish-audio");
    _voiceSynthesis = new FishAudioProvider();
  }
  return _voiceSynthesis;
}

export async function getMemory(): Promise<MemoryProvider | null> {
  if (!integrations.memory.enabled) return null;
  if (!_memory) {
    const { Mem9Provider } = await import("./mem9");
    _memory = new Mem9Provider();
  }
  return _memory;
}

export async function getMeetingRecording(): Promise<MeetingRecordingProvider | null> {
  if (!integrations.meetingRecording.enabled) return null;
  if (!_meetingRecording) {
    // Future: dynamically import the configured meeting recording provider
    return null;
  }
  return _meetingRecording;
}
