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

// Small epsilon to avoid divide-by-zero at r -> 0.
const EPS = 1e-4

// Schwarzschild radius rs = 2GM/c^2. In geometrized units this collapses
// to 2M, but we keep G and C explicit so the formula reads correctly.
export function schwarzschildRadius(mass: number): number {
  return (2 * G * mass) / (C * C)
}

// Deflection angle approximation for a light ray with perpendicular
// impact parameter `impactParam` passing at radial distance `r` from the
// throat. True GR first-order deflection is 4GM/(c^2 * b), but CLAUDE.md
// specifies an inverse-square falloff for the visual. We return a signed
// magnitude: positive means "bend toward the throat", negative "away".
export function lensingDeflection(impactParam: number, r: number): number {
  const denom = Math.max(r * r, EPS)
  const magnitude = (throatRadius * throatRadius) / denom
  return Math.sign(impactParam) * magnitude
}

// Gravitational time dilation factor dt_far / dt_local at radius r around
// a body with Schwarzschild radius rs. Goes to 0 at the horizon, 1 at
// infinity. Clamped above zero so audio/camera don't freeze outright.
export function timeDilation(r: number, rs: number): number {
  const ratio = rs / Math.max(r, EPS)
  return Math.sqrt(Math.max(1 - ratio, EPS))
}
