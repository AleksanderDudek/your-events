'use client';

import { useState, useEffect, useCallback } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { S } from '@/lib/strings';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchInput({ value, onChange }: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  return (
    <TextField
      fullWidth
      size="small"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder={S.SEARCH_PLACEHOLDER}
      aria-label={S.SEARCH_LABEL}
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
              aria-label="Wyczyść wyszukiwanie"
              sx={{ color: 'var(--color-text-muted)' }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-body)',
          '&.Mui-focused fieldset': {
            borderColor: 'var(--color-accent-primary)',
          },
        },
      }}
    />
  );
}
