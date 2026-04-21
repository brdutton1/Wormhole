// ----------------------------------------------------------------------------
// ring.frag — Saturn-style ring system with planet shadow.
//
// Features:
//   * Thin concentric bands via sin(r * K + noise) with hash-perturbed
//     gaps (Cassini-division stand-ins).
//   * Alpha density peaks in mid-radius, falls off at inner/outer edges.
//   * Planet shadow: if the world-space ring sample lies within the
//     cylinder cast by the planet along the sun direction, we darken.
//     This is the signature "shadow of the planet on its rings" beat.
// ----------------------------------------------------------------------------

precision highp float;

uniform float uTime;
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform vec3  uPlanetCenter;
uniform float uPlanetRadius;
uniform float uInnerRadius;
uniform float uOuterRadius;

varying vec3 vWorldPos;
varying vec2 vUv;

float hash11(float x) { return fract(sin(x * 43758.5453) * 13.7); }
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  // Radial distance in the ring's local space — we built a RingGeometry
  // centered on the planet, so vWorldPos - uPlanetCenter gives the
  // planar offset.
  vec3 rel = vWorldPos - uPlanetCenter;
  float r = length(vec2(rel.x, rel.z));

  // Normalized radial coordinate 0..1 across the ring.
  float rN = clamp((r - uInnerRadius) / max(uOuterRadius - uInnerRadius, 1e-3), 0.0, 1.0);

  // Concentric bands. Primary high-frequency ring, modulated by a
  // second noise for variability. Hash-based "dark gaps" simulate
  // Cassini divisions.
  float bandHigh = 0.5 + 0.5 * sin(r * 40.0 + hash21(vec2(floor(r * 8.0), 0.0)) * 6.28);
  float bandLow  = 0.5 + 0.5 * sin(r * 9.0);
  float bands = bandHigh * 0.6 + bandLow * 0.4;

  // Cassini divisions — a couple of fixed dark bands.
  float gap1 = 1.0 - exp(-pow((rN - 0.42) / 0.015, 2.0));
  float gap2 = 1.0 - exp(-pow((rN - 0.68) / 0.010, 2.0));
  bands *= gap1 * gap2;

  // Color: warm ice/dust tones, brighter in outer rings, amber inner.
  vec3 warm = vec3(1.0, 0.75, 0.5);
  vec3 pale = vec3(0.85, 0.82, 0.78);
  vec3 color = mix(warm, pale, rN);

  // Lit by the host star — dot(normal, sunDir) with normal = +Y in ring
  // local space. Since we tilt the ring, we approximate lighting by
  // sun dot a ring-plane-ish direction. Simpler: apply sun color scaling.
  color *= uSunColor * (0.5 + 0.5 * max(0.0, dot(normalize(rel), uSunDir)));

  // Planet shadow: project the sample along -uSunDir, check if the ray
  // (from sample toward sun) passes within the planet radius.
  //   Find t where (rel + t*uSunDir) · axis hits min distance to planet.
  //   For a sphere at uPlanetCenter (origin in rel space), the closest
  //   approach distance squared is:
  //     perp = rel - dot(rel, L) * L  where L = uSunDir
  //     shadowDist = length(perp)
  //   Only cast shadow if the sample is on the side of planet AWAY
  //   from the sun (dot(rel, L) < 0 means sun is on the +L side of sample).
  float along = dot(rel, uSunDir);
  vec3 perp = rel - along * uSunDir;
  float shadowDist = length(perp);
  float shadow = 1.0;
  if (along < 0.0) {
    // Soft penumbra: full shadow inside planet disk, fall off over 0.3.
    shadow = smoothstep(uPlanetRadius, uPlanetRadius + 0.3, shadowDist);
    shadow = mix(0.12, 1.0, shadow);
  }
  color *= shadow;

  // Density falloff at edges so the ring doesn't terminate in a hard line.
  float density = smoothstep(0.0, 0.08, rN) * (1.0 - smoothstep(0.9, 1.0, rN));
  float alpha = bands * density;

  gl_FragColor = vec4(color, alpha);
}
