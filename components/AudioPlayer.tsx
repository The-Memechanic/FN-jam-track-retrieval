"use client";

import { useEffect, useRef, useState } from "react";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ previewUrl }: { previewUrl: string | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!previewUrl) return;

    const audio = new Audio(previewUrl);
    audioRef.current = audio;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [previewUrl]);

  if (!previewUrl) {
    return (
      <span className="self-start rounded-lg bg-bg-light px-4 py-2 text-sm font-medium text-text-muted">
        No preview available
      </span>
    );
  }

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const playIcon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M8 5v14l11-7z" />
    </svg>
  );

  const pauseIcon = (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </svg>
  );

  const downloadIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

  const buttonStyles =
    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-bg-dark transition hover:bg-highlight";

  return (
    <div className="flex w-full items-center gap-3 rounded-lg bg-bg px-3 py-2 border border-border-muted">
      <button
        onClick={togglePlay}
        aria-label={playing ? "Pause preview" : "Play preview"}
        className={buttonStyles}
      >
        {playing ? pauseIcon : playIcon}
      </button>

      <div className="flex flex-1 items-center gap-2">
        <span className="w-9 flex-shrink-0 text-right text-xs tabular-nums text-text-muted">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="h-1.5 w-full flex-1 cursor-pointer accent-primary"
        />
        <span className="w-9 flex-shrink-0 text-xs tabular-nums text-text-muted">
          {formatTime(duration)}
        </span>
      </div>

      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download preview"
        className={buttonStyles}
      >
        {downloadIcon}
      </a>
    </div>
  );
}