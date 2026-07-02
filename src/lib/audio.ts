function createAudioContext() {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  audioCtx: AudioContext,
  startTime: number,
  frequency: number,
  duration: number,
  options?: { type?: OscillatorType; volume?: number },
) {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  const volume = options?.volume ?? 0.5;

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.type = options?.type ?? "square";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gainNode.gain.setValueAtTime(volume, startTime + duration - 0.03);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.01);
}

/** Idle reminder — short double digital beep. */
export function playBeep() {
  try {
    const audioCtx = createAudioContext();
    const t = audioCtx.currentTime;
    playTone(audioCtx, t, 880, 0.12);
    playTone(audioCtx, t + 0.2, 880, 0.12);
  } catch (e) {
    console.error("Audio beep failed:", e);
  }
}

/** CEO / manager call — urgent ascending ring, clearly different from idle beep. */
export function playCeoCallBeep() {
  try {
    const audioCtx = createAudioContext();
    const t = audioCtx.currentTime;
    const ring = [
      { at: 0, freq: 587, dur: 0.16 },
      { at: 0.18, freq: 740, dur: 0.16 },
      { at: 0.36, freq: 880, dur: 0.22 },
      { at: 0.64, freq: 880, dur: 0.22 },
      { at: 0.92, freq: 740, dur: 0.16 },
      { at: 1.1, freq: 587, dur: 0.3 },
    ];

    for (const note of ring) {
      playTone(audioCtx, t + note.at, note.freq, note.dur, {
        type: "triangle",
        volume: 0.65,
      });
    }
  } catch (e) {
    console.error("CEO call beep failed:", e);
  }
}

export function playNotificationBeep(type?: string) {
  if (type === "call") playCeoCallBeep();
}
