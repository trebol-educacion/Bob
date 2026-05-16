import type { Metadata } from "next";
import { Poppins, Nunito } from "next/font/google";
import "./globals.css";
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { BrandingProvider } from '@/components/BrandingProvider';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${poppins.variable} ${nunito.variable} h-full`}>
      <body className="font-sans antialiased h-full">
        <OrganizationProvider>
          <BrandingProvider>
            {children}
          </BrandingProvider>
        </OrganizationProvider>
      </body>
    </html>
  );
}
