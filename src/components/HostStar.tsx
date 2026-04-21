import * as THREE from 'three'

interface Props {
  position: [number, number, number]
  color: [number, number, number]
  radius?: number
}

// A bright emissive sphere that serves as the visible host star for
// the arrival system. We feed heavy luminance into the bloom pass so
// it reads as a sharp point with a haloed glow.
export default function HostStar({ position, color, radius = 0.4 }: Props) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshBasicMaterial
        color={new THREE.Color(color[0], color[1], color[2])}
        toneMapped={false}
      />
    </mesh>
  )
}
