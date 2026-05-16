# CLAUDE.md

> Mapa maestro del proyecto para Claude Code. **Léelo entero antes de tocar
> nada.** Es corto a propósito: el detalle vive en los documentos enlazados,
> que se leen **bajo demanda** según la tarea.

---

## ⛔ Antes de escribir una sola línea de código

1. Lee `.sdd/bob-core/decisions.md` **completo**. Es la fuente de verdad del
   "por qué". No se recontradice sin una entrada nueva en su §9.
2. Lee la sección **"Reglas duras"** de este archivo (más abajo). Son
   invariantes. Una tarea que te pida violarlas está mal planteada: **para y
   avisa**, no la ejecutes.
3. Identifica en qué **fase** de `.sdd/bob-core/tasks.md` estás. No trabajes
   fuera de la fase activa. No adelantes fases.
4. Si algo del código contradice un documento `.sdd/bob-core/*`, **gana el
   documento**. El código actual contiene deuda conocida y específica
   (descrita en `exploration.md`).

---

## Qué es Bob

**Bob** (interno; también "PronunciaBien") es un **módulo dentro del
ecosistema MIA**, no un producto aislado. **Grupo Trébol** lo vende a
**colegios que ya tienen MIA**. Lo usan **niños y adolescentes reales (≈6-17)
solos** (sin profesor garantizado al lado) para **prepararse a exámenes
oficiales de inglés** (Cambridge YLE/A2/B1/B2, TOEFL iBT 2026).

Es **producto final** (MVP no-simple): completo, válido, usable, **sin
errores de infra ni de sistema**. Criterio de "suficiente": **infra bien
armada**; pocas actividades sólidas por nivel, el resto dice "Próximamente".
**Mejor poco y sólido que mucho y frágil.**

La desarrolladora es **una sola persona** y ejecuta los cambios **con Claude
Code**. Por eso cada tarea debe ser verificable sin fe ciega.

---

## Hechos estructurales que cambian cómo programas aquí

Estos hechos no son negociables y mucho código actual los contradice. Si los
ignoras, alucinas:

- **Los prompts pedagógicos "fuertes" viven en la BD (`bob_prompts`)**,
  gestionados desde el panel de MIA. Bob los **consume** vía
  `src/lib/prompts/db-prompts.ts`. Los archivos `src/lib/prompts/*.ts`
  (a2.ts, part3.ts, toefl_*.ts, etc.) son **fallback/legacy**, NO la fuente
  de verdad. **Nunca** hardcodees un prompt pedagógico nuevo en `.ts`.
- **`bob_prompts` tiene ~178 filas; el frontend solo expone ~5 de 27 tuplas**
  `(framework, exam_part, cefr_level)`. El catálogo de actividades debe
  derivarse de la BD, no de un `MODE_CATALOG` estático.
- **La edad/nivel del alumno la asigna el colegio** (config del tenant:
  framework + CEFR en `profiles`/`organizations`). Bob **no** la decide ni la
  pide al niño.
- **Despliegue: solo Vercel serverless.** No hay servidor persistente. El
  trabajo pesado síncrono en Server Actions = timeout en producción.
- **Supabase en región UE.** El histórico propio no es transferencia
  internacional; el riesgo de transferencia se concentra en Gemini/Google.

---

## El spec maestro: `bob-core`

Hay **un único hilo de verdad**: `.sdd/bob-core/`.

- `bob-core` **absorbe** `.sdd/bob-dynamic-modes/` (catálogo dinámico desde
  `bob_prompts`; eliminar `MODE_CATALOG`; `PracticeMode → string`).
- `bob-core` **reconcilia** `.sdd/bob-a1-yl/` (su trabajo NO se tira: los
  prompts YL ya están en BD por la migración `20260514_bob_a1_yl.sql` y los
  componentes `src/components/practice/yl/` se conservan; solo se elimina la
  parte que metió YL en `MODE_CATALOG` hardcoded).
- **`bob-a1-yl` y `bob-dynamic-modes` están SUPERSEDED.** No los ejecutes por
  separado. No reactives sus tasks. Todo pasa por `bob-core`.

Orden de lectura de `.sdd/bob-core/` según lo que vayas a hacer:
1. `decisions.md` — siempre, primero. El "por qué" inmutable.
2. `exploration.md` — el diagnóstico (qué está mal y dónde, con archivos).
3. `spec.md` — los contratos de datos y el diseño objetivo.
4. `tasks.md` — los batches y tareas con `DoD`. **Aquí trabajas.**

---

## Reglas duras (invariantes — NUNCA las violes)

Si una tarea, un comentario o tu propia inferencia te llevan a violar una de
estas, **para y avisa a la desarrolladora**. No "interpretes" alrededor.

1. **Prompts pedagógicos en `bob_prompts` (BD).** Nunca hardcodear uno nuevo
   en `.ts`. Los `.ts` existentes son fallback.
2. **Speaking abierto → feedback formativo cualitativo, NUNCA nota tipo
   examen** (ni 0-100 ni 0-5). Aplica a A2 Part1, B1 Collaborative, TOEFL
   Interview, B2. (Decisión D-D2.)
3. **LLM y TTS NUNCA en el camino crítico.** El usuario nunca espera mirando
   una pantalla mientras se llama a Gemini/TTS. Pre-generar o diferir.
   (D-A1.)
4. **Nunca un `throw` que deje al niño ante una pantalla rota.** Siempre
   fallback servible o mensaje claro con reintento. (D-A4.)
5. **Datos del menor solo para la función educativa.** Prohibido todo reuso
   (mejora de modelo, analítica propia, etc.). (D-C2.)
6. **Voz/imagen del niño solo si el interruptor del tenant está activo;
   cifrada y borrable.** El histórico de texto/nota funciona siempre; la
   persistencia de voz/imagen es opcional y controlada por configuración.
   (D-C3.)
7. **RLS Supabase intacto** (`auth.uid() = user_id` en toda policy). No
   introducir rutas que lo salten. (D-C5.)
8. **No reescritura masiva.** Cada batch deja el producto compilando y
   funcionando. Nada de "lo dejo a medias y sigo".
9. **`bob-core` es el único spec maestro.** No toques `bob-a1-yl` ni
   `bob-dynamic-modes`. (D-R1.)
10. **Edad/nivel viene del tenant.** No la inventes, no la pidas al niño, no
    la hardcodees en el componente.
11. **El histórico se persiste de verdad** (`saveMessageAction` en los
    momentos correctos), no solo en `useState`. (D-A6 — es el bug
    "desaparece el contenido".)
12. **Material pedagógico curado vive en `Referencias/`.** Se seedea a BD,
    NO se regenera con LLM si existe versión oficial. Aplicable a Cambridge
    (specs `.docx`, vocabulary list, sample tests) y TOEFL (audios `.ogg`
    pre-generados, Practice Test 1 con keys, rúbricas PDF oficiales).

---

## Stack y comandos

- **Next.js 16** (App Router, Turbopack, React 19), **TypeScript strict**
  (`tsconfig.json` → `"strict": true`), **Tailwind 4** (CSS-first, sin
  `tailwind.config.js`), **Motion**, **@google/genai**, **Supabase**
  (`@supabase/ssr`), **Bun**.

```bash
bun install
bun dev            # desarrollo
bun run build      # build producción
bun run lint       # next lint
bunx tsc --noEmit  # type-check (DoD frecuente: 0 errores)
```

- Deploy: Vercel (`vercel.json`, `bun run build`).
- Env: `.env.local` con `GEMINI_API_KEY` (+ vars Supabase
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Hay **Playwright MCP** disponible (`.playwright-mcp/`) → úsalo para DoD de
  validación de UI cuando una tarea lo pida.
- Hay **Supabase MCP** (usado en `bob-a1-yl` para migraciones/inspección de
  esquema). Úsalo para inspección de esquema y migraciones, no adivines
  columnas.

---

## Mapa rápido del código (orientación, no exhaustivo)

- `src/app/page.tsx` — state machine raíz, routing por estado (deuda: gran
  `if (mode === ...)`; `bob-core` lo sustituye por mapa estático).
- `src/actions/` — Server Actions. `modes/` = acciones por modo. `gemini.ts`
  = núcleo Gemini. `sessions.ts`/`messages.ts` = persistencia.
- `src/lib/prompts/db-prompts.ts` — **lectura de prompts desde BD (la vía
  correcta)**. El resto de `prompts/*.ts` = fallback.
- `src/lib/types/practice.ts` — `PracticeMode` + `MODE_CATALOG` (deuda:
  `bob-core` elimina `MODE_CATALOG`, `PracticeMode → string`).
- `src/components/practice/yl/` — componentes Young Learners (se conservan).
- `src/components/{A2Part1,B1Collaborative,ToeflInterview,ToeflListenRepeat}Practice.tsx`
  — componentes de examen (deuda: gigantes, duplicados, **no persisten
  histórico**, TTS/LLM en camino crítico).
- `src/contexts/OrganizationContext.tsx` — multi-tenant; lugar natural para
  el query único a `bob_prompts` (ver `bob-core/exploration.md`).
- `supabase/migrations/` — esquema. `bob_sessions`, `bob_messages`,
  `bob_prompts`, migración YL `20260514`.

---

## Cobertura real vs oficial

Bob HOY tiene **solo Speaking** en BD (`bob_prompts`, ~47 tuplas con
`activity_type='generation'`). Los exámenes oficiales (Cambridge A2/B1/B2,
TOEFL 2026) tienen 4 skills: **Reading, Listening, Writing, Speaking**.

Estado actual por skill (validado 2026-05-16):

| Framework | Speaking BD | Reading BD | Listening BD | Writing BD |
|-----------|-------------|-----------|--------------|------------|
| Cambridge A2 KET | parts 1-2 | falta | falta | falta |
| Cambridge B1 PET | parts 1-4 | falta | falta | falta |
| Cambridge B2 FCE | parts 1-4 | falta | falta | falta |
| TOEFL iBT 2026 | listen_repeat + interview | falta | falta | falta |

Reading/Listening/Writing se seedean desde `Referencias/` en **Batch 10**
de `bob-core/tasks.md` (D9-1). No se inventan; se trasladan desde specs y
materiales oficiales.

**Activos físicos ya presentes en `Referencias/`:**
- `TOELF/Listening/**.ogg` — 16 audios oficiales (Academic Talks,
  Announcements, Conversations, Question Response)
- `TOELF/Speaking/**` — 8 audios + 4 vídeos Interview Q1-4
- `TOELF/toefl-full-length-practice-test1.pdf` — test completo con answer
  keys
- `TOELF/speaking-rubrics.pdf`, `writing-rubrics.pdf` — rúbricas oficiales
- `CAMBRIDGE B1 PARA MIA.docx` y `CAMBRIDGE B2 PARA MIA.docx` — specs
  completas con ejemplos de generación
- `A2/A2 Vocabulary list.pdf` — vocabulario oficial UCLES por temas
- `A2/A2 Key sample tests Speaking.pdf` + `assessing-speaking-performance.pdf`
  — tests reales + rúbrica
- `investigacion_bloque_A..D.md` — 4 bloques de research que sustentan
  todas las decisiones D-* y D9-*

---

## Cómo trabajar una tarea (protocolo anti-alucinación)

1. Abre `.sdd/bob-core/tasks.md`. Localiza la **única** tarea activa.
2. Lee su `files:` (qué tocar) y su `DoD:` (cómo se sabe que está bien).
3. **No toques archivos fuera de `files:`** salvo que sea imposible cumplir
   el DoD sin ello; si pasa, **para y avisa** antes de expandir el alcance.
4. Implementa lo mínimo para cumplir el DoD. Nada de mejoras no pedidas.
5. Verifica el DoD de forma objetiva (compila / test / Playwright / query).
6. Registra el avance donde indique `tasks.md` (Engram + apply-progress).
7. Marca `[x]` solo si el DoD se cumple de verdad. Si no, déjala `[ ]` y
   explica el bloqueo. **No marques tareas a medias.**
8. Una tarea a la vez. No encadenes. La desarrolladora valida entre tareas.

Si en cualquier punto dos fuentes se contradicen: **decisions.md > spec.md >
exploration.md > código actual > tu inferencia.**

---

## Lo que este proyecto NO es (para que no te disperses)

- No es un chatbot de inglés general. Es **preparación de examen oficial**.
- No es un sitio para "mejorar el modelo con datos de uso". Prohibido (D-C2).
- No es un MVP de hackathon: errores de infra/sistema = inaceptables.
- No es donde se decide la política legal. Eso es de Grupo Trébol; aquí solo
  se construye **conforme** a lo decidido en `decisions.md` §3 y §8.