import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ShareEvent from './ShareEvent';
import type { Event } from '@/types/event.types';

type Nav = Record<string, unknown>;
function stub(key: string, value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
}

afterEach(() => {
  for (const key of ['share', 'clipboard']) delete (navigator as unknown as Nav)[key];
});

const event: Event = {
  id: '1',
  eventKey: 'k',
  name: 'Koncert w parku',
  description: '',
  categoryMain: 'muzyka',
  categorySub: '',
  date: '2026-11-14',
  startTime: '19:00',
  endTime: '21:00',
  durationMin: null,
  location: { name: 'Park Kasprowicza', city: 'Szczecin', lat: null, lng: null },
  price: { amount: null, currency: 'PLN', label: '', showLabel: false },
  url: '',
  imageUrl: '',
  sources: [],
  updatedAt: null,
};

describe('ShareEvent', () => {
  it('is labelled as sharing the event', () => {
    render(<ShareEvent event={event} />);
    expect(screen.getByRole('button', { name: 'Udostępnij wydarzenie' })).toBeInTheDocument();
  });

  it('opens the native sheet with the event, its time and place, and its address', async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    stub('share', share);
    render(<ShareEvent event={event} />);
    await user.click(screen.getByRole('button', { name: 'Udostępnij wydarzenie' }));

    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0] as ShareData;
    expect(data.title).toBe('Koncert w parku');
    expect(data.text).toMatch(/^Koncert w parku · .*14.*19:00–21:00 · Park Kasprowicza$/);
    expect(data.url).toBe(window.location.origin + window.location.pathname);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('without a share sheet, offers copy and web links', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub('clipboard', { writeText });
    render(<ShareEvent event={event} />);
    await user.click(screen.getByRole('button', { name: 'Udostępnij wydarzenie' }));

    const menu = screen.getByRole('menu', { name: 'Udostępnij wydarzenie' });
    expect(menu).toBeInTheDocument();
    const whatsapp = screen.getByRole('menuitem', { name: 'WhatsApp' });
    expect(decodeURIComponent(whatsapp.getAttribute('href')!)).toContain('Koncert w parku');

    await user.click(screen.getByRole('menuitem', { name: 'Kopiuj link' }));
    expect(writeText).toHaveBeenCalledWith(window.location.origin + window.location.pathname);
    expect(await screen.findByText('Link skopiowany')).toBeInTheDocument();
  });

  it('does nothing more when the visitor closes the sheet', async () => {
    const user = userEvent.setup();
    stub('share', vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')));
    render(<ShareEvent event={event} />);
    await user.click(screen.getByRole('button', { name: 'Udostępnij wydarzenie' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<ShareEvent event={event} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
