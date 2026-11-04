import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/stores/auth-store';

vi.mock('../src/lib/api', () => ({
  api: {
    list: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1, hasNext: false, hasPrev: false } }),
    get: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
  },
  buildQuery: (params: Record<string, unknown>) => '?' + new URLSearchParams(params as Record<string, string>).toString(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/finance/journal',
}));

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

describe('JournalPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', name: 'Admin', email: 'admin@test.com', isSuperAdmin: true } as never,
      activeOrganization: { id: 'o1', name: 'Org', settings: { currency: 'USD' } } as never,
      membership: { permissions: ['*'] } as never,
      organizations: [],
      isReady: true,
    });
  });

  it('renders the journal page header', async () => {
    const { default: JournalPage } = await import('../src/app/(dashboard)/finance/journal/page');
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <JournalPage />
      </QueryClientProvider>,
    );
    expect(screen.getByText('General journal')).toBeInTheDocument();
  });

  it('renders the new entry button', async () => {
    const { default: JournalPage } = await import('../src/app/(dashboard)/finance/journal/page');
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <JournalPage />
      </QueryClientProvider>,
    );
    expect(screen.getAllByText('New journal entry').length).toBeGreaterThan(0);
  });
});