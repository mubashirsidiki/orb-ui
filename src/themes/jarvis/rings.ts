// ─── Ring drawing helper ──────────────────────────────────────────────────────

/**
 * Draw a ring made of N arc segments with gaps.
 *
 * @param ctx        Canvas 2D context
 * @param cx         Center X
 * @param cy         Center Y
 * @param radius     Ring radius in pixels
 * @param segments   Number of arc segments
 * @param gapFraction Fraction of circumference that is gaps (e.g. 0.15 = 15%)
 * @param rotation   Current rotation offset in radians
 * @param color      CSS color string (hex or named)
 * @param alpha      Opacity 0–1
 * @param lineWidth  Stroke width in pixels
 * @param glowSize   shadowBlur size
 */
export function drawRing(
  ctx:          CanvasRenderingContext2D,
  cx:           number,
  cy:           number,
  radius:       number,
  segments:     number,
  gapFraction:  number,
  rotation:     number,
  color:        string,
  alpha:        number,
  lineWidth:    number,
  glowSize:     number,
): void {
  ctx.save()

  const totalAngle   = Math.PI * 2
  const totalGap     = totalAngle * gapFraction
  const totalArc     = totalAngle - totalGap
  const arcPerSeg    = totalArc / segments
  const gapPerSeg    = totalGap / segments
  const segmentCycle = arcPerSeg + gapPerSeg

  ctx.globalAlpha   = alpha
  ctx.strokeStyle   = color
  ctx.lineWidth     = lineWidth
  ctx.shadowColor   = color
  ctx.shadowBlur    = glowSize
  ctx.lineCap       = 'round'

  for (let i = 0; i < segments; i++) {
    const startAngle = rotation + i * segmentCycle
    const endAngle   = startAngle + arcPerSeg

    ctx.beginPath()
    ctx.arc(cx, cy, radius, startAngle, endAngle)
    ctx.stroke()
  }

  ctx.restore()
}

// ─── Scan line with comet tail ────────────────────────────────────────────────

/**
 * Draw a scan line from center to `maxRadius`, with a fading tail arc behind it.
 */
export function drawScanLine(
  ctx:       CanvasRenderingContext2D,
  cx:        number,
  cy:        number,
  maxRadius: number,
  angle:     number,
  color:     string,
  alpha:     number,
  scale:     number,
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  // Comet tail — a gradient arc going backwards ~90 degrees
  const tailAngle = Math.PI * 0.5

  // Draw several arc slices at decreasing opacity for the tail
  const tailSteps = 12
  for (let i = 0; i < tailSteps; i++) {
    const frac      = i / tailSteps
    const arcStart  = angle - tailAngle * (1 - frac)
    const arcEnd    = angle - tailAngle * (1 - (i + 1) / tailSteps)
    const tailAlpha = alpha * frac * 0.35

    ctx.globalAlpha  = tailAlpha
    ctx.strokeStyle  = color
    ctx.lineWidth    = 2 * scale
    ctx.shadowColor  = color
    ctx.shadowBlur   = 6 * scale
    ctx.lineCap      = 'round'

    ctx.beginPath()
    ctx.arc(cx, cy, maxRadius * 0.6, arcStart, arcEnd)
    ctx.stroke()
  }

  // The main scan line: center → ring 3 edge
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth   = 1.5 * scale
  ctx.shadowColor = color
  ctx.shadowBlur  = 10 * scale
  ctx.lineCap     = 'round'

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(
    cx + Math.cos(angle) * maxRadius,
    cy + Math.sin(angle) * maxRadius,
  )
  ctx.stroke()

  ctx.restore()
}

// ─── Background grid ──────────────────────────────────────────────────────────

/**
 * Draw faint concentric dashed circles as a background grid.
 */
export function drawBackgroundGrid(
  ctx:       CanvasRenderingContext2D,
  cx:        number,
  cy:        number,
  maxRadius: number,
  ringCount: number,
  color:     string,
  alpha:     number,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth   = 0.5
  ctx.setLineDash([3, 6])

  for (let i = 1; i <= ringCount; i++) {
    const r = (maxRadius / ringCount) * i
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // A few subtle radial spokes
  ctx.setLineDash([2, 8])
  const spokeCount = 8
  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * maxRadius * 0.15, cy + Math.sin(a) * maxRadius * 0.15)
    ctx.lineTo(cx + Math.cos(a) * maxRadius,        cy + Math.sin(a) * maxRadius)
    ctx.stroke()
  }

  ctx.setLineDash([])
  ctx.restore()
}
