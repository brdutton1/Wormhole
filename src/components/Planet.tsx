import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import vertexShader from '../shaders/planet.vert?raw'
import fragmentShader from '../shaders/planet.frag?raw'

export type PlanetPreset = 'mercury' | 'alien'

interface Props {
  preset: PlanetPreset
  position: [number, number, number]
  radius: number
  sunDir: [number, number, number]
  sunColor: [number, number, number]
  rotationSpeed?: number
}

export default function Planet({
  preset,
  position,
  radius,
  sunDir,
  sunColor,
  rotationSpeed = 0.05,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPreset: { value: preset === 'mercury' ? 0 : 1 },
      uSunDir: { value: new THREE.Vector3(...sunDir).normalize() },
      uSunColor: { value: new THREE.Vector3(...sunColor) },
      uCameraPos: { value: new THREE.Vector3() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame(({ camera, clock }, dt) => {
    const u = matRef.current?.uniforms
    if (u) {
      u.uTime.value = clock.elapsedTime
      u.uPreset.value = preset === 'mercury' ? 0 : 1
      u.uSunDir.value.set(...sunDir).normalize()
      u.uSunColor.value.set(...sunColor)
      u.uCameraPos.value.copy(camera.position)
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += rotationSpeed * dt
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[radius, 48, 48]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}
