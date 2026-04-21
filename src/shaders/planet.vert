// Pass-through vertex shader for procedural planets. We forward the
// world-space position, the world-space normal (so Lambertian shading
// uses the scene's sun direction), and the uv.

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  // normalMatrix handles non-uniform scale; we use uniform spheres so
  // this reduces to a simple rotation.
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
