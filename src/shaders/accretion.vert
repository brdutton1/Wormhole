// Pass-through vertex shader for the accretion torus.
// The disk lives on the xz-plane in world space; we forward UVs (mapped
// around the torus) and the world position for Doppler calculations in
// the fragment shader.

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
