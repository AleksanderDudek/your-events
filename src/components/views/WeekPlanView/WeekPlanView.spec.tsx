import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { Event } from '@/types/event.types';
import type { PlanCandidate } from '@/lib/weekPlan';
import { settingsForDays } from '@/lib/weekPlan';
import type { SavedPlan } from '@/lib/weekPlans';

// The URL is the page's state (?plan=, ?id=, nothing), and the view moves
// between them with navigateInPage. Here that is a tiny store: a navigation
// changes the query and every useSearchParams reader re-renders, as the real
// router does on the popstate navigateInPage replays.
const nav = vi.hoisted(() => {
  const state = {
    search: '',
    listeners: new Set<() => void>(),
    go: (path: string) => {
      state.search = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
      state.listeners.forEach((listener) => listener());
    },
  };
  return state;
});

vi.mock('next/navigation', async () => {
  const { useMemo, useSyncExternalStore } = await import('react');
  return {
    useSearchParams: () => {
      const search = useSyncExternalStore(
        (onChange: () => void) => {
          nav.listeners.add(onChange);
          return () => nav.listeners.delete(onChange);
        },
        () => nav.search
      );
      return useMemo(() => new URLSearchParams(search), [search]);
    },
    usePathname: () => '/szczecin/moj-tydzien',
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  };
});

const navigateInPage = vi.hoisted(() => vi.fn((path: string) => nav.go(path)));
vi.mock('@/lib/inPageNavigation', () => ({ navigateInPage, isSamePageWithQuery: () => false }));

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

// A Monday, so this week's draft has all four default days.
const TODAY = '2026-11-23';
const DAYS = ['2026-11-23', '2026-11-25', '2026-11-27', '2026-11-29'];
const PLANS_KEY = 'go-to-city.week-plans.szczecin';
const LIST_PATH = '/szczecin/moj-tydzien/';

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

function savedPlan(overrides: Partial<SavedPlan> = {}): SavedPlan {
  return {
    id: 'mine0001',
    name: null,
    start: TODAY,
    origin: 'own',
    sourceKey: null,
    createdAt: 1,
    settings: settingsForDays([DAYS[0]]),
    chosen: {},
    ...overrides,
  };
}

function seedPlans(...plans: SavedPlan[]) {
  window.localStorage.setItem(PLANS_KEY, JSON.stringify({ version: 2, plans }));
}

function storedPlans(): SavedPlan[] {
  return JSON.parse(window.localStorage.getItem(PLANS_KEY) ?? '{"plans":[]}').plans;
}

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WeekPlanView />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 23, 10, 0));
  nav.search = '';
  navigateInPage.mockClear();
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

afterEach(() => {
  vi.useRealTimers();
});

// Whole-page tests: a full board, MUI dialogs and menus with their transitions.
// About a second each alone, but in a full parallel run on a loaded machine
// some went past the 5 s default (and an overrunning test keeps writing plans
// into the next one's storage). Hence the longer budget for this file.
const SLOW = { timeout: 15_000 };

async function board() {
  return within(await screen.findByRole('list', { name: 'Twój tydzień' }));
}

describe('WeekPlanView: a first plan', SLOW, () => {
  it('lays out a card per default day, and looking around saves nothing', async () => {
    renderView();
    const b = await board();
    const days = b.getAllByRole('heading', { level: 2 });
    expect(days).toHaveLength(DAYS.length);
    expect(b.getAllByRole('button', { name: /Wybierz wydarzenie/ })).toHaveLength(DAYS.length);
    expect(b.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText('Ten tydzień · 23 lis – 29 lis')).toBeInTheDocument();
    expect(window.localStorage.getItem(PLANS_KEY)).toBeNull();
    expect(navigateInPage).not.toHaveBeenCalled();
  });

  it('picks in a dialog, and the first choice saves the plan under its own address', async () => {
    const user = userEvent.setup();
    renderView();
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

    const [plan] = storedPlans();
    expect(plan).toMatchObject({ start: TODAY, origin: 'own', name: null });
    expect(plan.chosen).toEqual({ [`${DAYS[0]}#0`]: expect.any(String) });
    expect(navigateInPage).toHaveBeenCalledWith(`${LIST_PATH}?id=${plan.id}`, { replace: true });
    // Same planner, now a saved plan: its name, the way back to the list.
    expect(await screen.findByRole('heading', { level: 1, name: 'Ten tydzień' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Twoje plany' })).toBeInTheDocument();
    expect(b.getByRole('article', { name })).toBeInTheDocument();
  });

  it('swaps only the skipped card in the dialog', async () => {
    const user = userEvent.setup();
    renderView();
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
    renderView();
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
    renderView();
    await board();
    const music = screen.getByRole('button', { name: /Muzyka/ });
    expect(music).toHaveAttribute('aria-pressed', 'false');
    await user.click(music);
    expect(music).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts a plan for another week from the first one', async () => {
    const user = userEvent.setup();
    renderView();
    await board();
    await user.click(screen.getByRole('button', { name: 'Zaplanuj inny tydzień' }));
    const dialog = await screen.findByRole('dialog', { name: 'Na który tydzień?' });
    await user.click(within(dialog).getByRole('button', { name: /Przyszły tydzień/ }));

    const [plan] = storedPlans();
    expect(plan.start).toBe('2026-11-30');
    expect(navigateInPage).toHaveBeenLastCalledWith(`${LIST_PATH}?id=${plan.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Przyszły tydzień' })).toBeInTheDocument();
  });

  it('shares the plan as a link with the plan written out, and as a PDF', async () => {
    const user = userEvent.setup();
    renderView();
    const b = await board();
    await user.click(screen.getByRole('button', { name: 'Zaskocz mnie' }));
    const chosen = b.getAllByRole('article').map((a) => a.getAttribute('aria-label')!);
    await user.click(screen.getByRole('button', { name: 'Udostępnij plan' }));

    const dialog = await screen.findByRole('dialog', { name: 'Udostępnij plan' });
    const link = within(dialog).getByRole('textbox', { name: 'Link do planu' }) as HTMLInputElement;
    // usePathname() leaves the base path out; a link without it 404s on GitHub Pages.
    expect(link.value.startsWith(`${window.location.origin}/your-events/szczecin/moj-tydzien?plan=`)).toBe(true);
    expect(link.value).toMatch(/\?plan=\d+(\.\d+)*$/);
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
});

describe('WeekPlanView: a plan someone sent', SLOW, () => {
  it('opens read-only and says what has gone', async () => {
    api.shared = [makeEvent(TODAY, 'Wspólny koncert')];
    nav.search = `plan=${api.shared[0].id}.999`;
    const user = userEvent.setup();
    renderView();
    expect(await screen.findByRole('heading', { name: 'Plan, który ktoś Ci podesłał' })).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'Wspólny koncert' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wybieram' })).not.toBeInTheDocument();
    expect(screen.getByText(/1 wydarzenie z tego planu już się odbyło/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Ułóż własny tydzień' }));
    expect(navigateInPage).toHaveBeenCalledWith(LIST_PATH);
  });

  it('copies into a new plan of the visitor’s own and opens it', async () => {
    const event = makeEvent(DAYS[1], 'Wspólny koncert', { startTime: '20:00' });
    api.shared = [event];
    nav.search = `plan=${event.id}`;
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Skopiuj do moich planów' }));

    const [copy] = storedPlans();
    expect(copy).toMatchObject({ origin: 'copy', start: DAYS[1], sourceKey: event.id });
    expect(copy.settings.days).toEqual([{ date: DAYS[1], parts: ['evening'] }]);
    expect(copy.chosen).toEqual({ [`${DAYS[1]}#0`]: event.id });
    expect(navigateInPage).toHaveBeenCalledWith(`${LIST_PATH}?id=${copy.id}`, { replace: true });

    expect(await screen.findByRole('heading', { level: 1, name: 'Plan od znajomych' })).toBeInTheDocument();
    expect(screen.getByText('Skopiowany')).toBeInTheDocument();
    expect(await (await board()).findByRole('article', { name: 'Wspólny koncert' })).toBeInTheDocument();
    expect(screen.getByText('Plan skopiowany. Zmieniaj śmiało.')).toBeInTheDocument();
  });

  it('leaves the visitor’s own plans as they are', async () => {
    const mine = savedPlan({ chosen: { [`${DAYS[0]}#0`]: '1' } });
    seedPlans(mine);
    const event = makeEvent(DAYS[1], 'Wspólny koncert');
    api.shared = [event];
    nav.search = `plan=${event.id}`;
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Skopiuj do moich planów' }));

    const plans = storedPlans();
    expect(plans).toHaveLength(2);
    expect(plans.find((p) => p.id === mine.id)).toEqual(mine);
  });

  it('opens the copy already made when the same link is copied again', async () => {
    const event = makeEvent(DAYS[1], 'Wspólny koncert');
    const copy = savedPlan({ id: 'copy0001', origin: 'copy', sourceKey: event.id, start: DAYS[1] });
    seedPlans(copy);
    api.shared = [event];
    nav.search = `plan=${event.id}`;
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Skopiuj do moich planów' }));

    expect(storedPlans()).toHaveLength(1);
    expect(navigateInPage).toHaveBeenCalledWith(`${LIST_PATH}?id=copy0001`, { replace: true });
    expect(await screen.findByText('Ten plan już masz — oto on.')).toBeInTheDocument();
  });

  it('keeps a copied choice the week’s draw would not offer', async () => {
    // A gym class: classes are not read while "Aktywnie" is off.
    const gym = makeEvent(DAYS[0], 'Joga poranna', { categoryMain: 'Sport i Fitness', startTime: '08:00' });
    api.shared = [gym];
    seedPlans(
      savedPlan({
        id: 'copy0001',
        origin: 'copy',
        settings: { days: [{ date: DAYS[0], parts: ['morning'] }], moods: [], freeOnly: false },
        chosen: { [`${DAYS[0]}#0`]: gym.id },
      })
    );
    nav.search = 'id=copy0001';
    window.sessionStorage.setItem('go-to-city.week-plan.copied', 'new');
    renderView();
    expect(await (await board()).findByRole('article', { name: 'Joga poranna' })).toBeInTheDocument();
    expect(screen.getByText('Plan skopiowany. Zmieniaj śmiało.')).toBeInTheDocument();
    expect(storedPlans()[0].chosen).toEqual({ [`${DAYS[0]}#0`]: gym.id });
  });
});

describe('WeekPlanView: the list of plans', SLOW, () => {
  it('shows each plan with its week, its events, or that it is empty', async () => {
    const concert = makeEvent(DAYS[0], 'Koncert w Filharmonii');
    api.shared = [concert];
    seedPlans(
      savedPlan({ chosen: { [`${DAYS[0]}#0`]: concert.id } }),
      savedPlan({ id: 'next0001', start: '2026-11-30', settings: settingsForDays(['2026-11-30']) })
    );
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByRole('heading', { level: 1, name: 'Twoje plany' })).toBeInTheDocument();
    const list = within(screen.getByRole('list', { name: 'Twoje plany' }));
    const [thisWeek, nextWeek] = list.getAllByRole('link');
    expect(thisWeek).toHaveTextContent('Ten tydzień');
    expect(thisWeek).toHaveTextContent('1 wydarzenie');
    expect(await within(thisWeek).findByText('Koncert w Filharmonii')).toBeInTheDocument();
    expect(nextWeek).toHaveTextContent('Przyszły tydzień');
    expect(nextWeek).toHaveTextContent('30 lis – 6 gru');
    expect(nextWeek).toHaveTextContent('Pusty plan');
    expect(nextWeek).toHaveAttribute('href', '/your-events/szczecin/moj-tydzien/?id=next0001');

    await user.click(nextWeek);
    expect(navigateInPage).toHaveBeenCalledWith(`${LIST_PATH}?id=next0001`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Przyszły tydzień' })).toBeInTheDocument();
  });

  it('makes a new plan for the week chosen', async () => {
    seedPlans(savedPlan());
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Nowy plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Na który tydzień?' });
    const options = within(dialog).getAllByRole('button').filter((b) => b.textContent !== 'Anuluj');
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('Ten tydzień'),
      expect.stringContaining('Przyszły tydzień'),
      expect.stringContaining('Za 2 tygodnie'),
      expect.stringContaining('Za 3 tygodnie'),
    ]);
    expect(options[0]).toHaveTextContent('Masz już plan na ten tydzień');
    await user.click(options[2]);

    const created = storedPlans().find((p) => p.id !== 'mine0001')!;
    expect(created.start).toBe('2026-12-07');
    expect(created.settings.days.map((d) => d.date)).toEqual(['2026-12-07', '2026-12-09', '2026-12-11', '2026-12-13']);
    expect(navigateInPage).toHaveBeenCalledWith(`${LIST_PATH}?id=${created.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Za 2 tygodnie' })).toBeInTheDocument();
    expect(screen.getByText(/Tak daleko naprzód znamy na razie mniej wydarzeń/)).toBeInTheDocument();
  });

  it('renames a plan', async () => {
    seedPlans(savedPlan());
    nav.search = 'id=mine0001';
    const user = userEvent.setup();
    renderView();
    await board();

    await user.click(screen.getByRole('button', { name: 'Opcje planu „Ten tydzień”' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Zmień nazwę' }));
    const field = await screen.findByRole('textbox', { name: 'Nazwa planu' });
    await user.click(field);
    await user.paste('  Weekend   z mamą ');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Weekend z mamą' })).toBeInTheDocument();
    expect(storedPlans()[0].name).toBe('Weekend z mamą');
  });

  it('gives a plan its week’s name back when the name is cleared', async () => {
    seedPlans(savedPlan({ name: 'Weekend z mamą' }));
    nav.search = 'id=mine0001';
    const user = userEvent.setup();
    renderView();
    await board();

    await user.click(screen.getByRole('button', { name: 'Opcje planu „Weekend z mamą”' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Zmień nazwę' }));
    await user.clear(await screen.findByRole('textbox', { name: 'Nazwa planu' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ten tydzień' })).toBeInTheDocument();
    expect(storedPlans()[0].name).toBeNull();
  });

  it('deletes a plan, and the delete can be undone', async () => {
    seedPlans(savedPlan({ name: 'Weekend z mamą' }));
    nav.search = 'id=mine0001';
    const user = userEvent.setup();
    renderView();
    await board();

    await user.click(screen.getByRole('button', { name: 'Opcje planu „Weekend z mamą”' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Usuń plan' }));
    expect(storedPlans()).toEqual([]);
    expect(navigateInPage).toHaveBeenLastCalledWith(LIST_PATH, { replace: true });
    expect(await screen.findByText('Usunięto „Weekend z mamą”')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cofnij' }));
    expect(storedPlans().map((p) => p.name)).toEqual(['Weekend z mamą']);
    expect(await screen.findByRole('link', { name: /Weekend z mamą/ })).toBeInTheDocument();
  });

  it('moves the single plan kept before there were several into the list', async () => {
    window.localStorage.setItem(
      'go-to-city.week-plan.szczecin',
      JSON.stringify({ settings: settingsForDays([DAYS[1]]), chosen: { [`${DAYS[1]}#0`]: '77' } })
    );
    renderView();
    expect(await screen.findByRole('link', { name: /Ten tydzień/ })).toHaveTextContent('1 wydarzenie');
    expect(window.localStorage.getItem('go-to-city.week-plan.szczecin')).toBeNull();
    expect(storedPlans()).toEqual([
      expect.objectContaining({ start: DAYS[1], chosen: { [`${DAYS[1]}#0`]: '77' }, origin: 'own' }),
    ]);
  });

  it('says so when a plan is no longer there', async () => {
    nav.search = 'id=gone0001';
    const user = userEvent.setup();
    renderView();
    expect(await screen.findByText(/Tego planu już nie ma/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Twoje plany' }));
    expect(navigateInPage).toHaveBeenCalledWith(LIST_PATH);
  });
});
