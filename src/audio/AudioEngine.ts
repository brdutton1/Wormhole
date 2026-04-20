import * as Tone from 'tone'

// Generative audio engine tied to camera proximity. Built around a 40 Hz
// drone that pitches up near the throat, a reverb that opens inside the
// tunnel, and a high-frequency shimmer that rides on accretion proximity.

class AudioEngineImpl {
  private started = false
  private drone?: Tone.Oscillator
  private shimmer?: Tone.Oscillator
  private shimmerLFO?: Tone.LFO
  private pitchShift?: Tone.PitchShift
  private reverb?: Tone.Reverb
  private droneGain?: Tone.Gain
  private shimmerGain?: Tone.Gain
  private masterGain?: Tone.Gain

  async init(): Promise<void> {
    if (this.started) return
    await Tone.start()

    this.masterGain = new Tone.Gain(0.6).toDestination()
    this.reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).connect(this.masterGain)

    this.pitchShift = new Tone.PitchShift(0).connect(this.reverb)
    this.droneGain = new Tone.Gain(0.5).connect(this.pitchShift)
    this.drone = new Tone.Oscillator(40, 'sawtooth').connect(this.droneGain)
    this.drone.start()

    this.shimmerGain = new Tone.Gain(0).connect(this.reverb)
    this.shimmer = new Tone.Oscillator(1800, 'sine').connect(this.shimmerGain)
    this.shimmerLFO = new Tone.LFO({
      frequency: 0.25,
      min: 1600,
      max: 2100,
    }).connect(this.shimmer.frequency)
    this.shimmer.start()
    this.shimmerLFO.start()

    this.started = true
  }

  // `normalizedDist`: 1.0 = far from throat, 0.0 = at throat.
  setProximity(normalizedDist: number): void {
    if (!this.started) return
    const n = Math.max(0, Math.min(1, normalizedDist))

    // Pitch shift: up to +18 semitones as we close in.
    const semis = (1 - n) * 18
    this.pitchShift!.pitch = semis

    // Reverb wet: 0.2 far, 0.9 near.
    this.reverb!.wet.rampTo(0.2 + (1 - n) * 0.7, 0.1)

    // Shimmer: only audible near the disk — we approximate that as the
    // middle band of proximity (near the disk orbit, not deep inside).
    const shimmerAmt = Math.max(0, 1 - Math.abs(n - 0.35) * 3) * 0.15
    this.shimmerGain!.gain.rampTo(shimmerAmt, 0.15)
  }

  dispose(): void {
    if (!this.started) return
    this.drone?.stop()
    this.shimmer?.stop()
    this.shimmerLFO?.stop()
    this.drone?.dispose()
    this.shimmer?.dispose()
    this.shimmerLFO?.dispose()
    this.pitchShift?.dispose()
    this.droneGain?.dispose()
    this.shimmerGain?.dispose()
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
