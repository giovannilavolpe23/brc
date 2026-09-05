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

## Fase 4

Registro diario historico y encuestas, siempre para el usuario autenticado:

- `GET /daily-entries`: lista registros propios.
- `GET /daily-entries/:date`: devuelve un registro propio por `date_key`.
- `PUT /daily-entries/:date`: crea o reemplaza el registro propio de ese dia.
- `GET /surveys`: lista encuestas activas.
- `GET /surveys/:date/my-votes`: devuelve solo los votos propios de ese dia.
- `PUT /surveys/:surveyKey/:date/vote`: crea o reemplaza el voto propio para encuesta y dia.

`date_key` usa formato `YYYY-MM-DD` y se valida contra `America/Argentina/Buenos_Aires`. La API rechaza hoy y fechas futuras para conservar la regla conceptual de registrar el dia anterior o dias historicos ya cerrados.

`daily_entries` guarda solo datos originales: sueno, horarios, siesta, quinta comida, bano y salida del boliche. No acepta ni persiste `computed`.

`survey_questions` se inicia con `destroyed_vote`. En `survey_votes`, `voter_user_id` sale de la sesion, `voted_user_id` debe existir, no se permite autovoto y un segundo `PUT` para la misma encuesta/fecha reemplaza el voto anterior.

## Fase 5

Previas persistidas en PostgreSQL:

- `POST /previas`: crea una previa. Requiere rol admin o permiso `create_previa`.
- `GET /previas`: lista previas visibles para el usuario autenticado.
- `GET /previas/:id`: obtiene una previa visible por UUID o `legacyId`.
- `PATCH /previas/:id`: modifica una previa. Puede hacerlo admin o el creador.
- `DELETE /previas/:id`: elimina una previa. Puede hacerlo admin o el creador.

`creator_user_id` siempre sale de la sesion. El body no puede elegir creador. Los participantes pueden enviarse como UUIDs actuales o `legacy_id` heredados, y se guardan como FKs a `users`.

Formato de creacion compatible con el codigo actual:

- `legacyId` o `id`: identificador unico de la previa.
- `participantIds`: al menos un participante existente, sin duplicados.
- `products`: al menos un producto con `name`, `unitPrice`/`price` entero en pesos y `quantity` entero mayor a cero.
- `totalAmount` o `total`: debe coincidir con la suma de productos.
- `amountPerParticipant` o `amountPerPerson`: debe coincidir con `total / participantes`.
- `occurredAt` o `createdAt`: fecha ISO original.

No se exponen hashes de contrasena ni tokens en las respuestas de lectura.

## Fase 6

Estadisticas globales calculadas desde PostgreSQL:

- `GET /stats/total`: devuelve acumulados de todos los dias cerrados.
- `GET /stats/day/:date`: devuelve estadisticas para un `date_key` historico.

Todos los usuarios autenticados reciben los mismos resultados globales. La respuesta usa `userId` en rankings y no expone `initialBalance`, `password_hash`, cookies ni tokens.

Incluye inicialmente:

- dinero: total gastado global, total gastado por usuario, ranking por categoria y categoria con mayor gasto;
- registro diario: sueno, siestas, quinta comida, bano y tiempo de boliche recalculado desde datos originales;
- encuestas: resultados de `destroyed_vote`;
- previas: cantidad total y ranking por participante;
- rachas: boliche, quinta comida, bano, Chocolates y Alcohol, calculadas en runtime.

Las categorias sin datos no aparecen. `GET /stats/day/:date` rechaza hoy y futuro usando `America/Argentina/Buenos_Aires`.

## Fase 7

Personalizacion visual publica de perfil:

- `GET /users/me/appearance`: devuelve la apariencia propia o `null` si el usuario conserva el diseño default.
- `PUT /users/me/appearance`: guarda la apariencia del usuario autenticado.
- `DELETE /users/me/appearance`: restablece la apariencia propia al default eliminando la fila.

`user_id` siempre sale de la sesion autenticada. La API valida colores HEX, enums permitidos y tamano de payload, y no acepta modificar la apariencia de otro usuario.

Para evitar N requests por usuario, `appearance` tambien se incluye como dato publico en:

- `GET /auth/users`
- `POST /auth/login`
- `GET /auth/me`
- `GET /me`
- `GET /stats/total`
- `GET /stats/day/:date`
