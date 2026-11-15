/** Transport clock: "0:42". */
export function formatClock(value: number): string {
  const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Summary length: "0.7 s" under a minute, "3:38" from one minute up. */
export function formatLength(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "unknown length";
  return seconds < 60 ? `${seconds.toFixed(1)} s` : formatClock(seconds);
}

/** "48 kHz", "44.1 kHz". */
export function formatRate(sampleRate: number): string {
  return `${Number((sampleRate / 1000).toFixed(3))} kHz`;
}

export function formatChannels(channels: number): string {
  return channels === 1 ? "mono" : channels === 2 ? "stereo" : `${channels} channels`;
}
