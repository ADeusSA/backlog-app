import { describe, expect, it } from 'vitest'
import { buildAuthUrl, createLoopbackServer, createPkcePair, createState } from './oauth'

describe('createPkcePair (PKCE S256, RFC 7636)', () => {
  it('генерирует verifier и challenge допустимой длины/алфавита base64url', () => {
    const { verifier, challenge } = createPkcePair()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(challenge).not.toContain('=')
  })

  it('каждый вызов даёт новую пару', () => {
    const a = createPkcePair()
    const b = createPkcePair()
    expect(a.verifier).not.toBe(b.verifier)
    expect(a.challenge).not.toBe(b.challenge)
  })
})

describe('createState', () => {
  it('непустая строка без паддинга base64', () => {
    const s = createState()
    expect(s.length).toBeGreaterThan(0)
    expect(s).not.toContain('=')
  })
})

describe('buildAuthUrl', () => {
  it('содержит обязательные параметры PKCE и loopback redirect_uri', () => {
    const url = new URL(
      buildAuthUrl({
        redirectUri: 'http://127.0.0.1:54321/',
        scope: 'a b',
        state: 'st1',
        challenge: 'ch1'
      })
    )
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:54321/')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge')).toBe('ch1')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe('st1')
    expect(url.searchParams.get('scope')).toBe('a b')
  })
})

describe('createLoopbackServer (node:http на 127.0.0.1:0)', () => {
  it('резолвит код и state из callback-запроса и отдаёт HTML-страницу', async () => {
    const loopback = await createLoopbackServer()
    expect(loopback.port).toBeGreaterThan(0)
    try {
      const res = await fetch(`http://127.0.0.1:${loopback.port}/?code=abc123&state=xyz`)
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Готово')

      const outcome = await loopback.result
      expect(outcome).toEqual({ code: 'abc123', state: 'xyz' })
    } finally {
      loopback.close()
    }
  })

  it('резолвит ошибку, если Google вернул error=access_denied', async () => {
    const loopback = await createLoopbackServer()
    try {
      await fetch(`http://127.0.0.1:${loopback.port}/?error=access_denied`)
      const outcome = await loopback.result
      expect(outcome).toEqual({ error: 'access_denied' })
    } finally {
      loopback.close()
    }
  })
})
