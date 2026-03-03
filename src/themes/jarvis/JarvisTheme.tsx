import { useRef, useEffect, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { OrbState } from '../../components/VoiceOrb/VoiceOrb.types'
import { vertexShader, fragmentShader } from './shaders'
import {
  STATE_CONFIG,
  RING_DEFS,
  PARTICLE_COUNT,
  PARTICLE_RADIUS_MIN,
  PARTICLE_RADIUS_MAX,
  PARTICLE_SIZE,
  PARTICLE_BASE_OPACITY,
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2

    // ── Post-processing (bloom) ──────────────────────────────────────────────
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size, size),
      1.5,  // strength
      0.4,  // radius
      0.85, // threshold
    )
    composer.addPass(bloomPass)

    // ── Sphere with custom shader ────────────────────────────────────────────
    const sphereGeo = new THREE.IcosahedronGeometry(1, 6)
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

    // ── 3D Rings ─────────────────────────────────────────────────────────────
    const rings: THREE.Mesh[] = []
    for (const def of RING_DEFS) {
      const ringGeo = new THREE.TorusGeometry(def.radius, def.tube, 2, 120)
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.7,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = def.tiltX
      ring.rotation.z = def.tiltZ
      scene.add(ring)
      rings.push(ring)
    }

    // ── Particle cloud ───────────────────────────────────────────────────────
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = PARTICLE_RADIUS_MIN + Math.random() * (PARTICLE_RADIUS_MAX - PARTICLE_RADIUS_MIN)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particleMat = new THREE.PointsMaterial({
      color: 0x00d4ff,
      size: PARTICLE_SIZE,
      transparent: true,
      opacity: PARTICLE_BASE_OPACITY,
    })
    const points = new THREE.Points(particleGeo, particleMat)
    scene.add(points)

    // ── Animation state ──────────────────────────────────────────────────────
    let currentBloom = STATE_CONFIG[state].bloomStrength
    let currentBrightness = STATE_CONFIG[state].brightness
    let currentSphereSpeed = STATE_CONFIG[state].sphereSpeed
    let currentRingOpacity = STATE_CONFIG[state].ringOpacity
    let currentVolMult = STATE_CONFIG[state].volMult
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
      currentBrightness = lerp(currentBrightness, cfg.brightness, LERP_RATE)
      currentSphereSpeed = lerp(currentSphereSpeed, cfg.sphereSpeed, LERP_RATE)
      currentRingOpacity = lerp(currentRingOpacity, cfg.ringOpacity, LERP_RATE)
      currentVolMult = lerp(currentVolMult, cfg.volMult, LERP_RATE)
      currentColorR = lerp(currentColorR, cfg.color.r, LERP_RATE)
      currentColorG = lerp(currentColorG, cfg.color.g, LERP_RATE)
      currentColorB = lerp(currentColorB, cfg.color.b, LERP_RATE)

      time += 0.016 * currentSphereSpeed

      // Update sphere uniforms
      sphereMat.uniforms.uTime.value = time
      sphereMat.uniforms.uVolume.value = vol * currentVolMult
      sphereMat.uniforms.uColor.value.setRGB(currentColorR, currentColorG, currentColorB)
      sphereMat.uniforms.uBrightness.value = currentBrightness

      // Sphere slow rotation
      sphere.rotation.y += 0.002 * currentSphereSpeed
      sphere.rotation.x += 0.001 * currentSphereSpeed

      // Update bloom
      bloomPass.strength = currentBloom + vol * 0.8

      // Update rings
      rings.forEach((ring, i) => {
        const def = RING_DEFS[i]
        ring.rotation.y += def.speed * 0.016
        const mat = ring.material as THREE.MeshBasicMaterial
        mat.opacity = currentRingOpacity + vol * 0.3
        mat.color.setRGB(currentColorR, currentColorG, currentColorB)
      })

      // Update particles
      points.rotation.y += 0.0005
      particleMat.opacity = 0.4 + vol * 0.4
      particleMat.color.setRGB(currentColorR, currentColorG, currentColorB)

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
      rings.forEach(ring => {
        ring.geometry.dispose()
        ;(ring.material as THREE.MeshBasicMaterial).dispose()
      })
      particleGeo.dispose()
      particleMat.dispose()
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
