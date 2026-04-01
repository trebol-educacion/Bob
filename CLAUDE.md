# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

**Bob** (nombre interno) / **PronunciaBien** — Coach de pronunciación en inglés con IA. Permite al usuario practicar inglés mediante tres modos: frases por situación, descripción de imágenes generadas por IA, y conversación interactiva. Toda la evaluación y generación de contenido se hace con Gemini.

## Comandos

```bash
bun install          # Instalar dependencias
bun dev              # Servidor de desarrollo (Next.js 16 + Turbopack)
bun run build        # Build de producción
bun run lint         # Lint (next lint)
```

Deploy en Vercel con `bun` como runtime (`vercel.json`).

## Variables de entorno

Archivo `.env.local`:
```
GEMINI_API_KEY=<key>
```

## Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **Tailwind CSS 4** (CSS-first, sin tailwind.config.js)
- **Motion** (framer-motion) para animaciones
- **@google/genai** SDK para Gemini
- **Bun** como package manager y runtime

## Arquitectura

Aplicación single-page con estado manejado en `src/app/page.tsx` mediante un state machine (`AppState`). No hay routing — toda la navegación es por estados del componente raíz.

### Server Actions (`src/actions/gemini.ts`)

Todas las llamadas a Gemini se hacen via Server Actions (`'use server'`). Este archivo contiene:

- `generateSpeechAction` — TTS con voz "aoede" (gemini-2.5-flash-preview-tts)
- `generateTopicPhrasesAction` — Genera 10 frases progresivas sobre un tema
- `generateImageAction` — Genera imagen con gemini-3.1-flash-image-preview
- `generateImageSceneAction` — Genera escena B1 Speaking (topic + description + image_prompt)
- `evaluatePronunciationAction` — Evalúa audio del usuario contra frase objetivo
- `evaluateImageDescriptionAction` — Evalúa descripción de imagen estilo Cambridge B1
- `chatConversationAction` — Turno de conversación con audio (evalúa + responde + genera TTS)
- `chatTextConversationAction` — Igual pero con texto en vez de audio
- `generateInitialChatAction` — Genera framing + primer mensaje de simulación
- `simulateConversationAction` — Completa conversación si el usuario termina antes
- `generateQuestionsAction` — Genera preguntas de comprensión sobre la conversación

Todas las respuestas de evaluación usan JSON estructurado (`responseMimeType: 'application/json'` + `responseSchema`).

### Utilidades

- `src/lib/audio.ts` — `blobToBase64` (grabación → base64) y `pcmToWavBase64` (PCM de Gemini → WAV reproducible)
- `src/lib/utils.ts` — `cn()` helper para clases Tailwind

### Flujo de audio

1. **Grabación**: `MediaRecorder` en el cliente captura audio del micrófono
2. **Envío**: Se convierte a base64 y se envía como `inlineData` al Server Action
3. **TTS**: Gemini devuelve audio PCM raw que se convierte a WAV con `pcmToWavBase64`

## Convenciones

- Prompts de Gemini escritos en español con instrucciones para responder en inglés
- Feedback estilo Duolingo: amigable y motivador
- Colores custom con prefijo `trebol-` (trebol-bg, trebol-primary, trebol-secondary, trebol-text, trebol-border)
- Componentes funcionales con TypeScript, sin strict mode
