import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import vertexShader from '../shaders/tunnel.vert?raw'
import fragmentShader from '../shaders/tunnel.frag?raw'

interface Props {
  throatRadius: number
  traversalMode: boolean
}

export default function TunnelMesh({ throatRadius, traversalMode }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTraversalMode: { value: traversalMode ? 1 : 0 },
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
    // Smoothly ramp the traversal uniform so the tunnel fades in/out.
    const target = traversalMode ? 1 : 0
    u.uTraversalMode.value += (target - u.uTraversalMode.value) * 0.08
    u.uThroatRadius.value = throatRadius
    u.uCameraPos.value.copy(camera.position)
  })

  // Open-ended cylinder laid along the Z axis. radialSeg high for smooth
  // interior, heightSeg 1 (no need for extra vertical tessellation).
  // Rotate the default Y-up cylinder so its axis aligns with +Z/-Z.
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[throatRadius * 1.1, throatRadius * 1.1, 30, 64, 1, true]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}
