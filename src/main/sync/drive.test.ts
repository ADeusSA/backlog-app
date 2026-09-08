import { describe, expect, it, vi } from 'vitest'
import { computeBackoffMs, DriveClient, type DriveAuth } from './drive'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function fakeAuth(tokens: string[] = ['token-1']): DriveAuth & { refreshCalls: number } {
  let i = 0
  const auth = {
    refreshCalls: 0,
    async getAccessToken() {
      return tokens[Math.min(i, tokens.length - 1)] as string
    },
    async refreshAccessToken() {
      i += 1
      auth.refreshCalls += 1
      return tokens[Math.min(i, tokens.length - 1)] as string
    }
  }
  return auth
}

describe('computeBackoffMs (03 §7)', () => {
  it('уважает Retry-After, если он есть', () => {
    expect(computeBackoffMs(0, 5)).toBe(5000)
    expect(computeBackoffMs(3, 2)).toBe(2000)
  })

  it('растёт экспоненциально и ограничен сверху', () => {
    const noJitter = () => 0
    expect(computeBackoffMs(0, undefined, noJitter)).toBe(500)
    expect(computeBackoffMs(1, undefined, noJitter)).toBe(1000)
    expect(computeBackoffMs(2, undefined, noJitter)).toBe(2000)
    // база капается на 20с, джиттер добавляет ещё до 30% сверху
    expect(computeBackoffMs(10, undefined, noJitter)).toBe(20_000)
  })

  it('джиттер неотрицательный и не более 50% от базы', () => {
    const delay = computeBackoffMs(1, undefined, () => 1)
    expect(delay).toBeGreaterThanOrEqual(1000)
    expect(delay).toBeLessThanOrEqual(1000 + 1000 * 0.5 + 1)
  })
})

describe('DriveClient — повторы и обновление токена', () => {
  it('files.list парсит пагинацию и собирает все страницы', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { files: [{ id: '1', name: 'a' }], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(jsonResponse(200, { files: [{ id: '2', name: 'b' }] }))
    const client = new DriveClient(fakeAuth(), fetchImpl as unknown as typeof fetch, async () => undefined)
    const files = await client.filesList("'root' in parents", 'id,name')
    expect(files).toEqual([
      { id: '1', name: 'a' },
      { id: '2', name: 'b' }
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('на 401 обновляет токен ровно один раз и повторяет запрос', async () => {
    const auth = fakeAuth(['old', 'new'])
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse(200, { files: [] }))
    const client = new DriveClient(auth, fetchImpl as unknown as typeof fetch, async () => undefined)
    await client.filesList('q')
    expect(auth.refreshCalls).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const secondCallHeaders = fetchImpl.mock.calls[1]?.[1]?.headers as Record<string, string>
    expect(secondCallHeaders.Authorization).toBe('Bearer new')
  })

  it('на 429 делает бэкофф и повторяет, уважая Retry-After', async () => {
    const sleepImpl = vi.fn().mockResolvedValue(undefined)
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '1' } }))
      .mockResolvedValueOnce(jsonResponse(200, { files: [] }))
    const client = new DriveClient(fakeAuth(), fetchImpl as unknown as typeof fetch, sleepImpl)
    await client.filesList('q')
    expect(sleepImpl).toHaveBeenCalledWith(1000)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('после исчерпания ретраев пробрасывает ошибку', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }))
    const client = new DriveClient(fakeAuth(), fetchImpl as unknown as typeof fetch, async () => undefined)
    await expect(client.filesList('q')).rejects.toThrow(/Google Drive/)
    // 1 первый запрос + MAX_RETRIES(5) повторов = 6
    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })

  it('filesGetMedia возвращает бинарные данные', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    const client = new DriveClient(fakeAuth(), fetchImpl as unknown as typeof fetch, async () => undefined)
    const buf = await client.filesGetMedia('id1')
    expect([...buf]).toEqual([1, 2, 3])
  })

  it('filesCreateMultipart отправляет multipart/related и парсит ответ', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: 'new-id', name: 'x.webp' }))
    const client = new DriveClient(fakeAuth(), fetchImpl as unknown as typeof fetch, async () => undefined)
    const file = await client.filesCreateMultipart({ name: 'x.webp' }, new Uint8Array([9, 9]), 'image/webp')
    expect(file).toEqual({ id: 'new-id', name: 'x.webp' })
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('uploadType=multipart')
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/multipart\/related/)
  })

  it('filesUpdateContent выбирает resumable выше порога 5МБ', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1)
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: 'https://upload.example/session1' } }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'db1', name: 'backlog.db' }))
    const client = new DriveClient(fakeAuth(), fetchImpl as unknown as typeof fetch, async () => undefined)
    const file = await client.filesUpdateContent('db1', big, 'application/octet-stream')
    expect(file.id).toBe('db1')
    const [initUrl, initOpts] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(initUrl).toContain('uploadType=resumable')
    expect(initOpts.method).toBe('PATCH')
    const [putUrl, putOpts] = fetchImpl.mock.calls[1] as [string, RequestInit]
    expect(putUrl).toBe('https://upload.example/session1')
    expect(putOpts.method).toBe('PUT')
  })
})
