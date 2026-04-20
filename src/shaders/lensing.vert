// Pass-through vertex shader for the star-field sphere.
// Forwards world-space position so the fragment shader can cast rays
// from the camera toward the fragment without having to reconstruct it.

varying vec3 vWorldPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
