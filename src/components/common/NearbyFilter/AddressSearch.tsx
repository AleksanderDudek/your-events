'use client';

import { useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from '@/i18n';
import { useAddressSearch } from '@/components/service/useAddressSearch';
import type { AddressSuggestion } from '@/components/service/geocoding';

interface AddressSearchProps {
  onSelect: (suggestion: AddressSuggestion) => void;
}

export default function AddressSearch({ onSelect }: Readonly<AddressSearchProps>) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const { suggestions, isSearching, isError, tooShort } = useAddressSearch(input);

  let noOptionsText = t.NEAR_ADDRESS_NO_RESULTS;
  if (tooShort) noOptionsText = t.NEAR_ADDRESS_MIN_CHARS;
  else if (isError) noOptionsText = t.NEAR_ADDRESS_ERROR;

  return (
    <Box>
      <Autocomplete<AddressSuggestion>
        options={suggestions}
        value={null}
        inputValue={input}
        onInputChange={(_, next, reason) => {
          // 'reset' is the component writing the chosen option back into the
          // box; the box is emptied on selection instead.
          if (reason !== 'reset') setInput(next);
        }}
        onChange={(_, suggestion) => {
          if (!suggestion) return;
          onSelect(suggestion);
          setInput('');
        }}
        // Photon has matched already; filtering its answers again by the typed
        // text would hide "Świdnicka 12" from whoever typed "swidnicka 12".
        filterOptions={(options) => options}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        loading={isSearching}
        loadingText={t.NEAR_ADDRESS_LOADING}
        noOptionsText={noOptionsText}
        autoHighlight
        blurOnSelect
        size="small"
        renderOption={(props, option) => {
          const { key, ...rest } = props;
          return (
            <li key={key} {...rest}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2">{option.label}</Typography>
                {option.detail && (
                  <Typography variant="caption" sx={{ color: 'var(--color-text-muted)' }}>
                    {option.detail}
                  </Typography>
                )}
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField {...params} label={t.NEAR_ADDRESS_LABEL} placeholder={t.NEAR_ADDRESS_PLACEHOLDER} />
        )}
      />
      {/* Photon's data is OpenStreetMap's, under the ODbL, which asks for
          credit wherever it is shown. */}
      <Typography
        variant="caption"
        component="p"
        sx={{ mt: 0.5, color: 'var(--color-text-muted)', fontSize: '0.6875rem' }}
      >
        {t.NEAR_ADDRESS_CREDIT}
      </Typography>
    </Box>
  );
}
