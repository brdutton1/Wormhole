import * as Tone from 'tone'

// Generative audio engine tied to camera proximity.
//
// Layers:
//   * 40 Hz sawtooth drone → pitch shift → reverb (main voice).
//   * 22 Hz sine sub-bass → dedicated gain (parallel to drone, dry).
//   * Pink-noise "infall roar" → LFO-swept lowpass → reverb (swells near throat).
//   * 1800 Hz sine shimmer with slow LFO → reverb (accretion-proximity band).

class AudioEngineImpl {
  private started = false
  private drone?: Tone.Oscillator
  private subBass?: Tone.Oscillator
  private shimmer?: Tone.Oscillator
  private shimmerLFO?: Tone.LFO
  private roarNoise?: Tone.Noise
  private roarFilter?: Tone.Filter
  private roarLFO?: Tone.LFO
  private pitchShift?: Tone.PitchShift
  private reverb?: Tone.Reverb
  private droneGain?: Tone.Gain
  private shimmerGain?: Tone.Gain
  private subBassGain?: Tone.Gain
  private roarGain?: Tone.Gain
  private masterGain?: Tone.Gain

  async init(): Promise<void> {
    if (this.started) return
    await Tone.start()

    this.masterGain = new Tone.Gain(0.6).toDestination()
    this.reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).connect(this.masterGain)

    // Drone → pitch → reverb.
    this.pitchShift = new Tone.PitchShift(0).connect(this.reverb)
    this.droneGain = new Tone.Gain(0.5).connect(this.pitchShift)
    this.drone = new Tone.Oscillator(40, 'sawtooth').connect(this.droneGain)
    this.drone.start()

    // Sub-bass → dry to master (no reverb for punch).
    this.subBassGain = new Tone.Gain(0).connect(this.masterGain)
    this.subBass = new Tone.Oscillator(22, 'sine').connect(this.subBassGain)
    this.subBass.start()

    // Infall roar: pink noise → lowpass → reverb.
    this.roarGain = new Tone.Gain(0).connect(this.reverb)
    this.roarFilter = new Tone.Filter({ type: 'lowpass', frequency: 200, Q: 2 }).connect(this.roarGain)
    this.roarNoise = new Tone.Noise('pink').connect(this.roarFilter)
    this.roarNoise.start()
    this.roarLFO = new Tone.LFO({ frequency: 0.12, min: 80, max: 600 }).connect(this.roarFilter.frequency)
    this.roarLFO.start()

    // Shimmer.
    this.shimmerGain = new Tone.Gain(0).connect(this.reverb)
    this.shimmer = new Tone.Oscillator(1800, 'sine').connect(this.shimmerGain)
    this.shimmerLFO = new Tone.LFO({ frequency: 0.25, min: 1600, max: 2100 }).connect(this.shimmer.frequency)
    this.shimmer.start()
    this.shimmerLFO.start()

    this.started = true
  }

  // `normalizedDist`: 1.0 = far from throat, 0.0 = at throat.
  setProximity(normalizedDist: number): void {
    if (!this.started) return
    const n = Math.max(0, Math.min(1, normalizedDist))

    // Pitch shift: up to +18 semitones as we close in.
    this.pitchShift!.pitch = (1 - n) * 18

    // Reverb wet: 0.2 far, 0.9 near.
    this.reverb!.wet.rampTo(0.2 + (1 - n) * 0.7, 0.1)

    // Sub-bass: inaudible far, assertive near.
    this.subBassGain!.gain.rampTo((1 - n) * 0.4, 0.2)

    // Roar: only within the inner 60% of proximity, peaks inside throat.
    const roarRamp = Math.max(0, (0.6 - n) / 0.6)
    this.roarGain!.gain.rampTo(roarRamp * 0.6, 0.2)

    // Shimmer: narrow band around n ≈ 0.35 (disk orbit distance).
    const shimmerAmt = Math.max(0, 1 - Math.abs(n - 0.35) * 3) * 0.15
    this.shimmerGain!.gain.rampTo(shimmerAmt, 0.15)
  }

  dispose(): void {
    if (!this.started) return
    this.drone?.stop()
    this.subBass?.stop()
    this.shimmer?.stop()
    this.shimmerLFO?.stop()
    this.roarNoise?.stop()
    this.roarLFO?.stop()
    this.drone?.dispose()
    this.subBass?.dispose()
    this.shimmer?.dispose()
    this.shimmerLFO?.dispose()
    this.roarNoise?.dispose()
    this.roarFilter?.dispose()
    this.roarLFO?.dispose()
    this.pitchShift?.dispose()
    this.droneGain?.dispose()
    this.subBassGain?.dispose()
    this.shimmerGain?.dispose()
    this.roarGain?.dispose()
    this.reverb?.dispose()
    this.masterGain?.dispose()
    this.started = false
  }

  isStarted(): boolean {
    return this.started
  }
}

export const AudioEngine = new AudioEngineImpl()
export type { AudioEngineImpl }
