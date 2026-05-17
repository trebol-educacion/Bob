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
