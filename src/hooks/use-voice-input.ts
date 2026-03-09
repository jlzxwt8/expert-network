"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice input hook using MediaRecorder + server-side Qwen3-ASR-Flash.
 *
 * Flow:
 *   1. User clicks "start" → MediaRecorder begins capturing audio
 *   2. User clicks "stop"  → recording sent to /api/speech-to-text
 *   3. Server calls Qwen3-ASR-Flash and returns the transcript
 *   4. onTranscript callback fires with the final text
 *
 * This replaces the previous Web Speech API implementation, giving:
 *   - Consistent cross-browser support (MediaRecorder works everywhere)
 *   - Higher accuracy (Qwen3-ASR vs browser-native SR)
 *   - 100+ language support with code-switching
 *   - All usage under the same DashScope API key
 */

interface UseVoiceInputOptions {
  language?: string;
  continuous?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceInput(
  options: UseVoiceInputOptions = {}
): UseVoiceInputReturn {
  const { onTranscript } = options;
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const isSupported =
    typeof window !== "undefined" && typeof MediaRecorder !== "undefined";

  const startListening = useCallback(async () => {
    if (!isSupported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 500) {
          setIsProcessing(false);
          return;
        }

        setIsProcessing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const res = await fetch("/api/speech-to-text", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const { text } = await res.json();
            if (text) {
              setTranscript((prev) => {
                const updated = prev ? `${prev} ${text}` : text;
                onTranscriptRef.current?.(updated, true);
                return updated;
              });
            }
          } else {
            console.error("ASR failed:", res.status);
          }
        } catch (err) {
          console.error("ASR request error:", err);
        } finally {
          setIsProcessing(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start(1000);
      setIsListening(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  }, []);

  return {
    isListening,
    isProcessing,
    isSupported,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  };
}
