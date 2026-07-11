// Client-side Web Audio API Sound Synthesizer
export function playPokerSound(type: 'correct' | 'incorrect' | 'click' | 'victory', isMuted: boolean, volumeArg?: number) {
  if (isMuted) return;
  try {
    let volume = 0.5;
    if (volumeArg !== undefined) {
      volume = volumeArg;
    } else {
      try {
        const savedVol = localStorage.getItem('poker_training_volume');
        if (savedVol) volume = Number(savedVol);
      } catch {}
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.06 * volume * 2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'correct') {
      const playChip = (delay: number, pitch: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, ctx.currentTime + delay);
        osc.frequency.exponentialRampToValueAtTime(pitch * 1.4, ctx.currentTime + delay + 0.06);
        gain.gain.setValueAtTime(0.05 * volume * 2, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.08);
      };
      playChip(0, 950);
      playChip(0.04, 1200);
      playChip(0.08, 1500);
    } else if (type === 'incorrect') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.05 * volume * 2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else if (type === 'victory') {
      const playTone = (delay: number, pitch: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.04 * volume * 2, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };
      playTone(0, 523.25, 0.15); // C5
      playTone(0.12, 659.25, 0.15); // E5
      playTone(0.24, 783.99, 0.15); // G5
      playTone(0.36, 1046.50, 0.3); // C6
    }
  } catch (err) {
    console.warn('Audio failed to play', err);
  }
}
