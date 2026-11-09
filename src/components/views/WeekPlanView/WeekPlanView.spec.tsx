import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { Event } from '@/types/event.types';
import type { PlanCandidate } from '@/lib/weekPlan';
import { defaultPlanDates } from '@/lib/weekPlan';
import { toLocalDateString } from '@/lib/dateWindows';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => '/szczecin/moj-tydzien',
}));

vi.mock('@/components/service/useCategories', () => ({
  useCategories: () => ({ displayNameToSlug: new Map<string, string>() }),
}));

const api = vi.hoisted(() => ({
  candidates: [] as PlanCandidate[],
  shared: [] as Event[],
}));
vi.mock('@/components/service/eventsApi', () => ({
  fetchPlanCandidates: vi.fn(async () => api.candidates),
  fetchEventsByIds: vi.fn(async () => api.shared),
}));

import WeekPlanView from './WeekPlanView';

let nextId = 1;
function makeEvent(date: string, name: string, overrides: Partial<Event> = {}): Event {
  const id = String(nextId++);
  return {
    id,
    eventKey: `key-${id}`,
    name,
    description: '',
    categoryMain: 'Muzyka',
    categorySub: '',
    date,
    startTime: '19:00',
    endTime: '',
    durationMin: null,
    location: { name: `Klub ${id}`, city: 'Szczecin', lat: null, lng: null },
    price: { amount: 30, currency: 'PLN', label: '30 zł', showLabel: false },
    url: '',
    imageUrl: '',
    sources: ['test'],
    updatedAt: null,
    ...overrides,
  };
}

function candidate(event: Event): PlanCandidate {
  return { event, popularity: 1, imageKind: 'poster', seasons: [], audience: [], isLastDay: false, soldOut: false };
}

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WeekPlanView />
    </QueryClientProvider>
  );
}

const DAYS = defaultPlanDates(toLocalDateString(new Date()));

beforeEach(() => {
  nav.search = '';
  window.localStorage.clear();
  // Five concerts on each default day: three shown, two in reserve for skips.
  api.candidates = DAYS.flatMap((date) =>
    Array.from({ length: 5 }, (_, i) => candidate(makeEvent(date, `Koncert ${date} #${i}`)))
  );
  api.shared = [];
});

describe('WeekPlanView', () => {
  async function board() {
    renderView();
    return within(await screen.findByRole('list', { name: 'Twój tydzień' }));
  }

  it('lays out a card per default day, each with an empty slot to fill', async () => {
    const b = await board();
    const days = b.getAllByRole('heading', { level: 2 });
    expect(days).toHaveLength(DAYS.length);
    expect(b.getAllByRole('button', { name: /Wybierz wydarzenie/ })).toHaveLength(DAYS.length);
    expect(b.queryAllByRole('article')).toHaveLength(0);
  });

  it('picks in a dialog and puts the choice on the board', async () => {
    const user = userEvent.setup();
    const b = await board();
    await user.click(b.getAllByRole('button', { name: /Wybierz wydarzenie/ })[0]);
    const dialog = await screen.findByRole('dialog');
    const cards = within(dialog).getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.getAttribute('aria-label')!.includes(DAYS[0]))).toBe(true);
    const name = cards[1].getAttribute('aria-label')!;
    await user.click(within(cards[1]).getByRole('button', { name: 'Wybieram' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(b.getByRole('article', { name })).toBeInTheDocument();
    expect(b.getAllByRole('button', { name: /Wybierz wydarzenie/ })).toHaveLength(DAYS.length - 1);
    expect(screen.getByText(`W planie: 1 z ${DAYS.length}`)).toBeInTheDocument();
    // ...and the plan survives a reload.
    expect(window.localStorage.getItem('go-to-city.week-plan.szczecin')).toContain(`"${DAYS[0]}#0"`);
  });

  it('swaps only the skipped card in the dialog', async () => {
    const user = userEvent.setup();
    const b = await board();
    await user.click(b.getAllByRole('button', { name: /Wybierz wydarzenie/ })[0]);
    const dialog = await screen.findByRole('dialog');
    const labels = () => within(dialog).getAllByRole('article').map((c) => c.getAttribute('aria-label'));
    const before = labels();
    await user.click(within(within(dialog).getAllByRole('article')[0]).getByRole('button', { name: 'Pomiń' }));
    const after = labels();
    expect(after).toHaveLength(3);
    expect(after[0]).not.toBe(before[0]);
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  it('fills the whole week with "Zaskocz mnie"', async () => {
    const user = userEvent.setup();
    const b = await board();
    await user.click(screen.getByRole('button', { name: 'Zaskocz mnie' }));
    expect(b.getAllByRole('article')).toHaveLength(DAYS.length);
    expect(b.queryAllByRole('button', { name: /Wybierz wydarzenie/ })).toHaveLength(0);
    expect(screen.getByText(`W planie: ${DAYS.length} z ${DAYS.length}`)).toBeInTheDocument();
  });

  it('opens a shared plan read-only and says what has gone', async () => {
    const today = toLocalDateString(new Date());
    api.shared = [makeEvent(today, 'Wspólny koncert')];
    nav.search = `plan=${api.shared[0].id}.999`;
    const user = userEvent.setup();
    renderView();
    expect(await screen.findByRole('heading', { name: 'Plan, który ktoś Ci podesłał' })).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Wspólny koncert' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wybieram' })).not.toBeInTheDocument();
    expect(screen.getByText(/1 wydarzenie z tego planu już się odbyło/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ułóż własny tydzień' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/szczecin/moj-tydzien'));
  });
});
