// Pass-through vertex shader for the traversal tunnel cylinder.
// Forwards UV (u = circumference, v = length) and world position so the
// fragment can compute cylindrical effects and chromatic edge fringe.

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
