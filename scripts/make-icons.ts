/**
 * Draws the app icons. No image library: the mark is three bars of decreasing
 * ink — the fade the whole product is built around — so it is a few rounded
 * rectangles, supersampled and written out as PNG with node's own zlib.
 *
 *   npm run icons
 */
import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve(process.cwd(), 'public/icons')

const INK: RGB = [0x14, 0x18, 0x1f]
const PAPER: RGB = [0xee, 0xf0, 0xea]

type RGB = [number, number, number]

/** Coordinates are in a 0–1 unit square so one description serves every size. */
interface Bar {
  x: number
  y: number
  w: number
  h: number
  alpha: number
}

const BARS: Bar[] = [
  { x: 0.19, y: 0.26, w: 0.62, h: 0.088, alpha: 1 },
  { x: 0.19, y: 0.456, w: 0.42, h: 0.088, alpha: 0.5 },
  { x: 0.19, y: 0.652, w: 0.52, h: 0.088, alpha: 0.22 },
]

const SS = 4 // supersampling factor, for edges that are not staircases

function insideRoundedRect(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): boolean {
  const radius = Math.min(r, w / 2, h / 2)
  const cx = Math.min(Math.max(px, x + radius), x + w - radius)
  const cy = Math.min(Math.max(py, y + radius), y + h - radius)
  if (px < x || px > x + w || py < y || py > y + h) return false
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= radius * radius
}

interface IconSpec {
  size: number
  /** Corner radius as a fraction of the size. 0 fills the square. */
  radius: number
  /** How much of the square the mark occupies — maskable icons pull it in. */
  inset: number
}

function render({ size, radius, inset }: IconSpec): Buffer {
  const dim = size * SS
  const pixels = Buffer.alloc(dim * dim * 4)

  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const u = (x + 0.5) / dim
      const v = (y + 0.5) / dim
      const offset = (y * dim + x) * 4

      if (!insideRoundedRect(u, v, 0, 0, 1, 1, radius)) continue

      // Background first, then each bar composited over it.
      let [r, g, b] = INK
      const lo = (1 - inset) / 2
      for (const bar of BARS) {
        const bx = lo + bar.x * inset
        const by = lo + bar.y * inset
        const bw = bar.w * inset
        const bh = bar.h * inset
        if (!insideRoundedRect(u, v, bx, by, bw, bh, bh / 2)) continue
        r = Math.round(r + (PAPER[0] - r) * bar.alpha)
        g = Math.round(g + (PAPER[1] - g) * bar.alpha)
        b = Math.round(b + (PAPER[2] - b) * bar.alpha)
      }

      pixels[offset] = r
      pixels[offset + 1] = g
      pixels[offset + 2] = b
      pixels[offset + 3] = 255
    }
  }

  return encodePng(downsample(pixels, dim, size), size, size)
}

/** Box filter back down to the target size — this is where the edges smooth. */
function downsample(src: Buffer, srcDim: number, size: number): Buffer {
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const o = ((y * SS + sy) * srcDim + (x * SS + sx)) * 4
          const alpha = src[o + 3] / 255
          r += src[o] * alpha
          g += src[o + 1] * alpha
          b += src[o + 2] * alpha
          a += alpha
        }
      }
      const n = SS * SS
      const o = (y * size + x) * 4
      // Premultiplied average, then un-premultiply, so edges do not go grey.
      out[o] = a > 0 ? Math.round(r / a) : 0
      out[o + 1] = a > 0 ? Math.round(g / a) : 0
      out[o + 2] = a > 0 ? Math.round(b / a) : 0
      out[o + 3] = Math.round((a / n) * 255)
    }
  }
  return out
}

function crc32(buf: Buffer): number {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(rgba: Buffer, width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  // Each scanline is prefixed with its filter type; 0 means none.
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const ICONS: Array<{ file: string; spec: IconSpec }> = [
  { file: 'icon-192.png', spec: { size: 192, radius: 0.22, inset: 1 } },
  { file: 'icon-512.png', spec: { size: 512, radius: 0.22, inset: 1 } },
  // Maskable: square edge to edge, mark pulled into the safe zone.
  { file: 'icon-maskable-512.png', spec: { size: 512, radius: 0, inset: 0.62 } },
  // iOS applies its own mask and does not like transparency.
  { file: 'apple-touch-icon.png', spec: { size: 180, radius: 0, inset: 0.78 } },
]

async function main() {
  await mkdir(OUT, { recursive: true })
  for (const { file, spec } of ICONS) {
    const png = render(spec)
    await writeFile(path.join(OUT, file), png)
    console.log(`${file}  ${spec.size}×${spec.size}  ${(png.length / 1024).toFixed(1)} kB`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
