'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useTranslation } from '@/i18n';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchInput({ value, onChange }: SearchInputProps) {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(value);

  // The panel passes an inline arrow, so `onChange` has a new identity on every
  // parent render. Keeping it in a ref means the debounce below restarts only
  // when the user types — not every time a refetch re-renders the tree, which
  // could postpone a 1.5s search indefinitely.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // True only while the box holds typed text that hasn't reached the URL yet.
  const [typing, setTyping] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);

  // Adjust state while rendering (the sanctioned alternative to a sync effect):
  // an incoming `value` always wins and cancels a pending debounce, so clearing
  // the filters can't be undone 1.5s later by a term the user had half-typed.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setLocalValue(value);
    setTyping(false);
  }

  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => {
      setTyping(false);
      onChangeRef.current(localValue);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typing, localValue]);

  const handleType = useCallback((next: string) => {
    setTyping(true);
    setLocalValue(next);
  }, []);

  const handleClear = useCallback(() => {
    setTyping(false);
    setLocalValue('');
    onChangeRef.current('');
  }, []);

  return (
    <TextField
      fullWidth
      size="small"
      value={localValue}
      onChange={(e) => handleType(e.target.value)}
      placeholder={t.SEARCH_PLACEHOLDER}
      aria-label={t.SEARCH_LABEL}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: 'var(--color-text-muted)' }} />
          </InputAdornment>
        ),
        endAdornment: localValue ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={handleClear}
              aria-label={t.SEARCH_CLEAR}
              sx={{ color: 'var(--color-text-muted)' }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-body)',
          minHeight: 44,
        },
      }}
    />
  );
}
