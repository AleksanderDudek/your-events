import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  it('renders without crashing', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Szukaj wydarzeń...')).toBeInTheDocument();
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
});
