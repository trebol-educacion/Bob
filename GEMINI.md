# PronunciaBien - AI English Pronunciation Coach

Este es un MVP de una aplicación web diseñada para ayudar a los usuarios a mejorar su pronunciación en inglés utilizando la inteligencia artificial de Gemini.

## 🚀 Project Overview

PronunciaBien es una aplicación interactiva que presenta frases en inglés al usuario, le permite grabar su voz y recibe feedback instantáneo generado por el modelo **Gemini 2.5 Flash**.

### Tecnologías Principales
- **Frontend:** React 19 + TypeScript + Vite 6
- **Estilos:** Tailwind CSS 4 (con el plugin @tailwindcss/vite)
- **Animaciones:** Motion (framer-motion)
- **Iconos:** Lucide React
- **IA:** Google Generative AI SDK (@google/genai) utilizando los modelos `gemini-2.5-flash` para evaluación y `gemini-2.0-flash` para generación de audio nativo.

### Arquitectura
- `src/components/`: Componentes modulares de la interfaz (Cards, Botones, Barra de Progreso).
- `src/services/gemini.ts`: Servicio que interactúa con el SDK de Gemini. Incluye `evaluatePronunciation` (JSON estructurado) y `generateSpeech` (salida multimodal de audio).
- `src/lib/`: Utilidades para manejo de audio y clases de CSS.
- `src/data/phrases.ts`: El conjunto de datos con las frases de práctica.

## 🛠 Building and Running

### Comandos Clave
- **Instalación:** `npm install`
- **Desarrollo:** `npm run dev` (Inicia Vite en el puerto 3000)
- **Producción (Build):** `npm run build`
- **Linting/Type-checking:** `npm run lint` (Ejecuta `tsc --noEmit`)
- **Limpieza:** `npm run clean` (Elimina la carpeta `dist`)

### Configuración del Entorno
Es necesario configurar un archivo `.env.local` basado en `.env.example` con la siguiente variable:
```env
GEMINI_API_KEY=tu_api_key_aqui
```

## 📝 Development Conventions

- **Componentes:** Se prefieren componentes funcionales con TypeScript.
- **Estilos:** Se utiliza Tailwind CSS directamente en las clases (utilitarios).
- **IA:** 
  - Evaluación: El prompt en `evaluatePronunciation` devuelve un JSON estructurado.
  - Voz: `generateSpeech` utiliza la capacidad nativa de Gemini 2.0+ para generar audio profesional con la voz "Aoide".
- **Manejo de Audio:** 
  - Generación: Se utiliza el objeto `Audio` de JavaScript para reproducir el stream de base64 recibido de Gemini.
  - Grabación: Se utiliza `MediaRecorder` con parámetros de alta fidelidad (128kbps, echoCancellation, noiseSuppression).

## 🧠 Instrucciones para Gemini CLI

Al trabajar en este proyecto:
1.  **Contexto de IA:** Ten en cuenta que el prompt principal está en `src/services/gemini.ts`. Cualquier cambio en los criterios de evaluación debe hacerse allí.
2.  **Estilos:** Estamos usando Tailwind CSS 4. Evita configuraciones complejas de `tailwind.config.js` si pueden resolverse mediante el nuevo sistema de CSS-first.
3.  **Tipado:** Mantén la integridad de los tipos en `EvaluationResult` y las props de los componentes.
4.  **Feedback:** El feedback generado por la IA debe mantenerse amigable y motivador, similar al estilo de Duolingo.
