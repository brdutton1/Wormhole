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

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      {/* Torus(majorR, minorR, radialSeg, tubularSeg). Flat-ish disk via
          small minor radius; tubularSeg high for smooth ring. */}
      <torusGeometry args={[1.5, 0.6, 2, 128]} />
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
