import { describe, it, expect } from 'vitest';
import {
  getVisibleProducts,
  isLauncherPath,
  resolveLauncherItems,
  ECOSYSTEM_PRODUCTS,
} from '@/lib/ecosystem/launcher-config';

describe('isLauncherPath', () => {
  it('la app de alumno en / es launcher path', () => {
    expect(isLauncherPath('/')).toBe(true);
  });

  it('login y celebrate quedan fuera', () => {
    expect(isLauncherPath('/login')).toBe(false);
    expect(isLauncherPath('/celebrate')).toBe(false);
  });
});

describe('getVisibleProducts', () => {
  it('alumno ve zoe, noobe y trebol, nunca bob', () => {
    const codes = getVisibleProducts('student', '/').map((p) => p.code);
    expect(codes).toEqual(['zoe', 'noobe', 'trebol']);
    expect(codes).not.toContain('bob');
  });

  it('rol desconocido o nulo no ve ningún producto', () => {
    expect(getVisibleProducts('unknown_role', '/')).toEqual([]);
    expect(getVisibleProducts(null, '/')).toEqual([]);
  });

  it('fuera de la ruta de la app no se excluye bob (no es el producto actual ahí)', () => {
    const codes = getVisibleProducts('student', '/login').map((p) => p.code);
    expect(codes).toEqual(['zoe', 'noobe', 'trebol']);
  });
});

describe('resolveLauncherItems', () => {
  it('usa la URL configurada en platform_config cuando existe', () => {
    const zoe = ECOSYSTEM_PRODUCTS.find((p) => p.code === 'zoe')!;
    const items = resolveLauncherItems([zoe], { ecosystem_url_zoe: 'https://zoe.custom.test' });
    expect(items).toEqual([
      { code: 'zoe', name: 'ZOE', url: 'https://zoe.custom.test', logo: null },
    ]);
  });

  it('cae al default cuando la clave no está configurada o está vacía', () => {
    const zoe = ECOSYSTEM_PRODUCTS.find((p) => p.code === 'zoe')!;
    expect(resolveLauncherItems([zoe], {})[0].url).toBe('https://zoe.noobe.es');
    expect(resolveLauncherItems([zoe], { ecosystem_url_zoe: '  ' })[0].url).toBe(
      'https://zoe.noobe.es',
    );
  });

  it('usa el logo de platform_config si existe, si no el fallback estático', () => {
    const trebol = ECOSYSTEM_PRODUCTS.find((p) => p.code === 'trebol')!;
    const items = resolveLauncherItems([trebol], {});
    expect(items[0].logo).toBe('/ecosystem/trebol-logo.png');

    const zoe = ECOSYSTEM_PRODUCTS.find((p) => p.code === 'zoe')!;
    const withLogo = resolveLauncherItems([zoe], { zoe_avatar_url: 'https://cdn.test/zoe.png' });
    expect(withLogo[0].logo).toBe('https://cdn.test/zoe.png');
  });
});
