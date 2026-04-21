// ----------------------------------------------------------------------------
// planet.frag — procedural planet surface shader.
//
// Two presets:
//   0 = Mercury. Dark brown-gray, geometric albedo ~0.14, patchy
//       highlands/plains contrast (stand-ins for Caloris/Rachmaninoff),
//       Worley-based crater darkening. NO blue tint — real Mercury is
//       boring brown-gray and painting it silver is the tell of a fake.
//   1 = Dark ringed world. Near-black rocky base, faint violet ambient,
//       sharp hot rim light on the sun-facing edge (Fresnel-ish).
//
// Physics-adjacent:
//   * Lambertian diffuse term max(0, dot(N, sunDir)).
//   * Soft ambient term so the dark hemisphere doesn't crush to pure 0.
//   * Rim lighting via pow(1 - dot(N, V), 4) — cheap Fresnel stand-in,
//     real atmospheres scatter light differently but this reads well.
// ----------------------------------------------------------------------------

precision highp float;

uniform float uTime;
uniform int   uPreset;
uniform vec3  uSunDir;        // world-space direction *toward* the star
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

// Worley F1 distance — used for crater centers.
float worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float minD = 1.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 c = vec3(float(x), float(y), float(z));
        vec3 pt = c + hash33(i + c);
        minD = min(minD, length(f - pt));
      }
    }
  }
  return minD;
}

// --------- Mercury ---------
vec3 mercurySurface(vec3 n) {
  // Sample noise in normal-space so bands wrap around the sphere.
  vec3 p = n * 2.2;

  // Large-scale "mare" variation: Caloris ejecta (lighter) vs Rachmaninoff
  // plains (darker). Mix along a low-frequency 3D noise.
  float mare = smoothstep(0.35, 0.65, noise3(p * 0.9));
  vec3 highlands = vec3(0.35, 0.32, 0.29); // Caloris ejecta
  vec3 plains    = vec3(0.22, 0.20, 0.18); // darker mare
  vec3 base = mix(plains, highlands, mare);

  // Mid-frequency "grain" for visual interest.
  float grain = noise3(p * 6.0) * 0.08;
  base += grain - 0.04;

  // Craters: two Worley octaves; rim highlight around each crater center.
  float c1 = worley(p * 5.0);
  float c2 = worley(p * 11.0);
  float craterDepth = smoothstep(0.0, 0.12, c1) * 0.35
                    + smoothstep(0.0, 0.08, c2) * 0.15;
  float rim = (1.0 - smoothstep(0.08, 0.14, c1)) * 0.25;
  base *= (1.0 - craterDepth);
  base += vec3(0.40, 0.34, 0.28) * rim;

  return base;
}

// --------- Dark ringed world ---------
vec3 darkRockySurface(vec3 n) {
  vec3 p = n * 1.8;
  // Banded rocky variation — fast vertical-ish streaking.
  float bands = noise3(p * vec3(8.0, 2.5, 8.0));
  float roughness = noise3(p * 14.0);
  vec3 dark    = vec3(0.06, 0.05, 0.07);
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
  if (uPreset == 0) {
    albedo = mercurySurface(N);
  } else {
    albedo = darkRockySurface(N);
  }

  // Lambertian + ambient.
  float ndotl = max(0.0, dot(N, L));
  vec3 ambient;
  if (uPreset == 0) {
    // Mercury ambient: tiny warm bounce off nearby sun (we're "inside" Mercury's orbit).
    ambient = vec3(0.04, 0.035, 0.03);
  } else {
    // Alien ambient: cool violet scattered light.
    ambient = vec3(0.025, 0.02, 0.04);
  }
  vec3 diffuse = albedo * (ambient + uSunColor * ndotl);

  // Rim lighting — pow(1 - N·V, 4) cheap Fresnel stand-in. Only on the
  // sun-facing hemisphere so it reads as actual scattered starlight.
  float rim = pow(1.0 - max(0.0, dot(N, V)), 4.0);
  float sideLit = smoothstep(-0.2, 0.5, dot(N, L));
  vec3 rimColor = (uPreset == 1)
    ? uSunColor * 0.9   // sharp hot rim on the dark world
    : uSunColor * 0.25; // soft warm edge on Mercury
  diffuse += rimColor * rim * sideLit;

  gl_FragColor = vec4(diffuse, 1.0);
}
