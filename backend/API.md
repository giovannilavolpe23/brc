# Bariloche API

Backend independiente para migrar progresivamente la web estática hacia una API REST con PostgreSQL en Supabase.

## Entorno

Crear `backend/.env` localmente a partir de `backend/.env.example`:

```env
DATABASE_URL=
```

`DATABASE_URL` debe apuntar al PostgreSQL de Supabase. El archivo `.env` esta ignorado por Git y no debe commitearse.

## Scripts

- `npm run dev`: levanta Express en modo desarrollo.
- `npm run build`: compila TypeScript.
- `npm run typecheck`: valida tipos sin emitir archivos.
- `npm run migrate`: aplica migraciones pendientes.
- `npm run seed`: carga roles, permisos y usuarios iniciales.
- `npm run db:health`: verifica conexion a PostgreSQL.
- `npm test`: ejecuta tests basicos.

## Fase 1

Incluye solo identidad y salud del servicio:

- `GET /health`
- `GET /health/db`
- tablas `roles`, `permissions`, `users`, `user_permissions`
- seed de roles `admin`/`user`, permiso `create_previa`, y los 11 usuarios iniciales

No incluye todavia endpoints de gastos, registros diarios, previas, estadisticas ni integracion con el frontend.
