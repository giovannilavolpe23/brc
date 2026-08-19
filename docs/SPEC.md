# BARILOCHE WEB — SPEC

## Objetivo

Web mobile-first para administrar un viaje de egresados a Bariloche.

Cada participante podrá registrar y administrar sus datos durante el viaje. Gio tendrá además un panel administrativo para consolidar los datos de todos y generar estadísticas, rankings y otros resultados.

La web será estática y funcionará sin backend propio, API ni base de datos remota.

## Restricciones

- Prioridad absoluta: mobile.
- Desktop/tablet son secundarios.
- Persistencia mediante localStorage.
- Sin backend.
- Sin API externa.
- Sin autenticación externa.
- Debe funcionar correctamente sin conexión después de cargar la web.
- Debe poder alojarse en Vercel.
- La aplicación debe sentirse como una app móvil.

## Usuarios

Los participantes estarán definidos previamente.

El usuario NO escribe libremente su nombre.

Al iniciar por primera vez:

1. Se muestra "¿Quién sos?"
2. Se muestran los participantes disponibles.
3. El usuario selecciona su persona.
4. Se guarda su identificación en localStorage.
5. En futuras aperturas entra directamente a /home.

Gio es participante y administrador.

## Sesión

La sesión debe guardarse independientemente de los datos.

Ejemplo conceptual:

currentUser → usuario actualmente seleccionado
userData → datos persistentes del usuario

Cerrar sesión elimina únicamente currentUser.

Nunca utilizar localStorage.clear() para cerrar sesión.

Los datos del usuario deben permanecer.

## Rutas

/home
Experiencia principal del participante.

/admin
Panel administrativo exclusivo de Gio.

## Home

La experiencia principal será vertical y mobile-first.

Secciones:

- Dinero
- Registro diario
- Envío de datos

El usuario registrará principalmente los datos del día anterior al despertarse.

La composición visual de Home (fondo, montañas, título "BARILOCHE",
tamaño de las 3 tarjetas) sigue la estética "Bariloche" compartida
con el login — ver detalle en "Diseño > Estética 'Bariloche'".

## Dinero

Cada usuario podrá registrar:

- dinero inicial del viaje
- gastos
- categoría de cada gasto
- ganancias/dinero recibido

Categorías de gasto vigentes (confirmado en la auditoría de datos):

- Chocolates
- Alcohol
- Boliche
- Comida
- Bebida
- Actividades
- Otros

La categoría "Transporte" existió en una versión anterior y fue
eliminada del picker. Los gastos ya guardados con esa categoría se
migran automáticamente a "Otros" la próxima vez que se abre la
sección Dinero de ese usuario, sin perder nombre, monto ni fecha.

El sistema podrá mostrar posteriormente saldo, gráficos y estadísticas.

## Registro diario

Cada día el usuario podrá registrar datos como:

- hora de dormir y hora de despertarse (u opcionalmente "no dormí")
- siesta opcional (inicio y fin)
- quinta comida (sí/no)
- cantidad de veces que fue al baño
- hora de salida del boliche (u opcionalmente "no fui al boliche")
- otros datos humorísticos o estadísticos (futuro)
- encuesta diaria **"¿Quién estuvo más destruido anoche?"** (ver
  detalle más abajo)

Los datos pertenecen al día correspondiente del viaje. Por ahora cada
registro se identifica con la fecha calendario real del día anterior
(aún no existe fecha de inicio configurada); esa clave de fecha es la
que después se va a usar para calcular el número de día de viaje.

La fecha de inicio del viaje permitirá determinar automáticamente el día del viaje.

El sistema calcula automáticamente, a partir de los horarios
cargados: horas de sueño, duración de la siesta, sueño total
(sueño + siesta) y tiempo en el boliche (tomando la 01:00 como hora
fija de llegada). Estos valores calculados se guardan junto con el
registro para que estadísticas y rankings futuros no tengan que
reinterpretar los horarios crudos.

La fecha mostrada en el banner ("Registrando el día de ayer —
[fecha]") es siempre dinámica: se calcula a partir de la fecha
interna que usa la app (`getSimulatedToday()` en `script.js`), que
es la fecha real del dispositivo salvo que esté activa la
herramienta de testing `day(dia, mes)` (ver "Reglas para IA" /
`CURRENT_STATE.md`), en cuyo caso usa esa fecha simulada. Nunca hay
una fecha hardcodeada en el HTML/JS de esta sección.

## Encuesta diaria: "¿Quién estuvo más destruido anoche?" (implementado)

Dentro de Registro diario, además de los datos ya existentes
(sueño, siesta, quinta comida, baño, boliche), cada usuario responde
una encuesta de una sola pregunta sobre el día que está registrando:

- **Opciones**: todos los participantes de `PARTICIPANTS`, **excepto
  el propio usuario logueado** (no se muestra como opción tocable —
  no hace falta validar "no te podés votar" porque la opción ni
  siquiera aparece en la lista).
- **Selección única**: chips tocables (`.chip-group`, mismo patrón
  visual que "Quinta comida"/"Veces al baño"), solo una persona
  seleccionada a la vez; tocar otra opción reemplaza la anterior.
- **Almacenamiento**: el voto se guarda como `destroyedVote` (id del
  participante votado, o `null` si todavía no votó) dentro del mismo
  objeto de registro diario del usuario
  (`userData:<id>.dailyLog.entries[<fecha>]`), junto con sueño,
  siesta, quinta comida, baño y boliche de ese mismo día — no es una
  clave de `localStorage` separada. Viaja también dentro del código
  de exportación de ese usuario (`buildExportPayload` ya incluye
  `dailyEntries` completo, sin necesidad de listar el campo a mano) y
  queda disponible en `adminPlayers[id].data.dailyEntries` una vez
  importado, igual que el resto de los campos del día.
- **Sin duplicados**: como el voto vive dentro del mismo registro
  diario (identificado por la fecha, `dailyDateKey`), guardar de
  nuevo el mismo día sobrescribe la entrada existente en vez de
  crear una segunda (mismo mecanismo que ya usa el resto de Registro
  diario — "si ya existe un registro para la fecha del día anterior,
  se sobrescribe"). Si el usuario ya había votado ese día, al reabrir
  Registro diario su voto se precarga seleccionado (mismo patrón que
  el resto de los campos ya guardados).
- **Defensa extra contra autovoto**: aunque la UI ya excluye al
  propio usuario de las opciones, `saveDailyEntry()` descarta
  explícitamente el voto si por algún motivo coincidiera con el id
  del usuario logueado, así nunca se persiste un autovoto.
- **Usado por Títulos por encuesta**: el campo se lee desde
  "Títulos por encuesta" (`#/titulos-encuesta`, ver más abajo) para
  otorgar el título "El más destruido" a quien reciba más votos,
  por día o acumulado. Todavía no se lee desde Estadísticas
  (`#/stats`).
- Mismo estilo visual que el resto de Registro diario (tema
  "Bariloche" blanco/celeste, `.daily-section`, `.section-label`,
  chips), sin ningún componente ni color nuevo.

## Previas

Las previas se administran únicamente desde /admin.

No se registran individualmente desde cada usuario para evitar duplicaciones.

### Registro manual (implementado)

Desde /admin → "Previas" (`#/previas`), Gio puede:

- seleccionar participantes (botones tocables, selección múltiple);
- agregar varios productos/bebidas a la misma previa, cada uno con
  nombre, precio unitario y cantidad;
- ver el total calculado automáticamente (suma de precio × cantidad
  de todos los productos);
- ver, mientras arma la previa, un resumen en vivo con **Total de la
  previa**, **Participantes** (cantidad) y **A pagar por persona**
  (total ÷ cantidad de participantes; ej. 6 participantes y total
  $60.000 → $10.000 por persona);
- al tocar "Guardar previa", confirmar explícitamente en un bottom
  sheet ("¿Estás seguro de registrar esta previa?", con el mismo
  resumen de total/participantes/monto por persona) antes de que se
  escriba nada; cancelar no guarda ni modifica ningún dato;
- una vez confirmada, la previa genera un identificador único y
  persiste en `localStorage` bajo la clave `adminPrevias`, incluyendo
  el monto por persona ya calculado;
- consultar el historial completo de previas guardadas (participantes,
  productos, total, monto a pagar por persona, fecha/hora e
  identificador de cada una).

Almacenamiento (`localStorage`, clave `adminPrevias`, separada de
`userData:<id>` y de `adminPlayers`):

```js
adminPrevias = [
  {
    id: "<genId>",
    participantIds: ["gio", "sebas", ...],
    products: [
      { id: "<genId>", name: "Fernet", price: 5000, quantity: 2 },
      ...
    ],
    total: number,           // suma de price * quantity de todos los productos
    amountPerPerson: number, // total / cantidad de participantIds, calculado y
                              // guardado una sola vez al confirmar (no se
                              // recalcula después); viaja junto con el resto
                              // de la previa en cualquier código de
                              // exportación futuro que la incluya
    createdAt: "<ISO>",
  },
  ...
]
```

Validaciones antes de guardar: debe haber al menos un participante
seleccionado y al menos un producto agregado; si falta alguno, se
muestra un error y no se abre la confirmación. Solo se escribe en
`localStorage` después de que Gio confirma explícitamente en el
bottom sheet ("Sí, registrar previa"); tocar "Cancelar" no modifica
nada.

### Código de una previa e importación (implementado)

Reutiliza **exactamente** el mismo formato/codificación del "Código
de intercambio" descripto más abajo (`BRL<version>.` + XOR con
`EXPORT_XOR_KEY` + Base64 URL-safe, mismas funciones `xorBytes` /
`bytesToBase64Url` / `base64UrlToBytes` / `decodeExportCode`). Lo
único que cambia es la forma del payload:

```js
{
  version: 1,
  type: "previa",
  previa: {
    id, participantIds, products, total, amountPerPerson, createdAt
  }
}
```

(el payload de un jugador, en cambio, tiene `{ version, user, data }`
y no lleva `type`; `decodeExportCode` es agnóstico a la forma del
payload, así que no necesitó cambios).

- **Generar código de una previa**: `generatePreviaExportCode(previa)`
  (vía `buildPreviaExportPayload(previa)`, el único lugar que decide
  qué campos de la previa entran en el código).
- **Validar/decodificar**: `validatePreviaImportPayload(payload)`
  comprueba `version`, `type === "previa"` y que `previa` tenga
  `id`, `participantIds` (array no vacío), `products` (array no
  vacío), `total` y `amountPerPerson` (numéricos) y `createdAt`.
  `parseAndValidatePastedPreviaCode(rawCode)` combina
  `decodeExportCode` + esta validación con mensajes de error listos
  para mostrar.
- **Importar desde /admin**: dentro de `#/previas`, botón "Introducir
  código de previa" (solo visible para Gio) abre un bottom sheet
  multi-paso (pegar código → si `previa.id` ya existe en
  `adminPrevias`, avisar "Esta previa ya fue importada" sin tocar
  nada → previsualización de solo lectura (participantes, productos,
  total, monto por persona, fecha) → "Confirmar importación"). Solo
  al confirmar se escribe en `adminPrevias`, con el **mismo `id`** que
  traía el código (así reimportar el mismo código siempre cae en el
  paso de duplicado en vez de crear una segunda entrada) y
  exactamente los mismos campos que una previa registrada a mano por
  Gio (`participantIds`, `products`, `total`, `amountPerPerson`,
  `createdAt`): el resultado en el historial es idéntico a uno
  registrado directamente.

### Permiso especial: Jere puede registrar previas (implementado)

Además del registro manual desde /admin (exclusivo de Gio), **Jere**
tiene permiso explícito para registrar previas desde su propia
cuenta, sin ser administrador. Ver "Permisos" más abajo para el
detalle del flag.

- En el Home de Jere (y únicamente ahí) aparece, debajo de las
  tarjetas normales de Home, una sección adicional **"Previas"** con
  una tarjeta que lleva a `#/previas-jere`.
- `#/previas-jere` reutiliza **el mismo componente/lógica** de armado
  de previa que `#/previas` de /admin (selección de participantes,
  alta de productos, resumen en vivo, confirmación al guardar) — es
  la misma función `renderPreviasScreen()`, controlada por una
  variable de módulo `previaMode` (`"admin"` o `"local"`) que decide
  únicamente dónde persiste y qué ids de DOM usa (`previaIds()`); no
  existe una segunda implementación del formulario.
- **Diferencia clave de almacenamiento**: en modo `"local"`, al
  confirmar, la previa se guarda en `localStorage` bajo
  `localPrevias:<id del usuario>` (namespaced, hoy solo
  `localPrevias:jere`) — **nunca** en `adminPrevias`. Esa previa NO
  forma parte de la base administrativa consolidada hasta que Gio
  importa su código desde /admin.
- Al confirmar una previa en modo local, se genera de una el código
  (`generatePreviaExportCode`) y se muestra en un bottom sheet
  ("Código de la previa") con un `<textarea readonly>` y botón
  "Copiar código", para que Jere se lo pueda mandar a Gio (por
  WhatsApp u otro medio; no hay un botón de envío directo integrado,
  a diferencia de "Envío de datos" de Home). El historial local
  (debajo del formulario, leído de `localPrevias:<id>`) también
  ofrece un botón "Copiar código para Gio" por cada previa ya
  guardada, por si se cerró el sheet inicial sin copiar.
- Jere **no** tiene acceso a `/admin`, `/previas` (la de admin),
  jugadores, estadísticas ni ninguna otra función administrativa: si
  fuerza el hash `#/admin`, `#/previas` o cualquier otra ruta de
  admin, se lo redirige a `/home` (igual que a cualquier no-admin).
  Si fuerza `#/previas-jere` sin tener el permiso, también se lo
  redirige a `/home`.

### Pendiente

- Eliminar o editar una previa ya guardada (tanto en `adminPrevias`
  como en `localPrevias:<id>`).
- Estadísticas a partir de las previas guardadas.

## Permisos

Sistema de permisos simple y explícito, sin roles complejos todavía:

- **Gio**: `isAdmin: true` en `PARTICIPANTS` → administrador (acceso
  a `/admin` completo) + puede registrar previas (desde `#/previas`
  dentro de `/admin`, ver "Previas" más arriba).
- **Jere**: `canRegisterPrevias: true` en `PARTICIPANTS`, `isAdmin`
  ausente → usuario normal (mismo Home que cualquier participante,
  sin acceso a `/admin`, jugadores, estadísticas ni configuración
  administrativa) + puede registrar previas desde una sección
  adicional en su propio Home (`#/previas-jere`, guarda localmente,
  ver "Permiso especial: Jere puede registrar previas" más arriba).
- **Resto de participantes**: usuarios normales, sin ninguno de los
  dos flags → sin acceso a `/admin` ni a registro de previas.

La función `canRegisterLocalPrevia(id)` centraliza la regla ("tiene
`canRegisterPrevias` Y no es admin") para que la sección de Previas
de Home solo se ofrezca a quien corresponde; `navigate()` la usa
también para bloquear `#/previas-jere` si alguien fuerza el hash sin
tener el permiso.

## Administración

/admin será exclusivo de Gio.

**Implementado**: agregar/importar jugador, editar/actualizar jugador
(ver "Jugadores importados (implementado)" más abajo).

**Implementado**: registro manual de previas (ver "Previas" más arriba).

**Implementado**: sección Estadísticas con apartados DÍA/TOTAL (ver
"Estadísticas" más arriba); ambos apartados ya calculan las ocho
estadísticas reales en rankings de barras horizontales (DÍA sobre un
único día, TOTAL acumulando todos los días cerrados).

Futuras funciones:

- títulos/premios
- backups

## Código de intercambio (implementado)

Cada usuario puede generar, desde "Envío de datos" en /home, un
código que representa **todos sus datos actuales**: saldo inicial,
gastos, ganancias y registros diarios. El código se puede copiar o
enviar directamente a Gio por WhatsApp. Desde /admin, Gio ya puede
pegar ese código para importar o actualizar los datos del jugador
correspondiente (ver siguiente sección). El formato está versionado
para que la importación no se rompa si el formato cambia en el
futuro.

No es criptográficamente seguro (no hace falta). Su único objetivo es
que el contenido no sea legible a simple vista y que sea lo
suficientemente compacto para pegarlo en un mensaje de WhatsApp.

### Versión actual

`EXPORT_CODE_VERSION = 1` (constante en `script.js`).

### Formato del código

```
BRL<version>.<base64url(xor(JSON.stringify(payload), CLAVE))>
```

- `BRL` es un prefijo fijo para reconocer un código válido a simple
  vista (por ejemplo, para detectar que alguien pegó texto que no es
  un código, sin necesidad de decodificar nada).
- `<version>` es el mismo número que después viaja dentro del JSON
  (`payload.version`); está duplicado a propósito para poder
  detectar rápido un código de una versión vieja/nueva sin decodificar
  el resto.
- El resto es el JSON del payload, pasado por un XOR reversible byte a
  byte con una clave fija (`EXPORT_XOR_KEY`, hoy `"bariloche-2026"`) y
  después codificado en Base64 URL-safe (sin padding).

`payload` (lo que efectivamente se ofusca):

```js
{
  version: 1,
  user: "<id del participante, ej. \"gio\">",
  data: {
    initialBalance: number | null,
    movements: [ /* igual a userData:<id>.money.movements */ ],
    dailyEntries: { /* igual a userData:<id>.dailyLog.entries */ }
  }
}
```

No se incluye `createdAt`, ids de sesión, ni ningún dato de interfaz:
solo lo que representa el progreso del jugador.

### Algoritmo utilizado

1. Armar el `payload` a partir de los datos **actuales** de
   `localStorage` (nunca un valor guardado en memoria de antes).
2. `JSON.stringify(payload)`.
3. Convertir ese string a bytes UTF-8 (`TextEncoder`).
4. Hacer XOR byte a byte contra `EXPORT_XOR_KEY` (se repite la clave
   cíclicamente si el mensaje es más largo que la clave).
5. Codificar esos bytes en Base64, reemplazando `+`/`/` por `-`/`_` y
   quitando el padding `=` (Base64 URL-safe), para que quede prolijo
   dentro de una URL de WhatsApp.
6. Anteponer `BRL<version>.`.

Decodificar es exactamente el proceso inverso (XOR es su propia
inversa aplicando la misma clave).

### Funciones responsables (`script.js`)

- **Generar**: `generateExportCode(userId)` — única función central
  para armar el código. Internamente llama a `buildExportPayload(userId)`,
  que es el único lugar que decide qué datos del usuario entran en el
  código. Si en el futuro se agrega un nuevo tipo de dato persistido
  (ej. previas individuales), **alcanza con sumarlo dentro de
  `buildExportPayload`** sin tocar el resto del pipeline de
  codificación.
- **Decodificar**: `decodeExportCode(code)` — única función central
  para revertir un código a su `payload` original. Valida el prefijo
  `BRL` y que la versión del código coincida con la del JSON antes de
  parsear. Todavía no se usa desde la UI (no hay importación
  implementada aún), pero ya quedó lista y probada.

### Compatibilidad entre versiones

Si el formato de `data` cambia en el futuro, subir
`EXPORT_CODE_VERSION` y, dentro de `decodeExportCode`, manejar cada
versión de forma explícita (por ejemplo, migrando un payload viejo al
formato nuevo antes de devolverlo) para no romper códigos generados
con una versión anterior de la app.

### WhatsApp

Botón "Enviar datos a Gio" en la pantalla de Envío de datos: genera
el código en el momento (siempre con datos actuales), arma un enlace
`https://wa.me/5491127362080?text=...` con el mensaje:

```
BARILOCHE_DATA
Código:
[CODIGO]
```

y lo abre en una pestaña nueva para que el usuario revise el mensaje
en WhatsApp antes de mandarlo (nunca se envía automáticamente). También
hay un botón "Copiar código" que copia únicamente el código al
portapapeles (con confirmación visual de "Copiado").

## Jugadores importados (implementado)

Desde /admin, Gio puede importar y actualizar los datos de cualquier
jugador pegando el código que ese jugador generó en "Envío de datos".
Reutiliza exactamente el mismo sistema de códigos descripto arriba
(`decodeExportCode`) — no existe un formato de código distinto para
administración.

### Almacenamiento

Una única clave nueva en `localStorage`, separada de todo lo demás:

```js
adminPlayers = {
  "<id>": {
    id: "<id>",              // = payload.user del código decodificado
    name: "<nombre>",        // resuelto contra PARTICIPANTS si existe
    data: {                  // = payload.data tal cual venía en el código
      initialBalance: number | null,
      movements: [...],
      dailyEntries: {...}
    },
    sourceVersion: number,   // = payload.version con el que se generó
    importedAt: "<ISO>",     // primera vez que se importó a este jugador
    updatedAt: "<ISO>"       // última vez que se importó/actualizó
  },
  ...
}
```

`adminPlayers` es la copia consolidada propia de Gio. Nunca lee ni
escribe `userData:<id>` ni `currentUser`: importar los datos de Sebas
no modifica en absoluto los datos locales de Gio (ni los de nadie
más). Es una clave de solo administración.

### Lista única de jugadores

/admin muestra una **única lista**, con una fila por cada uno de los
participantes de `PARTICIPANTS` (siempre los mismos 11-12, hayan
mandado su código o no). No existe una segunda lista de jugadores ni
botones individuales de "actualizar código" dentro de cada fila: las
filas no son tocables.

Cada fila muestra: avatar, nombre y **"Última actualización: dd/mm
hh:mm"** (leído de `adminPlayers[id].updatedAt`, persistido en
`localStorage`), o **"Sin datos importados"** si ese jugador todavía
no tiene ninguna entrada en `adminPlayers`.

Debajo de la lista hay un único botón, **"Actualizar código"**, que
abre un bottom sheet con un campo de texto para pegar el código y un
botón "Importar". No apunta a ningún jugador de antemano: el jugador
se identifica automáticamente a partir de `payload.user` una vez
decodificado el código pegado. Es upsert siempre: si el jugador ya
tenía una entrada en `adminPlayers`, la actualiza; si no, la crea. No
existe (ni falta) un botón separado para el primer import de un
jugador — como la lista de participantes es siempre la fija de
`PARTICIPANTS`, "actualizar" y "agregar por primera vez" son la misma
operación desde el punto de vista de este botón. (El botón "+
Agregar jugador", que existía como una segunda entrada al mismo
flujo con un aviso de duplicado propio, se eliminó en v0.23.0 — ver
"Pendiente" más abajo.)

### Flujo de importación

1. Se decodifica el código pegado con `decodeExportCode` (mismo
   algoritmo que la exportación, en reversa: valida prefijo `BRL`,
   revierte Base64 URL-safe + XOR, parsea JSON, compara la versión
   del prefijo contra `payload.version`).
2. `validateImportPayload(payload)` comprueba, en este orden, que:
   - `payload.version` sea la versión soportada actual
     (`EXPORT_CODE_VERSION`);
   - `payload.user` exista y sea un string no vacío;
   - `payload.data` exista y tenga la forma esperada:
     `movements` sea un array, `initialBalance` sea `number` o
     `null`, `dailyEntries` sea un objeto.
3. Si cualquiera de los dos pasos falla, se muestra un mensaje de
   error claro dentro del mismo sheet y **no se modifica
   `adminPlayers` ni ningún otro dato**.
4. **El código siempre tiene que identificar a un jugador conocido**:
   se busca `payload.user` dentro de `PARTICIPANTS`. Si no aparece
   (jugador no registrado en la lista), se muestra el error `"<id>"
   no está registrado en la lista de jugadores` y **no se agrega
   automáticamente ni se modifica `adminPlayers`**.
5. Identificado el jugador, se pasa directo a la previsualización,
   exista o no ya una entrada previa en `adminPlayers` para ese id
   (upsert, sin paso intermedio de aviso).
6. La previsualización es de solo lectura y muestra: nombre resuelto
   del jugador, cantidad de gastos, cantidad de ganancias y cantidad
   de registros diarios contenidos en el código. **No muestra el
   saldo inicial** (ver "Saldo inicial — privado" más abajo).
7. Solo al tocar "Confirmar actualización" se escribe efectivamente
   en `adminPlayers` (función `confirmAdminImport`). Cancelar en
   cualquier paso anterior no deja rastro.

Al confirmar, `data` se **reemplaza por completo** por el nuevo
payload (no se mezclan gastos viejos con nuevos); `importedAt` se
conserva del primer import y `updatedAt` se actualiza a la hora de la
confirmación — es lo que hace que la fila de ese jugador en la lista
muestre la nueva fecha/hora.

### Duplicados

La clave de `adminPlayers` es siempre `payload.user` (el id estable
del participante), así que estructuralmente no pueden coexistir dos
entradas para el mismo id, y cada jugador aparece **una sola vez** en
la lista: importar de nuevo el mismo jugador con "Actualizar código"
simplemente actualiza su fila existente.

### Saldo inicial — privado

`data.initialBalance` viaja en el código y se guarda igual que
siempre dentro de `adminPlayers[id].data.initialBalance` (se necesita
internamente para cálculos futuros como "El más rata"), pero **no se
muestra en ningún lugar de /admin**: ni en la lista, ni en la
previsualización de importación, ni en ninguna otra pantalla
administrativa. Tampoco se muestra "dinero llevado al viaje" ni
ningún dato que permita inferir ese monto directamente.

### Interfaz

En /admin, sección "Jugadores": una fila por participante (avatar,
nombre, "Última actualización: ..." o "Sin datos importados") y un
único botón "Actualizar código" debajo. Mismo lenguaje visual que el
resto de /admin (bottom sheet, tarjetas, acento celeste), sin
convertir /admin en un dashboard.

Todavía no implementado: estadísticas, rankings, previas ni gráficos
administrativos a partir de `adminPlayers` (queda para una próxima
iteración, según lo pedido).


## Estadísticas

Sección **Estadísticas**, accesible desde /admin → tarjeta "Estadísticas"
(`#/stats`). Exclusiva de Gio: si otro usuario fuerza el hash
`#/stats`, se lo redirige a `/home` (mismo comportamiento que
`#/admin` y `#/previas`).

### Estructura base (implementada)

Dos apartados claramente diferenciados, alternables con un selector
tipo pestaña ("Día" / "Total") arriba de todo:

**DÍA**

- Navegación simple `← día →` entre los días ya cerrados del viaje.
- Un día se considera "cerrado" cuando existe al menos un registro
  diario (`dailyEntries`) de algún jugador dentro de `adminPlayers`
  para esa fecha, y esa fecha es estrictamente anterior al día de
  hoy. **Nunca** se puede consultar el día actual ni un día futuro:
  `getStatsClosedDays()` filtra por `key < todayKey()` antes de
  construir la lista navegable.
- El día seleccionado se muestra siempre de forma clara en el centro
  de la barra de navegación (mismo formato de fecha en español que
  Registro diario, ej. "Martes 12 de agosto").
- Las flechas se deshabilitan en los extremos (no hay vuelta al
  llegar al día más antiguo ni al más reciente) y no existe forma de
  avanzar hasta hoy.
- Si todavía no hay ningún día cerrado (nadie importó un registro
  diario aún), se muestra un mensaje explicativo en vez de la
  navegación activa.
- Debajo de la navegación, ocho tarjetas de ranking con **cálculo
  real** (ver "Cálculo real de DÍA (implementado)" más abajo). Si
  todavía no hay ningún día cerrado, en su lugar se muestran las
  cuatro tarjetas "Próximamente" (Sueño, Dinero, Boliche, Rankings)
  como antes.

**TOTAL**

- Mantiene **exactamente la misma estructura visual** que DÍA (misma
  barra superior, mismas tarjetas de categorías debajo), pero sin
  flechas de navegación (reemplazadas por el mismo espacio en blanco
  para no romper el layout) y mostrando en el centro "Todo el viaje"
  + la cantidad de días cerrados disponibles.
- Acumula los datos de todos los días disponibles (mismo conjunto
  `getStatsClosedDays()` que usa DÍA). Cuando hay al menos un día
  cerrado, muestra las mismas ocho tarjetas de ranking que DÍA (ver
  "Cálculo real de TOTAL (implementado)" más abajo), acumulando los
  valores de todos los días disponibles en vez de uno solo. Si
  todavía no hay ningún día cerrado, muestra las cuatro tarjetas
  "Próximamente" y el mismo mensaje explicativo que usa DÍA.

### Cálculo real de DÍA (implementado)

Cuando hay al menos un día cerrado, DÍA muestra ocho estadísticas,
cada una como un **ranking de barras horizontales** (nunca columnas
verticales), ordenado de mayor a menor. La sección debe sentirse como
una **competencia del viaje**, no como un dashboard empresarial:

- El primer puesto se separa visualmente del resto en un **podio**
  propio (🏆 animada, degradé de acento, borde con glow, tag "1er
  puesto" y nombre en tipografía más grande, barra más alta con un
  destello que la recorre una vez al llenarse) para que sea
  imposible no ver quién va ganando esa estadística puntual. El 2° y
  3° puesto se marcan con medalla (🥈/🥉) y un tinte plata/bronce
  propio en nombre y barra; del 4° en adelante, número de puesto
  simple dentro de una insignia circular.
- Cada tarjeta tiene un título de competencia (ej. "¿Quién durmió
  más?", "El más gastador") con una leyenda chica debajo, en el color
  de acento propio de esa estadística, que aclara el dato literal que
  se está midiendo (ej. "Horas dormidas", "Gasto total del día"),
  para que el tono lúdico no genere ambigüedad sobre qué representa
  el ranking. Un filete superior del mismo color de acento y una
  línea divisoria bajo el encabezado diferencian cada tarjeta de un
  vistazo sin agregar texto.
- Espaciado generoso entre tarjetas (más aire que en el resto de la
  app) para que la pantalla no se sienta saturada con las ocho
  estadísticas juntas.
- Las barras arrancan en 0% y se animan hasta su valor real al
  renderizarse, en cascada; las tarjetas también aparecen con una
  entrada escalonada en vez de todas de golpe.
- Navegar entre días (`← día →`) desliza el contenido en la
  dirección correspondiente (con una leve escala además del
  desplazamiento); cambiar de pestaña Día/Total usa un fade. Se
  respeta `prefers-reduced-motion` desactivando estas animaciones
  para quien lo tenga configurado.
- Si una tarjeta puntual no tiene datos, o si todavía no hay ningún
  día cerrado, el estado vacío se muestra como un bloque centrado con
  ícono y texto discreto (no un párrafo de error suelto).

El ancho de cada barra es proporcional al valor máximo **del propio
ranking** (no a una escala fija). Un jugador que no cargó cierto dato
ese día simplemente no aparece en esa tarjeta puntual (no se inventan
ceros); si ninguno tiene datos para una tarjeta, se muestra "Sin
datos para este día." en lugar de un ranking vacío. Diseño verificado
sin scroll horizontal en anchos de 360–430px (columna de nombre se
recorta con ellipsis si hace falta, incluso con nombres largos dentro
del podio).

Las ocho estadísticas y su fuente (siempre `adminPlayers` /
`adminPrevias`, nunca `userData:<id>` directamente):

1. **Horas dormidas** — `entry.computed.sleepMinutes` del registro
   diario de cada jugador para el día seleccionado.
2. **Cantidad de siestas** — por día es binario (¿durmió siesta ese
   día, sí o no?): `entry.nap` con `start`/`end` cargados → "Sí", si
   no → "No".
3. **Quinta comida** — `entry.fifthMeal`: "Sí" si es `"yes"`, "No"
   si es `"no"`; si no se cargó (`null`), el jugador no entra en el
   ranking.
4. **Veces que fue al baño** — `entry.bathroom` (0 a 5).
5. **Tiempo dentro del boliche** — `entry.computed.bolicheMinutes`
   (con la 01:00 fija de llegada, igual que en Registro diario).
6. **Dinero gastado total** — suma de los gastos (`movements` tipo
   `expense`) de cada jugador cuyo **día de viaje atribuido**
   (`isoToTripDayKey(m.date)`, ver nota abajo) coincide con el día
   seleccionado.
7. **Dinero gastado por categoría** — mismo conjunto de gastos del
   punto anterior, pero agrupados por categoría (Chocolates,
   Alcohol, Boliche, Comida, Bebida, Actividades, Otros) en vez de
   por jugador: acá el ranking es de categorías, no de participantes.
7b. **Ranking por categoría de gastos (por jugador)** — además del
   punto anterior, una tarjeta de ranking horizontal por cada
   categoría de gasto que tenga al menos un gasto registrado en el
   período mostrado (DÍA o TOTAL), mostrando cuánto gastó cada
   jugador en esa categoría puntual, de mayor a menor, con el mismo
   diseño de rankings horizontales y el ganador destacado. Si una
   categoría no tiene ningún gasto registrado, no se muestra su
   tarjeta. Títulos exactos por categoría: Alcohol → "Quién se la
   patinó más en alcohol"; Comida → "Quién es el más gordito de
   mierda"; Chocolates → "Quién es el más dulce"; Boliche → "Quién
   tuvo más ganas de quebrar"; Actividades → "Quién gastó más en
   actividades"; Bebida → "Quién compró más bebidas s/a"; Otros →
   "Quién gastó más en otros".
8. **Cantidad de previas** — de las previas guardadas en
   `adminPrevias` cuyo **día de viaje atribuido**
   (`isoToTripDayKey(p.createdAt)`) coincide con el día seleccionado,
   cuántas veces aparece cada jugador dentro de `participantIds`
   (puede estar en más de una previa el mismo día).

**Día de viaje atribuido (`isoToTripDayKey`, corregido):** los
gastos y las previas se guardan con la fecha/hora **real** en que se
cargan (`new Date().toISOString()`), pero — igual que Registro
diario, que siempre trabaja sobre "el día anterior" (ver
`getYesterdayKey`) — lo habitual es cargarlos recién al día
siguiente de haber ocurrido (alguien anota sus gastos de anoche a la
mañana siguiente; Gio carga la previa de anoche al otro día). Por
eso el día de viaje al que se atribuye un gasto/previa es el día
calendario **anterior** a su fecha real de carga, no la fecha de
carga tal cual. Antes se comparaba directo contra la fecha de carga
(`isoToLocalDateKey`, sin ese corrimiento), lo que hacía que un gasto
o previa cargado "hoy" nunca pudiera coincidir con ningún día
cerrado (siempre `< hoy` por definición) y las tarjetas de
Dinero/Previas mostraran "Sin datos para este día" aunque hubiera
datos reales cargados; corregido reemplazando `isoToLocalDateKey` por
`isoToTripDayKey` en los cuatro cálculos que la usan.

### Pendiente

- Rankings y títulos humorísticos más allá del ranking simple por
  estadística (por ejemplo, un resumen de "títulos" del día/viaje).
- Comparaciones entre participantes más elaboradas.
- Hora promedio de salida del boliche y gasto diario como serie
  temporal (a diferencia del gasto acumulado, ya implementado).

### Cálculo real de TOTAL (implementado)

Mismas ocho estadísticas que DÍA (mismos íconos, mismo orden, mismo
sistema de ranking de barras horizontales con podio para el primer
puesto y el mismo tratamiento de competencia descripto arriba), pero
**acumuladas** sobre todos los días cerrados disponibles (`getStatsClosedDays()`, el mismo conjunto que navega
DÍA). Cuando no hay ningún día cerrado, TOTAL muestra las mismas
cuatro tarjetas "Próximamente" que usaba antes.

Reglas de acumulación (siempre sobre `adminPlayers` / `adminPrevias`,
nunca `userData:<id>` directamente; un jugador entra en el ranking de
una tarjeta solo si tiene al menos un día cerrado con ese dato
cargado — no se inventan ceros para quien nunca registró ese campo):

1. **Horas dormidas** — suma de `entry.computed.sleepMinutes` de
   todos los días cerrados donde el jugador durmió (se saltea
   cualquier día con `didNotSleep`).
2. **Cantidad de siestas** — cuenta de días cerrados en los que el
   jugador durmió siesta (`entry.nap` con `start`/`end`); a
   diferencia de DÍA (que muestra "Sí"/"No" por ser un solo día),
   acá el valor es la cantidad de siestas de todo el viaje.
3. **Quinta comida** — cuenta de días cerrados con
   `entry.fifthMeal === "yes"`, sobre el conjunto de días donde el
   jugador sí respondió la pregunta (`fifthMeal` no `null`).
4. **Veces que fue al baño** — suma de `entry.bathroom` de todos los
   días cerrados donde el jugador cargó ese dato.
5. **Tiempo total dentro del boliche** — suma de
   `entry.computed.bolicheMinutes` de todos los días cerrados donde
   el jugador fue al boliche (se saltea cualquier día con
   `didNotGo`).
6. **Dinero gastado total** — suma de todos los gastos
   (`movements` tipo `expense`) de cada jugador cuyo día de viaje
   atribuido (`isoToTripDayKey(m.date)`, ver nota en "Cálculo real de
   DÍA" más arriba) cae dentro de alguno de los días cerrados.
7. **Dinero gastado por categoría** — mismo conjunto de gastos que
   el punto anterior, agrupados por categoría en vez de por
   jugador (ranking de categorías acumulado de todo el viaje).
7b. **Ranking por categoría de gastos (por jugador)** — misma regla
   que en DÍA (ver punto 7b más arriba), pero acumulado sobre los
   gastos de todos los días cerrados: una tarjeta por categoría con
   al menos un gasto acumulado, con el ranking de jugadores según
   cuánto gastaron en esa categoría en todo el viaje.
8. **Cantidad de previas** — de `adminPrevias`, se cuentan todas las
   previas cuyo día de viaje atribuido (`isoToTripDayKey(p.createdAt)`)
   cae en algún día cerrado, y cuántas veces aparece cada jugador
   dentro de `participantIds` en total.

Verificado con un caso de dos días cerrados y tres jugadores con
datos parciales (algún día sin ciertos campos, un jugador que solo
registró un día) que cada suma/cuenta acumula correctamente y que un
jugador sin ningún día con determinado dato no aparece en esa
tarjeta puntual.

### Organización visual: encabezados de sección (`v0.35.0`, duración de
la animación aumentada y texto "Estadísticas del día" quitado en
`v0.36.0`, duración subida de nuevo en `v0.37.0`)

Puramente presentacional — no cambia nada de lo descripto arriba
("Cálculo real de DÍA/TOTAL"): mismos datos, mismo orden de
tarjetas, mismos títulos y leyendas. Tanto en DÍA como en TOTAL, las
tarjetas quedan agrupadas bajo 4 encabezados de sección chicos
("separador elegante", no un título de dashboard), en este orden:

1. `-Datos de registro-` — antes de las estadísticas 1 a 6 (Horas
   dormidas, Cantidad de siestas, Quinta comida, Veces que fue al
   baño, Tiempo dentro del boliche, Dinero gastado total).
2. `-Pulso del viaje-` — antes de la estadística 7 (Dinero gastado
   por categoría, la tarjeta agregada "¿En qué se fue la plata?").
3. `-Gastos por categoría-` — antes de la 7b (el ranking por jugador
   de cada categoría de gasto).
4. `-PREVIAS-` — antes de la estadística 8 (Cantidad de previas).

En DÍA, estos encabezados quedan como lo primero debajo de la barra
`← día →`: el `<div class="section-label">Estadísticas del día</div>`
que antes aparecía ahí (redundante con "-Datos de registro-" justo
debajo) se quitó por completo en `v0.36.0`, sin reemplazo ni ajuste
de spacing adicional — el `margin-bottom` ya existente de la barra de
navegación alcanza para que la transición se vea natural. El
"Estadísticas totales" de TOTAL no se tocó.

Cada encabezado es una línea sutil a cada lado del texto en
mayúscula chica (misma tipografía/paleta que el resto de la pantalla:
`var(--text-faint)`/`var(--border)`, celeste/blanco de `.admin-frost`).
Al cargar la pantalla no se ve ninguna animación; recién cuando el
encabezado entra en el viewport por scroll, hace un fade-in + entrada
horizontal (`translateX`) una única vez — no se repite si se vuelve a
scrollear hacia arriba y abajo. Alternan de lado: 1° y 3°
(`-Datos de registro-`, `-Gastos por categoría-`) entran desde la
izquierda; 2° y 4° (`-Pulso del viaje-`, `-PREVIAS-`) entran desde la
derecha. Implementado con `IntersectionObserver` (sin dependencias
nuevas); respeta `prefers-reduced-motion`. Transición de 1.35s (0.45s
al implementarse en `v0.35.0` → 0.85s en `v0.36.0` → 1.35s en
`v0.37.0`, subida cada vez para que el desplazamiento lateral se
perciba con claridad, sin sentirse brusco ni exagerado), misma curva
`cubic-bezier(0.22, 1, 0.36, 1)`/`ease-out` y mismo desplazamiento
(±16px) de siempre. La animación es exclusiva de estos 4
encabezados — las tarjetas, barras e íconos siguen exactamente con
las animaciones que ya tenían (cascada de entrada, crecimiento de
barras).

## Estadísticas futuras (contenido, no implementado)

Ya implementadas para DÍA y TOTAL (ver ambas secciones "Cálculo
real" más arriba): gasto total, gasto por categoría, participación
en previas, horas dormidas, cantidad de siestas, quinta comida,
veces al baño, tiempo en el boliche.

Todavía no implementado, dentro de la estructura DÍA/TOTAL de
arriba:

- gasto diario como serie temporal (evolución día a día, no un
  día puntual ni el acumulado total)
- hora promedio de salida del boliche
- rankings compuestos y títulos humorísticos
- comparaciones entre participantes más allá del ranking simple
- ranking/título a partir de la encuesta "¿Quién estuvo más
  destruido anoche?" (el voto ya se captura y persiste en Registro
  diario — ver esa sección más arriba —, y ya se lee desde Títulos
  por encuesta; todavía no se lee desde Estadísticas)


## Títulos

Sección **Títulos**, accesible desde /admin → tarjeta "Títulos"
(`#/titulos`), ubicada debajo de "Estadísticas". Exclusiva de Gio:
si otro usuario fuerza el hash `#/titulos` (o el de cualquiera de
sus 3 subsecciones), se lo redirige a `/home`, igual que
`#/admin`/`#/previas`/`#/stats`.

### Estructura

`#/titulos` es un hub con 3 subsecciones, cada una en su propia
pantalla, con su propio botón "volver" hacia el hub (no directo a
Admin, igual que Dinero/Registro diario/Envío de datos vuelven a
Home y no a otro lado):

1. **Títulos por estadística** (`#/titulos-estadistica`, implementado
   — ver más abajo) — la única de las 3 con pestañas **Día / Total**
   (mismo componente `.stats-tabs`/`.stats-tab` que usa Estadísticas,
   con su propio estado independiente `titulosEstadisticaTab`).
2. **Títulos por encuesta** (`#/titulos-encuesta`, implementado —
   ver más abajo) — mismas pestañas **Día / Total** que "Por
   estadística" (estado propio `titulosEncuestaTab`), otorga
   títulos a partir de encuestas votadas por los participantes en
   vez de estadísticas medidas por la app.
3. **Títulos por racha** (`#/titulos-racha`, implementado — ver más
   abajo) — mismas pestañas **Día / Total** (estado propio
   `titulosRachaTab`), otorga títulos a partir de la racha más larga
   de días consecutivos cumpliendo un hábito (ej. ir al boliche
   varios días seguidos).

### Títulos por estadística (implementado — cálculo real)

Cada estadística competitiva que ya calcula la sección Estadísticas
(ver "Cálculo real de DÍA/TOTAL" más arriba) puede generar un
**título** para quien tenga el mejor resultado en esa estadística.
DÍA y TOTAL se mantienen completamente separados, igual que en
Estadísticas:

- **DÍA**: mismo componente de navegación `← día →` que Estadísticas
  (`getStatsClosedDays()`, nunca el día actual ni un día futuro),
  con su propio estado (`titulosEstadisticaDayIndex`,
  independiente de `statsDayIndex`). El título de cada estadística
  se calcula **solamente con los datos disponibles hasta ese día**
  (reutiliza tal cual las mismas funciones `dayRanking*` de
  Estadísticas — `dayRankingHorasDormidas`, `dayRankingSiestas`,
  `dayRankingQuintaComida`, `dayRankingBanio`, `dayRankingBoliche`,
  `dayRankingDineroTotal`, `dayRankingPrevias` — sin duplicar ningún
  cálculo).
- **TOTAL**: misma estructura visual que DÍA (sin flechas, "Todo el
  viaje" + cantidad de días cerrados), acumulando **todos los días
  cerrados disponibles** (reutiliza las funciones `totalRanking*`
  equivalentes de Estadísticas).
- **Datos reales, sin inventar nada**: si una estadística puntual no
  tiene ningún dato cargado en el período mostrado, simplemente no
  genera su tarjeta de título (no se inventa un ganador). Si ninguna
  estadística tiene datos todavía, se muestra el mismo
  `.stats-empty-banner` explicativo que usa Estadísticas cuando no
  hay días cerrados. El saldo inicial nunca se usa ni se muestra.
- **Sistema preparado para agregar/modificar títulos fácilmente**:
  `TITULOS_CONFIG` (`script.js`) es un arreglo de configuración,
  cada entrada `{ icon, accent, title, caption, provisional?, dayFn,
  totalFn }`. Agregar un título nuevo o cambiar el nombre de uno
  existente es sumar/editar una sola entrada — no hay que tocar el
  resto del render (`renderTituloCard`, `renderTitulosCards`,
  `renderTitulosDayReal`/`renderTitulosTotalReal`,
  `renderTitulosEstadisticaPanel`).
- **Títulos provisionales**: los que todavía no tienen nombre
  definitivo llevan `provisional: true` en su entrada de
  `TITULOS_CONFIG` y muestran una etiqueta "Provisional" junto al
  nombre (reutiliza `.soon-tag`). Estado actual:
  - **"El más dormilón"** (horas dormidas) — definitivo, ejemplo
    exacto del pedido original.
  - **"El más gastador"** (dinero gastado total) — definitivo,
    ejemplo exacto del pedido original.
  - "El rey de la siesta" (siestas) — provisional.
  - "El más comilón" (quinta comida) — provisional.
  - "El más urgente" (veces que fue al baño) — provisional.
  - "El más aguante del boliche" (tiempo en el boliche) —
    provisional.
  - "El más previero" (cantidad de previas) — provisional.
- **Diseño (perfiles de jugador, no tarjetas de ranking)**: la
  presentación es deliberadamente distinta a Estadísticas — un
  título es un logro ya obtenido, no una competencia en curso, así
  que no se muestran barras horizontales ni número de puesto. En vez
  de una tarjeta por estadística, se agrupa por jugador
  (`buildTitulosByPlayer()` en `script.js`, sin tocar el cálculo:
  sigue usando `rows[0]` de las mismas `dayFn`/`totalFn` de siempre):
  - Un **perfil por cada jugador que ganó al menos un título** en el
    período mostrado (DÍA o TOTAL), en el mismo orden que
    `PARTICIPANTS`. Cada perfil muestra el nombre del jugador y su
    avatar (mismas iniciales/color que el resto de la app), y debajo
    la lista de títulos que ganó — cada uno con su ícono, nombre del
    título y una descripción de qué estadística ganó (con el valor
    puntual, ej. "Horas dormidas · 8h 40m").
  - Un jugador sin ningún título en el período mostrado **no genera
    perfil** (mismo criterio de "no inventar nada" que ya regía
    para las tarjetas por estadística); no se muestran perfiles
    vacíos.
  - Estética propia: cards blanco/celeste con gradientes fríos y
    filete superior degradé, insignias tipo "trofeo" (ícono en
    medallón con glow del color propio del título) sin exagerar el
    efecto. Misma cascada de entrada (`statsFadeUp`), misma
    navegación Día/Total, mismo `.stats-empty-banner` cuando no hay
    ningún título repartido y misma estética "Bariloche" del resto
    de `/admin` — ver `.titulo-profile-card`/`.titulo-badge` en
    `styles.css`.
  - **Pulido visual final (implementado, `v0.44.0`)**: nombre del
    jugador con más jerarquía (más grande, recorte por ellipsis si es
    largo), avatar más grande con anillo doble, mayor separación
    entre perfiles de jugador, insignias de título con más aire e
    ícono de medallón más grande, watermark de 🏆 muy translúcido
    puramente decorativo, y una nota corta (`.titulos-source-note`)
    arriba de las pestañas Día/Total que aclara en una oración de
    dónde sale el título de esa subsección puntual. Nada de esto
    toca el cálculo: sigue siendo `rows[0]` de las mismas
    `dayFn`/`totalFn` de siempre, y sigue sin haber barras
    horizontales ni número de puesto.
- No se agregaron todavía títulos por categoría de gasto en
  particular ni títulos compuestos entre varias estadísticas (fuera
  de alcance de este pase).

### Títulos por encuesta (implementado — cálculo real)

Títulos que se otorgan a partir de una **votación de los
participantes** (no de una estadística medida por la app). Reutiliza
la misma estructura de pantalla que "Por estadística": pestañas
**Día / Total** (`titulosEncuestaTab`), con su propia barra
`← día →` sobre los mismos días cerrados (`getStatsClosedDays()`,
estado independiente `titulosEncuestaDayIndex`).

- **Encuesta implementada**: "¿Quién estuvo más destruido anoche?"
  (el voto ya se capturaba y persistía en Registro diario —
  `destroyedVote` dentro de `dailyEntries[<fecha>]` de cada
  jugador, ver esa sección más arriba). El título otorgado es
  **"El más destruido"**.
- **Conteo**: para un día puntual, se cuenta un voto por cada
  jugador que ese día haya votado a alguien (`tallyVotesForDay`);
  para TOTAL, se suman los conteos de todos los días cerrados
  disponibles (`tallyVotesForDays`, sin duplicar el cálculo día por
  día). La UI de Registro diario ya excluye la autovotación, así
  que nadie se vota a sí mismo.
- **DÍA**: usa únicamente los votos cargados ese día puntual.
- **TOTAL**: usa la suma de votos de todos los días cerrados del
  viaje.
- **Empates resueltos sin romper la interfaz**: si dos o más
  participantes quedan empatados en la cantidad de votos (en el
  primer puesto), el título se reparte entre **todos** los
  empatados — cada uno recibe su propio perfil con el mismo título
  — en vez de elegir arbitrariamente a uno solo o mostrar un estado
  inconsistente.
- **Sin datos, sin título**: si nadie votó en el período mostrado,
  no se otorga el título (mismo criterio de "no inventar nada" que
  usa "Por estadística"); se muestra el mismo tipo de
  `.stats-empty-banner` explicativo.
- **Misma presentación visual que "Por estadística" — exactamente**:
  reutiliza tal cual `renderTituloProfileCard`/`renderTituloBadge`
  (perfil del jugador con avatar + nombre, lista de insignias con
  ícono/nombre del título/descripción debajo), sin ranking de
  barras ni número de puesto — incluye el mismo pulido visual final
  de `v0.44.0` (ver "Pulido visual final" dentro de "Títulos por
  estadística" más arriba), por ser el mismo componente. Arriba de
  las pestañas Día/Total lleva su propia nota de origen ("🗳️ ...
  encuestas votadas por los participantes...",
  `renderTitulosSourceNote`) para dejar claro que, a diferencia de
  "Por estadística", estos títulos salen de una votación y no de un
  dato medido por la app. Ejemplo:

  ```
  GER
  🏆 El más destruido
    Ganó la votación de "¿Quién estuvo más destruido anoche?" · 3 votos
  ```

- **Preparado para agregar encuestas futuras**: `ENCUESTAS_CONFIG`
  (`script.js`) es un arreglo de configuración, cada entrada
  `{ key, icon, accent, title, caption, dayFn, totalFn }`, igual
  que `TITULOS_CONFIG` de "Por estadística". Agregar una encuesta
  nueva (con su propio campo dentro de `dailyEntries`) es sumar una
  entrada acá; no hace falta tocar el resto del render.
- No se agregaron todavía títulos compuestos entre varias encuestas
  ni encuestas nuevas más allá de "¿Quién estuvo más destruido
  anoche?" (fuera de alcance de este pase).

### Títulos por racha (implementado — cálculo real)

Títulos que se otorgan a partir de la **MEJOR RACHA de días
consecutivos** cumpliendo un hábito — no de un valor puntual de un
día ni de una votación. Misma estructura de pantalla que "Por
estadística"/"Por encuesta": pestañas **Día / Total**
(`titulosRachaTab`), con su propia barra `← día →` sobre los mismos
días cerrados (`getStatsClosedDays()`, estado independiente
`titulosRachaDayIndex`).

- **"Racha" = días consecutivos en el calendario**, no solo índices
  consecutivos dentro de la lista de días cerrados: si hay un día
  sin cerrar en el medio, la racha se corta ahí aunque los dos días
  "cerrados" que lo rodean hayan cumplido el hábito
  (`isNextDayKey`/`longestStreak` en `script.js`).
- **5 tipos de racha implementados** (`RACHAS_CONFIG`), nombres
  **provisionales** (`provisional: true`, misma convención que
  `TITULOS_CONFIG`, fáciles de renombrar más adelante):
  - 🕺 **"Rey de la noche"** — mayor racha de días yendo al boliche
    (`entry.computed.bolicheMinutes` no nulo ese día).
  - 🍔 **"Racha comilona"** — mayor racha de días comiendo quinta
    comida (`entry.fifthMeal === "yes"`).
  - 🚽 **"Intestino de hierro"** — mayor racha de días yendo al baño
    (`entry.bathroom > 0`).
  - 🍫 **"Racha dulce"** — mayor racha de días con al menos un gasto
    en la categoría Chocolates (`dayExpenses()`).
  - 🍷 **"Racha alcohólica"** — mayor racha de días con al menos un
    gasto en la categoría Alcohol (`dayExpenses()`).
- **DÍA**: la racha se calcula con los datos disponibles **hasta ese
  día** (todo el historial desde el principio del viaje hasta el día
  seleccionado en la barra `← día →`, `daysUpTo()`) — a diferencia
  de "Por estadística"/"Por encuesta", donde DÍA usa solo el dato de
  ESE día puntual. Una racha, por definición, necesita el historial
  previo.
- **TOTAL**: la racha se calcula con todo el historial de días
  cerrados del viaje.
- **Sin racha, sin título**: un jugador que nunca cumplió el hábito
  en el período mostrado (racha 0) no entra en el cálculo — no se
  otorga el título (mismo criterio de "no inventar nada" que usan
  "Por estadística"/"Por encuesta"); se muestra el mismo tipo de
  `.stats-empty-banner` explicativo cuando nadie tiene ninguna racha.
- **Empates resueltos correctamente**: si dos o más jugadores quedan
  con la misma racha máxima, el título se reparte entre **todos**
  los empatados — mismo mecanismo que "Por encuesta"
  (`buildTitulosByPlayerAllTiedWinners`, generalizada a partir de la
  función que antes usaba solo "Por encuesta").
- **Misma presentación visual que "Por estadística"/"Por
  encuesta" — exactamente**: reutiliza tal cual
  `renderTituloProfileCard`/`renderTituloBadge` (perfil del jugador
  con avatar + nombre, lista de insignias con ícono/nombre del
  título/descripción debajo), nunca como un ranking de barras —
  incluye el mismo pulido visual final de `v0.44.0`. Arriba de las
  pestañas Día/Total lleva su propia nota de origen ("🔥 ... racha
  más larga de días consecutivos...", `renderTitulosSourceNote`)
  para dejar claro que estos títulos salen de una racha y no de un
  valor puntual ni de una votación. Ejemplo:

  ```
  GER
  🏆 Rey de la noche
    Mayor racha de días yendo al boliche: 4 días
  ```

- **Preparado para agregar tipos de racha futuros**:
  `RACHAS_CONFIG` (`script.js`) es un arreglo de configuración,
  cada entrada `{ key, icon, accent, title, caption, provisional,
  dayFn, totalFn }`, igual que `TITULOS_CONFIG`/`ENCUESTAS_CONFIG`.
  Agregar un tipo de racha nuevo (u otra categoría de gasto) es
  sumar una entrada acá, con su propio `predicate(player, dateKey)`
  — no hace falta tocar el motor de rachas ni el resto del render.
- No se agregaron todavía rachas compuestas entre varios hábitos ni
  categorías de gasto más allá de Chocolates/Alcohol (fuera de
  alcance de este pase).

### Diseño e integración

Las 4 pantallas nuevas (`screen-titulos` y sus 3 subsecciones)
comparten exactamente la estética "Bariloche" blanco/celeste del
resto de /admin (clase `admin-frost`, nieve global, `.admin-hero`,
`.card-list`/`.feature-card`) sin ningún CSS nuevo. Están integradas
al router existente (`screens`, `navigate()`, `routeFromHash()`) y al
bottom nav: quedan como parte del tab "Admin" (igual que
Previas/Estadísticas) y usan la variante clara `.bottom-nav-frost`.

Entrar y salir del apartado (Admin↔Títulos) y navegar entre el hub y
cada subsección usa la misma animación fade + `translateY` que ya
usan Admin↔Previas y Admin↔Estadísticas — la función genérica
`navigateBetweenScreensWithTransition(fromRoute, toRoute)` (ver
"Animaciones de micro-interacción" más abajo). No se creó ninguna
animación nueva.

### Pendiente

- Nombres definitivos para los títulos marcados `provisional: true`
  en `TITULOS_CONFIG` y en `RACHAS_CONFIG` (las 3 subsecciones de
  Títulos ya tienen cálculo real, ver arriba).
- Títulos por categoría de gasto en particular (más allá de
  Chocolates/Alcohol en "Por racha") y títulos compuestos entre
  varias estadísticas o entre varios hábitos de racha.


## Diseño

La aplicación debe sentirse como una aplicación móvil premium.

Características:

- estética cuidada
- identidad visual propia
- navegación vertical
- animaciones sutiles
- elementos que aparecen al hacer scroll
- transiciones
- fondos dinámicos
- buena jerarquía visual
- botones cómodos para tocar

No debe parecer un dashboard administrativo genérico.

No debe existir scroll horizontal.

El contenido debe adaptarse principalmente a aproximadamente 360–430px de ancho.

### Estética "Bariloche" — LOGIN + HOME + navbar/menú de contraseña (implementado)

La pantalla de login (`#screen-select`, "¿Quién sos?"), la Home
(`#screen-home`), la barra de navegación inferior cuando se está en
Home o Admin, y el menú de contraseña del login comparten esta
estética alternativa, distinta del resto de la app (Registro
diario, Envío de datos y el resto de los sheets/pantallas, que
siguen con el tema oscuro original; Dinero también comparte esta
estética, ver más abajo):

- Fondo predominantemente blanco con gradiente suave hacia tonos
  celestes/azules, silueta de montañas nevadas y copos de nieve
  cayendo lentamente (pocos, animación CSS continua, sin bloquear
  los toques sobre las cards ni afectar el rendimiento).
- Grid de participantes en 2 columnas fijas en mobile (antes 3); las
  demás personas aparecen al hacer scroll vertical. Se mantienen
  todos los participantes existentes y la lógica de login intacta.
- Cards de jugador con estética "vidrio" (fondo blanco translúcido,
  sombra celeste, borde sutil) adaptadas al nuevo fondo claro.
- Fondo interactivo con el scroll (parallax sutil): las capas
  decorativas del fondo (glow, montañas, nieve) se desplazan a
  distinta velocidad que el contenido a medida que se recorre la
  lista de jugadores, dando sensación de profundidad. Movimiento
  acotado y suave, sin mover ni deformar las cards ni el texto, que
  permanecen perfectamente legibles y estáticos. Con "reducir
  movimiento" activado en el sistema, o si el navegador no soporta
  el efecto, el fondo se muestra estático (mismo resultado visual
  que sin el parallax).
- Título grande “BARILOCHE” detrás de las montañas
  (`.login-title-bg`): tipografía display, degradé de texto en los
  mismos tonos celeste/blanco del fondo, protagonista de la pantalla
  inicial. Vive en el DOM antes que las montañas dentro del mismo
  contenedor de fondo y ninguno de los dos elementos tiene `z-index`
  propio, así que el orden de pintado natural hace que las montañas
  lo tapen parcialmente de verdad (no que simplemente quede ubicado
  debajo). Tiene su propia velocidad de parallax (más lenta que las
  montañas, para dar sensación de estar más atrás) y respeta
  `prefers-reduced-motion` igual que el resto de las capas. No
  intercepta toques (`pointer-events: none`) ni es seleccionable.

Este cambio alcanza a login y Home (comparten la clase
`.login-screen` y el mismo markup de fondo — `.login-glow`,
`.login-title-bg`, `.login-mountains`, `.login-snowfall` —, y el
mismo `updateLoginParallax()`, que ahora opera sobre cualquiera de
las dos pantallas según cuál esté activa). Registro diario conserva
el tema oscuro sin modificaciones. Dinero y Envío de datos pasaron a
compartir la paleta blanco/celeste (ver «Estética "Bariloche" —
Dinero (implementado)» y «Estética "Bariloche" — Envío de datos
(implementado)» más abajo).

### Nieve global en toda la web (implementado)

Además de la nieve con parallax de LOGIN/Home (`.login-snowfall`,
descripta arriba) y sin reemplazarla, existe una capa de nieve
ambiental **global**, presente en absolutamente todas las pantallas
de la app (login, Home, Dinero, Registro diario, Envío de datos,
/admin, Previas de admin, Estadísticas, Previas de Jere) — no solo
en login y Home.

- Un único componente reutilizado (`#global-snowfall` en
  `index.html`, con el mismo estilo visual — círculos blancos con
  glow, misma animación `login-snow-fall` — que la nieve de
  LOGIN/Home): `script.js` lo reubica como **primer hijo** de la
  pantalla que pasa a estar activa en cada navegación
  (`showScreen()`), en vez de duplicar el markup/CSS en cada
  sección. Es el mismo nodo del DOM moviéndose de pantalla en
  pantalla, nunca una copia — así se cumple "único efecto global"
  sin tocar la arquitectura de rutas existente.
- Cubre siempre el alto completo del viewport (`position: fixed`,
  no solo la franja superior) y sigue cayendo sin interrupciones
  mientras se hace scroll, ya que no está atada al scroll de ninguna
  pantalla (a diferencia del parallax de `.login-snowfall`, que sí
  reacciona al scroll de login/Home — son capas totalmente
  independientes entre sí).
- Siempre queda **detrás de todo el contenido real** (headers,
  cards, botones, inputs, textos, bottom nav, bottom sheets) y nunca
  intercepta toques (`pointer-events: none` en el contenedor): al
  ser el primer hijo de la pantalla activa, el resto del contenido
  de esa pantalla —que sigue después en el DOM— siempre pinta por
  encima. El bottom nav y los bottom sheets no son hijos de
  `.screen` y mantienen sus propios `z-index` ya existentes, así que
  quedan intactos y por encima de la nieve sin ningún cambio.
- Sutil por diseño: pocos copos (16), tamaños y velocidades
  variados, con `prefers-reduced-motion` respetado (misma regla ya
  existente para `.snowflake`, sin agregar nada nuevo). Pensada para
  rendimiento en celulares: sin JavaScript por frame (la caída es
  pura animación CSS, igual que en LOGIN/Home), un único reflow
  puntual al navegar (mover el nodo, no crear/destruir nada).
- No modifica ningún dato, `localStorage`, cálculo ni ruta: es un
  cambio puramente visual/decorativo.



Admin (`#/admin`), Previas de admin (`#/previas`) y Estadísticas
(`#/stats`) comparten también la paleta blanco/celeste fría de
LOGIN/Home, vía una clase `admin-frost` agregada a cada `<section>`
en `index.html`. Dinero, Previas del Home de Jere (`#/previas-jere`),
Envío de datos (`#/export`) y Registro diario (`#/daily`) también
comparten esta paleta (ver «Estética "Bariloche" — Dinero
(implementado)», «Estética "Bariloche" — Previas de Jere
(implementado)», «Estética "Bariloche" — Envío de datos
(implementado)» y «Estética "Bariloche" — Registro diario
(implementado)» más abajo). Ya no queda ninguna pantalla logueada con
el tema oscuro original.

- La mayoría de los componentes de /admin (tarjetas, filas de
  jugadores, chips, inputs, tarjetas de ranking) ya estaban armados
  sobre las variables de color compartidas (`--bg`, `--surface`,
  `--border`, `--text`, `--accent`, etc.), así que redefinir esas
  variables dentro del scope `.screen.admin-frost` alcanza para que
  hereden el nuevo look sin reescribir cada clase.
- Se sobreescriben explícitamente los pocos lugares que usaban el
  acento ámbar "a fuego" en vez de una variable: la cabecera
  (`.admin-hero`, mismo tipo de glow celeste que ya usa `.home-hero`,
  **sin duplicar montañas ni nieve** — a propósito, para no saturar
  una pantalla de trabajo administrativo), los botones "Actualizar
  código"/"+ Agregar jugador", el tab activo Día/Total de
  Estadísticas, el podio del 1er puesto de cada ranking, los chips
  seleccionados y los avisos (`.admin-notice`).
- Los bottom sheets abiertos desde /admin (pegar código de
  jugador/previa, producto de previa, confirmar previa) reutilizan la
  misma variante `.sheet-frost` que ya existía para el sheet de
  contraseña del login: `openSheet()` la aplica también cuando la
  pantalla activa tiene la clase `admin-frost`, sin necesidad de
  listar cada `type` de sheet a mano ni afectar los mismos sheets
  cuando se abren desde `#/previas-jere` (que no lleva esa clase).
- `bottom-nav-frost` (la variante celeste de la barra inferior) se
  extiende a las rutas `previas` y `stats`, además de `home`/`admin`
  ya existentes.

Ningún cálculo, dato, permiso ni `localStorage` cambió: es
exclusivamente una capa de presentación sobre las mismas pantallas y
componentes ya documentados en el resto de este archivo (Jugadores
importados, Previas, Estadísticas).

En Home, el saludo (`.home-hero-bottom`) baja debajo de la línea de
las montañas (mismo criterio que `.login-content` en el login) para
no competir visualmente con el título "BARILOCHE", y las 3 tarjetas
de sección (`#screen-home .feature-card`) pasan a un estilo
"vidrio" — mismos valores que las cards de jugador del login — con
bastante más padding e ícono más grande, para aprovechar mejor el
alto de pantalla en mobile. Se mantienen las mismas 3 secciones
(Dinero, Registro diario, Envío de datos), la sección condicional
de Previas y toda su funcionalidad/navegación.

La barra de navegación inferior (`#bottom-nav`) es un único
componente compartido por todas las pantallas logueadas. En vez de
restylear la clase base, se agregó la variante `.bottom-nav-frost`
(gradiente blanco/celeste, mismos tonos que Home/login), que
`navigate()` togglea cuando la pantalla activa es Home, Admin,
Dinero, Registro diario, Envío de datos, Previas (de admin o de Jere)
o Estadísticas; es decir, en todas las pantallas logueadas.

**Glassmorphism reforzado (implementado):** tanto `.bottom-nav`
(estilo oscuro) como `.bottom-nav-frost` (estilo celeste) usan un
fondo bastante más transparente que antes (`rgba(21, 21, 31, 0.55)` /
`rgba(255, 255, 255, 0.55)` → `rgba(234, 246, 255, 0.55)`, antes
0.88/0.92 respectivamente) combinado con `backdrop-filter: blur(28px)
saturate(160%)` (antes `blur(14px)`, sin `saturate`), para que el
contenido detrás de la navbar se note claramente desenfocado en vez
de tapado por un fondo casi opaco. El color de los íconos/textos
(`--text-faint`/`--accent` en modo oscuro, `#4d6b82`/`#2f8fd1` en modo
frost) no cambió, así que la legibilidad de los elementos de
navegación se mantiene sobre cualquier fondo. Efecto aplicado a las
navbars de todas las pantallas logueadas (usuarios y admin), sin
tocar `navigate()`, rutas ni ninguna otra funcionalidad.

El bottom sheet genérico (`#sheet`, compartido por todos los
formularios de la app) tiene, del mismo modo, una variante
`.sheet-frost` que `openSheet()` togglea solo para el sheet de
contraseña de login (`login-password`): fondo con gradiente
blanco→celeste, título/subtítulo y borde de foco en los mismos
tonos que el resto de la estética "Bariloche". El resto de los
sheets (gasto, ganancia, saldo inicial, producto de previa, etc.)
no se ve afectado.

En ese mismo sheet, el input de contraseña dejó de mostrar un
`placeholder="••"` (que insinuaba la cantidad de dígitos
esperados). El input real sigue siendo el que recibe foco y
teclado — la lógica de `checkLoginPassword()` no cambió — pero su
texto queda invisible; encima se dibuja un punto por cada carácter
ya escrito (ninguno al abrir el sheet), que se limpia si la
contraseña resulta incorrecta. Los puntos representan únicamente lo
que la persona ya tipeó, nunca la longitud requerida.

### Estetica "Bariloche" — Dinero (implementado)

La seccion Dinero (`#screen-money`) tambien comparte la paleta
blanco/celeste de LOGIN/Home/Admin, sumando la misma clase
`admin-frost` a su `<section>` en `index.html`. En ese momento,
Registro diario (`#screen-daily`), Envio de datos (`#screen-export`)
y Previas de Jere (`#screen-previas-jere`) **no** se tocaron: seguian
con el tema oscuro original (ver mas abajo el detalle de cuando cada
una se sumo a la estetica Bariloche).

- `.money-hero` ya reutilizaba `.admin-hero`, y el resto de los
  componentes de Dinero (dona, prompt de saldo inicial, tarjeta de
  acciones, historial) ya estaban construidos sobre las variables de
  color compartidas, asi que heredan el nuevo look sin reescribir
  esas clases.
- La dona (`.donut-progress`) conserva exactamente el mismo SVG, el
  mismo calculo de `stroke-dasharray`/`stroke-dashoffset` y sus
  extremos redondeados (`stroke-linecap: round`, ver v0.20.1 en
  `CHANGELOG.md`); solo cambia de color porque `--accent` pasa a ser
  celeste dentro del scope `admin-frost`.
- Se suma un tratamiento "vidrio" (blur + sombra celeste) a la
  tarjeta de la dona, al prompt de saldo inicial y a las filas del
  historial, para que se lean como un mismo bloque visual; y se
  recolorean los botones - Gasto/+ Ganancia y los montos del
  historial (antes fijos en rosa/celeste "a fuego") para mantener
  buen contraste sobre fondo blanco.
- Como `openSheet()` ya aplicaba `sheet-frost` a cualquier sheet
  abierto desde una pantalla `admin-frost`, los sheets de saldo
  inicial, gasto, ganancia y editar/eliminar movimiento heredan esa
  variante automaticamente.

Ningun calculo, dato ni `localStorage` cambio: es exclusivamente
una capa de presentacion sobre la misma seccion Dinero ya
documentada mas arriba.

### Estética "Bariloche" — Previas de Jere (implementado)

La sección de Previas del Home de Jere (`#screen-previas-jere`,
`#/previas-jere`) comparte la misma paleta blanco/celeste fría de
LOGIN/Home/Admin/Dinero, sumando la clase `admin-frost` a su
`<section>` en `index.html` (mismo mecanismo que el resto de las
pantallas con esta estética). Antes era la única pantalla logueada
que quedaba con el tema oscuro original fuera de Registro diario y
Envío de datos; ahora solo esas dos conservan el tema oscuro.

- Como `renderPreviasScreen()` ya arma el mismo formulario que usa
  `#/previas` de admin (chips de participantes, alta de productos,
  resumen en vivo, historial), y todos esos componentes
  (`.feature-card`, `.chip`, `.field-input`, `.previa-product-row`,
  `.admin-preview-card`, etc.) ya estaban construidos sobre las
  variables de color compartidas, heredan el nuevo look en cascada
  sin tocar `previaMode` ni ninguna otra lógica de `script.js`.
- Como `openSheet()` ya aplicaba `sheet-frost` a cualquier sheet
  abierto desde una pantalla `admin-frost`, los sheets propios del
  modo local de Jere (agregar producto, confirmar previa, "Código de
  la previa") pasan a usar esa variante automáticamente. Se sumó una
  única regla nueva, `.sheet.sheet-frost .export-code-box` (mismo
  tratamiento que `.admin-import-textarea`), porque el cuadro de
  código de "Código de la previa" no estaba cubierto todavía por
  `.sheet-frost` y quedaba oscuro dentro de un sheet claro.
- La barra de navegación inferior (`#bottom-nav`) pasa a usar también
  la variante `.bottom-nav-frost` dentro de `#/previas-jere` (antes
  solo Home/Admin/Dinero/Previas/Estadísticas); `navigate()` suma
  `route === "previas-jere"` a esa condición.
- Ningún cálculo, dato, `localStorage` (sigue en
  `localPrevias:<id>`) ni comportamiento cambió: es exclusivamente
  una capa de presentación sobre la misma pantalla ya documentada en
  "Permiso especial: Jere puede registrar previas" más arriba.

### Estética "Bariloche" — Envío de datos (implementado)

La sección **Envío de datos** (`#screen-export`, `#/export`) comparte
también la paleta blanco/celeste fría de LOGIN/Home/Admin/Dinero/
Previas, sumando la clase `admin-frost` a su `<section>` en
`index.html` (mismo mecanismo que el resto de las pantallas con esta
estética). Junto con Dinero, Previas de admin, Previas de Jere,
Admin y Estadísticas, deja a Registro diario como la única pantalla
logueada que conserva el tema oscuro original.

- `renderExportScreen()` sigue armando exactamente el mismo markup
  (`.daily-section`, `.export-hint`, `.export-code-box`,
  `.sheet-cancel-link` para "Copiar código", `.daily-save-msg` para
  la confirmación de copiado, `.sheet-submit.whatsapp-btn` para
  "Enviar datos a un admin"); como esas clases ya estaban construidas
  sobre las variables de color compartidas (`--surface`, `--surface-2`,
  `--border`, `--text*`, `--accent`), heredan el nuevo look en
  cascada sin reescribirlas. `generateExportCode`, `copyExportCode`,
  `fallbackCopy` y `buildWhatsappUrl` no se tocaron.
- Se sumó `.daily-section` (dentro del scope `.screen.admin-frost`) al
  mismo tratamiento "vidrio" (`backdrop-filter: blur` + sombra
  celeste) que ya usan `.donut-card`/`.money-prompt`/`.history-row`
  en Dinero, para que la tarjeta que contiene el código se lea como
  parte del mismo lenguaje visual; como la regla está scoped a
  `admin-frost`, no afecta la misma clase `.daily-section` reutilizada
  por Registro diario (que no lleva esa clase).
- El botón **"Enviar datos a un admin"** conserva su verde de marca
  de WhatsApp (`.whatsapp-btn`, sin cambios) tanto en el tema oscuro
  como en el nuevo tema claro, igual que el resto de la app no toca
  colores de marcas externas.
- La barra de navegación inferior (`#bottom-nav`) pasa a usar también
  la variante `.bottom-nav-frost` dentro de `#/export` (antes solo
  Home/Admin/Dinero/Previas/Estadísticas); `navigate()` suma
  `route === "export"` a esa condición.
- Ningún dato, código de exportación, formato ni `localStorage`
  cambió: es exclusivamente una capa de presentación sobre la misma
  pantalla ya documentada en "Código de intercambio (implementado)"
  más arriba.

### Estetica "Bariloche" — Registro diario (implementado)

La sección **Registro diario** (`#screen-daily`, `#/daily`) suma
tambien la clase `admin-frost` a su `<section>` en `index.html`
(mismo mecanismo que el resto de las pantallas con esta estética).
Era la unica pantalla logueada que quedaba con el tema oscuro
original; ahora todas las pantallas logueadas (Login, Home, Dinero,
Registro diario, Envio de datos, Previas de admin, Previas de Jere,
Admin, Estadisticas) comparten la misma paleta blanco/celeste fria.

- `.daily-hero` ya reutilizaba `.admin-hero`, y el resto de los
  componentes de Registro diario (`.daily-date-banner`,
  `.daily-section`, `.chip`/`.chip-group`, `.picker-block`,
  `.field-label`, `.sheet-cancel-link`, `.sheet-submit`) ya estaban
  construidos sobre las variables de color compartidas, asi que
  heredan el nuevo look en cascada sin reescribir esas clases.
- Se suma el mismo tratamiento "vidrio" (blur + sombra celeste) que
  ya usan `.donut-card`/`.money-prompt`/`.history-row`/`.daily-section`
  (en Envio de datos) a `.daily-date-banner` y `.daily-total-sleep`,
  para que se lean como parte del mismo bloque visual.
- Se recolorean a celeste/rosa de contraste los pocos elementos que
  usaban `--accent-2` (cian) o rosa "a fuego" fijos, pensados para
  fondo oscuro y con bajo contraste sobre fondo blanco: la hora
  seleccionada en cada selector horizontal (`.time-option.selected`),
  los toggles "No dormi" / "No fui al boliche" activados
  (`.toggle-chip.selected`), el boton "+ Registrar siesta"
  (`.add-nap-btn`), los textos calculados de duracion
  (`.daily-computed`, `.daily-total-sleep strong`) y el mensaje de
  confirmacion al guardar (`.daily-save-msg`).
- La barra de navegacion inferior (`#bottom-nav`) pasa a usar tambien
  la variante `.bottom-nav-frost` dentro de `#/daily` (antes era la
  unica pantalla logueada que la dejaba con el tema oscuro);
  `navigate()` suma `route === "daily"` a esa condicion.
- Ningun horario, calculo derivado (sueno, siesta, tiempo en el
  boliche), entrada de `dailyLog.entries` ni `localStorage` cambio:
  es exclusivamente una capa de presentacion sobre la misma seccion ya
  documentada en "Registro diario" mas arriba.

### Animaciones de micro-interacción (implementado, pruebas puntuales)

Pruebas aisladas de animación, pensadas para evaluar si se extiende
el mismo lenguaje de movimiento al resto de la web. Ambas usan
únicamente `transform` + `opacity` (mobile-first, sin reflow) y
respetan `prefers-reduced-motion`.

- **Transición Login → Home / Home ↔ Dinero / Registro diario / Envío
  de datos / Previas de Jere / Admin / Admin ↔ Previas / Admin ↔
  Estadísticas / Admin ↔ Títulos / Títulos ↔ sus 3 subsecciones / Home
  → Login (Cerrar sesión)** (`v0.26.0`, timing y
  color de fondo ajustados en `v0.29.0`, extendida a Registro diario y
  Envío de datos en `v0.30.0`, a Login → Home en `v0.31.0`, a la
  vuelta Dinero/Registro diario/Envío de datos → Home en `v0.32.0`, a
  Home ↔ Admin, Admin ↔ Previas, Admin ↔ Estadísticas y Home ↔ Previas
  de Jere en `v0.33.0`, al ícono "admin" del bottom nav desde
  Previas/Estadísticas y a Cerrar sesión en `v0.34.0`, y a Admin ↔
  Títulos junto con Títulos ↔ "Por estadística"/"Por encuesta"/"Por
  racha" (hub y las 3 subsecciones) en `v0.38.0`): al pulsar
  `#card-money`, `#card-daily`, `#card-export` o `#card-previas-jere`
  desde Home; al pulsar el ícono "admin" del bottom nav desde Home,
  Previas, Estadísticas, Títulos o cualquiera de sus 3 subsecciones;
  al pulsar `#card-admin-previas`, `#card-admin-stats` o
  `#card-admin-titulos` desde Admin; al pulsar
  `#card-titulos-estadistica`, `#card-titulos-encuesta` o
  `#card-titulos-racha` desde Títulos; al ingresar la contraseña
  correcta en el selector de usuario (Login → Home); al pulsar
  "Cerrar sesión" desde Home; o al volver de cualquiera de esas
  secciones (botón "volver" de cada pantalla, o ícono "home"/"admin"
  del bottom nav según corresponda), la pantalla de origen hace
  fade-out +
  `translateY(-10px)` (100ms) y, justo después, la pantalla destino
  hace fade-in + `translateY(10px→0)` (100ms), ambas con una curva
  `cubic-bezier` suave (`0.4, 0, 1, 1` de salida / `0, 0, 0.2, 1` de
  entrada) en vez de `ease-out`. Mientras dura la transición, `#app`
  (clase `home-money-transition-bg`, agregada/quitada por la función
  genérica `navigateBetweenScreensWithTransition(fromRoute, toRoute)`,
  de la que `navigateHomeToScreenWithTransition(route)`,
  `navigateSelectToHomeWithTransition()` y
  `navigateScreenToHomeWithTransition(fromRoute)` son wrappers)
  muestra el mismo celeste claro (`#eaf6ff`) que ya usan de fondo
  todas las pantallas logueadas y el login, en vez de su `var(--bg)`
  oscuro por defecto, para que no se vea un parpadeo oscuro entre
  medio — el efecto se siente como que el contenido se borra y
  aparece otro, no como una pantalla negra intermedia. Todas las
  pantallas involucradas comparten timing, curva y color porque
  todas comparten `.admin-frost` (o `.login-screen` en el caso de
  Login/Home/Select). Acotada exclusivamente a las navegaciones
  puntuales listadas arriba — el resto de las transiciones entre
  pantallas (back del navegador) siguen siendo instantáneas; cualquier
  apartado nuevo que se agregue a futuro no lleva esta animación
  salvo que se sume explícitamente.
- **Saludo de Home (`v0.27.0`, rediseño visual y saludo aleatorio en
  `v0.28.0`)**: al entrar a Home, "Hola,", el nombre del usuario y un
  remate/pregunta entran con una secuencia escalonada — "Hola," y el
  remate desde la izquierda (`translateX(-48px) → 0`), el nombre con
  sensación de profundidad (`translateX(40px) scale(0.82) →
  translateX(0) scale(1)`), delays 0/160/340ms, ≈760ms en total. Se
  reinicia en cada entrada real a Home (no en cada micro-render)
  reiniciando la clase `.home-greeting-animate` desde `renderHome()`.
  Los 3 textos tienen tipografía y color propios (`.home-greet-hola`,
  `.home-greet-name`, `.home-greet-question`), más claros y con mejor
  jerarquía que el tratamiento genérico de `.eyebrow` que usaban
  antes, dentro de la misma paleta celeste/azul de la estética
  "Bariloche". El remate ya no es fijo: `renderHome()` sortea, cada
  vez que se entra a Home, una de 8 variantes
  (`HOME_GREETING_QUESTIONS` en `script.js`: "¿Como estás?", "¿Todo
  bajo control?", "¿Todo bien?", "¿hoy sale previa?", "¿se viene algo
  bueno?", "¿seguimos vivos?", "¿qué tal tu dia?", "¿disfrutando
  barilo?") y la escribe en `.home-greet-question` antes de disparar
  la animación. No se persiste en `localStorage`; es puramente de
  sesión/render.

## Arquitectura

Mantener el proyecto simple.

Evitar dependencias innecesarias y sobreingeniería.

La arquitectura debe permitir agregar las funcionalidades futuras sin rehacer completamente el proyecto.

## Reglas para IA

Antes de modificar el proyecto:

1. Leer SPEC.md.
2. Leer CURRENT_STATE.md.
3. Revisar el código existente.
4. Mantener funcionalidades existentes.
5. No implementar funcionalidades futuras sin solicitarlo.
6. No introducir backend/API sin autorización.
7. Priorizar mobile.
8. No crear archivos innecesarios.
9. Mantener el código limpio.
10. Actualizar CURRENT_STATE.md y CHANGELOG.md cuando corresponda.