// ----------------------------------------------------------------------------
// accretion.frag — hot plasma disk around the wormhole throat.
//
// Physics approximations:
//   * Differential rotation is Keplerian: angular velocity ω ∝ r^(-3/2),
//     so inner rings spin much faster than outer rings (per Kepler III).
//   * Radial temperature ramp goes hot-white at the inner edge → amber
//     mid → violet outer. This is a stylized three-stop ramp; in reality
//     temperature follows (r^-3/4) for a thin accretion disk.
//   * Doppler shift uses the non-relativistic approximation
//         color_shift ≈ 1 - (v · n) / c
//     where v is the local tangential velocity and n is the camera ray.
//     We tint RGB toward blue (approaching) or red (receding), capped to
//     ±15% so the effect reads without destroying the palette.
//   * Turbulence is layered value-noise on polar coordinates — a stand-in
//     for MHD turbulence in the real disk.
// ----------------------------------------------------------------------------

precision highp float;

uniform float uTime;
uniform float uAccretionSpeed;
uniform float uThroatRadius;
uniform vec3  uCameraPos;

varying vec2 vUv;
varying vec3 vWorldPos;

// Value noise scaffold.
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Three-stop temperature ramp keyed on normalized radius t ∈ [0, 1].
vec3 temperatureColor(float t) {
  vec3 hotCore = vec3(1.00, 0.95, 0.85);  // near-white
  vec3 amberMid = vec3(1.00, 0.55, 0.15); // orange/amber
  vec3 violet   = vec3(0.45, 0.20, 0.70); // deep violet outer
  vec3 inner = mix(hotCore, amberMid, smoothstep(0.0, 0.45, t));
  vec3 outer = mix(amberMid, violet, smoothstep(0.45, 1.0, t));
  return mix(inner, outer, smoothstep(0.35, 0.55, t));
}

void main() {
  // The torus UV.x runs around the major circle (phi), UV.y around the
  // minor (cross-section). We only need phi and a radial coordinate
  // built from the world position to do polar math.
  float phi = vUv.x * 6.28318530718;

  // Radial distance from the wormhole axis (y-axis in world space, since
  // we rotate the torus flat). This is the physical "disk radius".
  vec2 planar = vec2(vWorldPos.x, vWorldPos.z);
  float r = length(planar);

  // Normalize r into [0, 1] over the disk extent. Inner edge is just
  // outside the throat radius; outer edge at disk outer radius (~2.1
  // for a Torus(1.5, 0.6)).
  float rInner = uThroatRadius * 1.05;
  float rOuter = 2.1;
  float rNorm = clamp((r - rInner) / (rOuter - rInner), 0.0, 1.0);

  // Keplerian differential rotation: theta shift ∝ r^(-3/2).
  float omega = uAccretionSpeed / max(pow(r, 1.5), 0.05);
  float theta = phi + uTime * omega;

  // Turbulence in the (theta, r) plane — two octaves.
  float n1 = noise2(vec2(theta * 2.0, rNorm * 6.0));
  float n2 = noise2(vec2(theta * 5.0, rNorm * 14.0));
  float turbulence = mix(n1, n2, 0.4);

  // Radial bands: thin dark striations modulated by turbulence.
  float bands = 0.8 + 0.4 * sin(theta * 3.0 + turbulence * 4.0);

  // Base color from the temperature ramp.
  vec3 color = temperatureColor(rNorm);
  color *= mix(0.8, 1.2, turbulence) * bands;

  // Doppler shift. Tangential velocity direction at this disk point
  // (perpendicular to the radial, in the plane), rotating counter-clockwise.
  vec2 tangent = vec2(-sin(phi), cos(phi));
  vec3 vDir = vec3(tangent.x, 0.0, tangent.y);
  vec3 toCamera = normalize(uCameraPos - vWorldPos);
  float dopplerAmount = dot(vDir, toCamera); // + = approaching, - = receding
  // Scale by local speed (fast near center) and cap at ±0.15.
  float speedFactor = clamp(1.0 / max(pow(r, 0.5), 0.3), 0.0, 2.0);
  float doppler = clamp(dopplerAmount * speedFactor * 0.15, -0.15, 0.15);
  color.b *= 1.0 + doppler;       // approaching → more blue
  color.r *= 1.0 - doppler * 0.6; // receding → more red

  // Soft inner and outer cutoff so the disk doesn't clip hard against
  // the torus geometry.
  float innerFade = smoothstep(0.0, 0.08, rNorm);
  float outerFade = 1.0 - smoothstep(0.85, 1.0, rNorm);
  float alpha = innerFade * outerFade;

  // Boost intensity so bloom pass has something to grab.
  color *= 1.8;

  gl_FragColor = vec4(color, alpha);
}
