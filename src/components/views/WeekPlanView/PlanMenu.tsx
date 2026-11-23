'use client';

import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from '@/i18n';

interface PlanMenuProps {
  /** The plan's name as shown, for the button's label. */
  title: string;
  onRename: () => void;
  onDelete: () => void;
  className?: string;
}

/** ⋮ on a plan: rename, delete. */
export default function PlanMenu({ title, onRename, onDelete, className }: PlanMenuProps) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  return (
    // The class goes on a wrapper: MUI's own styles on the button (position:
    // relative) would win over a module class placing it.
    <span className={className}>
      <IconButton
        aria-label={t.WEEK_PLAN_OPTIONS(title)}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        <MenuItem
          onClick={() => {
            close();
            onRename();
          }}
        >
          <ListItemIcon>
            <DriveFileRenameOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t.WEEK_PLAN_RENAME}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            onDelete();
          }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t.WEEK_PLAN_DELETE}</ListItemText>
        </MenuItem>
      </Menu>
    </span>
  );
}
