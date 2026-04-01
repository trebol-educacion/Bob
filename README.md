# PronunciaBien - AI English Pronunciation Coach (Next.js 16)

Este proyecto ha sido refactorizado a Next.js 16 para mejorar la seguridad y el rendimiento.

## 🚀 Tecnologías
- **Next.js 16 (App Router)**
- **React 19**
- **Tailwind CSS 4**
- **Gemini AI (Server Actions)**

## 🛠 Ejecución Local

1. Instala las dependencias con Bun:
   ```bash
   bun install
   ```
2. Configura tu `GEMINI_API_KEY` en un archivo `.env.local`:
   ```env
   GEMINI_API_KEY=tu_api_key_aqui
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   bun dev
   ```

## 🔒 Seguridad
Las llamadas a la API de Gemini se realizan mediante **Server Actions**, lo que garantiza que tu API Key nunca se exponga en el cliente.
