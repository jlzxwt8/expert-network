"use client";

import { Mic, MicOff } from "lucide-react";
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
 * A mic button that uses the Web Speech API for browser-native dictation.
 *
 * Future: When Typeless (https://www.typeless.com/) ships a web SDK,
 * this component can delegate to it for higher-quality dictation with
 * filler removal, auto-formatting, and personalized tone. The component
 * API remains unchanged for consumers.
 */
export function VoiceInputButton({
  onTranscript,
  language = "en-US",
  className,
  size = "icon",
}: VoiceInputButtonProps) {
  const {
    isListening,
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

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size={size}
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
      title={isListening ? "Stop dictation" : "Start voice input"}
    >
      {isListening ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
