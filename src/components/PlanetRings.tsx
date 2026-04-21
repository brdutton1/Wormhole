import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import vertexShader from '../shaders/ring.vert?raw'
import fragmentShader from '../shaders/ring.frag?raw'

interface Props {
  planetCenter: [number, number, number]
  planetRadius: number
  innerRadius: number
  outerRadius: number
  tiltXDeg?: number
  tiltZDeg?: number
  sunDir: [number, number, number]
  sunColor: [number, number, number]
}

export default function PlanetRings({
  planetCenter,
  planetRadius,
  innerRadius,
  outerRadius,
  tiltXDeg = 25,
  tiltZDeg = 8,
  sunDir,
  sunColor,
}: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(...sunDir).normalize() },
      uSunColor: { value: new THREE.Vector3(...sunColor) },
      uPlanetCenter: { value: new THREE.Vector3(...planetCenter) },
      uPlanetRadius: { value: planetRadius },
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame(({ clock }) => {
    const u = matRef.current?.uniforms
    if (!u) return
    u.uTime.value = clock.elapsedTime
    u.uSunDir.value.set(...sunDir).normalize()
    u.uSunColor.value.set(...sunColor)
    u.uPlanetCenter.value.set(...planetCenter)
    u.uPlanetRadius.value = planetRadius
    u.uInnerRadius.value = innerRadius
    u.uOuterRadius.value = outerRadius
  })

  // Rings sit in the xz plane of the local group; tilt the group.
  const tiltX = (tiltXDeg * Math.PI) / 180
  const tiltZ = (tiltZDeg * Math.PI) / 180

  return (
    <group position={planetCenter} rotation={[Math.PI / 2 + tiltX, 0, tiltZ]}>
      <mesh>
        <ringGeometry args={[innerRadius, outerRadius, 256, 1]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
    </group>
  )
}
