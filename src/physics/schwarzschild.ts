// Schwarzschild metric — visual approximation, not a GR solver.
//
// We work in geometrized units (G = c = 1) so formulas stay compact.
// Every function here is a primitive the shaders and camera code reuse.

export const G = 1
export const C = 1

// Default wormhole throat radius in world units. Everything else is
// expressed relative to this: lensing sphere, accretion inner cutoff,
// tunnel radius, etc.
export const throatRadius = 1.0

const EPS = 1e-4

// Schwarzschild radius rs = 2GM/c^2. In geometrized units this collapses
// to 2M, but we keep G and C explicit so the formula reads correctly.
export function schwarzschildRadius(mass: number): number {
  return (2 * G * mass) / (C * C)
}

// GR first-order deflection: delta ≈ 4GM / (c^2 * b). Capped near the
// throat so the direction doesn't invert at tiny impact parameters.
export function lensingDeflection(impactParam: number, r: number): number {
  const b = Math.max(Math.abs(impactParam), 0.15 * throatRadius)
  const rs = schwarzschildRadius(r)
  const magnitude = Math.min((2 * rs) / b, 1.8)
  return Math.sign(impactParam) * magnitude
}

// Photon sphere radius: r_ph = 3M = 1.5 * rs. Light can orbit the black
// hole at this radius — it's what gives real black-hole images their
// bright thin inner ring.
export function photonSphereRadius(rs: number): number {
  return 1.5 * rs
}

// Einstein ring angular radius for a lens of given mass (geometrized
// distances normalized to 1): θ_E = sqrt(4GM). Used for tuning the
// visible ring in the shader.
export function einsteinRadius(mass: number): number {
  return Math.sqrt(4 * G * mass)
}

// Gravitational time dilation factor dt_far / dt_local at radius r.
// Goes to 0 at the horizon, 1 at infinity.
export function timeDilation(r: number, rs: number): number {
  const ratio = rs / Math.max(r, EPS)
  return Math.sqrt(Math.max(1 - ratio, EPS))
}

// Gravitational redshift factor z at radius r: wavelength observed at
// infinity is (1+z) × wavelength at emission. Returns z (not 1+z).
export function gravitationalRedshift(r: number, rs: number): number {
  const denom = Math.sqrt(Math.max(1 - rs / Math.max(r, rs + EPS), EPS))
  return 1 / denom - 1
}
