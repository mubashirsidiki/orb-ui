import { useRef, useEffect, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { OrbState } from '../../components/VoiceOrb/VoiceOrb.types'
import { vertexShader, fragmentShader } from './shaders'
import {
  STATE_CONFIG,
  RING1_RADIUS, RING1_PARTICLES, RING1_WAVE_FREQ, RING1_WAVE_SPEED, RING1_TILT_X,
  RING2_RADIUS, RING2_PARTICLES, RING2_WAVE_FREQ, RING2_WAVE_SPEED, RING2_TILT_X,
  RING_PARTICLE_SIZE, RING_COLOR, VOLUME_AMP,
  LERP_RATE,
} from './constants'

interface JarvisThemeProps {
  state: OrbState
  volume: number
  size: number
  className?: string
  style?: React.CSSProperties
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function updateRing(
  positions: Float32Array, N: number, radius: number,
  waveFreq: number, waveSpeed: number, amplitude: number,
  time: number, tiltX: number,
) {
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2
    const disp = amplitude * Math.sin(angle * waveFreq + time * waveSpeed)
    const r = radius + disp
    const x = r * Math.cos(angle)
    const yFlat = r * Math.sin(angle)
    const y = yFlat * Math.cos(tiltX)
    const z = yFlat * Math.sin(tiltX)
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
  }
}

export function JarvisTheme({ state, volume, size, className, style }: JarvisThemeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const volumeRef = useRef(volume)
  const stateRef = useRef(state)

  useLayoutEffect(() => { volumeRef.current = volume }, [volume])
  useLayoutEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size <= 0) return

    // ── Scene setup ──────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.z = 3.5

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(size, size)
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2

    // ── Post-processing (bloom) ──────────────────────────────────────────────
    const renderTarget = new THREE.WebGLRenderTarget(size * dpr, size * dpr, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    })
    const composer = new EffectComposer(renderer, renderTarget)
    composer.addPass(new RenderPass(scene, camera))
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size, size),
      1.5,  // strength
      0.4,  // radius
      0.85, // threshold
    )
    composer.addPass(bloomPass)

    // ── Sphere with custom shader ────────────────────────────────────────────
    const sphereGeo = new THREE.IcosahedronGeometry(1, 5)
    const sphereMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uVolume: { value: 0 },
        uColor: { value: new THREE.Color(0x00d4ff) },
        uBrightness: { value: 0.6 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    scene.add(sphere)

    // ── Particle Ring 1 ──────────────────────────────────────────────────────
    const ring1Positions = new Float32Array(RING1_PARTICLES * 3)
    const ring1Geo = new THREE.BufferGeometry()
    ring1Geo.setAttribute('position', new THREE.BufferAttribute(ring1Positions, 3))
    const ring1Mat = new THREE.PointsMaterial({
      color: RING_COLOR,
      size: RING_PARTICLE_SIZE,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
    const ring1Points = new THREE.Points(ring1Geo, ring1Mat)
    scene.add(ring1Points)

    // ── Particle Ring 2 ──────────────────────────────────────────────────────
    const ring2Positions = new Float32Array(RING2_PARTICLES * 3)
    const ring2Geo = new THREE.BufferGeometry()
    ring2Geo.setAttribute('position', new THREE.BufferAttribute(ring2Positions, 3))
    const ring2Mat = new THREE.PointsMaterial({
      color: RING_COLOR,
      size: RING_PARTICLE_SIZE,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
    const ring2Points = new THREE.Points(ring2Geo, ring2Mat)
    scene.add(ring2Points)

    // ── Animation state ──────────────────────────────────────────────────────
    let currentBloom = STATE_CONFIG[state].bloomStrength
    let currentAmplitude = STATE_CONFIG[state].amplitude
    let currentSphereVol = STATE_CONFIG[state].sphereVol
    let currentRingOpacity = STATE_CONFIG[state].ringOpacity
    let currentColorR = STATE_CONFIG[state].color.r
    let currentColorG = STATE_CONFIG[state].color.g
    let currentColorB = STATE_CONFIG[state].color.b
    let time = 0
    let rafId = 0

    // ── Animation loop ───────────────────────────────────────────────────────
    const animate = () => {
      const vol = volumeRef.current
      const st = stateRef.current
      const cfg = STATE_CONFIG[st]

      // Lerp all state values
      currentBloom = lerp(currentBloom, cfg.bloomStrength, LERP_RATE)
      currentAmplitude = lerp(currentAmplitude, cfg.amplitude, LERP_RATE)
      currentSphereVol = lerp(currentSphereVol, cfg.sphereVol, LERP_RATE)
      currentRingOpacity = lerp(currentRingOpacity, cfg.ringOpacity, LERP_RATE)
      currentColorR = lerp(currentColorR, cfg.color.r, LERP_RATE)
      currentColorG = lerp(currentColorG, cfg.color.g, LERP_RATE)
      currentColorB = lerp(currentColorB, cfg.color.b, LERP_RATE)

      time += 0.016

      // Ring amplitude = state amplitude + volume contribution
      const ringAmplitude = currentAmplitude + vol * VOLUME_AMP

      // Update sphere uniforms
      sphereMat.uniforms.uTime.value = time
      sphereMat.uniforms.uVolume.value = currentSphereVol * vol
      sphereMat.uniforms.uColor.value.setRGB(currentColorR, currentColorG, currentColorB)
      sphereMat.uniforms.uBrightness.value = 0.6 + vol * 0.4

      // Sphere slow rotation
      sphere.rotation.y += 0.002
      sphere.rotation.x += 0.001

      // Update bloom
      bloomPass.strength = currentBloom + vol * 0.8

      // Update particle rings
      updateRing(ring1Positions, RING1_PARTICLES, RING1_RADIUS, RING1_WAVE_FREQ, RING1_WAVE_SPEED, ringAmplitude, time, RING1_TILT_X)
      ring1Geo.attributes.position.needsUpdate = true
      ring1Mat.opacity = currentRingOpacity
      ring1Mat.color.setRGB(currentColorR, currentColorG, currentColorB)

      updateRing(ring2Positions, RING2_PARTICLES, RING2_RADIUS, RING2_WAVE_FREQ, RING2_WAVE_SPEED, ringAmplitude, time, RING2_TILT_X)
      ring2Geo.attributes.position.needsUpdate = true
      ring2Mat.opacity = currentRingOpacity
      ring2Mat.color.setRGB(currentColorR, currentColorG, currentColorB)

      // Render with post-processing
      composer.render()

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId)
      sphereGeo.dispose()
      sphereMat.dispose()
      ring1Geo.dispose()
      ring1Mat.dispose()
      ring2Geo.dispose()
      ring2Mat.dispose()
      renderTarget.dispose()
      bloomPass.dispose()
      composer.dispose()
      renderer.dispose()
    }
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, display: 'block', ...style }}
    />
  )
}
