import { useCallback, useEffect, useRef, useState } from 'react'
import { useControls, folder } from 'leva'
import WormholeScene from './components/WormholeScene'
import ExplorerHUD, { type Phase } from './components/ExplorerHUD'
import { AudioEngine } from './audio/AudioEngine'

const TRAVERSAL_MS = 6100

export default function App() {
  // Phase state drives the narrative. The leva `traversalMode` is kept
  // as a debug override so we can still force the traversal shader/camera.
  const [phase, setPhase] = useState<Phase>('approach')
  const [hudDismissed, setHudDismissed] = useState(false)
  const [proximity, setProximity] = useState(1)

  const [values, set] = useControls(() => ({
    throatRadius: { value: 1.0, min: 0.3, max: 3.0, step: 0.01 },
    lensingStrength: { value: 0.65, min: 0.0, max: 3.0, step: 0.01 },
    accretionSpeed: { value: 1.0, min: 0.0, max: 4.0, step: 0.01 },
    audioEnabled: { value: false },
    traversalMode: { value: false },
    Tuning: folder(
      {
        starDensity: { value: 0.6, min: 0.0, max: 1.0, step: 0.01 },
        photonRingIntensity: { value: 1.9, min: 0.0, max: 3.0, step: 0.01 },
        diskLensing: { value: 0.85, min: 0.0, max: 1.0, step: 0.01 },
        bloomIntensity: { value: 2.2, min: 0.0, max: 4.0, step: 0.01 },
        chromaticOffset: { value: 0.0006, min: 0.0, max: 0.01, step: 0.0001 },
        grainIntensity: { value: 0.06, min: 0.0, max: 0.3, step: 0.005 },
      },
      { collapsed: true },
    ),
  }))

  // Audio.
  useEffect(() => {
    if (values.audioEnabled) {
      AudioEngine.init().catch((err) => console.warn('Audio init failed:', err))
    } else if (AudioEngine.isStarted()) {
      AudioEngine.dispose()
    }
  }, [values.audioEnabled])
  useEffect(() => () => AudioEngine.dispose(), [])

  // Throttled proximity → audio + HUD tidal readout.
  const lastProximityAt = useRef(0)
  const onProximity = useCallback((norm: number) => {
    setProximity(norm)
    const now = performance.now()
    if (now - lastProximityAt.current < 50) return
    lastProximityAt.current = now
    if (AudioEngine.isStarted()) AudioEngine.setProximity(norm)
  }, [])

  // Phase transitions.
  const engage = useCallback(() => {
    if (phase !== 'approach') return
    setHudDismissed(false)
    setPhase('traversal')
    setTimeout(() => setPhase('arrival'), TRAVERSAL_MS)
  }, [phase])

  const returnHome = useCallback(() => {
    if (phase !== 'arrival') return
    setHudDismissed(false)
    setPhase('traversal')
    setTimeout(() => setPhase('approach'), TRAVERSAL_MS)
  }, [phase])

  const stay = useCallback(() => setHudDismissed(true), [])

  // Leva debug override: if user flips `traversalMode` on manually,
  // we honor it but don't corrupt phase state.
  const onTraversalEnd = useCallback(() => {
    if (values.traversalMode) set({ traversalMode: false })
  }, [set, values.traversalMode])

  return (
    <>
      <WormholeScene
        throatRadius={values.throatRadius}
        lensingStrength={values.lensingStrength}
        accretionSpeed={values.accretionSpeed}
        phase={phase}
        traversalMode={values.traversalMode}
        bloomIntensity={values.bloomIntensity}
        chromaticOffset={values.chromaticOffset}
        starDensity={values.starDensity}
        photonRingIntensity={values.photonRingIntensity}
        diskLensing={values.diskLensing}
        grainIntensity={values.grainIntensity}
        onProximity={onProximity}
        onTraversalEnd={onTraversalEnd}
      />
      <ExplorerHUD
        phase={phase}
        proximity={proximity}
        hudDismissed={hudDismissed}
        onEngage={engage}
        onReturn={returnHome}
        onStay={stay}
      />
    </>
  )
}
