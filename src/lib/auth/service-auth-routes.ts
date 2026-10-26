export const SERVICE_AUTH_ROUTES = ['/api/challenge/pregenerate', '/api/b2/pregenerate'] as const;

/**
 * @param pathname string
 * @returns boolean
 */
export function isServiceAuthRoute(pathname: string): boolean {
  return SERVICE_AUTH_ROUTES.some((route) => pathname.startsWith(route));
}
