// ----------------------------------------------------------------------------
// accretion.frag — hot plasma disk, flat-annulus version.
//
// Physics approximations:
//   * Keplerian differential rotation: ω ∝ r^(-3/2).
//   * Radial temperature ramp: white-hot core → amber mid → violet outer.
//     Real thin disks follow T ∝ r^(-3/4); we shape a cleaner three-stop
//     ramp for look.
//   * Non-relativistic Doppler tint: approaching → blue, receding → red,
//     scaled by local tangential speed, capped at ±15%.
//   * Gravitational redshift: (1+z) = 1/sqrt(1 - rs/r). Inner ring loses
//     blue/green, gains red.
//   * Filamentary turbulence = two-octave value noise in (theta, r).
// ----------------------------------------------------------------------------

precision highp float;

uniform float uTime;
uniform float uAccretionSpeed;
uniform float uThroatRadius;
uniform vec3  uCameraPos;

varying vec2 vUv;
varying vec3 vWorldPos;

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

vec3 temperatureColor(float t) {
  vec3 hotCore = vec3(1.20, 1.05, 0.85);  // blown-out white (HDR)
  vec3 amberMid = vec3(1.00, 0.55, 0.15);
  vec3 violet   = vec3(0.55, 0.25, 0.85);
  vec3 inner = mix(hotCore, amberMid, smoothstep(0.0, 0.45, t));
  vec3 outer = mix(amberMid, violet, smoothstep(0.45, 1.0, t));
  return mix(inner, outer, smoothstep(0.35, 0.55, t));
}

void main() {
  // World-space polar coords: works for any flat xz-plane disk geometry.
  vec2 xz = vWorldPos.xz;
  float r = length(xz);
  float phi = atan(xz.y, xz.x); // xz.y is vWorldPos.z

  float rInner = uThroatRadius * 1.05;
  float rOuter = 2.1;
  float rNorm = clamp((r - rInner) / (rOuter - rInner), 0.0, 1.0);

  // Keplerian rotation.
  float omega = uAccretionSpeed / max(pow(r, 1.5), 0.05);
  float theta = phi + uTime * omega;

  // Two-octave turbulence; the high-freq octave rides the low.
  float n1 = noise2(vec2(theta * 2.0, rNorm * 6.0));
  float n2 = noise2(vec2(theta * 5.5 + n1 * 2.0, rNorm * 18.0));
  float turbulence = mix(n1, n2, 0.5);

  // Fine filament bands — big contrast swing sells the "hot plasma".
  float bands = 0.55 + 0.55 * sin(theta * 5.0 + turbulence * 7.0 + rNorm * 12.0);
  bands = mix(bands, 1.0, 0.35); // floor so it doesn't go fully dark.

  vec3 color = temperatureColor(rNorm);
  color *= mix(0.7, 1.4, turbulence) * bands;

  // Doppler tint.
  vec2 tangent = vec2(-sin(phi), cos(phi));
  vec3 vDir = vec3(tangent.x, 0.0, tangent.y);
  vec3 toCamera = normalize(uCameraPos - vWorldPos);
  float doppler = clamp(dot(vDir, toCamera)
                        * clamp(1.0 / max(pow(r, 0.5), 0.3), 0.0, 2.0)
                        * 0.15, -0.15, 0.15);
  color.b *= 1.0 + doppler;
  color.r *= 1.0 - doppler * 0.6;

  // Gravitational redshift, softened so the ramp doesn't flatten to red.
  float rs = uThroatRadius * 2.0;
  float zShift = 1.0 / sqrt(max(1.0 - rs / max(r, rs + 0.01), 0.05)) - 1.0;
  zShift = clamp(zShift, 0.0, 1.0);
  color.r *= 1.0 + 0.35 * zShift;
  color.g *= 1.0 - 0.10 * zShift;
  color.b *= 1.0 - 0.30 * zShift;

  // Edge fades.
  float innerFade = smoothstep(0.0, 0.08, rNorm);
  float outerFade = 1.0 - smoothstep(0.8, 1.0, rNorm);
  float alpha = innerFade * outerFade;

  color *= 2.2; // punch up for bloom.

  gl_FragColor = vec4(color, alpha);
}
