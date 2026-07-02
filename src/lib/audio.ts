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

/** Two frequencies together — classic telephone dual-tone. */
function playDualPhoneRing(
  audioCtx: AudioContext,
  startTime: number,
  duration: number,
  f1: number,
  f2: number,
  volume = 0.55,
) {
  for (const freq of [f1, f2]) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume * 0.45, startTime + 0.025);
    gain.gain.setValueAtTime(volume * 0.45, startTime + duration - 0.04);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }
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

const CALL_ALERT_FILES = [
  "/sounds/digitalstore07-new-message-alert-430414.mp3",
  "/sounds/digitalstore07-new-message-alert-430414.wav",
  "/sounds/digitalstore07-new-message-alert-430414.ogg",
];

function playFallbackCeoCallBeep() {
  const audioCtx = createAudioContext();
  const t = audioCtx.currentTime;

  const ringBurst = (offset: number) => {
    playDualPhoneRing(audioCtx, t + offset, 0.55, 440, 480, 0.75);
    playDualPhoneRing(audioCtx, t + offset + 0.62, 0.5, 520, 660, 0.7);
    playDualPhoneRing(audioCtx, t + offset + 1.18, 0.55, 440, 480, 0.75);
    playDualPhoneRing(audioCtx, t + offset + 1.8, 0.5, 520, 660, 0.7);
  };

  ringBurst(0);
  ringBurst(2.55);
}

async function playCallAlertFile(): Promise<boolean> {
  for (const src of CALL_ALERT_FILES) {
    try {
      const audio = new Audio(src);
      audio.volume = 1;
      await audio.play();
      return true;
    } catch {
      /* try next extension */
    }
  }
  return false;
}

/** CEO call — plays custom alert from public/sounds if present. */
export function playCeoCallBeep() {
  void playCallAlertFile().catch(() => {
    try {
      playFallbackCeoCallBeep();
    } catch (e) {
      console.error("CEO call beep failed:", e);
    }
  });
}

export function playNotificationBeep(type?: string) {
  if (type === "call") playCeoCallBeep();
}
