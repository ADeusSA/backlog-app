declare module '*.sql?raw' {
  const content: string
  export default content
}

/** Переменные из `.env`, которые Vite подставляет в main при сборке (см. providers/rawg.config.ts). */
interface ImportMetaEnv {
  readonly MAIN_VITE_RAWG_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
