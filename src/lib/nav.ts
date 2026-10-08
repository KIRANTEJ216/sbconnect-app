/**
 * Shared active-route matching.
 *
 * Every nav surface previously used `pathname === to`, so opening a nested route
 * — `/requests/create`, `/requests/:id`, `/profile/:id`, `/attendance/scan` —
 * left *no* item highlighted, because none of those strings equal `/requests` or
 * `/attendance`. Prefix matching keeps the parent section lit while the user is
 * anywhere inside it.
 */
export function isRouteActive(pathname: string, to: string): boolean {
  if (pathname === to) return true;
  // `/` must not match everything.
  if (to === '/') return pathname === '/';
  return pathname.startsWith(`${to}/`);
}

