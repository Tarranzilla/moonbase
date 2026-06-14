import * as Tone from 'tone';

class SFXEngine {
  private isInitialized = false;
  private pingSynth!: Tone.Synth;
  private clickSynth!: Tone.MembraneSynth;
  private chirpSynth!: Tone.FMSynth;
  private moveSynth!: Tone.FMSynth;
  private deployImpactSynth!: Tone.MembraneSynth;
  private deployNoiseSynth!: Tone.NoiseSynth;
  private placeSynth!: Tone.PolySynth;
  private completeSynth!: Tone.FMSynth;
  
  // A master volume node that we can toggle on/off
  private masterVol!: Tone.Volume;

  public initialize() {
    if (this.isInitialized) return;

    // Route SFX into a shared volume control, then to destination
    this.masterVol = new Tone.Volume(-10).toDestination();

    // 1. Radar Ping for Cell Selection
    this.pingSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 }
    }).connect(this.masterVol);

    // 2. UI Click for Buttons
    this.clickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 2,
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 }
    }).connect(this.masterVol);

    // 3. Double Chirp for Unit Selection
    this.chirpSynth = new Tone.FMSynth({
      harmonicity: 2,
      modulationIndex: 3,
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 },
      modulation: { type: 'triangle' },
      modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
    }).connect(this.masterVol);

    // 4. Protoss Probe Move Command (Metallic Warp Sweep)
    this.moveSynth = new Tone.FMSynth({
      harmonicity: 5.01,
      modulationIndex: 10,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.2 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 }
    }).connect(this.masterVol);

    // 5. Deploy Impact (Drop pod thud + pneumatic steam)
    this.deployImpactSynth = new Tone.MembraneSynth({
      pitchDecay: 0.1,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.5 }
    }).connect(this.masterVol);

    this.deployNoiseSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.05, decay: 0.5, sustain: 0, release: 0.5 }
    }).connect(this.masterVol);

    // 6. Placing Structure (Hollow blueprint layout sound)
    this.placeSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 }
    }).connect(this.masterVol);

    // 7. Structure Complete (Metallic chime/power-up)
    this.completeSynth = new Tone.FMSynth({
      harmonicity: 1.5,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.5, sustain: 0.5, release: 1 },
      modulation: { type: 'triangle' },
      modulationEnvelope: { attack: 0.1, decay: 0.4, sustain: 0, release: 0.1 }
    }).connect(this.masterVol);

    this.isInitialized = true;
  }

  public setEnabled(enabled: boolean) {
    if (this.masterVol) {
      this.masterVol.mute = !enabled;
    }
  }

  public playSelectCell() {
    if (!this.isInitialized) this.initialize();
    if (this.masterVol?.mute) return;
    if (Tone.context.state !== 'running') Tone.start();
    
    // High-pitched tech ping
    this.pingSynth.triggerAttackRelease('C6', '16n');
  }

  public playSelectEngineer() {
    if (!this.isInitialized) this.initialize();
    if (this.masterVol?.mute) return;
    if (Tone.context.state !== 'running') Tone.start();
    
    // Quick low double chirp
    const now = Tone.now();
    this.chirpSynth.triggerAttackRelease('E3', '32n', now);
    this.chirpSynth.triggerAttackRelease('A3', '32n', now + 0.1);
  }

  public playClick() {
    if (!this.isInitialized) this.initialize();
    if (this.masterVol?.mute) return;
    if (Tone.context.state !== 'running') Tone.start();
    
    // Deep, short mechanical click
    this.clickSynth.triggerAttackRelease('G2', '64n');
  }

  public playMoveCommand() {
    if (!this.isInitialized) this.initialize();
    if (this.masterVol?.mute) return;
    if (Tone.context.state !== 'running') Tone.start();
    
    // Metallic warping sweep, pitched down
    const now = Tone.now();
    this.moveSynth.triggerAttackRelease('C4', '8n', now);
    this.moveSynth.frequency.exponentialRampToValueAtTime('C1', now + 0.3);
  }

  public playDeployCommand() {
    if (!this.isInitialized) this.initialize();
    if (this.masterVol?.mute) return;
    if (Tone.context.state !== 'running') Tone.start();
    
    // Heavy drop pod impact
    const now = Tone.now();
    this.deployImpactSynth.triggerAttackRelease('C1', '8n', now);
    
    // Pneumatic steam release
    this.deployNoiseSynth.triggerAttackRelease('4n', now + 0.1);
  }

  public playPlaceStructure() {
    if (!this.isInitialized) this.initialize();
    if (this.masterVol?.mute) return;
    if (Tone.context.state !== 'running') Tone.start();
    
    // Blueprint placement blip
    const now = Tone.now();
    this.placeSynth.triggerAttackRelease(['C4', 'E4'], '16n', now);
  }

  public playStructureComplete() {
    if (!this.isInitialized) this.initialize();
    if (this.masterVol?.mute) return;
    if (Tone.context.state !== 'running') Tone.start();
    
    // Satisfying power-up chime
    const now = Tone.now();
    this.completeSynth.triggerAttackRelease('G4', '4n', now);
    this.completeSynth.triggerAttackRelease('C5', '2n', now + 0.1);
  }
}

export const sfxEngine = new SFXEngine();
