import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { OfferedSeason } from '@/types/season.types';

const HALLOWEEN: OfferedSeason = {
  slug: 'halloween',
  name: 'Halloween',
  emoji: '🎃',
  description: 'Bale przebierańców i warsztaty z dyniami.',
  dateFrom: '2026-10-15',
  dateTo: '2026-11-02',
  showFrom: '2026-10-10',
  sort: 10,
  count: 63,
  upcoming: false,
};

const mocks = vi.hoisted(() => ({ seasons: [] as unknown[] }));
vi.mock('@/components/service/useSeasons', () => ({
  useSeasons: () => ({ seasons: mocks.seasons, isLoading: false }),
}));

import SeasonBar from './SeasonBar';

beforeEach(() => {
  mocks.seasons = [HALLOWEEN];
});

describe('SeasonBar', () => {
  it('renders nothing outside a season', () => {
    mocks.seasons = [];
    const { container } = render(<SeasonBar value={null} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('turns the season on', async () => {
    const onChange = vi.fn();
    render(<SeasonBar value={null} onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Halloween: 63 wydarzenia' }));
    expect(onChange).toHaveBeenCalledWith('halloween');
  });

  it('turns it off again when pressed a second time', async () => {
    const onChange = vi.fn();
    render(<SeasonBar value="halloween" onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Halloween: 63 wydarzenia' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('describes the season only while it is chosen', () => {
    const { rerender } = render(<SeasonBar value={null} onChange={vi.fn()} />);
    expect(screen.queryByText(HALLOWEEN.description)).not.toBeInTheDocument();
    rerender(<SeasonBar value="halloween" onChange={vi.fn()} />);
    expect(screen.getByText(HALLOWEEN.description)).toBeInTheDocument();
  });

  it('points the pressed toggle at the description, so it is heard as well as seen', () => {
    render(<SeasonBar value="halloween" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Halloween: 63 wydarzenia' })).toHaveAccessibleDescription(
      HALLOWEEN.description
    );
  });

  it('passes accessibility check, pressed and not', async () => {
    const { container, rerender } = render(<SeasonBar value={null} onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
    rerender(<SeasonBar value="halloween" onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
