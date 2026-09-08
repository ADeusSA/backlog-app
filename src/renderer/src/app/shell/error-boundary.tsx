import { Component, type ErrorInfo, type ReactNode } from 'react'
import { call } from '@/platform/api'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Глобальный error boundary (05 §7): текст, перезагрузка экрана, открыть журнал. */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    void call('app.log', {
      level: 'error',
      message: error.message,
      data: { stack: error.stack, componentStack: info.componentStack }
    }).catch(() => undefined)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="type-h1">Что-то пошло не так</h1>
        <p className="type-body max-w-[60ch]" style={{ color: 'var(--text-2)' }}>
          {error.message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-[var(--r-pill)] px-4 py-2 type-body"
            style={{ background: 'var(--primary-btn)', color: 'var(--primary-btn-on)' }}
            onClick={() => this.setState({ error: null })}
          >
            Перезагрузить экран
          </button>
          <button
            type="button"
            className="rounded-[var(--r-pill)] px-4 py-2 type-body"
            style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}
            onClick={() => void call('app.openPath', { target: 'logs' })}
          >
            Открыть журнал
          </button>
        </div>
      </div>
    )
  }
}
