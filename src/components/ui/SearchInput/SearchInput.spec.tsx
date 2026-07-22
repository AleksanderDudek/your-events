import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, afterEach } from 'vitest';
import SearchInput from './SearchInput';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

const PLACEHOLDER = 'Szukaj wydarzenia lub miejsca...';

describe('SearchInput', () => {
  it('renders without crashing', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Szukaj wydarzenia lub miejsca...')).toBeInTheDocument();
  });

  it('passes accessibility check', async () => {
    const { container } = render(<SearchInput value="" onChange={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows clear button when value exists', () => {
    render(<SearchInput value="hip hop" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Wyczyść wyszukiwanie')).toBeInTheDocument();
  });

  it('calls onChange with empty string on clear', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="hip hop" onChange={onChange} />);
    await user.click(screen.getByLabelText('Wyczyść wyszukiwanie'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  describe('debounce', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    // The panel passes an inline arrow, so onChange changes identity on every
    // parent render. When the debounce depended on that identity, a tree that
    // re-rendered faster than the delay never fired the search at all.
    it('is not restarted by a re-render that only changes the onChange identity', () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      const { rerender } = render(<SearchInput value="" onChange={onChange} />);

      fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
        target: { value: 'jazz' },
      });
      act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 100));
      rerender(<SearchInput value="" onChange={(v) => onChange(v)} />);
      act(() => void vi.advanceTimersByTime(200));

      expect(onChange).toHaveBeenCalledWith('jazz');
    });

    // "Clear filters" resets the value prop; a debounce still in flight must not
    // put the half-typed term back into the URL a second later.
    it('cancels a pending debounce when the value is reset from outside', () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      const { rerender } = render(<SearchInput value="jazz" onChange={onChange} />);

      fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), {
        target: { value: 'jazzz' },
      });
      rerender(<SearchInput value="" onChange={onChange} />);
      act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2));

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('');
    });
  });
});
