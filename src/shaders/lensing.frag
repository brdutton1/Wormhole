// ----------------------------------------------------------------------------
// lensing.frag — gravitational lensing + photon ring + lensed disk halo
//                + nebula dust + Worley-style starfield (no grid bands).
//
// Physics approximations (visual-first):
//   * GR first-order deflection δ ≈ 4GM/(c²b), i.e. 1/b falloff, with a
//     soft cap near the throat so tiny b doesn't invert direction.
//   * Photon sphere at r_ph = 3M = 1.5·rs rendered as a bright thin
//     gaussian annulus — this is the signature feature of a black hole.
//   * Event horizon represented by `discard` inside rs.
//   * Accretion disk lensed via ray-plane intersection after bending.
//
// Visual notes:
//   * Starfield uses cell-jittered points (Worley-lite): one star per
//     cell at a hash-random position within the cell, distance-shaped.
//     This kills the grid-ring artifacts a plain floor-hash produces
//     when bent rays all converge at similar impact parameters.
//   * A low-frequency 3D noise adds a purple/cyan nebula "dust" to
//     break up the pure black between stars.
// ----------------------------------------------------------------------------

precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uThroatRadius;
uniform float uLensingStrength;
uniform vec3  uCameraPos;
uniform float uStarDensity;
uniform float uPhotonRingIntensity;
uniform float uDiskLensing;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uAccretionSpeed;

// v4 uniforms — relativistic effects + system palette shift.
uniform vec3  uObserverVel;  // β-scaled observer velocity (|v| ≤ 0.9)
uniform float uSystemTint;   // 0 = home (warm), 1 = alien (cool)

varying vec3 vWorldPos;

// ---- hashes ----
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7,  74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
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

// 3D value noise for dust.
float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash13(i + vec3(0,0,0));
  float b = hash13(i + vec3(1,0,0));
  float c = hash13(i + vec3(0,1,0));
  float d = hash13(i + vec3(1,1,0));
  float e = hash13(i + vec3(0,0,1));
  float g = hash13(i + vec3(1,0,1));
  float h = hash13(i + vec3(0,1,1));
  float j = hash13(i + vec3(1,1,1));
  return mix(
    mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
    mix(mix(e,g,f.x), mix(h,j,f.x), f.y),
    f.z
  );
}

// ---- Worley-lite star layer ----
// Each cell has one point at a random sub-cell position. We render a
// star as a steep gaussian around that point. No visible grid because
// placement is sub-cell random.
vec3 starLayer(vec3 dir, float cellSize) {
  vec3 p = dir * cellSize;
  vec3 cell = floor(p);
  vec3 offset = hash33(cell);              // random sub-cell position
  vec3 localPt = offset;
  vec3 f = fract(p);
  float d = length(f - localPt);

  // Brightness distribution: rare stars pop, most are dim.
  float h = hash13(cell + 7.77);
  float brightness = pow(h, 7.0);

  // Gate off cells below threshold → sparse field.
  float gate = smoothstep(0.04, 0.1, brightness);

  // Star profile: tight core + soft halo.
  float core = exp(-d * d * 120.0);
  float halo = exp(-d * d * 18.0) * 0.25;
  float star = (core + halo) * gate * brightness;

  // Temperature (blue giants → red dwarfs) via a second hash.
  float t = hash13(cell + 17.3);
  vec3 cool   = vec3(0.55, 0.72, 1.10);
  vec3 neutral= vec3(1.00, 0.97, 0.90);
  vec3 warm   = vec3(1.10, 0.60, 0.35);
  vec3 temp = mix(cool, neutral, smoothstep(0.0, 0.5, t));
  temp = mix(temp, warm, smoothstep(0.5, 1.0, t));

  // Twinkle.
  float tw = 0.8 + 0.2 * sin(uTime * 2.0 + h * 31.4159);

  return temp * star * tw * 4.5; // HDR headroom for bloom.
}

// ---- nebula dust ----
// Low-frequency 3D noise tinted purple/cyan — sells the void without
// being obvious.
vec3 nebula(vec3 dir) {
  float a = noise3(dir * 2.5 + vec3(0.0, uTime * 0.01, 0.0));
  float b = noise3(dir * 6.0 - vec3(uTime * 0.015, 0.0, 0.0));
  float density = smoothstep(0.45, 0.95, a * 0.7 + b * 0.3);
  vec3 purple = vec3(0.35, 0.15, 0.55);
  vec3 cyan   = vec3(0.15, 0.35, 0.55);
  vec3 tint = mix(purple, cyan, smoothstep(0.3, 0.8, b));
  return tint * density * 0.35;
}

// ---- lensed disk sampler ----
vec3 diskPalette(float t) {
  vec3 hot   = vec3(1.20, 1.05, 0.85);
  vec3 amber = vec3(1.00, 0.55, 0.15);
  vec3 violet= vec3(0.55, 0.25, 0.85);
  vec3 a = mix(hot, amber, smoothstep(0.0, 0.45, t));
  vec3 b = mix(amber, violet, smoothstep(0.45, 1.0, t));
  return mix(a, b, smoothstep(0.35, 0.55, t));
}
vec3 sampleLensedDisk(vec3 hit) {
  float r = length(hit.xz);
  float theta = atan(hit.z, hit.x);
  float rNorm = clamp((r - uDiskInner) / max(uDiskOuter - uDiskInner, 1e-3), 0.0, 1.0);
  float omega = uAccretionSpeed / max(pow(r, 1.5), 0.05);
  theta += uTime * omega;
  float turb = noise2(vec2(theta * 2.5, rNorm * 8.0));
  float bands = 0.55 + 0.55 * sin(theta * 5.0 + turb * 7.0 + rNorm * 12.0);
  vec3 col = diskPalette(rNorm) * bands * mix(0.7, 1.4, turb);
  float edge = smoothstep(0.0, 0.1, rNorm) * (1.0 - smoothstep(0.85, 1.0, rNorm));
  return col * edge * 1.8;
}

void main() {
  vec3 rayOrigin = uCameraPos;
  vec3 rayDir = normalize(vWorldPos - rayOrigin);

  // Impact parameter.
  vec3 toThroat = -rayOrigin;
  float tClosest = dot(toThroat, rayDir);
  vec3 closestPoint = rayOrigin + rayDir * tClosest;
  float b = length(closestPoint);

  float rs = uThroatRadius * 2.0;

  // Event horizon shadow (hard cutoff; Canvas background is black).
  if (tClosest > 0.0 && b < rs * 0.55) {
    discard;
  }

  // GR 1/b deflection, capped.
  vec3 bendDir = (tClosest > 0.0) ? normalize(-closestPoint) : vec3(0.0);
  float deflect = uLensingStrength * 2.0 * rs / max(b, 0.2 * uThroatRadius);
  deflect = min(deflect, 1.4);
  float frontFactor = clamp(tClosest / 12.0, 0.0, 1.0);
  vec3 bent = normalize(rayDir + bendDir * deflect * frontFactor);

  // ---- Relativistic aberration + Doppler beaming ----
  // Shift the sampling direction per SR aberration formula. Only applied
  // to starfield/nebula sampling — disk and photon ring are geometric
  // features tied to the throat's rest frame and should not aberrate.
  vec3 sampleDir = bent;
  float doppler = 1.0;
  float beta = length(uObserverVel);
  if (beta > 0.001) {
    beta = min(beta, 0.9);
    vec3 vhat = uObserverVel / max(length(uObserverVel), 1e-5);
    float cosT = dot(bent, vhat);
    // cos θ' = (cos θ + β) / (1 + β cos θ)
    float newCosT = (cosT + beta) / (1.0 + beta * cosT);
    float sinT = sqrt(max(1.0 - cosT * cosT, 0.0));
    float newSinT = sqrt(max(1.0 - newCosT * newCosT, 0.0));
    vec3 perp = (sinT > 1e-4) ? normalize(bent - vhat * cosT) : vec3(0.0);
    sampleDir = normalize(vhat * newCosT + perp * newSinT);

    // Doppler factor D = 1 / (γ (1 - β cosθ)). Beaming intensity ∝ D^4.
    float gamma = 1.0 / sqrt(max(1.0 - beta * beta, 1e-4));
    doppler = 1.0 / (gamma * (1.0 - beta * cosT));
  }

  // Nebula base — always visible, sampled along (aberrated) direction.
  vec3 color = nebula(sampleDir);

  // Starfield — 2 Worley layers for depth variety.
  float dLow  = mix(35.0, 80.0, clamp(uStarDensity, 0.0, 1.0));
  float dHigh = dLow * 2.2;
  color += starLayer(sampleDir, dLow);
  color += starLayer(sampleDir, dHigh) * 0.6;

  // Relativistic beaming: pile intensity into the forward cone, thin out behind.
  color *= pow(doppler, 4.0);

  // Doppler hue shift: forward → blue, backward → red. Subtle tint.
  float hueShift = clamp((doppler - 1.0) * 0.6, -0.5, 0.5);
  color.b *= 1.0 + hueShift * 0.3;
  color.r *= 1.0 - hueShift * 0.2;

  // System tint: warm at home, cool in alien system. Applied after beaming
  // so the shift affects the final starfield mood.
  vec3 homeTint  = vec3(1.0, 0.98, 0.95);
  vec3 alienTint = vec3(0.82, 0.92, 1.15);
  color *= mix(homeTint, alienTint, clamp(uSystemTint, 0.0, 1.0));

  // Photon ring — narrow bright gaussian at b = 1.5·rs.
  // Plus faint secondary "photon sub-ring" slightly inside it.
  if (tClosest > 0.0) {
    float photonR = 1.5 * rs;
    float w1 = 0.05 * uThroatRadius;
    float ring1 = exp(-pow((b - photonR) / w1, 2.0));
    float w2 = 0.025 * uThroatRadius;
    float ring2 = exp(-pow((b - photonR * 0.88) / w2, 2.0)) * 0.55;
    // Hot-white core fading to amber at the edges.
    vec3 ringColor = mix(vec3(1.6, 1.35, 1.0), vec3(1.2, 0.6, 0.25),
                         smoothstep(0.0, 1.0, abs(b - photonR) / (photonR * 0.5)));
    color += ringColor * (ring1 + ring2) * uPhotonRingIntensity;
  }

  // Lensed accretion disk halo.
  if (uDiskLensing > 0.001 && abs(bent.y) > 1e-3) {
    float tHit = -rayOrigin.y / bent.y;
    if (tHit > 0.0) {
      vec3 hit = rayOrigin + bent * tHit;
      float rDisk = length(hit.xz);
      if (rDisk > uDiskInner && rDisk < uDiskOuter) {
        color += sampleLensedDisk(hit) * uDiskLensing;
      }
    }
  }

  gl_FragColor = vec4(color, 1.0);
}
