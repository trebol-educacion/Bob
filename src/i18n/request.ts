import { getRequestConfig } from 'next-intl/server';

const NAMESPACES = [
  'common',
  'shell',
  'home',
  'yl',
  'cambridge',
  'toefl',
  'chat',
  'dashboard',
  'errors',
  'loading',
  'login',
  'mode_ui',
  'resultcard',
] as const;

async function loadMessages(locale: string) {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = await import(`../../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    })
  );
  return Object.fromEntries(entries);
}

export default getRequestConfig(async () => {
  const locale = 'en';
  return {
    locale,
    messages: await loadMessages(locale),
  };
});
