export type EcosystemProductCode = 'mia' | 'zoe' | 'bob' | 'noobe' | 'trebol';

export interface EcosystemProductDef {
  code: EcosystemProductCode;
  name: string;
  urlKey: string;
  defaultUrl: string | null;
  logoKey: string | null;
  fallbackLogo: string | null;
}

export const NOOBE_ICON_URL =
  'https://res.cloudinary.com/noobe/image/upload/v1759490244/noobe/app/img/noobe-icon-enhanced.svg';

export const ECOSYSTEM_PRODUCTS: EcosystemProductDef[] = [
  {
    code: 'mia',
    name: 'MIA',
    urlKey: 'ecosystem_url_mia',
    defaultUrl: 'https://mia.noobe.es',
    logoKey: 'mia_avatar_url',
    fallbackLogo: null,
  },
  {
    code: 'zoe',
    name: 'ZOE',
    urlKey: 'ecosystem_url_zoe',
    defaultUrl: 'https://zoe.noobe.es',
    logoKey: 'zoe_avatar_url',
    fallbackLogo: null,
  },
  {
    code: 'bob',
    name: 'BOB',
    urlKey: 'ecosystem_url_bob',
    defaultUrl: 'https://bob.noobe.es',
    logoKey: null,
    fallbackLogo: '/ecosystem/bob-avatar.png',
  },
  {
    code: 'noobe',
    name: 'Noobe',
    urlKey: 'ecosystem_url_noobe',
    defaultUrl: 'https://app.noobe.es/login',
    logoKey: null,
    fallbackLogo: NOOBE_ICON_URL,
  },
  {
    code: 'trebol',
    name: 'FAQS',
    urlKey: 'ecosystem_url_trebol',
    defaultUrl: 'https://tu-consulta.noobe.es',
    logoKey: null,
    fallbackLogo: '/ecosystem/trebol-logo.png',
  },
];

export const ECOSYSTEM_URL_KEYS = ECOSYSTEM_PRODUCTS.map((p) => p.urlKey);

export const ECOSYSTEM_LOGO_KEYS = ECOSYSTEM_PRODUCTS.flatMap((p) =>
  p.logoKey ? [p.logoKey] : [],
);

const PRODUCTS_BY_ROLE: Record<string, EcosystemProductCode[]> = {
  student: ['zoe', 'noobe', 'trebol'],
  teacher: ['mia', 'zoe', 'noobe', 'trebol'],
  school_admin: ['mia', 'zoe', 'noobe', 'trebol'],
  super_admin: ['mia', 'zoe', 'noobe', 'trebol'],
};

export function getLauncherProducts(
  roleName: string | null | undefined,
): EcosystemProductDef[] {
  const codes = roleName ? PRODUCTS_BY_ROLE[roleName] : undefined;
  if (!codes) return [];
  return ECOSYSTEM_PRODUCTS.filter((p) => codes.includes(p.code));
}

const CURRENT_PRODUCT: EcosystemProductCode = 'bob';
const LAUNCHER_PATHS = new Set(['/']);

export function isLauncherPath(pathname: string): boolean {
  return LAUNCHER_PATHS.has(pathname);
}

export function getCurrentProduct(pathname: string): EcosystemProductCode | null {
  return isLauncherPath(pathname) ? CURRENT_PRODUCT : null;
}

export function getVisibleProducts(
  roleName: string | null | undefined,
  pathname: string,
): EcosystemProductDef[] {
  const current = getCurrentProduct(pathname);
  return getLauncherProducts(roleName).filter((p) => p.code !== current);
}

export interface LauncherItem {
  code: EcosystemProductCode;
  name: string;
  url: string;
  logo: string | null;
}

export function resolveLauncherItems(
  products: EcosystemProductDef[],
  config: Record<string, string | null | undefined>,
): LauncherItem[] {
  const items: LauncherItem[] = [];
  for (const product of products) {
    const configured = config[product.urlKey]?.trim();
    const url = configured || product.defaultUrl;
    if (!url) continue;

    const configuredLogo = product.logoKey ? config[product.logoKey]?.trim() : undefined;
    items.push({
      code: product.code,
      name: product.name,
      url,
      logo: configuredLogo || product.fallbackLogo,
    });
  }
  return items;
}
