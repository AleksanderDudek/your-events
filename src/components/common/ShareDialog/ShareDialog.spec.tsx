import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ShareDialog from './ShareDialog';
import { openShareDialog, resetShareStoreForTests } from '@/components/service/usePromoShare';
import { resetPromoMediaForTests } from '@/components/service/usePromoMedia';

vi.mock('next/navigation', () => ({
  usePathname: () => '/szczecin',
  useRouter: () => ({ push: vi.fn() }),
}));

type Nav = Record<string, unknown>;
function stub(key: string, value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
}

const fetchMock = vi.fn();

beforeEach(() => {
  resetShareStoreForTests();
  resetPromoMediaForTests();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:promo');
  // jsdom has no media playback.
  HTMLMediaElement.prototype.load = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ['share', 'canShare', 'clipboard']) delete (navigator as unknown as Nav)[key];
});

function open() {
  render(<ShareDialog />);
  act(() => openShareDialog('header'));
  return screen.getByRole('dialog', { name: 'Poleć Idź na miasto' });
}

describe('ShareDialog', () => {
  it('stays closed until opened', () => {
    render(<ShareDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the post caption with its character count', () => {
    open();
    const caption = screen.getByLabelText('Opis') as HTMLTextAreaElement;
    expect(caption.value).toContain('idznamiasto.pl');
    expect(caption.value).toContain('#idznamiasto #Szczecin');
    expect(screen.getByText(/\/130 znaków/)).toBeInTheDocument();
  });

  it('switches to the story caption and its tip', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: /Relacja \/ Short/ }));
    const caption = screen.getByLabelText('Opis') as HTMLTextAreaElement;
    expect(caption.value).toMatch(/^Coś się dzieje, a Ty nie wiesz\?/);
    expect(screen.getByText(/naklejkę „Link”/)).toBeInTheDocument();
  });

  it('without a share sheet, offers copy, downloads and web links', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub('clipboard', { writeText });
    open();

    expect(screen.queryByRole('button', { name: /Udostępnij/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kopiuj opis' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('idznamiasto.pl'));
    expect(await screen.findByText('Opis skopiowany')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Pobierz film/ })).toHaveAttribute('download', 'idznamiasto-post.mp4');
    expect(screen.getByRole('link', { name: /Pobierz grafikę/ })).toHaveAttribute('download', 'idznamiasto-post.jpg');
    expect(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(screen.getByRole('link', { name: /Facebook/ }).getAttribute('href')).toContain('facebook.com/sharer');
    // No download of the video for a browser that could never attach it.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shares the prepared video with the caption, and copies the caption too', async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub('share', share);
    stub('canShare', vi.fn().mockReturnValue(true));
    stub('clipboard', { writeText });
    fetchMock.mockResolvedValue(new Response(new Blob(['v'], { type: 'video/mp4' })));
    open();

    const button = await screen.findByRole('button', { name: 'Udostępnij z filmem' });
    await user.click(button);

    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0] as ShareData;
    expect(data.files?.[0].name).toBe('idznamiasto-post.mp4');
    expect(data.text).toContain('idznamiasto.pl');
    expect(writeText).toHaveBeenCalledWith(data.text);
    expect(await screen.findByText(/Opis jest w schowku/)).toBeInTheDocument();
  });

  it('shows the poster, not a second video download, until the prefetch lands', () => {
    stub('share', vi.fn());
    stub('canShare', vi.fn().mockReturnValue(true));
    fetchMock.mockReturnValue(new Promise(() => {}));
    const dialog = open();
    expect(dialog.querySelector('video')).toBeNull();
    expect(screen.getByRole('button', { name: /Przygotowuję film/ })).toBeDisabled();
  });

  it('forgets an old toast when reopened', async () => {
    const user = userEvent.setup();
    stub('clipboard', { writeText: vi.fn().mockResolvedValue(undefined) });
    open();
    await user.click(screen.getByRole('button', { name: 'Kopiuj opis' }));
    expect(await screen.findByText('Opis skopiowany')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zamknij' }));
    act(() => openShareDialog('footer'));
    expect(screen.queryByText('Opis skopiowany')).not.toBeInTheDocument();
  });

  it('falls back to the image and says so when the video cannot be had', async () => {
    stub('share', vi.fn().mockResolvedValue(undefined));
    stub('canShare', vi.fn().mockReturnValue(true));
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('.mp4')
        ? Promise.reject(new TypeError('offline'))
        : Promise.resolve(new Response(new Blob(['i'], { type: 'image/jpeg' })))
    );
    open();

    expect(await screen.findByRole('button', { name: 'Udostępnij z grafiką' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Filmu nie udało się przygotować');
    expect(screen.getByRole('img', { name: /Otwierasz i wiesz/ })).toBeInTheDocument();
  });

  it('tells the visitor when the share sheet fails', async () => {
    const user = userEvent.setup();
    stub('share', vi.fn().mockRejectedValue(new DOMException('x', 'NotAllowedError')));
    open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Udostępnij' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Udostępnij' }));
    expect(await screen.findByText(/Nie udało się otworzyć udostępniania/)).toBeInTheDocument();
  });

  // axe over a full MUI dialog is slow in jsdom; the default 5 s is not enough.
  it('passes accessibility check', async () => {
    const dialog = open();
    expect(await axe(dialog)).toHaveNoViolations();
  }, 20_000);
});
