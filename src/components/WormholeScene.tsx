import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import StarField from './StarField'
import AccretionDisk from './AccretionDisk'
import TunnelMesh from './TunnelMesh'
import PostFX from './PostFX'
import { normalizedThroatDistance, traversalCurve } from '../physics/geodesic'

export interface SceneParams {
  throatRadius: number
  lensingStrength: number
  accretionSpeed: number
  traversalMode: boolean
  bloomIntensity: number
  chromaticOffset: number
  starDensity: number
  onProximity?: (normalizedDist: number) => void
  onTraversalEnd?: () => void
}

// Lives inside <Canvas> so it can touch the camera and call useFrame.
function CameraRig({
  traversalMode,
  onProximity,
  onTraversalEnd,
}: Pick<SceneParams, 'traversalMode' | 'onProximity' | 'onTraversalEnd'>) {
  const { camera } = useThree()
  const startedAt = useRef<number | null>(null)
  const wasTraversing = useRef(false)

  useFrame(({ clock }) => {
    if (traversalMode) {
      if (!wasTraversing.current) {
        startedAt.current = clock.elapsedTime
        wasTraversing.current = true
      }
      const t = clock.elapsedTime - (startedAt.current ?? clock.elapsedTime)
      const { z, dilation, done } = traversalCurve(t)
      // Apply dilation by damping how quickly we interpolate toward target.
      const targetZ = z
      camera.position.x += (0 - camera.position.x) * 0.1
      camera.position.y += (0 - camera.position.y) * 0.1
      camera.position.z += (targetZ - camera.position.z) * (0.15 * dilation + 0.05)
      camera.lookAt(0, 0, camera.position.z - 1)
      if (done && onTraversalEnd) onTraversalEnd()
    } else if (wasTraversing.current) {
      wasTraversing.current = false
      startedAt.current = null
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
    traversalMode,
    bloomIntensity,
    chromaticOffset,
    starDensity,
    onProximity,
    onTraversalEnd,
  } = props

  // Reset camera to orbit position when traversal flips off.
  const [orbitKey, setOrbitKey] = useState(0)
  useEffect(() => {
    if (!traversalMode) setOrbitKey((k) => k + 1)
  }, [traversalMode])

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ powerPreference: 'high-performance', antialias: false }}
      camera={{ position: [0, 1.2, 8], fov: 55, near: 0.1, far: 2000 }}
      style={{ position: 'fixed', inset: 0, background: '#000' }}
    >
      <color attach="background" args={['#000']} />
      <fog attach="fog" args={['#000', 12, 60]} />

      {/* Scene lights — subtle rim/ambient; the disk provides most light. */}
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 0, 0]} intensity={2} distance={10} color={new THREE.Color('#ffb16a')} />

      <StarField
        throatRadius={throatRadius}
        lensingStrength={lensingStrength}
        starDensity={starDensity}
      />
      <AccretionDisk throatRadius={throatRadius} accretionSpeed={accretionSpeed} />
      <TunnelMesh throatRadius={throatRadius} traversalMode={traversalMode} />

      <CameraRig
        traversalMode={traversalMode}
        onProximity={onProximity}
        onTraversalEnd={onTraversalEnd}
      />

      {!traversalMode && (
        <OrbitControls
          key={orbitKey}
          autoRotate
          autoRotateSpeed={0.2}
          enableDamping
          enablePan={false}
          minDistance={3}
          maxDistance={20}
        />
      )}

      <PostFX bloomIntensity={bloomIntensity} chromaticOffset={chromaticOffset} />
    </Canvas>
  )
}
