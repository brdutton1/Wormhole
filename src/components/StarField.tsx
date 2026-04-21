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
  systemTint: number // 0 = home, 1 = alien
}

// Scene-unit speed-of-light used to scale camera velocity into β. During
// the 6 s traversal the camera sweeps ~30 units → mean speed ~5 units/s.
// C_VISUAL = 8 → peak β around 0.6–0.8 near mid-traversal. Tune for look.
const C_VISUAL = 8

export default function StarField({
  throatRadius,
  lensingStrength,
  starDensity,
  photonRingIntensity,
  diskLensing,
  diskInner,
  diskOuter,
  accretionSpeed,
  systemTint,
}: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const { size } = useThree()
  const lastPos = useRef(new THREE.Vector3())
  const lastValid = useRef(false)
  const smoothedVel = useRef(new THREE.Vector3())

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
      uObserverVel: { value: new THREE.Vector3() },
      uSystemTint: { value: systemTint },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame(({ camera, clock }, dt) => {
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

    // Camera velocity → β. Smoothed so single-frame jitter doesn't
    // slam the aberration uniform.
    const safeDt = Math.max(dt, 1 / 240)
    if (lastValid.current) {
      const instV = camera.position.clone().sub(lastPos.current).divideScalar(safeDt)
      smoothedVel.current.lerp(instV, 0.25)
    } else {
      lastValid.current = true
    }
    lastPos.current.copy(camera.position)

    const beta = Math.min(smoothedVel.current.length() / C_VISUAL, 0.9)
    if (beta > 0.001) {
      const dir = smoothedVel.current.clone().normalize().multiplyScalar(beta)
      u.uObserverVel.value.copy(dir)
    } else {
      u.uObserverVel.value.set(0, 0, 0)
    }

    // Smoothly ease the system tint toward target.
    const cur = u.uSystemTint.value as number
    u.uSystemTint.value = cur + (systemTint - cur) * 0.06
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
