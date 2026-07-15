'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import CheckIcon from '@mui/icons-material/Check';
import PlaceIcon from '@mui/icons-material/Place';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useTranslation } from '@/i18n';
import { useCity } from '@/config/CityProvider';
import { CityId } from '@/config/cities';

export default function CitySwitcher() {
  const { city, setCity, availableCities, cities } = useCity();
  const { locale, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const router = useRouter();

  const pickFrom = availableCities.length > 0 ? availableCities : cities;

  const handleSelect = (id: CityId) => {
    setCity(id);
    setAnchorEl(null);
    router.push(`/${id}` as Route);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<PlaceIcon fontSize="small" />}
        endIcon={<ArrowDropDownIcon fontSize="small" />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label={t.CITY_LABEL}
        aria-haspopup="listbox"
        aria-expanded={open}
        sx={{
          ml: 1,
          color: 'var(--color-text-primary)',
          borderColor: 'var(--color-border)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          textTransform: 'none',
          padding: '2px 10px',
          minHeight: 32,
          '&:hover': {
            borderColor: 'var(--color-accent-primary)',
            backgroundColor: 'var(--color-accent-tint-soft)',
          },
        }}
      >
        {city.displayName[locale]}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{ list: { 'aria-label': t.CITY_LABEL, role: 'listbox' } }}
        PaperProps={{
          sx: {
            maxHeight: 360,
            minWidth: 200,
          },
        }}
      >
        {pickFrom.map((c) => {
          const selected = c.id === city.id;
          return (
            <MenuItem
              key={c.id}
              onClick={() => handleSelect(c.id as CityId)}
              selected={selected}
              role="option"
              aria-selected={selected}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {selected ? <CheckIcon fontSize="small" /> : null}
              </ListItemIcon>
              <ListItemText primary={c.displayName[locale]} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
