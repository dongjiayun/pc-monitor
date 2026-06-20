/**
 * Generate app icon — simple, reliable PNG icons for tray and taskbar.
 * Circular dark background with a blue-purple gradient arc symbol.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

function createPNG(width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6  // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const raw = Buffer.alloc(height * (1 + width * 4))
  const cx = width / 2, cy = height / 2
  const bgR = width * 0.46       // circle radius
  const outerR = width * 0.38    // arc outer radius
  const innerR = width * 0.26    // arc inner radius
  const arcStart = 30, arcEnd = 330

  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
  }

  function setPx(y, x, r, g, b, a) {
    const off = y * (1 + width * 4) + 1 + x * 4
    raw[off] = r
    raw[off + 1] = g
    raw[off + 2] = b
    raw[off + 3] = a
  }

  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0 // filter none
    for (let x = 0; x < width; x++) {
      const d = dist(x, y, cx, cy)

      // Background circle with anti-alias
      const bgEdge = d - bgR
      if (bgEdge > 1.5) {
        setPx(y, x, 0, 0, 0, 0)
        continue
      }

      const bgAlpha = Math.round(Math.max(0, Math.min(255, (1.5 - bgEdge) / 1.5 * 255)))

      // Fill dark background
      setPx(y, x, 15, 15, 26, bgAlpha)

      // Arc ring
      if (d >= innerR && d <= outerR) {
        const angle = Math.atan2(y - cy, x - cx)
        const angleDeg = angle * 180 / Math.PI
        const angleNorm = angleDeg < 0 ? angleDeg + 360 : angleDeg

        if (angleNorm >= arcStart && angleNorm <= arcEnd) {
          const t = (angleNorm - arcStart) / (arcEnd - arcStart)
          const r = Math.round(10 + t * 181)    // 10 → 191 (blue→purple)
          const g = Math.round(132 - t * 42)     // 132 → 90
          const b = Math.round(255 - t * 13)     // 255 → 242

          // Anti-alias ring edges
          const edgeAA = Math.min(Math.abs(d - outerR), Math.abs(d - innerR))
          const ringAlpha = Math.round(Math.min(bgAlpha, Math.max(0, (1.5 - edgeAA) / 1.5 * 255)))
          setPx(y, x, r, g, b, ringAlpha)
        }
      }
    }
  }

  // White center dot
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const px = Math.round(cx + dx)
      const py = Math.round(cy + dy)
      if (px >= 0 && px < width && py >= 0 && py < height) {
        const dd = dist(px, py, cx, cy)
        if (dd <= 2.5) {
          setPx(py, px, 255, 255, 255, Math.round(200 * Math.max(0, 1 - dd / 3)))
        }
      }
    }
  }

  const deflated = zlib.deflateSync(raw)

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeB = Buffer.from(type, 'ascii')
    const crcData = Buffer.concat([typeB, data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(crcData))
    return Buffer.concat([len, typeB, data, crc])
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function crc32(buf) {
  let crc = 0xFFFFFFFF
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

for (const { name, size } of [
  { name: 'icon.png', size: 256 },
  { name: 'icon-64.png', size: 64 },
  { name: 'icon-32.png', size: 32 },
]) {
  const png = createPNG(size, size)
  fs.writeFileSync(path.join(__dirname, '..', 'public', name), png)
  console.log(`Created ${name} (${size}x${size})`)
}
