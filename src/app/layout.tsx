import type { Metadata } from "next";
import { Poppins, Nunito } from "next/font/google";
import "./globals.css";
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { BrandingProvider } from '@/components/BrandingProvider';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

const nunito = Nunito({
  weight: ['400', '500', '700', '800', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nunito',
});

export const metadata: Metadata = {
  title: "Bob",
  description: "Mejora tu pronunciación en inglés con la ayuda de la IA de Gemini.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${poppins.variable} ${nunito.variable} h-full`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('bob-brand');if(!s)return;var b=JSON.parse(s);var r=document.documentElement.style;if(b.primary){r.setProperty('--color-trebol-primary',b.primary);r.setProperty('--color-bob-brand',b.primary);}if(b.secondary)r.setProperty('--color-trebol-secondary',b.secondary);if(b.accent)r.setProperty('--color-trebol-accent',b.accent);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased h-full">
        <NextIntlClientProvider messages={messages}>
          <OrganizationProvider>
            <BrandingProvider>
              {children}
            </BrandingProvider>
          </OrganizationProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
