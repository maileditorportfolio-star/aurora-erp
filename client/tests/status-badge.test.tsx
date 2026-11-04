import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../src/components/ui/badge';

describe('StatusBadge', () => {
  it('renders paid status', () => {
    render(<StatusBadge status="paid" />);
    expect(screen.getByText('paid')).toBeInTheDocument();
  });

  it('renders dash for missing status', () => {
    render(<StatusBadge />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});