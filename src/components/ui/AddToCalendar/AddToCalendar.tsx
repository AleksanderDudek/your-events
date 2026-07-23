'use client';

import { useCallback, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import EventIcon from '@mui/icons-material/Event';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import { Event } from '@/types/event.types';
import { useTranslation } from '@/i18n';
import { slugify } from '@/lib/utils';
import { toCalendarEvent } from '@/lib/calendar/calendarEvent';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/calendar/links';
import { buildIcs, icsDataUri } from '@/lib/calendar/ics';

interface AddToCalendarProps {
  event: Event;
}

export default function AddToCalendar({ event }: Readonly<AddToCalendarProps>) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Every destination needs the same normalised entry, so build it once.
  // Guarded on event.date: an empty date cannot be turned into a UTC instant
  // (toCalendarEvent -> warsawToUtc throws on it), and the component renders
  // nothing in that case anyway — but hooks still have to run unconditionally,
  // so the guard lives inside the memo rather than around the hook call.
  const calendarEvent = useMemo(
    () => (event.date ? toCalendarEvent(event, t.CALENDAR_END_GUESS) : null),
    [event, t]
  );

  const destinations = useMemo(
    () =>
      calendarEvent
        ? {
            google: googleCalendarUrl(calendarEvent),
            outlook: outlookCalendarUrl(calendarEvent),
            ics: icsDataUri(buildIcs(calendarEvent)),
          }
        : null,
    [calendarEvent]
  );

  const fileName = `${slugify(event.name) || 'wydarzenie'}-${event.date}.ics`;
  const close = useCallback(() => setAnchorEl(null), []);

  // Without a date there is nothing to put in a calendar.
  if (!event.date || !destinations) return null;

  return (
    <>
      <Button
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<EventIcon />}
        endIcon={<ArrowDropDownIcon />}
        aria-haspopup="menu"
        aria-expanded={open}
        sx={{
          minHeight: 44,
          width: '100%',
          textTransform: 'none',
          color: 'var(--color-text-primary)',
          borderColor: 'var(--color-border)',
          '&:hover': {
            borderColor: 'var(--color-accent-primary)',
            backgroundColor: 'var(--color-accent-tint-soft)',
          },
        }}
      >
        {t.CALENDAR_ADD}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        slotProps={{ list: { 'aria-label': t.CALENDAR_ADD } }}
      >
        {/* Real links, not scripted window.open calls: middle-click and
            "copy link address" work, and screen readers announce them as links. */}
        <MenuItem
          component="a"
          href={destinations.google}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t.CALENDAR_GOOGLE} />
        </MenuItem>

        <MenuItem
          component="a"
          href={destinations.outlook}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t.CALENDAR_OUTLOOK} />
        </MenuItem>

        <MenuItem component="a" href={destinations.ics} download={fileName} onClick={close}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t.CALENDAR_ICS} />
        </MenuItem>
      </Menu>
    </>
  );
}
