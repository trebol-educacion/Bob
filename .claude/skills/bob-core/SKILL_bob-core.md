---
name: bob-core
description: >
  Hilo maestro para trabajar en Bob FUERA del dominio Young Learners:
  motor único de actividades (catálogo dinámico desde bob_prompts),
  robustez de producto (persistencia real, LLM/TTS fuera del camino
  crítico, fallback, observabilidad), comprensión cerrada y feedback
  honesto. Reconcilia y SUPERSEDE los specs bob-a1-yl y bob-dynamic-modes.
  Trigger: cuando la usuaria pide tocar catálogo de modos, persistencia
  de actividades de examen (A2/B1/B2/TOEFL no-YL), latencia, evaluación,
  o cualquier cambio estructural de Bob que no sea una actividad YL nueva
  (para YL usar bob-yl-activity).
license: MIT
metadata:
  project: bob
  version: "1.0"
  supersedes: [bob-a1-yl, bob-dynamic-modes]
  artifact_store: filesystem  # engram MCP desconectado — NO usar mem_update
---

## Cuándo aplicar este skill

Aplica cuando la usuaria pida:
- Tocar el catálogo de modos / cards / `MODE_CATALOG` / routing por modo.
- Arreglar persistencia o histórico en actividades de examen NO-YL
  (`A2Part1Practice`, `B1CollaborativePractice`, `ToeflListenRepeatPractice`,
  `ToeflInterviewPractice`).
- Latencia / "tarda en aparecer la actividad" / TTS lento.
- Evaluación, nota, feedback (incluida la conversión a feedback formativo
  sin nota tipo examen).
- Comprensión cerrada (Listening/Reading tipo test).
- Cualquier cambio estructural de Bob.

**NO aplica** (usar `bob-yl-activity` en su lugar) cuando: se construye o
ajusta una actividad **Young Learners** (Starters/Movers/Flyers Parts).
Si dudas entre las dos: YL → `bob-yl-activity`; todo lo demás → `bob-core`.

## Regla cero: leer antes de tocar

Antes de escribir una sola línea de código, en este orden:

1. `.sdd/bob-core/decisions.md` — fuente de verdad del "por qué". No se
   recontradice sin entrada nueva en su §9.
2. `.sdd/bob-core/exploration.md` — diagnóstico (8 deudas con ubicación).
3. `.sdd/bob-core/spec.md` — contratos + 10 objetivos verificables.
4. `.sdd/bob-core/tasks.md` — batches. **Aquí se trabaja.**
5. Los 4 documentos de research (`investigacion_bloque_A..D.md`) son
   **contexto**, no plan. Se consultan para entender una decisión, no para
   ejecutar.

Si el código actual contradice estos documentos: **gana el documento**
(jerarquía: decisions > spec > exploration > código > inferencia).

## Modo de persistencia (CRÍTICO — no fallar aquí)

**Artifact store = filesystem. Engram MCP está DESCONECTADO.**

- NO usar `mem_update`, `mem_search`, `mem_get_observation`. Fallarán.
- Los artefactos `.sdd` son **ficheros en disco**: `.sdd/bob-core/*.md`.
- Marcar tareas completas editando `tasks.md` en disco: `- [ ]` → `- [x]`.
- El progreso acumulado se escribe/edita en
  `.sdd/bob-core/apply-progress.md` (crear si no existe; MERGE, nunca
  sobrescribir perdiendo batches previos — ver protocolo de `sdd-apply`).
- Si en algún momento Engram se reconecta, seguir igualmente filesystem
  para este change salvo que la usuaria diga lo contrario.

## Reconciliación con el ecosistema (reusar, no reinventar)

`bob-core` **orquesta** skills que ya existen. No las dupliques:

| Necesidad | Skill a invocar | NO hacer |
|---|---|---|
| Actividad YL nueva/ajuste | `bob-yl-activity` | No reimplementar YL aquí |
| Flujo spec→tasks→apply | `sdd-spec`, `sdd-tasks`, `sdd-apply`, `sdd-verify` | No inventar pipeline propio |
| DoD de UI / E2E | `webapp-testing` | No escribir un runner ad-hoc |
| Crear una skill nueva | `skill-creator` | No improvisar formato |
| Contexto MIA/noobe | `mia`, `noobe-*` | No duplicar conocimiento de ecosistema |

### Patrones YA validados en `bob-yl-activity` que `bob-core` ADOPTA tal cual

Estos están resueltos en producción. `bob-core` los **reutiliza**, no los
rediseña (mi spec/tasks los daba como "a decidir" — ya están decididos):

1. **Imágenes → Supabase Storage (`bob-images`), NUNCA base64 en returns
   de server actions.** Next 16 → `Maximum array nesting exceeded`. Una
   imagen por call en `for`, no batch.
2. **TTS cacheado en `bob_messages`** (`msg_type='yl_tts'` o equivalente)
   por `(sessionId, text)` vía patrón `getOrCreateCueAudioAction`. Esto
   ES el "LLM/TTS fuera del camino crítico" del spec — generalizar este
   patrón existente, no crear uno nuevo.
3. **`initStartedRef`** contra doble-init en React Strict Mode.
4. **Reapertura desde sidebar reconstruyendo desde `bob_messages`**, sin
   regenerar (no llamar a la action de start si hay `initialSessionId`).
5. **RLS con `TO authenticated`** (no `{-}`). Verificar con la query de
   `pg_policy` antes de dar por buena una tabla nueva.
6. **`StudentStatsPanel`** agrega `evaluation/is_final=true`; cualquier
   modo que persista así aparece en "Mi progreso" automáticamente.
7. **`ChatShell + MessageBubble + InfoCard` es el shell visual obligatorio.**
   Rama `feature/styles` ya migró: YL (Part1-4, Pointing), `ConversationPractice`,
   `BobPracticeChat`. Pendientes de migrar (Batch 12 de `bob-core/tasks.md`):
   `A2Part1Practice`, `B1CollaborativePractice`, `ToeflListenRepeatPractice`,
   `ToeflInterviewPractice`. Cualquier modo nuevo arranca con ChatShell. (D9-10.)

Si una tarea de `bob-core/tasks.md` parece pedir reinventar uno de estos,
**está mal planteada**: parar, avisar, y reusar el patrón de
`bob-yl-activity`.

## Reglas duras (invariantes — NUNCA violar)

De `decisions.md` §6 + convenciones del proyecto:

1. Prompts pedagógicos en `bob_prompts` (BD). Nunca hardcodear uno nuevo.
2. Speaking abierto → feedback formativo cualitativo, **NUNCA nota tipo
   examen** (ni 0-100 ni 0-5). Excepción acotada: Listen & Repeat puede
   indicar exactitud objetivable (palabras faltantes), conservando las
   reglas anti-inflado que el prompt de BD ya tiene.
3. LLM/TTS nunca en el camino crítico (pre-generar/cachear — patrón YL).
4. Nunca `throw` que deje pantalla rota al niño; siempre fallback.
5. Datos del menor solo para función educativa. Cero reuso.
6. Voz/imagen del niño solo tras interruptor de tenant, cifrada, borrable.
7. RLS Supabase intacto (`auth.uid()=user_id`, `TO authenticated`).
8. No reescritura masiva. Cada batch deja el producto compilando.
9. `bob-core` es el único spec maestro. NO reactivar `bob-a1-yl` ni
   `bob-dynamic-modes` por separado. Su trabajo YL se conserva.
10. Edad/nivel viene del tenant (config colegio), no se decide en Bob.
11. El histórico se persiste de verdad (`saveMessageAction` en los
    momentos correctos), no solo en `useState`.
12. **Material pedagógico curado vive en `Referencias/`.** Se seedea a BD,
    no se regenera con LLM si existe versión oficial. (D9-1.)

### Convenciones del proyecto (de `bob-yl-activity`, aplican igual)

- **`bun run build` está PROHIBIDO.** Validar TypeScript SOLO con
  `bunx tsc --noEmit`.
- Commits: conventional, en español, **sin atribución AI, sin co-author**
  (`feat(core): ...`, `fix(core): ...`, `refactor(core): ...`).
- UI del alumno en **inglés**, sin Spanglish (el contenido es inglés → la
  UI también). Excepción: framing/instrucciones de bienvenida pueden ir
  en español como ya hace YL (`framing`).

## Cómo trabajar un batch (protocolo)

1. Abrir `.sdd/bob-core/tasks.md`. Localizar el **único** batch/tarea
   activa. No adelantar batches. Batch 0 y 1 BLOQUEAN al resto.
2. Leer `files:` (qué tocar) y `DoD:` (cómo se verifica).
3. Implementar lo mínimo para cumplir el DoD. Sin mejoras no pedidas.
   No tocar archivos fuera de `files:` sin parar y avisar.
4. Verificar el DoD con su método objetivo (grep / `bunx tsc --noEmit` /
   `webapp-testing` Playwright / query Supabase / cronómetro).
5. Marcar `[x]` en `tasks.md` (disco) SOLO si el DoD se cumple de verdad.
   Si no, dejar `[ ]` + nota del bloqueo y **parar**.
6. Editar `.sdd/bob-core/apply-progress.md` (MERGE acumulativo: todas las
   tareas previas + las nuevas; nunca perder batches anteriores).
7. Una tarea a la vez. La usuaria valida entre tareas y sube a git.

Si dos fuentes se contradicen: **decisions > spec > exploration > código
actual > tu inferencia.** Si una tarea pide violar una regla dura: parar
y avisar, no "interpretar alrededor".

## Errores que NO debes cometer (específicos de bob-core)

1. ❌ Usar `mem_update`/Engram → está desconectado, falla. Filesystem.
2. ❌ `bun run build` → prohibido. Solo `bunx tsc --noEmit`.
3. ❌ Reinventar caché de TTS/imágenes → ya existe en `bob-yl-activity`
   (Storage + `bob_messages` cache). Generalizar ese patrón.
4. ❌ Destruir trabajo YL al "reconciliar" → solo se revierte la
   extensión de `MODE_CATALOG` con literales YL; componentes Y, prompts
   en BD y migración `20260514` se CONSERVAN.
5. ❌ Reactivar `bob-a1-yl`/`bob-dynamic-modes` como changes vivos →
   están superseded. Marcarlos, no ejecutarlos.
6. ❌ Poner nota tipo examen en speaking abierto → feedback formativo.
7. ❌ Adelantar batches → Batch 0 (hilo único) y Batch 1 (inspección)
   bloquean todo. Nada se asume antes de inspeccionar la BD real.
8. ❌ Marcar `[x]` sin verificar el DoD con su método objetivo.
9. ❌ Escribir spec/tasks "a mano" nuevos → usar `sdd-spec`/`sdd-tasks`
   sobre el research si hay que regenerarlos; los `.md` actuales son el
   borrador de referencia.
10. ❌ Tratar los 4 bloques de investigación como tareas → son contexto
    del "por qué", no ejecutables.
11. ❌ Enviar audio crudo del menor a Gemini sin pasar por el wrapper
    minimizador (Batch 6, T6.6). El wrapper respeta el flag
    `organizations.allow_voice_storage` y por default NO persiste el audio.
    Mandar audio sin minimización viola D-C2, D-C3, D9-7.

## Relación con el pipeline `.sdd`

`bob-core` ya tiene sus artefactos escritos a mano (fruto de una sesión
de investigación profunda): `decisions.md`, `exploration.md`, `spec.md`,
`tasks.md` + 4 bloques de research. Son válidos como **borrador de alta
calidad**.

- Si la usuaria quiere ejecutar directo: `sdd-apply` sobre
  `.sdd/bob-core/tasks.md`, modo filesystem, Batch 0 primero.
- Si la usuaria quiere que el pipeline los regenere en formato canónico:
  alimentar `sdd-explore`/`sdd-spec`/`sdd-tasks` con los 4 bloques +
  `decisions.md` como input de research. NO descartar el research: es el
  activo más valioso de la sesión que lo originó.

El research (bloques A-D) responde a: infra con LLM de fondo, UX
niño/adolescente y latencia, legalidad de datos de menores (AEPD/RGPD),
y qué actividades habilitar. Cualquier decisión estructural de Bob debe
ser coherente con esos cuatro documentos.

## Definición de "bob-core hecho"

Terminado SOLO cuando `tasks.md` Batch 9 (T9.1) muestra los **10
objetivos verificables de `spec.md §1` en PASS**, comprobados con métodos
objetivos (grep / tsc / Playwright / query / cronómetro), no con la
palabra del agente. Hasta entonces sigue en progreso por mucho `[x]`
que haya.

## Material oficial en `Referencias/` (índice rápido)

Para CUALQUIER duda de contenido pedagógico (qué evalúa Part 3 de PET, qué
rúbrica usa TOEFL Listen and Repeat, qué vocabulario es A2), la fuente de
verdad está en `Referencias/`, no en LLM ni en suposiciones.

| Archivo | Para qué sirve |
|---------|----------------|
| `investigacion_bloque_A.md` | Diagnóstico de infra LLM/histórico (Bloque A). Sustenta D-A1..D-A6. |
| `investigacion_bloque_B.md` | UX niños/adolescentes + latencia + feedback por edad. Sustenta D-B1..D-B4. |
| `investigacion_bloque_C.md` | Legal AEPD/RGPD menores. Sustenta D-C1..D-C6, D9-7. |
| `investigacion_bloque_D.md` | Qué actividades habilitar con los 3 filtros. Sustenta D-D1..D-D5, D9-1, D9-4. |
| `A2/A2 Speaking.docx` | A2 Key Speaking Parts 1-2 + framework de evaluación |
| `A2/A2 Vocabulary list.pdf` | Vocabulario oficial UCLES A2 por temas |
| `A2/A2 Key sample tests Speaking.pdf` | Tests reales con scripts del examinador |
| `A2/A2-key-for-schools-speaking-assessing-speaking-performance.pdf` | Rúbrica oficial A2 (Grammar/Vocabulary, Pronunciation, Interactive Comm., bandas 0-5) |
| `CAMBRIDGE B1 PARA MIA.docx` | Spec completa PET: Listening 1-4, Reading 1-6, Writing 1-2, Speaking 1-4 con ejemplos generados por Gemini |
| `CAMBRIDGE B2 PARA MIA.docx` | Spec completa FCE: Listening 1-4, Reading & UoE 1-7, Writing 1-2 |
| `FEEDBACK B1_.docx` | Bugs reportados por profes (95 sin grabar, repetir frase, imágenes sin personas, Speaking Part 3 PET faltante) |
| `TOELF/TOEFL IBT 2026.docx` | Estructura Reading/Listening/Writing/Speaking 2026 |
| `TOELF/TOEFL IBT Speaking.docx` | Listen and Repeat + Take an Interview (formato 2026) |
| `TOELF/speaking-rubrics.pdf` | Rúbrica oficial TOEFL Speaking (Listen and Repeat 0-5, Take an Interview 0-5) |
| `TOELF/writing-rubrics.pdf` | Rúbrica oficial TOEFL Writing (Email 0-5, Academic Discussion 0-5) |
| `TOELF/toefl-ibt-test-overview.pdf` | Overview oficial 2026 + mapeo CEFR (A1-C2 ↔ bandas 1-6) + sample tasks |
| `TOELF/toefl-full-length-practice-test1.pdf` | Test completo con answer keys (insumo para `bob_closed_items`) |
| `TOELF/Listening/**.ogg` | 16 audios oficiales pre-generados (Academic Talks, Announcements, Conversations, Question Response) |
| `TOELF/Speaking/Interview/*.mp4` + `*.ogg` | 4 vídeos + audios de entrevista oficial |
| `files/bob_avatar.png`, `bob_logo.png`, `footer_login.png` | Branding |

**Reglas duras al usar este material:**
- Las rúbricas oficiales son 0-5 numéricas. Para SPEAKING ABIERTO y WRITING
  ABIERTO Bob da feedback formativo, NUNCA replica esa escala como nota
  visible al alumno (D-D2, D9-11).
- Para COMPRENSIÓN CERRADA (Listening/Reading multiple-choice) la nota se
  calcula contra la clave correcta, no la juzga LLM (D-D1).
- Los assets pre-generados se suben a Supabase Storage en migración
  (Batch 8 T8.7, Batch 10 T10.5).
