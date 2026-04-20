// ----------------------------------------------------------------------------
// lensing.frag — gravitational lensing of a procedural star field.
//
// Physics approximation:
//   We approximate light deflection by a Schwarzschild mass with an
//   inverse-square falloff on the impact parameter b:
//       delta ≈ (R_throat^2 / b^2) * strength
//   True GR first-order deflection is 4GM / (c^2 * b) (~1/b), but CLAUDE.md
//   specifies inverse-square for the visual falloff, which gives a sharper
//   "ring" around the throat at the cost of GR accuracy. We are going for
//   look, not a geodesic integrator.
//
//   The throat itself is rendered as a hard black void by `discard`-ing
//   fragments whose rays would pass within the throat radius — a visual
//   stand-in for the event horizon shadow.
// ----------------------------------------------------------------------------

precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uThroatRadius;
uniform float uLensingStrength;
uniform vec3  uCameraPos;
uniform float uStarDensity;

varying vec3 vWorldPos;

// Cheap 3D hash for a procedural star field. Returns [0, 1).
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

// Generates a single octave of stars at a given cell size. Each grid cell
// gets a random threshold; only the brightest hashes render as stars,
// giving a natural-looking sparse field.
vec3 starOctave(vec3 dir, float cellSize, float threshold) {
  vec3 p = dir * cellSize;
  vec3 cell = floor(p);
  float h = hash13(cell);
  // Sharp cutoff → individual stars instead of a noisy gradient.
  float bright = smoothstep(threshold, threshold + 0.01, h);
  // Tiny twinkle modulated by time.
  float twinkle = 0.8 + 0.2 * sin(uTime * 2.0 + h * 31.4159);
  return vec3(bright * twinkle);
}

void main() {
  // Build a ray from the camera through this fragment (we're inside a
  // large inward-facing sphere, so vWorldPos gives us a good direction).
  vec3 rayOrigin = uCameraPos;
  vec3 rayDir = normalize(vWorldPos - rayOrigin);

  // Throat is anchored at world origin. Compute closest approach of the
  // ray to the throat center — this is our impact parameter b.
  vec3 toThroat = -rayOrigin;
  float tClosest = dot(toThroat, rayDir);
  vec3 closestPoint = rayOrigin + rayDir * tClosest;
  float b = length(closestPoint);

  // Void cutout: ray passes inside the throat → event horizon shadow.
  // Only applies when the throat is actually in front of the camera.
  if (tClosest > 0.0 && b < uThroatRadius) {
    discard;
  }

  // Direction from the closest point back toward the throat center —
  // this is the direction we bend the ray into.
  vec3 bendDir = (tClosest > 0.0) ? normalize(-closestPoint) : vec3(0.0);

  // Inverse-square deflection. The throatRadius^2 keeps the expression
  // dimensionless in our unit system.
  float deflect = (uThroatRadius * uThroatRadius) / max(b * b, 1e-3);
  deflect *= uLensingStrength;

  // Only bend rays that are heading roughly toward the throat; otherwise
  // the far side of the sky would warp for no reason.
  float frontFactor = clamp(tClosest / 10.0, 0.0, 1.0);
  vec3 bent = normalize(rayDir + bendDir * deflect * frontFactor);

  // Sample the star field along the bent direction. Two octaves give
  // a sense of depth without blowing the frag budget.
  float densityLow  = mix(120.0, 220.0, clamp(uStarDensity, 0.0, 1.0));
  float densityHigh = densityLow * 2.3;
  vec3 stars = starOctave(bent, densityLow,  0.985)
             + starOctave(bent, densityHigh, 0.992) * 0.6;

  // Subtle cool tint near the ring to sell the "bent light" look.
  float ring = smoothstep(uThroatRadius * 1.0, uThroatRadius * 1.6, b);
  vec3 ringTint = mix(vec3(0.4, 0.6, 1.0), vec3(1.0), ring);
  stars *= ringTint;

  // Output opaque: this is our sky, so no alpha.
  gl_FragColor = vec4(stars, 1.0);
}
