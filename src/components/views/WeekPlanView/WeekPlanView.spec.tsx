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
  useCategories: () => ({ displayNameToSlug: new Map<string, string>(), byDisplayName: new Map() }),
}));

const api = vi.hoisted(() => ({
  candidates: [] as PlanCandidate[],
  shared: [] as Event[],
}));
vi.mock('@/components/service/eventsApi', () => ({
  fetchPlanCandidates: vi.fn(async () => api.candidates),
  fetchEventsByIds: vi.fn(async (_city: string, ids: readonly string[]) =>
    api.shared.filter((e) => ids.includes(e.id))
  ),
}));

// The PDF itself is planPdf.spec's business; here it only has to arrive.
vi.mock('@/lib/planPdf', () => ({
  fetchPlanPdfFonts: vi.fn(async () => ({})),
  buildPlanPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
}));

import WeekPlanView from './WeekPlanView';
import { buildPlanPdf as buildPlanPdfMock } from '@/lib/planPdf';

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
  nav.replace.mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => 'blob:plan');
  URL.revokeObjectURL = vi.fn();
  vi.mocked(buildPlanPdfMock).mockClear();
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
    // Every test event costs 30 zł: each day says so, the week adds them up.
    expect(b.getAllByText('ok. 30 zł')).toHaveLength(DAYS.length);
    expect(screen.getByText(`ok. ${30 * DAYS.length} zł`)).toBeInTheDocument();
  });

  it('turns a mood tile on and off', async () => {
    const user = userEvent.setup();
    await board();
    const music = screen.getByRole('button', { name: /Muzyka/ });
    expect(music).toHaveAttribute('aria-pressed', 'false');
    await user.click(music);
    expect(music).toHaveAttribute('aria-pressed', 'true');
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

  it('shares the plan as a link with the plan written out, and as a PDF', async () => {
    const user = userEvent.setup();
    const b = await board();
    await user.click(screen.getByRole('button', { name: 'Zaskocz mnie' }));
    const chosen = b.getAllByRole('article').map((a) => a.getAttribute('aria-label')!);
    await user.click(screen.getByRole('button', { name: 'Udostępnij plan' }));

    const dialog = await screen.findByRole('dialog', { name: 'Udostępnij plan' });
    const link = within(dialog).getByRole('textbox', { name: 'Link do planu' }) as HTMLInputElement;
    expect(link.value).toMatch(/\/szczecin\/moj-tydzien\?plan=\d+(\.\d+)*$/);
    expect(link.value.split('=')[1].split('.')).toHaveLength(DAYS.length);

    const whatsapp = within(dialog).getByRole('link', { name: 'WhatsApp' });
    const message = decodeURIComponent(whatsapp.getAttribute('href')!.split('text=')[1]);
    expect(message).toContain('Mój tydzień w Szczecinie');
    for (const name of chosen) expect(message).toContain(name);
    expect(message.trimEnd().endsWith(link.value)).toBe(true);
    expect(within(dialog).getByRole('link', { name: 'Telegram' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'E-mail' })).toHaveAttribute('href', expect.stringMatching(/^mailto:/));
    // Phone-only apps stay off a desktop.
    expect(within(dialog).queryByRole('link', { name: 'Messenger' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: 'SMS' })).not.toBeInTheDocument();

    // Made on demand only: pdf-lib is heavy, and most people just send the link.
    const { buildPlanPdf } = await import('@/lib/planPdf');
    expect(buildPlanPdf).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Pobierz PDF' }));
    const pdf = await within(dialog).findByRole('link', { name: 'Pobierz PDF' });
    expect(buildPlanPdf).toHaveBeenCalledTimes(1);
    expect(pdf).toHaveAttribute('href', 'blob:plan');
    expect(pdf.getAttribute('download')).toMatch(/^idznamiasto-plan-szczecin-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('copies a shared plan into the visitor’s own planner', async () => {
    const event = makeEvent(DAYS[1], 'Wspólny koncert', { startTime: '20:00' });
    api.shared = [event];
    nav.search = `plan=${event.id}`;
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Skopiuj do mojego planu' }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/szczecin/moj-tydzien'));
    const stored = JSON.parse(window.localStorage.getItem('go-to-city.week-plan.szczecin')!);
    expect(stored.settings.days).toEqual([{ date: DAYS[1], parts: ['evening'] }]);
    expect(stored.chosen).toEqual({ [`${DAYS[1]}#0`]: event.id });
  });

  it('asks before a copy replaces a plan the visitor already has', async () => {
    const mine = { settings: { days: [{ date: DAYS[0], parts: ['any'] }], moods: [], freeOnly: false }, chosen: { [`${DAYS[0]}#0`]: '1' } };
    window.localStorage.setItem('go-to-city.week-plan.szczecin', JSON.stringify(mine));
    const event = makeEvent(DAYS[1], 'Wspólny koncert');
    api.shared = [event];
    nav.search = `plan=${event.id}`;
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Skopiuj do mojego planu' }));

    const confirm = await screen.findByRole('dialog', { name: 'Zastąpić Twój plan?' });
    expect(within(confirm).getByText(/Masz już w planie 1 wydarzenie/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Anuluj' }));
    expect(JSON.parse(window.localStorage.getItem('go-to-city.week-plan.szczecin')!)).toEqual(mine);
    expect(nav.replace).not.toHaveBeenCalled();

    // The page is aria-hidden until the dialog's exit transition ends.
    await user.click(await screen.findByRole('button', { name: 'Skopiuj do mojego planu' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Zastąpić Twój plan?' })).getByRole('button', { name: 'Zastąp' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/szczecin/moj-tydzien'));
    expect(JSON.parse(window.localStorage.getItem('go-to-city.week-plan.szczecin')!).chosen).toEqual({
      [`${DAYS[1]}#0`]: event.id,
    });
  });

  it('keeps a copied choice the week’s draw would not offer, and says it was copied', async () => {
    // A gym class: classes are not read while "Aktywnie" is off.
    const gym = makeEvent(DAYS[0], 'Joga poranna', { categoryMain: 'Sport i Fitness', startTime: '08:00' });
    api.shared = [gym];
    window.localStorage.setItem(
      'go-to-city.week-plan.szczecin',
      JSON.stringify({
        settings: { days: [{ date: DAYS[0], parts: ['morning'] }], moods: [], freeOnly: false },
        chosen: { [`${DAYS[0]}#0`]: gym.id },
      })
    );
    window.sessionStorage.setItem('go-to-city.week-plan.copied', '1');
    renderView();
    const b = within(await screen.findByRole('list', { name: 'Twój tydzień' }));
    expect(await b.findByRole('article', { name: 'Joga poranna' })).toBeInTheDocument();
    expect(screen.getByText('Plan skopiowany. Zmieniaj śmiało.')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('go-to-city.week-plan.szczecin')!).chosen).toEqual({
      [`${DAYS[0]}#0`]: gym.id,
    });
  });
});
