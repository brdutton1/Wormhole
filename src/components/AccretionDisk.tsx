import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import vertexShader from '../shaders/accretion.vert?raw'
import fragmentShader from '../shaders/accretion.frag?raw'

interface Props {
  throatRadius: number
  accretionSpeed: number
}

export default function AccretionDisk({ throatRadius, accretionSpeed }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAccretionSpeed: { value: accretionSpeed },
      uThroatRadius: { value: throatRadius },
      uCameraPos: { value: new THREE.Vector3() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame(({ camera, clock }) => {
    const u = matRef.current?.uniforms
    if (!u) return
    u.uTime.value = clock.elapsedTime
    u.uAccretionSpeed.value = accretionSpeed
    u.uThroatRadius.value = throatRadius
    u.uCameraPos.value.copy(camera.position)
  })

  // Flat annulus tilted slightly so we see its face, not its edge. A
  // small tilt (~12°) gives a classic elliptical disk silhouette.
  return (
    <mesh rotation={[Math.PI / 2 - 0.21, 0, 0]}>
      <ringGeometry args={[throatRadius * 1.05, 2.1, 256, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
