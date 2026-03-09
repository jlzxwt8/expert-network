"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  /** Minimum recommended recording length in seconds */
  minSeconds?: number;
  /** Maximum recording length in seconds */
  maxSeconds?: number;
  className?: string;
  disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "recorded";

export function VoiceRecorder({
  onRecordingComplete,
  minSeconds = 10,
  maxSeconds = 60,
  className,
  disabled = false,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
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

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("recorded");
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setState("recording");
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= maxSeconds) {
            recorder.stop();
            if (timerRef.current) clearInterval(timerRef.current);
          }
          return next;
        });
      }, 1000);
    } catch {
      setState("idle");
    }
  }, [maxSeconds]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    setElapsed(0);
    setState("idle");
    setIsPlaying(false);
  }, [audioUrl]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  const confirmRecording = useCallback(() => {
    if (blobRef.current) onRecordingComplete(blobRef.current);
  }, [onRecordingComplete]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const isShort = state === "recorded" && elapsed < minSeconds;

  return (
    <div className={cn("space-y-3", className)}>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Recording / playback controls */}
      <div className="flex items-center justify-center gap-3">
        {state === "idle" && (
          <Button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 text-white"
          >
            <Mic className="h-6 w-6" />
          </Button>
        )}

        {state === "recording" && (
          <Button
            type="button"
            onClick={stopRecording}
            className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white animate-pulse"
          >
            <Square className="h-5 w-5" />
          </Button>
        )}

        {state === "recorded" && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={resetRecording}
              className="h-10 w-10 rounded-full"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={togglePlayback}
              className="h-14 w-14 rounded-full"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
          </>
        )}
      </div>

      {/* Timer */}
      <p className="text-center text-sm tabular-nums text-muted-foreground">
        {state === "recording" && (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-2 animate-pulse" />
            Recording {formatTime(elapsed)}
            {elapsed < minSeconds && (
              <span className="block text-xs mt-0.5">
                Keep going — aim for at least {minSeconds}s
              </span>
            )}
          </>
        )}
        {state === "recorded" && (
          <>
            {formatTime(elapsed)} recorded
            {isShort && (
              <span className="block text-xs text-amber-600 mt-0.5">
                Short recording — {minSeconds}s+ recommended for best quality
              </span>
            )}
          </>
        )}
        {state === "idle" && "Tap the mic to start recording your voice"}
      </p>

      {/* Confirm button */}
      {state === "recorded" && (
        <Button
          type="button"
          onClick={confirmRecording}
          disabled={disabled}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
        >
          {disabled ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Use This Recording"
          )}
        </Button>
      )}
    </div>
  );
}
