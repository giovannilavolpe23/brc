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

Secciones futuras:

- Dinero
- Registro diario
- Envío de datos

El usuario registrará principalmente los datos del día anterior al despertarse.

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

Debajo de la lista hay dos botones, ambos abren el mismo bottom sheet
con un campo de texto para pegar el código y un botón "Importar":

- **"Actualizar código"** (botón general, único, `adminImportMode =
  "update-code"`): no apunta a ningún jugador de antemano.
- **"+ Agregar jugador"** (`adminImportMode = "add"`): pensado para
  el primer import de un jugador.

### Flujo común de importación

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
5. A partir de acá el comportamiento difiere según el botón usado:
   - **"Actualizar código"**: identificado el jugador, se pasa
     directo a la previsualización, exista o no ya una entrada previa
     en `adminPlayers` para ese id (upsert).
   - **"+ Agregar jugador"**: si `payload.user` **ya existe** en
     `adminPlayers`, no se duplica ni se actualiza desde acá: se
     muestra el aviso "`<Nombre>` ya está cargado" indicando que hay
     que usar el botón "Actualizar código" en su lugar, y se cierra
     sin tocar nada. Si no existía, sigue a la previsualización.
6. La previsualización es de solo lectura y muestra: nombre resuelto
   del jugador, cantidad de gastos, cantidad de ganancias y cantidad
   de registros diarios contenidos en el código. **No muestra el
   saldo inicial** (ver "Saldo inicial — privado" más abajo).
7. Solo al tocar "Confirmar importación"/"Confirmar actualización" se
   escribe efectivamente en `adminPlayers` (función
   `confirmAdminImport`). Cancelar en cualquier paso anterior no deja
   rastro.

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
actualiza su fila existente; intentarlo con "+ Agregar jugador" avisa
y no hace nada.

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
nombre, "Última actualización: ..." o "Sin datos importados"), botón
"Actualizar código" y botón "+ Agregar jugador" debajo. Mismo lenguaje
visual que el resto de la app (bottom sheet, tarjetas oscuras, acento
ámbar), sin convertir /admin en un dashboard.

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
8. **Cantidad de previas** — de `adminPrevias`, se cuentan todas las
   previas cuyo día de viaje atribuido (`isoToTripDayKey(p.createdAt)`)
   cae en algún día cerrado, y cuántas veces aparece cada jugador
   dentro de `participantIds` en total.

Verificado con un caso de dos días cerrados y tres jugadores con
datos parciales (algún día sin ciertos campos, un jugador que solo
registró un día) que cada suma/cuenta acumula correctamente y que un
jugador sin ningún día con determinado dato no aparece en esa
tarjeta puntual.

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