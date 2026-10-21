import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LatLng } from '@/lib/geo';
import LocationPickerDialog from './LocationPickerDialog';

// Leaflet cannot run in jsdom; the stand-in exposes the two things the map
// reports — a click and where it is centred.
vi.mock('./LocationPickerMap', () => ({
  default: ({
    onPick,
    onCenterChange,
  }: {
    onPick: (p: LatLng) => void;
    onCenterChange: (p: LatLng) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onPick({ lat: 51.1, lng: 17.03 })}>
        map click
      </button>
      <button type="button" onClick={() => onCenterChange({ lat: 51.2, lng: 17.1 })}>
        map pan
      </button>
    </div>
  ),
}));

const CITY = { lat: 51.1079, lng: 17.0385 };

function renderDialog(overrides: Partial<React.ComponentProps<typeof LocationPickerDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <LocationPickerDialog
      fallbackCenter={CITY}
      initialPoint={null}
      initialRadius={1000}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />
  );
  return { onConfirm, onCancel };
}

describe('LocationPickerDialog', () => {
  it('cannot apply before a point is dropped', async () => {
    renderDialog();
    await screen.findByRole('button', { name: 'map click' });
    expect(screen.getByRole('button', { name: 'Zastosuj' })).toBeDisabled();
  });

  it('applies the dropped point with the radius chosen in the dialog', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'map click' }));
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Promień' }), { key: 'ArrowRight' });
    await user.click(screen.getByRole('button', { name: 'Zastosuj' }));

    expect(onConfirm).toHaveBeenCalledWith({ lat: 51.1, lng: 17.03 }, 1500);
  });

  // A keyboard cannot click a map, but it can pan one.
  it('drops the pin where the map is centred', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'map pan' }));
    await user.click(screen.getByRole('button', { name: 'Postaw na środku mapy' }));
    await user.click(screen.getByRole('button', { name: 'Zastosuj' }));

    expect(onConfirm).toHaveBeenCalledWith({ lat: 51.2, lng: 17.1 }, 1000);
  });

  it('starts from the current point, so Apply works straight away', async () => {
    renderDialog({ initialPoint: { lat: 51.11, lng: 17.032 } });
    await screen.findByRole('button', { name: 'map click' });
    expect(screen.getByRole('button', { name: 'Zastosuj' })).toBeEnabled();
  });

  it('cancels', async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
