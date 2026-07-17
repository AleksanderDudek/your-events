import { CATEGORY_ICON_PATHS } from './paths';
import { slugify } from '@/lib/utils';

interface CategoryIconProps {
  category: string;
  size?: number;
  className?: string;
}

// Inline category glyph (brief §5). stroke=currentColor so callers tint it with
// `color: var(--cat-<slug>)`. Unknown categories fall back to the Inne glyph.
export default function CategoryIcon({ category, size = 16, className }: CategoryIconProps) {
  const slug = slugify(category || 'inne');
  const glyph = CATEGORY_ICON_PATHS[slug] ?? CATEGORY_ICON_PATHS.inne;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {glyph}
    </svg>
  );
}
