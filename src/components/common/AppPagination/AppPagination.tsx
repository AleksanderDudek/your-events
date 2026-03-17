'use client';

import Box from '@mui/material/Box';
import Pagination from '@mui/material/Pagination';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { PageSize } from '@/types/filter.types';
import { PAGE_SIZE_OPTIONS } from '@/lib/constants';
import { S } from '@/lib/strings';
import { totalPages } from '@/lib/utils';
import styles from './AppPagination.module.scss';

interface AppPaginationProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}

export default function AppPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: AppPaginationProps) {
  const muiTheme = useTheme();
  const isSmUp = useMediaQuery(muiTheme.breakpoints.up('sm'));
  const pages = totalPages(total, pageSize);

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    onPageChange(value);
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0 });
    }
  };

  if (pages <= 1 && total <= pageSize) return null;

  return (
    <Box className={styles.container}>
      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
        {S.RESULTS_PAGE(page, pages)}
      </Typography>

      <Pagination
        count={pages}
        page={page}
        onChange={handlePageChange}
        siblingCount={isSmUp ? 1 : 0}
        boundaryCount={isSmUp ? 1 : 0}
        shape="rounded"
        sx={{
          '& .MuiPaginationItem-root': {
            minWidth: 44,
            minHeight: 44,
          },
        }}
      />

      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel id="page-size-label" sx={{ fontSize: '0.8125rem' }}>
          {S.PAGE_SIZE_LABEL}
        </InputLabel>
        <Select
          labelId="page-size-label"
          value={pageSize}
          label={S.PAGE_SIZE_LABEL}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          sx={{ fontSize: '0.8125rem' }}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
