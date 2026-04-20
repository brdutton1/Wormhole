import { Vector3 } from 'three'
import { schwarzschildRadius, throatRadius, timeDilation } from './schwarzschild'

// Helpers that turn the Schwarzschild primitives into things the scene
// and audio engine can consume: camera position along the traversal
// curve, audio proximity, etc.

const TRAVERSAL_DURATION = 6 // seconds, per spec
const TRAVERSAL_START_Z = 15
const TRAVERSAL_END_Z = -15

// Effective Schwarzschild radius of the wormhole used for dilation math.
// Mass = throatRadius in geometrized units gives rs = 2 * throatRadius,
// which is the usual textbook identification for a unit black hole. We
// use half that so time dilation kicks in inside the throat but not
// everywhere — purely a tuning choice for feel.
const RS_EFFECTIVE = schwarzschildRadius(throatRadius) * 0.5

// Map any camera position to a [0, 1] "distance to throat" score where
// 1.0 = far away (safe), 0.0 = at the throat. Used to drive audio and
// shader uniforms that should respond to proximity.
export function normalizedThroatDistance(cameraPos: Vector3, throatCenter = new Vector3(0, 0, 0)): number {
  const d = cameraPos.distanceTo(throatCenter)
  // Exponential falloff so it stays sensitive near the throat.
  const k = 4.0
  return Math.min(1, 1 - Math.exp(-d / (throatRadius * k)))
}

// Position + local time-dilation factor along the traversal curve.
// `t` is seconds since traversal began. We ease with a cosine so the
// camera coasts at the edges and blasts through the middle, then scale
// the effective dt by timeDilation(r) near the throat — "time slows" as
// we cross. The returned z is already dilation-adjusted, and the caller
// can use `dilation` to slow other animations in lockstep.
export function traversalCurve(t: number): { z: number; dilation: number; done: boolean } {
  const clamped = Math.max(0, Math.min(TRAVERSAL_DURATION, t))
  const u = clamped / TRAVERSAL_DURATION // 0..1 along traversal

  // Cosine ease for base z: starts at +15, ends at -15.
  const eased = 0.5 - 0.5 * Math.cos(u * Math.PI)
  const baseZ = TRAVERSAL_START_Z + (TRAVERSAL_END_Z - TRAVERSAL_START_Z) * eased

  // Dilation factor at current radius from throat center.
  const r = Math.max(Math.abs(baseZ), 1e-3)
  const dilation = timeDilation(r, RS_EFFECTIVE)

  return {
    z: baseZ,
    dilation,
    done: clamped >= TRAVERSAL_DURATION,
  }
}

export { TRAVERSAL_DURATION }
