// Pass-through vertex shader for planetary rings (flat annulus).
// Forwards world position so the fragment can test planet shadow.

varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
