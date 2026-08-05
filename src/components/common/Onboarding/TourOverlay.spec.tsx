import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/i18n';
import { TOUR_STEPS, visibleSteps, type TourStep } from '@/lib/tourSteps';
import TourOverlay from './TourOverlay';

beforeAll(() => {
  // jsdom lays nothing out and ships no scrollIntoView; the overlay calls it to
  // bring each anchor on screen before measuring.
  Element.prototype.scrollIntoView = vi.fn();
});

function stepsFor(ids: TourStep['id'][]): TourStep[] {
  return TOUR_STEPS.filter((step) => ids.includes(step.id));
}

function renderTour(ids: TourStep['id'][], anchorIds: TourStep['id'][] = ids) {
  const onFinish = vi.fn();
  const result = render(
    <LocaleProvider>
      <div>
        {anchorIds.map((id) => (
          <button key={id} data-tour={id} type="button">
            {id}
          </button>
        ))}
        <TourOverlay steps={stepsFor(ids)} onFinish={onFinish} />
      </div>
    </LocaleProvider>
  );
  return { ...result, onFinish };
}

describe('TourOverlay', () => {
  it('opens on the first step and counts them', () => {
    renderTour(['search', 'sort']);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Krok 1 z 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Zacznij od wyszukiwania' })).toBeInTheDocument();
  });

  it('advances and offers "Gotowe" on the last step', async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour(['search', 'sort']);

    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(screen.getByText('Krok 2 z 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ustaw kolejność' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Gotowe' }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('goes back', async () => {
    const user = userEvent.setup();
    renderTour(['search', 'sort']);
    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    await user.click(screen.getByRole('button', { name: 'Wstecz' }));
    expect(screen.getByText('Krok 1 z 2')).toBeInTheDocument();
  });

  it('has no back button on the first step', () => {
    renderTour(['search', 'sort']);
    expect(screen.queryByRole('button', { name: 'Wstecz' })).not.toBeInTheDocument();
  });

  it('ends on Escape', async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour(['search', 'sort']);
    await user.keyboard('{Escape}');
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('ends on the skip button', async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour(['search', 'sort']);
    await user.click(screen.getByRole('button', { name: 'Pomiń' }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  // A step whose control vanished between the tour starting and that step being
  // reached must not strand the tour on a dead rectangle.
  it('skips past a step whose anchor is missing', async () => {
    const user = userEvent.setup();
    renderTour(['search', 'filters', 'sort'], ['search', 'sort']);
    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(screen.getByRole('heading', { name: 'Ustaw kolejność' })).toBeInTheDocument();
  });

  it('finishes when no anchor is left to point at', () => {
    const { onFinish } = renderTour(['search'], []);
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('moves focus into the tooltip so the keyboard follows the tour', () => {
    renderTour(['search', 'sort']);
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('calls onFinish only once even if it is ended twice', async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour(['search', 'sort']);
    await user.keyboard('{Escape}');
    await user.keyboard('{Escape}');
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('runs the full desktop step list end to end', async () => {
    const user = userEvent.setup();
    const ids = TOUR_STEPS.map((s) => s.id);
    const { onFinish } = renderTour(ids);
    expect(visibleSteps(document)).toHaveLength(ids.length);

    for (let i = 0; i < ids.length - 1; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Dalej' }));
    }
    await user.click(screen.getByRole('button', { name: 'Gotowe' }));
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
