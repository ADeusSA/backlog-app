/** Заглушка Electron для юнит-тестов (vitest, окружение node). */
export const app = {
  isPackaged: false,
  getVersion: () => '0.0.0-test',
  getPath: () => process.cwd(),
  getAppPath: () => process.cwd(),
  setPath: () => undefined
}

export const BrowserWindow = {
  getAllWindows: () => [] as unknown[]
}

export const ipcMain = { handle: () => undefined }
export const shell = { openExternal: async () => undefined, openPath: async () => '' }
export const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }
export const net = { fetch: async () => new Response('') }
export const protocol = { registerSchemesAsPrivileged: () => undefined, handle: () => undefined }
export const session = { defaultSession: { webRequest: { onHeadersReceived: () => undefined } } }
export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: () => Buffer.alloc(0),
  decryptString: () => ''
}
export const screen = { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) }
export default { app, BrowserWindow, ipcMain, shell, dialog, net, protocol, session, safeStorage, screen }
