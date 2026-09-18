import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { LocaleProvider } from '@/i18n';
import SortSelect from './SortSelect';

function renderControl(overrides: Partial<React.ComponentProps<typeof SortSelect>> = {}) {
  const onSortChange = vi.fn();
  const onDirChange = vi.fn();
  const { container } = render(
    <LocaleProvider>
      <SortSelect
        sort="date"
        dir="asc"
        onSortChange={onSortChange}
        onDirChange={onDirChange}
        {...overrides}
      />
    </LocaleProvider>
  );
  return { onSortChange, onDirChange, container };
}

describe('SortSelect', () => {
  it('offers all four orderings', async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole('combobox', { name: 'Sortuj' }));

    for (const label of ['Data', 'Nazwa', 'Miejsce', 'Cena']) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }
  });

  it('reports the chosen ordering', async () => {
    const user = userEvent.setup();
    const { onSortChange } = renderControl();

    await user.click(screen.getByRole('combobox', { name: 'Sortuj' }));
    await user.click(screen.getByRole('option', { name: 'Cena' }));

    expect(onSortChange).toHaveBeenCalledWith('price');
  });

  // Every remaining ordering has a meaningful direction, so the toggle is
  // never inert — the one ordering that had none is gone.
  it('enables the direction toggle for every ordering', () => {
    for (const sort of ['date', 'name', 'venue', 'price'] as const) {
      const { container } = renderControl({ sort });
      expect(screen.getByRole('button', { name: /sortuj (rosnąco|malejąco)/i })).toBeEnabled();
      container.remove();
    }
  });

  it('flips direction on click', async () => {
    const user = userEvent.setup();
    const { onDirChange } = renderControl({ sort: 'date', dir: 'asc' });

    await user.click(screen.getByRole('button', { name: /sortuj (rosnąco|malejąco)/i }));

    expect(onDirChange).toHaveBeenCalledWith('desc');
  });

  it('passes accessibility check', async () => {
    const { container } = renderControl({ sort: 'date' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
