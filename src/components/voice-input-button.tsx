"use client";

import { Mic, MicOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  language?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

/**
 * Mic button that records audio and transcribes it via Qwen3-ASR-Flash.
 *
 * States: idle → recording (pulse) → processing (spinner) → idle
 */
export function VoiceInputButton({
  onTranscript,
  language = "en-US",
  className,
  size = "icon",
}: VoiceInputButtonProps) {
  const {
    isListening,
    isProcessing,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    language,
    continuous: false,
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        onTranscript(text);
        resetTranscript();
      }
    },
  });

  if (!isSupported) return null;

  const busy = isListening || isProcessing;

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size={size}
      disabled={isProcessing}
      className={cn(
        "shrink-0 transition-all",
        isListening && "animate-pulse",
        className
      )}
      onClick={() => {
        if (isListening) {
          stopListening();
        } else {
          startListening();
        }
      }}
      title={
        isProcessing
          ? "Transcribing…"
          : isListening
            ? "Stop recording"
            : "Start voice input"
      }
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : busy ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
