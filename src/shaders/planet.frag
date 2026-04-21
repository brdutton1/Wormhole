// ----------------------------------------------------------------------------
// planet.frag — procedural planet surface shader.
//
// Presets:
//   0 = Ice world with crack lineae (Europa / Enceladus inspired).
//       Bright blue-white surface, dark crack network via Worley F2-F1
//       cell-edge distance, subtle cyan subsurface scattering, aurora
//       hint near poles.
//   1 = Dark ringed rocky world. Near-black base, sharp hot rim light.
//
// Physics-adjacent:
//   * Lambertian diffuse term max(0, dot(N, sunDir)).
//   * Soft ambient term so the dark hemisphere doesn't crush to pure 0.
//   * Rim lighting via pow(1 - dot(N, V), 4) — cheap Fresnel stand-in,
//     works well for both ice (high scatter) and dark rock (silhouette).
//   * For ice, a subsurface term brightens the shadow side slightly —
//     real ice scatters a lot of blue light internally.
// ----------------------------------------------------------------------------

precision highp float;

uniform float uTime;
uniform int   uPreset;
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform vec3  uCameraPos;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

// ---- hashes / noise ----
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
float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash13(i);
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

// Worley F1 (nearest) and F2 (second-nearest) in one pass. F2-F1 spikes
// to zero along cell edges → makes a crack network.
vec2 worleyF1F2(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float f1 = 1.0, f2 = 1.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 c = vec3(float(x), float(y), float(z));
        vec3 pt = c + hash33(i + c);
        float d = length(f - pt);
        if (d < f1) { f2 = f1; f1 = d; }
        else if (d < f2) { f2 = d; }
      }
    }
  }
  return vec2(f1, f2);
}

// --------- Ice world ---------
vec3 iceSurface(vec3 n) {
  // Sample in normal space so bands wrap properly.
  vec3 p = n * 2.0;

  // Base albedo: high (bright icy surface).
  vec3 iceWhite   = vec3(0.88, 0.93, 0.98);
  vec3 iceShadow  = vec3(0.60, 0.72, 0.88); // subsurface cyan

  // Macro variation: large "plate" regions.
  float plates = smoothstep(0.35, 0.65, noise3(p * 0.7));
  vec3 base = mix(iceShadow, iceWhite, plates);

  // Subtle mid-frequency stipple for "frost" texture.
  float stipple = noise3(p * 14.0) * 0.10;
  base += (stipple - 0.05);

  // Crack network: TWO octaves of Worley F2-F1.
  // Big primary lineae (like Europa's Argadnel Linea).
  vec2 w1 = worleyF1F2(p * 2.8);
  float cracks1 = 1.0 - smoothstep(0.0, 0.04, w1.y - w1.x);
  // Finer secondary fractures.
  vec2 w2 = worleyF1F2(p * 7.0);
  float cracks2 = (1.0 - smoothstep(0.0, 0.03, w2.y - w2.x)) * 0.55;
  float cracks = max(cracks1, cracks2);

  // Crack color: dark with a hint of reddish-brown (real Europa linea
  // tint from sulfur compounds).
  vec3 crackColor = vec3(0.22, 0.18, 0.28);
  base = mix(base, crackColor, cracks * 0.75);

  return base;
}

// --------- Dark ringed world ---------
vec3 darkRockySurface(vec3 n) {
  vec3 p = n * 1.8;
  float bands = noise3(p * vec3(8.0, 2.5, 8.0));
  float roughness = noise3(p * 14.0);
  vec3 dark     = vec3(0.06, 0.05, 0.07);
  vec3 lessDark = vec3(0.11, 0.09, 0.12);
  vec3 base = mix(dark, lessDark, smoothstep(0.3, 0.7, bands));
  base += vec3(0.03, 0.02, 0.05) * (roughness - 0.5);
  return base;
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPos);
  vec3 L = normalize(uSunDir);

  vec3 albedo;
  vec3 ambient;
  vec3 rimColor;
  float rimPower = 4.0;
  float subsurface = 0.0;

  if (uPreset == 0) {
    albedo = iceSurface(N);
    ambient = vec3(0.18, 0.22, 0.30); // cool ambient — ice reflects sky
    rimColor = uSunColor * 0.8;
    // Subsurface scattering: boost shadow-side brightness slightly with
    // a cyan tint. Real ice glows from within in dim light.
    subsurface = 0.4;
  } else {
    albedo = darkRockySurface(N);
    ambient = vec3(0.025, 0.02, 0.04);
    rimColor = uSunColor * 0.95; // sharp hot rim on the dark world
  }

  float ndotl = max(0.0, dot(N, L));
  vec3 diffuse = albedo * (ambient + uSunColor * ndotl);

  // Subsurface for ice: inverse Lambert term, tinted cyan.
  if (subsurface > 0.0) {
    float wrap = max(0.0, dot(N, -L) * 0.5 + 0.3);
    diffuse += albedo * vec3(0.55, 0.75, 1.0) * wrap * subsurface * 0.35;
  }

  // Rim light — only on the sun-facing edge (sideLit gate).
  float rim = pow(1.0 - max(0.0, dot(N, V)), rimPower);
  float sideLit = smoothstep(-0.2, 0.5, dot(N, L));
  diffuse += rimColor * rim * sideLit;

  // Aurora hint for ice: ribbon of violet near poles (|N.y| > 0.6), faint.
  if (uPreset == 0) {
    float polar = smoothstep(0.6, 0.85, abs(N.y));
    float shimmer = 0.5 + 0.5 * sin(uTime * 0.8 + N.x * 6.0 + N.z * 4.0);
    diffuse += vec3(0.45, 0.3, 0.8) * polar * shimmer * 0.12;
  }

  gl_FragColor = vec4(diffuse, 1.0);
}
