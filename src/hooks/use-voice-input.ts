"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser-native voice input hook using the Web Speech API.
 *
 * Architecture note: This uses SpeechRecognition as the default provider.
 * When Typeless (https://www.typeless.com/) releases a web SDK, this hook
 * can be extended to delegate to it — the consumer API stays the same.
 *
 * Typeless advantages over raw Web Speech API:
 *   - Filler word removal ("um", "uh")
 *   - Auto-correction when speaker changes their mind mid-sentence
 *   - Auto-formatting (lists, structure)
 *   - Personalized style/tone per app context
 *   - 100+ languages with seamless mixing
 *
 * For now, Web Speech API provides a working baseline that's available in
 * modern browsers (Chrome, Edge, Safari) with no external dependency.
 */

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

interface UseVoiceInputOptions {
  language?: string;
  continuous?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceInput(
  options: UseVoiceInputOptions = {}
): UseVoiceInputReturn {
  const { language = "en-US", continuous = true, onTranscript } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    if (!isSupported) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition: SpeechRecognitionInstance = new Ctor();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript((prev) => {
          const updated = prev + final;
          onTranscriptRef.current?.(updated, true);
          return updated;
        });
      } else if (interim) {
        onTranscriptRef.current?.(interim, false);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, continuous, language]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  };
}
