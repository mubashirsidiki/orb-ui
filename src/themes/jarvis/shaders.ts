export const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uVolume;

varying vec3 vNormal;
varying vec3 vViewDir;

float noise(vec3 p) {
  return sin(p.x * 3.0 + uTime) * sin(p.y * 2.5 + uTime * 0.7) * sin(p.z * 2.0 + uTime * 1.3);
}

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec3 pos = position;
  float displacement = noise(pos * 1.5 + uTime * 0.3) * (0.01 + uVolume * 0.03);
  pos += normal * displacement;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vViewDir = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`

export const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uBrightness;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.5);
  vec3 color = uColor * (0.3 + fresnel * uBrightness);
  gl_FragColor = vec4(color, 0.4 + fresnel * 0.6);
}
`
