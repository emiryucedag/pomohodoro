export class NoiseSynthesizer {
    constructor() {
        this.ctx = null;
        this.source = null;
        this.gainNode = null;
        this.isPlaying = false;
    }

    play(volume = 0.5) {
        if (this.isPlaying) return;

        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        if (this.source) {
            this.source.stop();
            this.source.disconnect();
        }

        // We only generate Focus Noise (Brown noise equivalent)
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        let lastOut = 0;

        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            const out = (lastOut + (0.02 * white)) / 1.02;
            lastOut = out;
            data[i] = out * 0.3; // Boost base amplitude slightly
        }

        this.source = this.ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.loop = true;

        // Lowpass filter for deep focus rumble
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        // Gain node for volume control
        if (!this.gainNode) {
            this.gainNode = this.ctx.createGain();
        }
        this.gainNode.gain.value = volume;

        this.source.connect(filter);
        filter.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);

        this.source.start();
        this.isPlaying = true;
    }

    setVolume(volume) {
        if (this.gainNode) {
            // smoothly transition volume to prevent pops
            this.gainNode.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
        }
    }

    stop() {
        if (this.source) {
            this.source.stop();
            this.source.disconnect();
            this.source = null;
        }
        this.isPlaying = false;
    }
}

export class NotificationSynth {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playBeep(frequency = 880, duration = 0.1, volume = 0.3) {
        this.init();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
}

export const synth = new NoiseSynthesizer();
export const notifications = new NotificationSynth();
