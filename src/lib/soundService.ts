class SoundService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1, delay: number = 0) {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);
      
      gain.gain.setValueAtTime(vol, this.ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + delay + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + duration);
    } catch (e) {
      console.error("Audio error", e);
    }
  }

  playClick() {
    this.playTone(600, 'sine', 0.1, 0.05);
  }

  playOpenPack() {
    this.playTone(440, 'sine', 0.1, 0.1, 0);
    this.playTone(554, 'sine', 0.1, 0.1, 0.1);
    this.playTone(659, 'sine', 0.1, 0.1, 0.2);
    this.playTone(880, 'sine', 0.4, 0.1, 0.3);
  }

  playVictory() {
    this.playTone(523.25, 'triangle', 0.2, 0.1, 0); // C5
    this.playTone(659.25, 'triangle', 0.2, 0.1, 0.2); // E5
    this.playTone(783.99, 'triangle', 0.2, 0.1, 0.4); // G5
    this.playTone(1046.50, 'triangle', 0.6, 0.15, 0.6); // C6
  }

  playDefeat() {
    this.playTone(392.00, 'sawtooth', 0.3, 0.1, 0); // G4
    this.playTone(369.99, 'sawtooth', 0.3, 0.1, 0.3); // Gb4
    this.playTone(349.23, 'sawtooth', 0.3, 0.1, 0.6); // F4
    this.playTone(329.63, 'sawtooth', 0.8, 0.15, 0.9); // E4
  }

  playUpgradeLevel() {
    this.playTone(587.33, 'sine', 0.1, 0.1, 0); // D5
    this.playTone(880.00, 'sine', 0.3, 0.1, 0.1); // A5
  }

  playUpgradeAscension() {
    this.playTone(261.63, 'square', 1.0, 0.05, 0); // C4
    this.playTone(392.00, 'square', 1.0, 0.05, 0); // G4
    this.playTone(523.25, 'square', 1.0, 0.05, 0); // C5
    this.playTone(659.25, 'square', 1.0, 0.05, 0); // E5
  }
}

export const sounds = new SoundService();
