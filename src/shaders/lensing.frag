// ----------------------------------------------------------------------------
// lensing.frag — gravitational lensing + photon ring + lensed disk halo.
//
// Physics approximations (visual-first, not a geodesic integrator):
//   * Deflection uses the GR first-order form δ ≈ 4GM/(c²b), i.e. 1/b
//     falloff, with a soft cap near the throat so small b doesn't invert.
//   * The photon sphere (r_ph = 3M = 1.5·rs) is rendered as a bright
//     thin annulus at b ≈ r_ph — this is what gives real black-hole
//     images their iconic inner ring (EHT M87*, Gargantua).
//   * The event horizon is represented by `discard` inside rs.
//   * The accretion disk is lensed: after bending a ray, we intersect it
//     with the disk plane y=0 and composite a disk sample. This produces
//     the Interstellar-style "disk wrapping over AND under" the throat
//     in a single draw call.
// ----------------------------------------------------------------------------

precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uThroatRadius;
uniform float uLensingStrength;
uniform vec3  uCameraPos;
uniform float uStarDensity;

// v2 uniforms
uniform float uPhotonRingIntensity;
uniform float uDiskLensing;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uAccretionSpeed;

varying vec3 vWorldPos;

// -------- hashes & noise --------
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0,0.0));
  float c = hash21(i + vec2(0.0,1.0));
  float d = hash21(i + vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}

// -------- HDR starfield --------
// Brightness distribution: pow(h, 8) => most cells faint, rare cells pop.
// Color temperature: second hash through a 3-stop Planckian-ish ramp.
vec3 starOctave(vec3 dir, float cellSize) {
  vec3 p = dir * cellSize;
  vec3 cell = floor(p);
  float h = hash13(cell);
  float h2 = hash13(cell + 17.3);
  float brightness = pow(h, 8.0);
  // Only cells above threshold get a star; keeps the field sparse.
  float gate = smoothstep(0.06, 0.12, brightness);
  float twinkle = 0.75 + 0.25 * sin(uTime * 2.0 + h * 31.4159);

  // Temperature: blue-white for hot, warm orange for cool.
  vec3 cool = vec3(0.55, 0.7, 1.0);
  vec3 neutral = vec3(1.0, 0.97, 0.9);
  vec3 warm = vec3(1.0, 0.55, 0.3);
  vec3 temp = mix(cool, neutral, smoothstep(0.0, 0.5, h2));
  temp = mix(temp, warm, smoothstep(0.5, 1.0, h2));

  // HDR boost makes brightest stars bloom; dim ones stay as pinpricks.
  return temp * brightness * gate * twinkle * 3.0;
}

// -------- inline disk sampler (mirrors accretion.frag palette) --------
vec3 diskPalette(float t) {
  vec3 hot = vec3(1.0, 0.95, 0.85);
  vec3 amber = vec3(1.0, 0.55, 0.15);
  vec3 violet = vec3(0.45, 0.20, 0.70);
  vec3 a = mix(hot, amber, smoothstep(0.0, 0.45, t));
  vec3 b = mix(amber, violet, smoothstep(0.45, 1.0, t));
  return mix(a, b, smoothstep(0.35, 0.55, t));
}
vec3 sampleLensedDisk(vec3 hit) {
  float r = length(hit.xz);
  float theta = atan(hit.z, hit.x);
  float rNorm = clamp((r - uDiskInner) / max(uDiskOuter - uDiskInner, 1e-3), 0.0, 1.0);
  // Keplerian-ish rotation so the halo isn't static.
  float omega = uAccretionSpeed / max(pow(r, 1.5), 0.05);
  theta += uTime * omega;
  float turb = noise2(vec2(theta * 2.5, rNorm * 8.0));
  float bands = 0.8 + 0.35 * sin(theta * 3.0 + turb * 4.0);
  vec3 col = diskPalette(rNorm) * bands * mix(0.8, 1.2, turb);
  // Fade edges so the halo doesn't have a hard boundary in the sky.
  float edgeFade = smoothstep(0.0, 0.1, rNorm) * (1.0 - smoothstep(0.85, 1.0, rNorm));
  return col * edgeFade * 1.6;
}

void main() {
  vec3 rayOrigin = uCameraPos;
  vec3 rayDir = normalize(vWorldPos - rayOrigin);

  // Impact parameter: closest approach of the ray to the throat center.
  vec3 toThroat = -rayOrigin;
  float tClosest = dot(toThroat, rayDir);
  vec3 closestPoint = rayOrigin + rayDir * tClosest;
  float b = length(closestPoint);

  // M = throatRadius in geometrized units, so rs = 2M.
  float rs = uThroatRadius * 2.0;

  // Event horizon shadow.
  if (tClosest > 0.0 && b < rs * 0.5) {
    discard;
  }

  // GR 1/b deflection with soft cap to prevent inversion at small b.
  vec3 bendDir = (tClosest > 0.0) ? normalize(-closestPoint) : vec3(0.0);
  float deflect = uLensingStrength * 2.0 * rs / max(b, 0.15 * uThroatRadius);
  deflect = min(deflect, 1.8);
  float frontFactor = clamp(tClosest / 10.0, 0.0, 1.0);
  vec3 bent = normalize(rayDir + bendDir * deflect * frontFactor);

  // Starfield along the bent ray — two octaves of HDR stars.
  float dLow  = mix(120.0, 220.0, clamp(uStarDensity, 0.0, 1.0));
  float dHigh = dLow * 2.3;
  vec3 color = starOctave(bent, dLow) + starOctave(bent, dHigh) * 0.6;

  // Photon ring: bright gaussian annulus at b ≈ 1.5 * rs.
  // Only visible when the throat is actually in front of us.
  if (tClosest > 0.0) {
    float photonR = 1.5 * rs;
    float ringWidth = 0.08 * uThroatRadius;
    float ring = exp(-pow((b - photonR) / ringWidth, 2.0));
    // A faint secondary at ~0.6 of that — stand-in for higher-order photon ring.
    float ring2 = exp(-pow((b - photonR * 0.82) / (ringWidth * 0.5), 2.0)) * 0.35;
    color += vec3(1.0, 0.75, 0.45) * (ring + ring2) * uPhotonRingIntensity;
  }

  // Lensed-disk halo: intersect bent ray with y=0 disk plane.
  if (uDiskLensing > 0.001 && abs(bent.y) > 1e-3) {
    float tHit = -rayOrigin.y / bent.y;
    if (tHit > 0.0) {
      vec3 hit = rayOrigin + bent * tHit;
      float rDisk = length(hit.xz);
      if (rDisk > uDiskInner && rDisk < uDiskOuter) {
        vec3 diskCol = sampleLensedDisk(hit);
        // Additive so the disk halo blooms through the starfield.
        color += diskCol * uDiskLensing;
      }
    }
  }

  gl_FragColor = vec4(color, 1.0);
}
