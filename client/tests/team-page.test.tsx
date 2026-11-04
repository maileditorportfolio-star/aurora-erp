import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/stores/auth-store';

vi.mock('../src/lib/api', () => ({
  api: {
    list: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1, hasNext: false, hasPrev: false } }),
    get: vi.fn().mockResolvedValue({ permissions: [] }),
    delete: vi.fn().mockResolvedValue({}),
  },
  buildQuery: (params: Record<string, unknown>) => '?' + new URLSearchParams(params as Record<string, string>).toString(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/team',
}));

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

describe('TeamPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', name: 'Admin', email: 'admin@test.com', isSuperAdmin: true } as never,
      activeOrganization: { id: 'o1', name: 'Org', settings: { currency: 'USD' } } as never,
      membership: { permissions: ['*'] } as never,
      organizations: [],
      isReady: true,
    });
  });

  it('renders the team page header', async () => {
    const { default: TeamPage } = await import('../src/app/(dashboard)/team/page');
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <TeamPage />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Team & roles')).toBeInTheDocument();
    expect(screen.getByText('Invite member')).toBeInTheDocument();
  });

  it('renders summary cards', async () => {
    const { default: TeamPage } = await import('../src/app/(dashboard)/team/page');
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <TeamPage />
      </QueryClientProvider>,
    );
    expect(screen.getAllByText('Active members').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Administrators').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Suspended').length).toBeGreaterThan(0);
  });
});