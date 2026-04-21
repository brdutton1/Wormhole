import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import StarField from './StarField'
import AccretionDisk from './AccretionDisk'
import TunnelMesh from './TunnelMesh'
import PostFX from './PostFX'
import Planet from './Planet'
import PlanetRings from './PlanetRings'
import HostStar from './HostStar'
import type { Phase } from './ExplorerHUD'
import { normalizedThroatDistance, traversalCurve } from '../physics/geodesic'

export interface SceneParams {
  throatRadius: number
  lensingStrength: number
  accretionSpeed: number
  phase: Phase
  traversalMode: boolean
  bloomIntensity: number
  chromaticOffset: number
  starDensity: number
  photonRingIntensity: number
  diskLensing: number
  grainIntensity: number
  onProximity?: (normalizedDist: number) => void
  onTraversalEnd?: () => void
}

// Disk inner/outer radii.
const DISK_INNER_MUL = 1.05
const DISK_OUTER = 2.1

// Scene anchors per phase.
const APPROACH_CAM: [number, number, number] = [6, 2.2, 16]
const MERCURY_POS: [number, number, number] = [-3.5, -0.2, 4]
const ARRIVAL_CAM: [number, number, number] = [0, 2, -18]
const ARRIVAL_LOOK: [number, number, number] = [5, -0.4, -24]
const ALIEN_POS: [number, number, number] = [5, -0.4, -24]
const ALIEN_RADIUS = 2.4
const HOST_STAR_POS: [number, number, number] = [26, 11, -28]

// Consistent sun directions per system.
const MERCURY_SUN_DIR: [number, number, number] = [1, 0.25, 0.5] // toward the inner sun
const MERCURY_SUN_COLOR: [number, number, number] = [1.0, 0.95, 0.85]
const ALIEN_SUN_COLOR: [number, number, number] = [0.85, 0.92, 1.2] // A-class blue-white

function CameraRig({
  phase,
  onProximity,
  onTraversalEnd,
}: {
  phase: Phase
  onProximity?: (n: number) => void
  onTraversalEnd?: () => void
}) {
  const { camera } = useThree()
  const traversalStartedAt = useRef<number | null>(null)
  const prevPhase = useRef<Phase>(phase)

  useFrame(({ clock }) => {
    // Phase transitions snap reference time for traversal.
    if (prevPhase.current !== phase) {
      if (phase === 'traversal') traversalStartedAt.current = clock.elapsedTime
      else traversalStartedAt.current = null
      prevPhase.current = phase
    }

    if (phase === 'approach') {
      // Lerp toward the approach anchor. OrbitControls will take over
      // once we're close (it reads current position and damps).
      camera.position.x += (APPROACH_CAM[0] - camera.position.x) * 0.04
      camera.position.y += (APPROACH_CAM[1] - camera.position.y) * 0.04
      camera.position.z += (APPROACH_CAM[2] - camera.position.z) * 0.04
    } else if (phase === 'traversal') {
      const t = clock.elapsedTime - (traversalStartedAt.current ?? clock.elapsedTime)
      const { z, dilation, done } = traversalCurve(t)
      camera.position.x += (0 - camera.position.x) * 0.1
      camera.position.y += (0 - camera.position.y) * 0.1
      camera.position.z += (z - camera.position.z) * (0.18 * dilation + 0.06)
      camera.lookAt(0, 0, camera.position.z - 1)
      if (done && onTraversalEnd) onTraversalEnd()
    } else {
      // arrival: tween to anchor, look at the alien planet
      camera.position.x += (ARRIVAL_CAM[0] - camera.position.x) * 0.05
      camera.position.y += (ARRIVAL_CAM[1] - camera.position.y) * 0.05
      camera.position.z += (ARRIVAL_CAM[2] - camera.position.z) * 0.05
      camera.lookAt(ARRIVAL_LOOK[0], ARRIVAL_LOOK[1], ARRIVAL_LOOK[2])
    }

    if (onProximity) {
      onProximity(normalizedThroatDistance(camera.position))
    }
  })

  return null
}

export default function WormholeScene(props: SceneParams) {
  const {
    throatRadius,
    lensingStrength,
    accretionSpeed,
    phase,
    traversalMode,
    bloomIntensity,
    chromaticOffset,
    starDensity,
    photonRingIntensity,
    diskLensing,
    grainIntensity,
    onProximity,
    onTraversalEnd,
  } = props

  // Alien sun direction computed from alien planet → host star.
  const alienSunDir: [number, number, number] = [
    HOST_STAR_POS[0] - ALIEN_POS[0],
    HOST_STAR_POS[1] - ALIEN_POS[1],
    HOST_STAR_POS[2] - ALIEN_POS[2],
  ]

  // Reset OrbitControls on phase change (so they re-seat around the new target).
  const [orbitKey, setOrbitKey] = useState(0)
  useEffect(() => {
    setOrbitKey((k) => k + 1)
  }, [phase])

  const systemTint = phase === 'arrival' ? 1 : 0
  const orbitTarget: [number, number, number] =
    phase === 'arrival' ? ALIEN_POS : [0, 0, 0]
  const orbitEnabled = phase !== 'traversal' && !traversalMode

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ powerPreference: 'high-performance', antialias: false }}
      camera={{ position: APPROACH_CAM, fov: 48, near: 0.1, far: 2000 }}
      style={{ position: 'fixed', inset: 0, background: '#000' }}
    >
      <color attach="background" args={['#000']} />
      <ambientLight intensity={0.05} />
      <pointLight
        position={[0, 0, 0]}
        intensity={1.2}
        distance={10}
        color={new THREE.Color('#ffb16a')}
      />

      <StarField
        throatRadius={throatRadius}
        lensingStrength={lensingStrength}
        starDensity={starDensity}
        photonRingIntensity={photonRingIntensity}
        diskLensing={diskLensing}
        diskInner={throatRadius * DISK_INNER_MUL}
        diskOuter={DISK_OUTER}
        accretionSpeed={accretionSpeed}
        systemTint={systemTint}
      />
      <AccretionDisk throatRadius={throatRadius} accretionSpeed={accretionSpeed} />
      <TunnelMesh
        throatRadius={throatRadius}
        traversalMode={phase === 'traversal' || traversalMode}
      />

      {/* Mercury only visible during approach — it's on the home side. */}
      {phase === 'approach' && (
        <Planet
          preset="mercury"
          position={MERCURY_POS}
          radius={0.9}
          sunDir={MERCURY_SUN_DIR}
          sunColor={MERCURY_SUN_COLOR}
          rotationSpeed={0.04}
        />
      )}

      {/* Dark ringed world + host star + rings only in arrival. */}
      {phase === 'arrival' && (
        <>
          <Planet
            preset="alien"
            position={ALIEN_POS}
            radius={ALIEN_RADIUS}
            sunDir={alienSunDir}
            sunColor={ALIEN_SUN_COLOR}
            rotationSpeed={0.02}
          />
          <PlanetRings
            planetCenter={ALIEN_POS}
            planetRadius={ALIEN_RADIUS}
            innerRadius={2.9}
            outerRadius={4.6}
            tiltXDeg={22}
            tiltZDeg={12}
            sunDir={alienSunDir}
            sunColor={ALIEN_SUN_COLOR}
          />
          <HostStar position={HOST_STAR_POS} color={[1.5, 1.7, 2.4]} radius={0.45} />
        </>
      )}

      <CameraRig
        phase={phase}
        onProximity={onProximity}
        onTraversalEnd={onTraversalEnd}
      />

      {orbitEnabled && (
        <OrbitControls
          key={orbitKey}
          autoRotate
          autoRotateSpeed={0.15}
          enableDamping
          enablePan={false}
          minDistance={4}
          maxDistance={40}
          target={orbitTarget}
        />
      )}

      <PostFX
        bloomIntensity={bloomIntensity}
        chromaticOffset={chromaticOffset}
        grainIntensity={grainIntensity}
      />
    </Canvas>
  )
}
