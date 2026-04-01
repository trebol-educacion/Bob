import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PronunciaBien - AI English Coach",
  description: "Mejora tu pronunciación en inglés con la ayuda de la IA de Gemini.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
