import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LatLng } from '@/lib/geo';
import NearbyFilter from './NearbyFilter';

vi.mock('@/components/service/useAddressSearch', () => ({
  ADDRESS_MIN_CHARS: 3,
  useAddressSearch: () => ({
    suggestions: [{ id: 'W1', label: 'Świdnicka 12', detail: 'Wrocław', lat: 51.1069, lng: 17.0322 }],
    isSearching: false,
    isError: false,
    tooShort: false,
  }),
}));

vi.mock('@/components/common/LocationPicker/LocationPickerDialog', () => ({
  default: ({ onConfirm }: { onConfirm: (point: LatLng, radius: number) => void }) => (
    <button type="button" onClick={() => onConfirm({ lat: 51.12, lng: 17.04 }, 2000)}>
      picker: confirm
    </button>
  ),
}));

type Locate = (ok: PositionCallback, fail: PositionErrorCallback) => void;

function stubGeolocation(locate: Locate) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: vi.fn(locate) },
  });
}

const fixAt =
  (latitude: number, longitude: number): Locate =>
  (ok) =>
    ok({ coords: { latitude, longitude } } as unknown as GeolocationPosition);

afterEach(() => {
  delete (navigator as { geolocation?: unknown }).geolocation;
  window.sessionStorage.clear();
});

const RYNEK = { lat: 51.11, lng: 17.032, radius: 1000, label: null };

describe('NearbyFilter', () => {
  it('sets the point from the device, coarsened to ~100 m, at the default radius', async () => {
    stubGeolocation(fixAt(51.109_87, 17.032_41));
    const onChange = vi.fn();
    render(<NearbyFilter value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' }));

    expect(onChange).toHaveBeenCalledWith({ lat: 51.11, lng: 17.032, radius: 1000, label: null });
  });

  it('calls this tab\'s own fix "your location"', async () => {
    stubGeolocation(fixAt(51.11, 17.032));
    const { rerender } = render(<NearbyFilter value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' }));

    rerender(<NearbyFilter value={RYNEK} onChange={vi.fn()} />);

    expect(screen.getByText('Twoja lokalizacja')).toBeInTheDocument();
  });

  // Someone else's location, arriving by a shared link, is not "yours".
  it('calls an unlabelled point from elsewhere "selected point"', () => {
    render(<NearbyFilter value={RYNEK} onChange={vi.fn()} />);
    expect(screen.getByText('Wybrany punkt')).toBeInTheDocument();
  });

  it.each([
    [1, 'Brak zgody na dostęp do lokalizacji'],
    [2, 'Nie udało się ustalić Twojej lokalizacji'],
    [3, 'Ustalanie lokalizacji trwało zbyt długo'],
  ])('explains a failed fix (code %i) and names the other ways in', async (code, message) => {
    stubGeolocation((_, fail) => fail({ code } as GeolocationPositionError));
    const onChange = vi.fn();
    render(<NearbyFilter value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('says so when the browser has no geolocation at all', async () => {
    render(<NearbyFilter value={null} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ta przeglądarka nie udostępnia lokalizacji'
    );
  });

  it('takes an address as the point, with its name', async () => {
    const onChange = vi.fn();
    render(<NearbyFilter value={null} onChange={onChange} />);

    await userEvent.type(screen.getByRole('combobox', { name: 'Adres lub miejsce' }), 'Świd');
    await userEvent.click(await screen.findByRole('option', { name: /Świdnicka 12/ }));

    expect(onChange).toHaveBeenCalledWith({
      lat: 51.1069,
      lng: 17.0322,
      radius: 1000,
      label: 'Świdnicka 12',
    });
  });

  it('takes a point dropped on the map, with the radius chosen there', async () => {
    const onChange = vi.fn();
    render(<NearbyFilter value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Wskaż na mapie' }));
    await userEvent.click(screen.getByRole('button', { name: 'picker: confirm' }));

    expect(onChange).toHaveBeenCalledWith({ lat: 51.12, lng: 17.04, radius: 2000, label: null });
  });

  it('changes the radius of the current point, keeping its name', () => {
    const onChange = vi.fn();
    render(<NearbyFilter value={{ ...RYNEK, label: 'Rynek' }} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Promień' }), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith({ ...RYNEK, label: 'Rynek', radius: 1500 });
  });

  it('keeps a radius chosen before the point and uses it when the point arrives', async () => {
    stubGeolocation(fixAt(51.11, 17.032));
    const onChange = vi.fn();
    render(<NearbyFilter value={null} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Promień' }), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Użyj mojej lokalizacji' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ radius: 1500 }));
  });

  it('removes the point', async () => {
    const onChange = vi.fn();
    render(<NearbyFilter value={RYNEK} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Usuń lokalizację' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  // Rendered outside a CityProvider, the city is the default — Szczecin.
  it('warns when the point is far from the city', () => {
    render(
      <NearbyFilter value={{ lat: 50.06, lng: 19.94, radius: 1000, label: 'Kraków' }} onChange={vi.fn()} />
    );
    expect(screen.getByText(/daleko od wybranego miasta/)).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<NearbyFilter value={RYNEK} onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
