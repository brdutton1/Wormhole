import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import vertexShader from '../shaders/lensing.vert?raw'
import fragmentShader from '../shaders/lensing.frag?raw'

interface Props {
  throatRadius: number
  lensingStrength: number
  starDensity: number
  photonRingIntensity: number
  diskLensing: number
  diskInner: number
  diskOuter: number
  accretionSpeed: number
}

export default function StarField({
  throatRadius,
  lensingStrength,
  starDensity,
  photonRingIntensity,
  diskLensing,
  diskInner,
  diskOuter,
  accretionSpeed,
}: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const { size } = useThree()

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uThroatRadius: { value: throatRadius },
      uLensingStrength: { value: lensingStrength },
      uCameraPos: { value: new THREE.Vector3() },
      uStarDensity: { value: starDensity },
      uPhotonRingIntensity: { value: photonRingIntensity },
      uDiskLensing: { value: diskLensing },
      uDiskInner: { value: diskInner },
      uDiskOuter: { value: diskOuter },
      uAccretionSpeed: { value: accretionSpeed },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame(({ camera, clock }) => {
    const u = matRef.current?.uniforms
    if (!u) return
    u.uTime.value = clock.elapsedTime
    u.uThroatRadius.value = throatRadius
    u.uLensingStrength.value = lensingStrength
    u.uStarDensity.value = starDensity
    u.uPhotonRingIntensity.value = photonRingIntensity
    u.uDiskLensing.value = diskLensing
    u.uDiskInner.value = diskInner
    u.uDiskOuter.value = diskOuter
    u.uAccretionSpeed.value = accretionSpeed
    u.uResolution.value.set(size.width, size.height)
    u.uCameraPos.value.copy(camera.position)
  })

  return (
    <mesh>
      <sphereGeometry args={[1000, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  )
}
