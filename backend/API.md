# Bariloche API

Backend independiente para migrar progresivamente la web estática hacia una API REST con PostgreSQL en Supabase.

## Entorno

Crear `backend/.env` localmente a partir de `backend/.env.example`:

```env
DATABASE_URL=
JWT_SECRET=
FRONTEND_ORIGIN=
NODE_ENV=
```

`DATABASE_URL` debe apuntar al PostgreSQL de Supabase. El archivo `.env` esta ignorado por Git y no debe commitearse.
`JWT_SECRET` debe ser un secreto largo local/deploy. `FRONTEND_ORIGIN` debe ser el origen exacto del frontend autorizado para CORS.

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

## Fase 2

Autenticacion propia de la API, sin Supabase Auth:

- `POST /auth/login`: recibe `username` y `password`, valida bcrypt y setea una cookie `access_token` httpOnly con JWT de 24 horas.
- `POST /auth/logout`: borra la cookie de sesion.
- `GET /me`: exige cookie valida y devuelve el usuario publico actual.

Las respuestas nunca incluyen `password_hash` ni el token JWT en el cuerpo. En cada request autenticada la API vuelve a cargar el usuario desde PostgreSQL para obtener rol, estado activo y permisos actuales.

Autorizacion preparada:

- `requireAuth`
- `requireRole(role)`
- `requirePermission(permission)`

Los administradores pasan los chequeos de permisos. Jere conserva el permiso explicito `create_previa`.

## Fase 3

Dinero privado por usuario autenticado:

- `GET /money`: devuelve solo el saldo inicial y movimientos del usuario autenticado.
- `PUT /money/initial-balance`: actualiza el saldo inicial propio con `amount` entero en pesos, mayor o igual a cero.
- `POST /money/movements`: crea un gasto o ingreso propio.
- `PATCH /money/movements/:id`: modifica un movimiento propio.
- `DELETE /money/movements/:id`: elimina un movimiento propio.

Los endpoints no aceptan `userId` del body como autoridad. El propietario siempre sale de la sesion autenticada.

Movimientos:

- `type`: `expense` o `income`.
- `amount`: entero en pesos, mayor a cero.
- `movementDate`: fecha calendario `YYYY-MM-DD`.
- gastos: `category` debe ser una de `Chocolates`, `Alcohol`, `Boliche`, `Comida`, `Bebida`, `Actividades`, `Otros`.
- ingresos: `category` debe ser `null` u omitirse.

No se persisten totales derivados.
