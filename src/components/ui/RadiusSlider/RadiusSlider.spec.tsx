import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import RadiusSlider from './RadiusSlider';

describe('RadiusSlider', () => {
  it('states the radius in words a screen reader can say', () => {
    render(<RadiusSlider value={1500} onChange={vi.fn()} />);
    expect(screen.getByRole('slider', { name: 'Promień' })).toHaveAttribute(
      'aria-valuetext',
      '1,5 km'
    );
  });

  it('moves in 500 m steps and reports the new radius', () => {
    const onChange = vi.fn();
    render(<RadiusSlider value={1000} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Promień' }), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith(1500);
  });

  it('stops at 500 m', () => {
    const onChange = vi.fn();
    render(<RadiusSlider value={5000} onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Promień' }), { key: 'Home' });

    expect(onChange).toHaveBeenLastCalledWith(500);
  });

  it('passes accessibility check', async () => {
    const { container } = render(<RadiusSlider value={1000} onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
