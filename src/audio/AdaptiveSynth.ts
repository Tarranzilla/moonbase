import * as Tone from 'tone';

export type AudioMood = 'NONE' | 'SPACE' | 'JAZZ' | 'BREAKBEAT';

class AdaptiveSynth {
  private isInitialized = false;
  private currentMood: AudioMood = 'NONE';

  private kick!: Tone.MembraneSynth;
  private snare!: Tone.NoiseSynth;
  private hihat!: Tone.MetalSynth;
  private bass!: Tone.MonoSynth;
  private keys!: Tone.PolySynth;
  private pad!: Tone.PolySynth;
  private lead!: Tone.Synth;

  // Reverb and Effects
  private spaceReverb!: Tone.Freeverb;
  private standardReverb!: Tone.Freeverb;
  private masterLimiter!: Tone.Limiter;
  
  // Connection Profile
  private connectionEQ!: Tone.EQ3;
  private stereoWidener!: Tone.StereoWidener;

  // Em9 -> Cmaj7 -> Am9 -> Bm7
  private chordProgression = [
    ['E3', 'G3', 'B3', 'D4', 'F#4'], // Em9
    ['C3', 'E3', 'G3', 'B3', 'D4'],  // Cmaj7(9)
    ['A2', 'C3', 'E3', 'G3', 'B3'],  // Am9
    ['B2', 'D3', 'F#3', 'A3', 'C#4'] // Bm9
  ];
  
  private leadScale = ['E4', 'G4', 'A4', 'B4', 'D5', 'E5'];

  public async initialize() {
    if (this.isInitialized) return;
    await Tone.start();

    // Prevent digital clipping without raising the noise floor
    this.masterLimiter = new Tone.Limiter(-1).toDestination();

    // EQ and Spatialization for device profiles
    this.connectionEQ = new Tone.EQ3({ low: 0, mid: 0, high: 0 }); // Default Speakers
    this.stereoWidener = new Tone.StereoWidener(0.5); // Default Speakers

    this.stereoWidener.connect(this.masterLimiter);
    this.connectionEQ.connect(this.stereoWidener);

    // Use Freeverb (algorithmic) instead of Reverb (convolution) to prevent grainy "dots" noise
    this.spaceReverb = new Tone.Freeverb({ roomSize: 0.95, dampening: 2000 }).connect(this.connectionEQ);
    this.spaceReverb.wet.value = 0.8;
    
    this.standardReverb = new Tone.Freeverb({ roomSize: 0.6, dampening: 4000 }).connect(this.connectionEQ);
    this.standardReverb.wet.value = 0.2;

    // -- INSTRUMENTS --
    
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.4 }
    }).connect(this.connectionEQ);
    this.kick.volume.value = -60; // Start muted

    this.snare = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0 }
    }).connect(this.standardReverb);
    this.snare.volume.value = -60;

    this.hihat = new Tone.MetalSynth({
      envelope: { attack: 0.005, decay: 0.05, release: 0.01 },
      harmonicity: 3.1,
      modulationIndex: 16,
      resonance: 2000,
      octaves: 1.5
    }).connect(this.standardReverb);
    this.hihat.frequency.value = 200;
    this.hihat.volume.value = -60;

    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      filter: { Q: 0.5, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 0.5 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.5, baseFrequency: 60, octaves: 2 }
    }).connect(this.connectionEQ);
    this.bass.volume.value = -60;

    this.keys = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 0.5, sustain: 0.8, release: 2 }
    }).connect(this.standardReverb);
    this.keys.volume.value = -60;

    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 2, decay: 1, sustain: 1, release: 4 }
    }).connect(this.spaceReverb);
    this.pad.volume.value = -60;

    this.lead = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 1 }
    }).connect(this.spaceReverb);
    this.lead.volume.value = -60;

    // -- COMPOSITION (7/4 Time) --
    // 1 bar = 7 beats = 28 sixteenth notes.
    let tick = 0;
    
    Tone.Transport.scheduleRepeat((time) => {
      const beat = tick % 28; // 16th note position in the 7/4 measure
      const bar = Math.floor(tick / 28) % 4; // Which chord in the progression
      const isQuarterNote = beat % 4 === 0;
      const quarterBeat = beat / 4; // 0 to 6
      
      const mood = this.currentMood;

      // 1. CHORDS (Keys & Pad)
      if (beat === 0) {
         // Prevent infinite PolySynth voice stacking by releasing previous chords!
         this.pad.releaseAll(time);
         // Pad plays continuously on the 1 of every bar
         this.pad.triggerAttackRelease(this.chordProgression[bar], '1m', time);
         
         if (mood === 'SPACE') {
            this.keys.releaseAll(time);
            // Keys play long swells
            this.keys.set({ envelope: { attack: 2, release: 4 } });
            this.keys.triggerAttackRelease(this.chordProgression[bar], '2n', time);
         }
      }
      
      if (mood === 'JAZZ' || mood === 'BREAKBEAT') {
         this.keys.set({ envelope: { attack: 0.05, release: 1.5 } });
         // Syncopated jazzy stabs
         if (beat === 0 || beat === 14 /* "and" of beat 4 */) {
            this.keys.releaseAll(time);
            this.keys.triggerAttackRelease(this.chordProgression[bar], '4n', time);
         }
      }

      // 2. BASS
      const baseNote = this.chordProgression[bar][0].replace('3', '1').replace('2', '1');
      if (mood === 'SPACE') {
         if (beat === 0) this.bass.triggerAttackRelease(baseNote, '1m', time);
      } else if (mood === 'JAZZ') {
         // Walking / Syncopated
         if (isQuarterNote && quarterBeat % 2 === 0) {
            this.bass.triggerAttackRelease(baseNote, '4n', time);
         } else if (beat === 10 || beat === 22) {
            this.bass.triggerAttackRelease(baseNote, '8n', time);
         }
      } else if (mood === 'BREAKBEAT') {
         // Fast rolling 16ths
         if (beat % 2 === 0 || Math.random() > 0.6) {
            this.bass.triggerAttackRelease(baseNote, '16n', time);
         }
      }

      // 3. LEAD / MELODY
      if (mood === 'SPACE') {
         if (beat === 0 && Math.random() > 0.5) {
            const note = this.leadScale[Math.floor(Math.random() * this.leadScale.length)];
            this.lead.triggerAttackRelease(note, '2n', time);
         }
      } else if (mood === 'JAZZ') {
         if (isQuarterNote && Math.random() > 0.7) {
            const note = this.leadScale[Math.floor(Math.random() * this.leadScale.length)];
            this.lead.triggerAttackRelease(note, '8n', time);
         }
      } else if (mood === 'BREAKBEAT') {
         // Fast arps
         if (beat % 3 === 0) {
            const note = this.leadScale[Math.floor((tick / 3) % this.leadScale.length)];
            this.lead.triggerAttackRelease(note, '16n', time);
         }
      }

      // 4. DRUMS
      if (mood === 'JAZZ') {
         // Kick on 1 and 4
         if (beat === 0 || beat === 12) this.kick.triggerAttackRelease('E1', '8n', time);
         // Cross-stick Snare on 3 and 6
         if (beat === 8 || beat === 20) {
            this.snare.set({ envelope: { decay: 0.1 } });
            this.snare.triggerAttackRelease('16n', time, 0.5);
         }
         // Swung ride cymbal feel (Hihat)
         if (isQuarterNote || (beat % 4 === 2 && Math.random() > 0.3)) {
            this.hihat.triggerAttackRelease('32n', time, isQuarterNote ? 0.6 : 0.3);
         }
      } else if (mood === 'BREAKBEAT') {
         // Driving kick
         if (beat === 0 || beat === 10 || beat === 16) {
            this.kick.triggerAttackRelease('E1', '8n', time);
         }
         // Heavy snare on 3 and 6
         if (beat === 8 || beat === 20) {
            this.snare.set({ envelope: { decay: 0.25 } });
            this.snare.triggerAttackRelease('16n', time, 1);
         }
         // Fast breakbeat ghost snares
         if ((beat === 6 || beat === 14 || beat === 18) && Math.random() > 0.5) {
            this.snare.set({ envelope: { decay: 0.1 } });
            this.snare.triggerAttackRelease('32n', time, 0.3);
         }
         // Fast 16th hats
         if (beat % 2 === 0) {
            this.hihat.triggerAttackRelease('32n', time, 0.5);
         } else if (Math.random() > 0.4) {
            this.hihat.triggerAttackRelease('32n', time, 0.2);
         }
      }

      tick++;
    }, "16n");

    this.isInitialized = true;
    Tone.Transport.timeSignature = [7, 4];
  }

  public async setMood(mood: AudioMood) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
    }

    this.currentMood = mood;

    if (mood === 'NONE') {
      Tone.Transport.stop();
      this.pad.releaseAll();
      this.keys.releaseAll();
      return;
    }

    // If transport isn't running, start it
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }

    const fadeTime = 2; // Morph over 2 seconds

    if (mood === 'SPACE') {
      Tone.Transport.bpm.rampTo(55, fadeTime);
      this.pad.volume.rampTo(-30, fadeTime);
      this.keys.volume.rampTo(-35, fadeTime);
      this.bass.volume.rampTo(-26, fadeTime);
      this.lead.volume.rampTo(-38, fadeTime);
      // Mute drums
      this.kick.volume.rampTo(-60, fadeTime);
      this.snare.volume.rampTo(-60, fadeTime);
      this.hihat.volume.rampTo(-60, fadeTime);
      // Smooth out all oscillators to remove crisp/buzz sounds
      this.bass.set({ oscillator: { type: 'sine' }, filterEnvelope: { octaves: 1 } });
      this.keys.set({ oscillator: { type: 'sine' } });
      this.lead.set({ oscillator: { type: 'sine' } });
    } 
    else if (mood === 'JAZZ') {
      Tone.Transport.bpm.rampTo(105, fadeTime);
      this.pad.volume.rampTo(-45, fadeTime);
      this.keys.volume.rampTo(-32, fadeTime);
      this.bass.volume.rampTo(-28, fadeTime);
      this.lead.volume.rampTo(-35, fadeTime);
      // Jazz drums
      this.kick.volume.rampTo(-26, fadeTime);
      this.snare.volume.rampTo(-34, fadeTime);
      this.hihat.volume.rampTo(-40, fadeTime);
      // Restore harmonic oscillators
      this.bass.set({ oscillator: { type: 'triangle' }, filterEnvelope: { octaves: 2 } });
      this.keys.set({ oscillator: { type: 'triangle' } });
      this.lead.set({ oscillator: { type: 'triangle' } });
    }
    else if (mood === 'BREAKBEAT') {
      Tone.Transport.bpm.rampTo(160, fadeTime);
      this.pad.volume.rampTo(-40, fadeTime);
      this.keys.volume.rampTo(-30, fadeTime);
      this.bass.volume.rampTo(-24, fadeTime);
      this.lead.volume.rampTo(-32, fadeTime);
      // Heavy drums
      this.kick.volume.rampTo(-22, fadeTime);
      this.snare.volume.rampTo(-28, fadeTime);
      this.hihat.volume.rampTo(-36, fadeTime);
      // Gritty bass
      this.bass.set({ oscillator: { type: 'sawtooth' }, filterEnvelope: { octaves: 3 } });
      this.keys.set({ oscillator: { type: 'triangle' } });
      this.lead.set({ oscillator: { type: 'triangle' } });
    }
  }

  public getMood() {
    return this.currentMood;
  }

  public async setConnectionType(type: 'SPEAKERS' | 'HEADPHONES') {
    if (!this.isInitialized) await this.initialize();
    
    if (type === 'HEADPHONES') {
      // Flatter EQ, slight crossfeed (width reduction towards mono) to reduce fatigue
      this.connectionEQ.set({ low: 0, mid: 0, high: -1 });
      this.stereoWidener.width.rampTo(0.2, 0.5);
    } else {
      // Speakers: Flat EQ, widen stereo image
      this.connectionEQ.set({ low: 0, mid: 0, high: 0 });
      this.stereoWidener.width.rampTo(0.8, 0.5);
    }
  }

  public async setAudioDevice(deviceId: string) {
    if (!this.isInitialized) await this.initialize();
    
    const rawContext = Tone.getContext().rawContext as any;
    if (typeof rawContext.setSinkId === 'function') {
      try {
        await rawContext.setSinkId(deviceId);
        console.log(`Successfully routed audio to device: ${deviceId}`);
      } catch (err) {
        console.warn('Failed to set audio sink ID:', err);
      }
    } else {
      console.warn('setSinkId is not supported in this browser.');
    }
  }
}

export const adaptiveSynth = new AdaptiveSynth();
