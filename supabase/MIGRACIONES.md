# ⛔ Aquí NO van migraciones

Las migraciones de este proyecto viven en **`noobe-hub/supabase/migrations/`**.

## Por qué

MIA, ZOE, BOB y el hub comparten UNA sola base de datos Supabase
(`MIA-DEVELOP` / `MIA` en producción). El CLI de Supabase exige que la carpeta
local de migraciones contenga **todas** las que la base tiene registradas: si
cada repo llevase las suyas, en cuanto uno hiciera `supabase db push` los demás
quedarían bloqueados con:

```
Remote migration versions not found in local migrations directory.
```

(`--include-all` no lo evita — comprobado.)

Por eso hay **un único repo dueño del esquema: `noobe-hub`**.

## Cómo crear una migración

```bash
cd ../noobe-hub
supabase migration new <producto>_<descripcion>   # p.ej. bob_add_streak_bonus
# editar el archivo generado
supabase db push
```

Prefija SIEMPRE con el producto: `hub_`, `mia_`, `zoe_`, `bob_`.

## Reglas

- **Nunca** `supabase db pull` — traería el esquema de los otros productos.
- **Nunca** SQL suelto contra la base sin migración: así se rompió el historial
  la vez anterior (ver `noobe-hub/docs/auditoria-migraciones-develop.md`).
- Cada producto toca **solo su schema**. La única FK permitida hacia fuera es
  `user_id -> auth.users(id)`; nunca a `profiles`.

## Histórico

Las migraciones antiguas de este repo están en
`noobe-hub/supabase/migrations/_archive/`. Ya no son la fuente de verdad: el
estado real quedó consolidado en `20260818000000_baseline.sql`.
