import type { Ref } from 'react';
import { Link, type LinkProps } from 'react-router';
import { withTrailingSlash } from '@/lib/href';

export interface AppLinkProps extends Omit<LinkProps, 'to'> {
  /** Site-relative path (the base path is added by the router) or an absolute URL. */
  href: string;
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * The app's internal link: React Router's <Link> — client-side navigation,
 * base-path aware — with the static host's URL policy applied (trailing slash,
 * see withTrailingSlash).
 *
 * It takes `href` rather than `to` so it drops into MUI's `component` prop
 * (`<Button component={AppLink} href=…>`), which forwards `href` to whatever it
 * renders.
 */
export default function AppLink({ href, ref, ...rest }: AppLinkProps) {
  return <Link ref={ref} to={withTrailingSlash(href)} {...rest} />;
}
