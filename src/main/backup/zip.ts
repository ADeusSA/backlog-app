import zlib from 'node:zlib'

/**
 * Минимальный ZIP-контейнер без внешних зависимостей (store/deflate через `node:zlib`,
 * без шифрования) — см. ADR 0003. Достаточно для экспорта/импорта данных приложения
 * (06 §8, A12) и совместимо со стандартными архиваторами (Explorer, 7-Zip, unzip).
 */

export interface ZipEntry {
  /** Путь внутри архива, всегда с `/` (например, `images/ab/abf3….webp`). */
  name: string
  data: Buffer
}

const LOCAL_SIGNATURE = 0x04034b50
const CENTRAL_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50
const VERSION = 20

const CRC_TABLE = buildCrcTable()

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time: time & 0xffff, date: dosDate & 0xffff }
}

/** Собирает zip-архив из набора записей (в памяти — для наших объёмов данных этого достаточно). */
export function createZip(entries: readonly ZipEntry[]): Buffer {
  const { time, date } = dosDateTime(new Date())
  const fileChunks: Buffer[] = []
  const centralChunks: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8')
    const crc = crc32(entry.data)
    const deflated = zlib.deflateRawSync(entry.data)
    const useStore = deflated.length >= entry.data.length
    const method = useStore ? 0 : 8
    const payload = useStore ? entry.data : deflated

    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL_SIGNATURE, 0)
    local.writeUInt16LE(VERSION, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(entry.data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    fileChunks.push(local, nameBuf, payload)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(CENTRAL_SIGNATURE, 0)
    central.writeUInt16LE(VERSION, 4)
    central.writeUInt16LE(VERSION, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(payload.length, 20)
    central.writeUInt32LE(entry.data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralChunks.push(central, nameBuf)

    offset += local.length + nameBuf.length + payload.length
  }

  const centralDirStart = offset
  const centralDir = Buffer.concat(centralChunks)

  const end = Buffer.alloc(22)
  end.writeUInt32LE(END_SIGNATURE, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDir.length, 12)
  end.writeUInt32LE(centralDirStart, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...fileChunks, centralDir, end])
}

const EOCD_SIGNATURE_BYTES = Buffer.from([0x50, 0x4b, 0x05, 0x06])

/** Разбирает zip-архив, собранный `createZip` (или любым архиватором без Zip64/шифрования). */
export function readZip(buffer: Buffer): ZipEntry[] {
  const eocdOffset = buffer.lastIndexOf(EOCD_SIGNATURE_BYTES)
  if (eocdOffset === -1) throw new Error('Не найден конец центрального каталога ZIP — файл повреждён или не является zip')

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10)
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16)

  const entries: ZipEntry[] = []
  let ptr = centralDirOffset
  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(ptr) !== CENTRAL_SIGNATURE) {
      throw new Error('Повреждён центральный каталог ZIP')
    }
    const method = buffer.readUInt16LE(ptr + 10)
    const compressedSize = buffer.readUInt32LE(ptr + 20)
    const nameLen = buffer.readUInt16LE(ptr + 28)
    const extraLen = buffer.readUInt16LE(ptr + 30)
    const commentLen = buffer.readUInt16LE(ptr + 32)
    const localOffset = buffer.readUInt32LE(ptr + 42)
    const name = buffer.toString('utf8', ptr + 46, ptr + 46 + nameLen)

    const localNameLen = buffer.readUInt16LE(localOffset + 26)
    const localExtraLen = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const raw = buffer.subarray(dataStart, dataStart + compressedSize)
    const data = method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw)
    entries.push({ name, data })

    ptr += 46 + nameLen + extraLen + commentLen
  }
  return entries
}
