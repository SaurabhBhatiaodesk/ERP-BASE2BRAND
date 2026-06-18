export function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Some browsers require resuming the context
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // High pitch digital watch beep
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    
    // Beep 1
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.02);
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.12);

    // Beep 2
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.2);
    gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.22);
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime + 0.3);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.32);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.error("Audio beep failed:", e);
  }
}
