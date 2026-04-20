// ----------------------------------------------------------------------------
// tunnel.frag — interior of the wormhole during traversal.
//
// Physics approximations (all perceptual, none metric-accurate):
//   * Depth fog toward the throat center stands in for the Shapiro delay
//     region where incoming light is heavily redshifted.
//   * Time-based acceleration stretch (v' = v + pow(t,1.5)) is a visual
//     analogue of length contraction / rapidly accumulating proper time
//     as the camera crosses the throat.
//   * Chromatic aberration at the throat edge represents wavelength-
//     dependent bending — shorter wavelengths deflect more than longer,
//     so we sample R / G / B at slightly different radial offsets.
// ----------------------------------------------------------------------------

precision highp float;

uniform float uTime;
uniform float uTraversalMode;   // 0 = idle, 1 = traversing
uniform float uThroatRadius;
uniform vec3  uCameraPos;

varying vec2 vUv;
varying vec3 vWorldPos;

float hash21(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
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

// Sample a banded streak pattern at a given cylindrical UV.
vec3 sampleBands(vec2 uv) {
  float streak = noise2(vec2(uv.x * 40.0, uv.y * 6.0 - uTime * 2.0));
  float pulse = 0.5 + 0.5 * sin(uv.y * 60.0 - uTime * 5.0 + streak * 6.28);
  vec3 warm = vec3(1.0, 0.45, 0.15);
  vec3 cool = vec3(0.25, 0.15, 0.75);
  return mix(cool, warm, streak) * (0.4 + 0.6 * pulse);
}

void main() {
  // Cylindrical UV: u around the circumference, v along the length.
  vec2 uv = vUv;

  // Acceleration stretch: when traversing, squash v near the entry side
  // and stretch near the throat — gives a rushing-inward feel.
  float traversal = clamp(uTraversalMode, 0.0, 1.0);
  float stretch = 1.0 + traversal * pow(fract(uTime * 0.35), 1.5) * 1.2;
  uv.y = fract(uv.y * stretch + uTime * 0.15 * traversal);

  // Chromatic aberration: small radial offsets per channel. `edge` grows
  // as we approach either open end of the cylinder.
  float edge = smoothstep(0.35, 0.5, abs(vUv.y - 0.5));
  float ca = 0.004 * (1.0 + traversal * 2.0) * edge;
  vec3 color;
  color.r = sampleBands(uv + vec2(0.0,  ca)).r;
  color.g = sampleBands(uv).g;
  color.b = sampleBands(uv - vec2(0.0,  ca)).b;

  // Depth fog: darker toward the middle of the tunnel so the throat
  // reads as a well. vWorldPos.z is relative to the cylinder center.
  float depth = abs(vWorldPos.z) / 15.0;
  float fog = smoothstep(0.0, 1.0, 1.0 - depth);
  color *= mix(0.25, 1.0, fog);

  // Amplify overall intensity during traversal so the tunnel pops.
  color *= mix(0.6, 1.4, traversal);

  // Fade both open ends so the cylinder doesn't show hard seams.
  float alpha = 1.0 - edge * 0.9;
  alpha *= mix(0.0, 1.0, smoothstep(0.0, 0.15, traversal) + 0.4);

  gl_FragColor = vec4(color, alpha);
}
