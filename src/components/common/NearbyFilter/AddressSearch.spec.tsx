import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchAddresses } from '@/components/service/geocoding';
import AddressSearch from './AddressSearch';

vi.mock('@/components/service/geocoding', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/service/geocoding')>()),
  searchAddresses: vi.fn(),
}));

const searchAddressesMock = vi.mocked(searchAddresses);

function renderSearch() {
  const onSelect = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AddressSearch onSelect={onSelect} />
    </QueryClientProvider>
  );
  return { onSelect, box: screen.getByRole('combobox', { name: 'Adres lub miejsce' }) };
}

beforeEach(() => {
  searchAddressesMock.mockReset();
});

describe('AddressSearch', () => {
  it('asks for three characters before searching', async () => {
    const user = userEvent.setup();
    const { box } = renderSearch();

    await user.type(box, 'Ry');

    expect(await screen.findByText('Wpisz co najmniej 3 znaki')).toBeInTheDocument();
    expect(searchAddressesMock).not.toHaveBeenCalled();
  });

  it('offers what the geocoder found and reports the pick', async () => {
    searchAddressesMock.mockResolvedValue([
      { id: 'W1', label: 'Świdnicka 12', detail: 'Stare Miasto, Wrocław', lat: 51.1069, lng: 17.0322 },
    ]);
    const user = userEvent.setup();
    const { onSelect, box } = renderSearch();

    await user.type(box, 'Świdnicka');
    await user.click(await screen.findByRole('option', { name: /Świdnicka 12/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ label: 'Świdnicka 12', lat: 51.1069 }));
    // Debounced: the half-typed prefixes never reached the geocoder.
    expect(searchAddressesMock).toHaveBeenCalledTimes(1);
    expect(searchAddressesMock).toHaveBeenCalledWith(
      'Świdnicka',
      expect.objectContaining({ lat: expect.any(Number) }),
      'pl',
      expect.anything()
    );
  });

  // One street name in two districts: the label alone is not a unique key.
  it('lists look-alike addresses side by side', async () => {
    searchAddressesMock.mockResolvedValue([
      { id: 'W1', label: 'Kościuszki', detail: 'Stare Miasto, Wrocław', lat: 51.1, lng: 17.03 },
      { id: 'W2', label: 'Kościuszki', detail: 'Siechnice', lat: 51.04, lng: 17.15 },
    ]);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const { box } = renderSearch();

    await user.type(box, 'Kościuszki');

    expect(await screen.findAllByRole('option', { name: /Kościuszki/ })).toHaveLength(2);
    const duplicateKey = consoleError.mock.calls.some((args) => String(args[0]).includes('same key'));
    consoleError.mockRestore();
    expect(duplicateKey).toBe(false);
  });

  it('says so when the geocoder is down', async () => {
    searchAddressesMock.mockRejectedValue(new Error('503'));
    const user = userEvent.setup();
    const { box } = renderSearch();

    await user.type(box, 'Rynek');

    expect(await screen.findByText('Wyszukiwarka adresów jest chwilowo niedostępna')).toBeInTheDocument();
  });

  it('credits OpenStreetMap', () => {
    renderSearch();
    expect(screen.getByText(/© OpenStreetMap/)).toBeInTheDocument();
  });
});
