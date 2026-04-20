import { useCallback, useEffect, useRef } from 'react'
import { useControls, folder } from 'leva'
import WormholeScene from './components/WormholeScene'
import { AudioEngine } from './audio/AudioEngine'

export default function App() {
  // Primary controls — these five are the CLAUDE.md-defined leva surface.
  // The "Tuning" folder exposes the rest of the shader uniforms.
  const [values, set] = useControls(() => ({
    throatRadius: { value: 1.0, min: 0.3, max: 3.0, step: 0.01 },
    lensingStrength: { value: 1.0, min: 0.0, max: 3.0, step: 0.01 },
    accretionSpeed: { value: 1.0, min: 0.0, max: 4.0, step: 0.01 },
    audioEnabled: { value: false },
    traversalMode: { value: false },
    Tuning: folder(
      {
        starDensity: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
        bloomIntensity: { value: 1.5, min: 0.0, max: 4.0, step: 0.01 },
        chromaticOffset: { value: 0.0015, min: 0.0, max: 0.01, step: 0.0001 },
      },
      { collapsed: true },
    ),
  }))

  // Audio: init on first enable, dispose on disable.
  useEffect(() => {
    let mounted = true
    if (values.audioEnabled) {
      AudioEngine.init().catch((err) => {
        console.warn('Audio init failed:', err)
      })
    } else if (AudioEngine.isStarted()) {
      AudioEngine.dispose()
    }
    return () => {
      mounted = false
      void mounted
    }
  }, [values.audioEnabled])

  // Clean up on unmount.
  useEffect(() => () => AudioEngine.dispose(), [])

  // Proximity callback — throttle to avoid spamming Tone.js every frame.
  const lastProximityAt = useRef(0)
  const onProximity = useCallback((norm: number) => {
    const now = performance.now()
    if (now - lastProximityAt.current < 50) return
    lastProximityAt.current = now
    if (AudioEngine.isStarted()) AudioEngine.setProximity(norm)
  }, [])

  // When traversal completes, flip the toggle back off.
  const onTraversalEnd = useCallback(() => {
    set({ traversalMode: false })
  }, [set])

  return (
    <WormholeScene
      throatRadius={values.throatRadius}
      lensingStrength={values.lensingStrength}
      accretionSpeed={values.accretionSpeed}
      traversalMode={values.traversalMode}
      bloomIntensity={values.bloomIntensity}
      chromaticOffset={values.chromaticOffset}
      starDensity={values.starDensity}
      onProximity={onProximity}
      onTraversalEnd={onTraversalEnd}
    />
  )
}
