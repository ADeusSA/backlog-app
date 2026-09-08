// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ listId: 'list-1' })
}))

vi.mock('@/features/collection/game-collection-view', () => ({
  GameCollectionView: (props: { title: string }): React.ReactElement => (
    <div data-testid="collection-view">{props.title}</div>
  )
}))

vi.mock('@/platform/api', () => ({
  call: vi.fn(async (channel: string) => {
    if (channel === 'lists.get') {
      return {
        id: 'list-1',
        name: 'Cozy games',
        slug: 'cozy-games',
        description: null,
        icon: 'heart',
        color: '#8B7CFF',
        coverImageId: null,
        coverFile: null,
        isRanked: false,
        sortMode: 'manual',
        sortOrder: 0,
        isPinned: true,
        gameCount: 3,
        completedCount: 1,
        playtimeMinutes: 120,
        yearFrom: 2020,
        yearTo: 2024,
        coverMosaic: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    }
    return null
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) })
}))

describe('ListScreen', () => {
  it('renders list title into the collection view', async () => {
    const { ListScreen } = await import('./list-screen')
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <ListScreen />
      </QueryClientProvider>
    )
    expect(await screen.findByTestId('collection-view')).toHaveTextContent('Cozy games')
  })
})
