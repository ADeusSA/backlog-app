import crypto from 'node:crypto'
import http from 'node:http'
import { shell } from 'electron'
import { AppError } from '@shared/errors'
import { log } from '../log'
import { GOOGLE_OAUTH, isConfigured } from './google.config'
import type { DriveAuth } from './drive'
import {
  clearCachedAccessToken,
  clearRefreshToken,
  getCachedAccessToken,
  loadRefreshToken,
  saveRefreshToken,
  setCachedAccessToken
} from './tokens'

/**
 * OAuth 2.0 loopback + PKCE (03 §2, §19; 01 §10).
 * `node:http` сервер на `127.0.0.1:0`, PKCE S256 через `node:crypto`, `shell.openExternal` для
 * системного браузера, обмен кода на токены — глобальный `fetch`. Таймаут ожидания 5 минут.
 */

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000

/* ------------------------------------------------------------------------------- PKCE */

export interface PkcePair {
  verifier: string
  challenge: string
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Пара verifier/challenge для PKCE S256 (RFC 7636). */
export function createPkcePair(): PkcePair {
  const verifier = base64url(crypto.randomBytes(32))
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function createState(): string {
  return base64url(crypto.randomBytes(16))
}

/* --------------------------------------------------------------------------- auth URL */

export function buildAuthUrl(params: { redirectUri: string; scope: string; state: string; challenge: string }): string {
  const url = new URL(GOOGLE_OAUTH.authEndpoint)
  url.searchParams.set('client_id', GOOGLE_OAUTH.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', params.scope)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('code_challenge', params.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', params.state)
  return url.toString()
}

/* ---------------------------------------------------------------- loopback-сервер (§2) */

export type LoopbackResult = { code: string; state: string } | { error: string }

export interface LoopbackServer {
  port: number
  result: Promise<LoopbackResult>
  close: () => void
}

/** Страница-ответ в браузере в стиле Aurora (docs/04, цвета из tokens.css). */
function renderResultPage(ok: boolean): string {
  const title = ok ? 'Готово' : 'Не получилось'
  const message = ok
    ? 'Готово, можно закрыть вкладку.'
    : 'Вход не выполнен. Можно закрыть вкладку и попробовать снова в приложении.'
  const accent = ok ? '#8b7cff' : '#f0708a'
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Backlog · ${title}</title>
<style>
  html,body{height:100%;margin:0}
  body{
    display:flex;align-items:center;justify-content:center;
    background:#0b0d14;color:#f2f4fa;
    font-family:'Manrope','Segoe UI Variable Text','Segoe UI',system-ui,sans-serif;
  }
  .card{
    display:flex;flex-direction:column;align-items:center;gap:12px;
    padding:32px 40px;border-radius:18px;
    background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.08);
    text-align:center;max-width:360px;
  }
  .dot{width:40px;height:40px;border-radius:999px;background:${accent};
       box-shadow:0 0 40px ${accent}66;}
  p{margin:0;color:#9aa3b8;font-size:14px;line-height:1.5}
  strong{color:#f2f4fa;font-size:18px}
</style></head>
<body><div class="card"><div class="dot"></div><strong>${title}</strong><p>${message}</p></div></body></html>`
}

/** Поднимает сервер на 127.0.0.1:0, разрешает промис при первом валидном обратном вызове. */
export function createLoopbackServer(): Promise<LoopbackServer> {
  return new Promise((resolveServer) => {
    let settle: (value: LoopbackResult) => void
    const result = new Promise<LoopbackResult>((res) => {
      settle = res
    })
    let settled = false

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (!code && !error) {
        res.writeHead(404)
        res.end()
        return
      }
      const ok = !error
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(renderResultPage(ok))
      if (!settled) {
        settled = true
        settle(error ? { error } : { code: code as string, state: state ?? '' })
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolveServer({
        port,
        result,
        close: () => server.close()
      })
    })
  })
}

/* --------------------------------------------------------------------- обмен токенов */

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope?: string
}

async function postForm(url: string, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString()
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AppError('sync_auth', `Google OAuth: ${res.status} ${text.slice(0, 300)}`)
  }
  return (await res.json()) as TokenResponse
}

async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GOOGLE_OAUTH.userInfoEndpoint, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return null
    const json = (await res.json()) as { email?: string }
    return json.email ?? null
  } catch {
    return null
  }
}

export interface SignInResult {
  accessToken: string
  expiresIn: number
  refreshToken: string
  email: string | null
}

/**
 * Полный поток входа (03 §2): открыть системный браузер → дождаться кода на loopback →
 * обменять на токены → сохранить refresh-токен зашифрованным → узнать e-mail аккаунта.
 */
export async function signIn(): Promise<SignInResult> {
  if (!isConfigured()) {
    throw new AppError(
      'sync_disabled',
      'Синхронизация не настроена сборкой: заполните src/main/sync/google.config.ts (см. docs/03-sync-google-drive.md §11).'
    )
  }

  const loopback = await createLoopbackServer()
  const redirectUri = `http://127.0.0.1:${loopback.port}/`
  const { verifier, challenge } = createPkcePair()
  const state = createState()
  const authUrl = buildAuthUrl({ redirectUri, scope: GOOGLE_OAUTH.scopes.join(' '), state, challenge })

  try {
    await shell.openExternal(authUrl)

    const timeout = new Promise<LoopbackResult>((_, reject) => {
      setTimeout(() => reject(new AppError('sync_auth', 'Время ожидания входа истекло (5 минут)')), SIGN_IN_TIMEOUT_MS)
    })
    const outcome = await Promise.race([loopback.result, timeout])

    if ('error' in outcome) {
      throw new AppError('sync_auth', `Google отклонил вход: ${outcome.error}`)
    }
    if (outcome.state !== state) {
      throw new AppError('sync_auth', 'Несовпадение параметра state — вход отклонён из соображений безопасности')
    }

    const tokens = await postForm(GOOGLE_OAUTH.tokenEndpoint, {
      client_id: GOOGLE_OAUTH.clientId,
      client_secret: GOOGLE_OAUTH.clientSecret,
      code: outcome.code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
    if (!tokens.refresh_token) {
      throw new AppError(
        'sync_auth',
        'Google не выдал refresh-токен (возможно, доступ уже предоставлен ранее без повторного согласия)'
      )
    }

    saveRefreshToken(tokens.refresh_token)
    setCachedAccessToken(tokens.access_token, tokens.expires_in)
    const email = await fetchAccountEmail(tokens.access_token)
    return { accessToken: tokens.access_token, expiresIn: tokens.expires_in, refreshToken: tokens.refresh_token, email }
  } finally {
    loopback.close()
  }
}

/** Принудительное обновление access-токена по сохранённому refresh-токену. */
export async function refreshAccessToken(): Promise<string> {
  const refreshToken = loadRefreshToken()
  if (!refreshToken) {
    throw new AppError('sync_auth', 'Нет сохранённого входа — требуется повторное подключение Google')
  }
  try {
    const tokens = await postForm(GOOGLE_OAUTH.tokenEndpoint, {
      client_id: GOOGLE_OAUTH.clientId,
      client_secret: GOOGLE_OAUTH.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
    setCachedAccessToken(tokens.access_token, tokens.expires_in)
    return tokens.access_token
  } catch (err) {
    // Токен отозван в аккаунте Google (03 §10 п.5) — просим переподключиться, не роняя приложение.
    log.warn('[sync] обновление токена не удалось', err instanceof Error ? err.message : err)
    throw new AppError('sync_auth', 'Не удалось обновить доступ Google. Войдите заново в настройках.', undefined, {
      cause: err
    })
  }
}

/** `DriveAuth` поверх кеша `tokens.ts` — используется `DriveClient`. */
export function createDriveAuth(): DriveAuth {
  return {
    async getAccessToken() {
      const cached = getCachedAccessToken()
      if (cached) return cached
      return refreshAccessToken()
    },
    async refreshAccessToken() {
      return refreshAccessToken()
    }
  }
}

/** Выход (03 §2): отозвать токен на сервере Google, удалить локальные секреты. */
export async function signOut(): Promise<void> {
  const refreshToken = loadRefreshToken()
  if (refreshToken) {
    try {
      await postForm(GOOGLE_OAUTH.revokeEndpoint, { token: refreshToken })
    } catch (err) {
      log.warn('[sync] не удалось отозвать токен на сервере (продолжаем локальный выход)', err)
    }
  }
  clearRefreshToken()
  clearCachedAccessToken()
}

export function hasSignedIn(): boolean {
  return loadRefreshToken() !== null
}
