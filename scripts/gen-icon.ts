/**
 * Генератор иконки приложения (ТЗ 04 §6): скруглённый квадрат акцентного цвета
 * с белым контуром геймпада. Рисуется процедурно, без внешних зависимостей;
 * на выходе `resources/icon.png` (256×256) и `resources/icon.ico` (PNG внутри ICO).
 *
 * Запуск: npx tsx scripts/gen-icon.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const SIZE = 256
const SS = 4 // суперсэмплинг для сглаживания
const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..')
const OUT_DIR = path.join(ROOT, 'resources')

type Rgb = [number, number, number]

const ACCENT_TOP: Rgb = [0x8b, 0x7c, 0xff]
const ACCENT_BOTTOM: Rgb = [0x6f, 0x5f, 0xe8]
const WHITE: Rgb = [0xf2, 0xf4, 0xfa]

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ]
}

function inRoundedRect(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function inCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

/** Силуэт геймпада: корпус + две «рукоятки», минус крестовина и две кнопки. */
function isPad(x: number, y: number): boolean {
  const body =
    inRoundedRect(x, y, 62, 92, 194, 164, 30) ||
    inCircle(x, y, 84, 130, 38) ||
    inCircle(x, y, 172, 130, 38)
  if (!body) return false
  // крестовина слева
  const dpad =
    inRoundedRect(x, y, 68, 124, 104, 136, 4) || inRoundedRect(x, y, 80, 112, 92, 148, 4)
  // две кнопки справа
  const buttons = inCircle(x, y, 160, 118, 9) || inCircle(x, y, 180, 138, 9)
  return !dpad && !buttons
}

function renderPixels(): Buffer {
  const data = Buffer.alloc(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let bgHits = 0
      let padHits = 0
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (inRoundedRect(px, py, 8, 8, SIZE - 8, SIZE - 8, 56)) bgHits += 1
          if (isPad(px, py)) padHits += 1
        }
      }
      const samples = SS * SS
      const bgAlpha = bgHits / samples
      const padAlpha = padHits / samples
      const base = mix(ACCENT_TOP, ACCENT_BOTTOM, y / SIZE)
      const color = mix(base, WHITE, Math.min(1, padAlpha))
      const offset = (y * SIZE + x) * 4
      data[offset] = color[0]
      data[offset + 1] = color[1]
      data[offset + 2] = color[2]
      data[offset + 3] = Math.round(bgAlpha * 255)
    }
  }
  return data
}

/* --------------------------------------------------------------- PNG-кодирование */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, payload: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(payload.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), payload])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

function encodePng(rgba: Buffer, size: number): Buffer {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0 // фильтр None
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // бит на канал
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** ICO с одним изображением-PNG 256×256 (поддерживается начиная с Windows Vista). */
function encodeIco(png: Buffer): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // тип: иконка
  header.writeUInt16LE(1, 4) // одно изображение
  const entry = Buffer.alloc(16)
  entry[0] = 0 // 0 = 256 пикселей
  entry[1] = 0
  entry[2] = 0 // палитра не используется
  entry[3] = 0
  entry.writeUInt16LE(1, 4) // плоскости
  entry.writeUInt16LE(32, 6) // бит на пиксель
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(header.length + entry.length, 12)
  return Buffer.concat([header, entry, png])
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const png = encodePng(renderPixels(), SIZE)
fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), png)
fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), encodeIco(png))
console.log(`Иконка готова: resources/icon.png и resources/icon.ico (${png.length} байт PNG)`)
