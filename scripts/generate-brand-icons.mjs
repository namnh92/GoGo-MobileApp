// Node >=22.18 (native TypeScript stripping). No network or generated artwork.
// Run: node scripts/generate-brand-icons.mjs [--svg-only]
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { brandLogo, text, darkText } from '../src/shared/ui/tokens.ts'
import { logoPaths } from '../src/shared/ui/gogo-logo.asset.ts'

const assets = new URL('../assets/', import.meta.url)
const directory = new URL('brand/', assets)
await mkdir(directory, { recursive: true })
const stops = entries => entries.map(([offset, color, opacity = 1]) => `<stop offset="${offset}%" stop-color="${color}" stop-opacity="${opacity}"/>`).join('')
const body = `<defs>
  <linearGradient id="spectrum" x1="0%" x2="100%" y1="58%" y2="42%">${stops(brandLogo.spectrum)}</linearGradient>
  <linearGradient id="bridge" x1="0%" x2="100%" y1="100%" y2="0%">${stops(brandLogo.bridge)}</linearGradient>
</defs>
${logoPaths.stars.map((d, i) => `<path d="${d}" fill="${brandLogo.stars[i]}" opacity="${i === 0 ? 0.95 : 0.9}"/>`).join('\n')}
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="${logoPaths.ribbon}" stroke="url(#spectrum)" stroke-width="42"/>
  <path d="${logoPaths.bridge}" stroke="url(#bridge)" stroke-width="42"/>
  ${logoPaths.highlights.map((d, i) => `<path d="${d}" stroke="${brandLogo.highlight}" stroke-width="7" opacity="${i === 0 ? 0.42 : 0.45}"/>`).join('\n')}
</g>`
const svg = (content, viewBox = '0 0 1024 1024') => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${viewBox}">${content}</svg>\n`
const background = `<rect width="1024" height="1024" fill="${brandLogo.background}"/>`
// Bounds of the shared absolute M/C/Q/Z paths, including round strokes.
// Evaluate curve extrema rather than control points or the 400×320 viewBox.
const pathBounds = (path, strokeWidth = 0) => {
  const tokens = path.match(/[MCQZ]|-?\d+(?:\.\d+)?/g)
  const xs = [], ys = []
  let point, start
  const include = p => { xs.push(p[0]); ys.push(p[1]) }
  const readPoint = () => [Number(tokens.shift()), Number(tokens.shift())]
  while (tokens.length) {
    const command = tokens.shift()
    if (command === 'M') { point = start = readPoint(); include(point); continue }
    if (command === 'Z') { point = start; continue }
    if (command !== 'C' && command !== 'Q') throw new Error(`Unsupported logo path command: ${command}`)
    const points = [point, readPoint(), readPoint()]
    if (command === 'C') points.push(readPoint())
    include(points.at(-1))
    for (const axis of [0, 1]) {
      const [p0, p1, p2, p3] = points.map(p => p[axis])
      const a = command === 'C' ? -p0 + 3 * p1 - 3 * p2 + p3 : 0
      const b = command === 'C' ? 2 * (p0 - 2 * p1 + p2) : p0 - 2 * p1 + p2
      const c = p1 - p0
      const discriminant = b * b - 4 * a * c
      const roots = Math.abs(a) < 1e-12 ? (Math.abs(b) < 1e-12 ? [] : [-c / b])
        : discriminant < 0 ? [] : [(-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a)]
      for (const t of roots.filter(t => t > 0 && t < 1)) {
        // De Casteljau evaluation works for both quadratic and cubic curves.
        let values = points.map(p => p[axis])
        while (values.length > 1) values = values.slice(1).map((v, i) => (1 - t) * values[i] + t * v)
        ;(axis === 0 ? xs : ys).push(values[0])
      }
    }
    point = points.at(-1)
  }
  const radius = strokeWidth / 2
  return [Math.min(...xs) - radius, Math.min(...ys) - radius, Math.max(...xs) + radius, Math.max(...ys) + radius]
}
const unionBounds = boxes => [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))]
const ribbonGeometry = [[logoPaths.ribbon, 42], [logoPaths.bridge, 42], ...logoPaths.highlights.map(path => [path, 7])]
const geometry = [...ribbonGeometry, ...logoPaths.stars.map(path => [path, 0])]
const ribbonBounds = unionBounds(ribbonGeometry.map(([path, width]) => pathBounds(path, width)))
const contentBounds = unionBounds(geometry.map(([path, width]) => pathBounds(path, width)))
console.log(`Source ribbon bounds=${JSON.stringify(ribbonBounds)}; all content bounds=${JSON.stringify(contentBounds)}`)
// Centre the visual ribbon body; the stars above it otherwise push it too low.
// Stars still count towards canvas/safe-zone containment. Keep the approved +15%.
const centre = [(ribbonBounds[0] + ribbonBounds[2]) / 2, (ribbonBounds[1] + ribbonBounds[3]) / 2]
const placement = scale => {
  const offset = centre.map(value => 512 - value * scale)
  const bounds = contentBounds.map((value, i) => value * scale + offset[i % 2])
  if (bounds.some(value => value < 0 || value > 1024)) throw new Error('Logo content exceeds icon canvas')
  const transform = `translate(${offset.map(value => Number(value.toFixed(9))).join(' ')}) scale(${scale})`
  console.log(`${transform}; ribbon centre=(512, 512); content bounds=${JSON.stringify(bounds)}; content centre=(${(bounds[0] + bounds[2]) / 2}, ${(bounds[1] + bounds[3]) / 2})`)
  return { transform, bounds }
}
const icon = placement(2.208)
const adaptive = placement(1.472)
// Bézier curves stay in their control-point convex hull. Check that hull plus
// the round stroke radius against Android's central safe-zone circle (313px).
const adaptiveRadius = Math.max(...geometry.flatMap(([path, width]) => {
  const coordinates = path.match(/-?\d+(?:\.\d+)?/g).map(Number)
  return coordinates.filter((_, i) => i % 2 === 0).map((x, i) =>
    (Math.hypot(x - centre[0], coordinates[i * 2 + 1] - centre[1]) + width / 2) * 1.472)
}))
if (adaptiveRadius > 313) throw new Error('Logo content exceeds adaptive safe zone')
console.log(`Adaptive painted-content radius <= ${adaptiveRadius}px (safe zone: 313px)`)
const foreground = `<g transform="${adaptive.transform}">${body}</g>`
const sources = {
  'gogo-mark.svg': svg(body, '0 0 400 320'),
  'icon.svg': svg(`${background}<g transform="${icon.transform}">${body}</g>`),
  'adaptive-foreground.svg': svg(foreground),
  'adaptive-background.svg': svg(background),
}
// Native launch uses the same option B lockup before React is ready.
for (const [mode, ink] of [['light', text.primary], ['dark', darkText.primary]]) {
  sources[`splash-${mode}.svg`] = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="948" viewBox="0 0 400 370"><g transform="translate(0 -20)">${body}</g><text x="200" y="338" text-anchor="middle" fill="${ink}" font-family="Inter" font-size="68" font-weight="800" letter-spacing="3.5">go go</text></svg>\n`
}
for (const [name, source] of Object.entries(sources)) await writeFile(new URL(name, directory), source)
console.log('Generated SVGs in assets/brand from the shared option A paths and palette.')
if (!process.argv.includes('--svg-only')) {
  let sharp
  try {
    const require = createRequire(import.meta.url)
    try { sharp = require(process.env.GOGO_SHARP_MODULE || 'sharp') } catch {
      const expoRequire = createRequire(require.resolve('expo/package.json'))
      sharp = await expoRequire('@expo/image-utils').findSharpInstanceAsync()
    }
  } catch {
    throw new Error('SVG PNG generation requires sharp. Install sharp@0.34.5 or set GOGO_SHARP_MODULE to its absolute module path, then rerun node scripts/generate-brand-icons.mjs. Existing PNGs were not changed.')
  }
  // Register the bundled font with fontconfig before librsvg draws wordmarks;
  // never depend on whichever fonts happen to be installed on the host.
  await sharp({ text: { text: 'go go', font: 'Inter ExtraBold 68', fontfile: fileURLToPath(new URL('fonts/Inter-ExtraBold.ttf', assets)), rgba: true } }).png().toBuffer()
  // Explicit PNG settings and no metadata/timestamps make repeat runs identical
  // with the same locked sharp/libvips version. iOS icon is fully opaque RGB.
  for (const [source, target, opaque] of [
    ['icon.svg', 'icon.png', true],
    ['adaptive-foreground.svg', 'adaptive-icon.png', false],
    ['adaptive-background.svg', 'adaptive-icon-background.png', true],
  ]) {
    let pipeline = sharp(Buffer.from(sources[source])).resize(1024, 1024)
    if (opaque) pipeline = pipeline.flatten({ background: brandLogo.background }).removeAlpha()
    await pipeline.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toFile(fileURLToPath(new URL(target, assets)))
    console.log(`Generated assets/${target} (1024×1024)`)
  }
  for (const [source, target] of [['splash-light.svg', 'splash-icon.png'], ['splash-dark.svg', 'splash-icon-dark.png']]) {
    await sharp(Buffer.from(sources[source])).png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toFile(fileURLToPath(new URL(target, assets)))
    console.log(`Generated assets/${target} (1024×948)`)
  }
}
