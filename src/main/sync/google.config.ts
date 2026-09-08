/**
 * Учётные данные OAuth-клиента Google Drive (Desktop app), см. docs/03-sync-google-drive.md §11.
 *
 * Zero-config для конечного пользователя: `clientId`/`clientSecret` вшиты в сборку и общие для
 * всех копий приложения. Владелец сборки настраивает проект Google Cloud РОВНО ОДИН РАЗ:
 *
 *   1. console.cloud.google.com → создать проект (например, «Backlog»).
 *   2. APIs & Services → Library → включить Google Drive API.
 *   3. Google Auth Platform → Branding: название «Backlog», support e-mail.
 *   4. Google Auth Platform → Audience: тип External → Publish app (статус In production;
 *      в Testing refresh-токен живёт всего 7 дней — не подходит).
 *   5. Google Auth Platform → Data access: добавить non-sensitive scopes ниже.
 *   6. Google Auth Platform → Clients → Create client → тип Desktop app → скопировать
 *      Client ID и Client secret (секрет показывается только один раз при создании).
 *   7. Вписать значения в константы ниже.
 *
 * Для Desktop-клиентов Google `client_secret` официально не считается секретом (может быть
 * встроен в приложение) — подтверждено в docs/research/02-tech-verification.md §3a и
 * docs/03-sync-google-drive.md §2. Подробности и нюансы (верификация, лимиты, домены) — §11 того
 * же документа.
 *
 * Пока эти константы пусты, синхронизация с Google Диском отключена во всём приложении:
 * `sync.getState` возвращает `status: 'disabled'`, `sync.signIn` бросает `AppError('sync_disabled', …)`.
 * Бэкапы и экспорт/импорт работают независимо от этого файла.
 */
export const GOOGLE_OAUTH = {
  /** `xxxxxxxx.apps.googleusercontent.com` из Google Auth Platform → Clients. */
  clientId: '',
  /** Client secret того же Desktop-клиента. */
  clientSecret: '',
  /** Non-sensitive scopes — верификация приложения Google не требуется (03 §2, §11). */
  scopes: ['https://www.googleapis.com/auth/drive.file', 'openid', 'email'] as string[],
  /** Endpoints Google OAuth 2.0 / OpenID Connect (не меняются владельцем сборки). */
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revokeEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo'
} as const

/** Заполнены ли учётные данные сборки владельцем (03 §1: «ноль настроек у пользователя»). */
export function isConfigured(): boolean {
  return GOOGLE_OAUTH.clientId.trim().length > 0 && GOOGLE_OAUTH.clientSecret.trim().length > 0
}
