import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/i18n';
import { TOUR_STEPS, type TourStep, type TourStepId } from '@/lib/tourSteps';
import TourOverlay from './TourOverlay';

beforeAll(() => {
  // jsdom lays nothing out and ships no scrollIntoView; the overlay calls it to
  // bring each anchor on screen before measuring.
  Element.prototype.scrollIntoView = vi.fn();
});

function stepsFor(ids: TourStepId[]): TourStep[] {
  return TOUR_STEPS.filter((step) => ids.includes(step.id));
}

function renderTour(ids: TourStepId[], anchors: string[]) {
  const onFinish = vi.fn();
  const onStepEnter = vi.fn();
  const result = render(
    <LocaleProvider>
      <div>
        {anchors.map((name) => (
          <button key={name} data-tour={name} type="button">
            {name}
          </button>
        ))}
        <TourOverlay steps={stepsFor(ids)} onStepEnter={onStepEnter} onFinish={onFinish} />
      </div>
    </LocaleProvider>
  );
  return { ...result, onFinish, onStepEnter };
}

describe('TourOverlay', () => {
  it('opens on the first step and counts them', async () => {
    renderTour(['categories', 'results'], ['filters', 'results']);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Krok 1 z 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Zacznijmy od przykładu' })).toBeInTheDocument();
  });

  // The action is what makes the story a story rather than a slideshow, and it
  // has to fire before the anchor is looked for — usually it is what puts that
  // anchor on screen.
  it('performs each step exactly once, in order', async () => {
    const user = userEvent.setup();
    const { onStepEnter } = renderTour(['categories', 'results'], ['filters', 'results']);
    await screen.findByRole('dialog');
    expect(onStepEnter).toHaveBeenCalledTimes(1);
    expect(onStepEnter.mock.calls[0][0].id).toBe('categories');

    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    await waitFor(() => expect(onStepEnter).toHaveBeenCalledTimes(2));
    expect(onStepEnter.mock.calls[1][0].id).toBe('results');
  });

  it('advances and offers "Gotowe" on the last step', async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour(['categories', 'results'], ['filters', 'results']);
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(await screen.findByText('Krok 2 z 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Gotowe' }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  // Forward-only: the steps write filters, save a preset and edit it, and
  // stepping back through those would need an undo for each.
  it('offers no way back', async () => {
    renderTour(['categories', 'results'], ['filters', 'results']);
    await screen.findByRole('dialog');
    expect(screen.queryByRole('button', { name: 'Wstecz' })).not.toBeInTheDocument();
  });

  it('ends on Escape', async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour(['categories', 'results'], ['filters', 'results']);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('ends on the skip button', async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour(['categories', 'results'], ['filters', 'results']);
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Pomiń' }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  // The cross-page steps land before their page does. Giving up on the first
  // look would end the story halfway through the navigation it just started.
  it('waits for an anchor that arrives late', async () => {
    renderTour(['categories'], []);
    // Nothing to point at yet — no tooltip, but the scrim is already up.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const late = document.createElement('button');
    late.setAttribute('data-tour', 'filters');
    document.body.appendChild(late);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('gives up on an anchor that never arrives and moves on', async () => {
    const { onFinish } = renderTour(['results'], []);
    await waitFor(() => expect(onFinish).toHaveBeenCalledOnce(), { timeout: 5000 });
  });

  it('moves focus into the tooltip so the keyboard follows the story', async () => {
    renderTour(['categories', 'results'], ['filters', 'results']);
    expect(await screen.findByRole('dialog')).toHaveFocus();
  });

  it('calls onFinish only once even if it is ended twice', async () => {
    const user = userEvent.setup();
    const { onFinish } = renderTour(['categories', 'results'], ['filters', 'results']);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await user.keyboard('{Escape}');
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
