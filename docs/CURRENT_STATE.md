# CURRENT STATE

## Versión

v0.16.2 — Fix visual: fecha de "Registrando el día de ayer" no se actualizaba con `day()`

## v0.16.2 — Fix visual: fecha de "Registrando el día de ayer" no se actualizaba con `day()`

Bug encontrado al testear v0.16.1: el banner de `#/daily` (Registrar
datos) seguía mostrando la fecha con la que se había entrado a la
pantalla la primera vez, aunque después se ejecutara `day(dia, mes)`
para simular otra fecha.

Causa: `renderDailyScreen()` calculaba `dailyDateKey` una sola vez
por sesión (`if (dailyDateKey === null) { ... }`) y lo guardaba en
una variable de módulo para no perder los datos que el usuario
estuviera completando. Como `refreshCurrentScreenForDaySim()` (v0.16.1)
sí volvía a llamar a `renderDailyScreen()`, pero `dailyDateKey` ya
no era `null`, la función nunca volvía a leer `getYesterdayKey()` y
el texto quedaba pegado a la primera fecha.

Fix, sólo en `renderDailyScreen()`:

```js
const freshDailyDateKey = getYesterdayKey();
if (dailyDateKey === null || dailyDateKey !== freshDailyDateKey) {
  dailyDateKey = freshDailyDateKey;
  const data = ensureDailyLogData(user.id);
  const existing = data.dailyLog.entries[dailyDateKey];
  dailyState = existing ? JSON.parse(JSON.stringify(existing)) : defaultDailyEntry();
}
```

Ahora la clave se recalcula en cada render comparándola contra la
fecha interna actual (`getYesterdayKey()` → `getSimulatedToday()`):
si cambió (por `day()`), se actualiza el texto y se recarga el
registro guardado de ese nuevo día; si no cambió, se preserva
`dailyState` tal cual estaba (no se pisa lo que el usuario esté
completando sin guardar todavía).

El texto (`formatDailyDate(dailyDateKey)`) nunca tuvo ni tiene una
fecha hardcodeada: siempre sale de la fecha interna de la app.

Importante para quien testee con `day()`: el banner sigue diciendo
"el día de **ayer**", es decir, muestra la fecha simulada **menos
un día** (así funcionó siempre Registro diario — se registra lo de
ayer, no lo de hoy). Ejemplo real:

```
day(14, 9)  →  "Registrando el día de ayer — Domingo, 13 de septiembre"
day(15, 9)  →  "Registrando el día de ayer — Lunes, 14 de septiembre"
day()       →  vuelve a la fecha real del dispositivo, sin refresh
```

No se modificó ninguna otra funcionalidad de Registro diario (picks
de sueño/siesta/boliche, guardado en `localStorage`, etc.), ni la
fecha de inicio del viaje (sigue sin configurarse — pendiente).

## v0.16.1 — `day()` actualiza la UI al instante, sin refresh

`day(dia, mes)` y `day()` / `day("reset")` ahora, además de cambiar
`__simulatedDate`, llaman a `refreshCurrentScreenForDaySim()`, que
re-ejecuta `navigate(routeFromHash())` — el mismo mecanismo que usa
el router al cambiar de pantalla — para forzar el re-render
inmediato de la sección visible en ese momento (Home, Registro
diario, Estadísticas, etc.) con la nueva fecha simulada ya aplicada.
No hace falta recargar la página ni volver a navegar manualmente:
el cambio se ve reflejado apenas se ejecuta `day(...)` en la
consola. Si no hay sesión iniciada, no hace nada (no hay pantalla
que refrescar).

## v0.16.0 — Herramienta de testing: simulación de fecha (`day()`)

Se agregó una función **exclusiva para testing manual**, disponible
en `window.day` (consola del navegador), que permite simular qué
fecha considera "hoy" la app sin tocar el reloj del sistema.

Uso desde la consola:

```
day(14, 9)     // simula el 14/09 del año actual
day(15, 9)
day(16, 9)
day()          // vuelve al modo normal (fecha real)
day("reset")   // ídem
```

Implementación (`script.js`):

- `let __simulatedDate` guarda la fecha simulada (o `null` si está
  desactivada).
- `getSimulatedToday()` devuelve `__simulatedDate` si está seteada,
  o `new Date()` si no — es el único punto de lectura de "hoy" para
  la lógica de día de viaje.
- `getYesterdayKey()` (Registro diario) y `todayKey()` (Estadísticas
  → día cerrado) ahora usan `getSimulatedToday()` en vez de
  `new Date()` directo. Son las dos únicas funciones cuyo resultado
  depende del día del viaje, así que activar `day()` afecta:
  - qué fecha se le asocia al registro diario que se está cargando,
  - qué días aparecen como "cerrados" en Estadísticas (y la
    atribución de gastos/previas a esos días).
- **No afecta** timestamps reales (`createdAt`, `date` de
  movimientos/previas cargados), que siguen usando `new Date()` sin
  intervención: la app sigue sabiendo cuándo se cargó cada cosa
  realmente. La simulación solo cambia qué día se considera "hoy" a
  efectos de clasificación, no el reloj real.
- No persiste: al recargar la página vuelve solo a fecha real
  (`__simulatedDate` es una variable en memoria, no se guarda en
  `localStorage`).

Es exclusivamente una herramienta de QA — no se expone ninguna UI
para esto y no está pensada para usarse con el grupo en producción.

## v0.15.0 — Pulido visual de Estadísticas (segunda pasada)

Solo presentación dentro de `#/stats`: **ningún cálculo, fuente de
datos, estructura de `localStorage`, día cerrado, categoría, previa o
formato de código cambió.** Las funciones `dayRanking*` /
`totalRanking*` (y las de v0.14.0) están intactas; solo se tocó cómo
`renderRankingBars`/`renderRankingCard` arman el HTML/clases y el CSS
asociado.

- **Separación y espaciado**: `.stats-real-list` pasa de 10px a 20px
  de espacio entre tarjetas; header de cada tarjeta con línea
  divisoria propia y más aire (`padding-bottom` + `border-bottom`)
  antes del ranking.
- **Jerarquía de título/subtítulo**: título de competencia más grande
  (16px, peso 800) y la leyenda (antes gris parejo) ahora toma el
  color de acento propio de cada estadística, para que se lea como
  parte del mismo bloque en vez de un dato suelto. Filete superior de
  2px con el color de acento en cada tarjeta (`--ranking-accent`,
  pasado desde `renderRankingCard` sin tocar los datos).
- **Podio del 1er puesto**: se agrega un tag "1er puesto" (antes solo
  el nombre con un "1° " chico delante), nombre en su propia línea
  (ya no compite con el valor por espacio), barra ganadora más alta
  (20px) con un destello (`ranking-bar-shine`) que la recorre una vez
  al terminar de crecer.
- **Plata/bronce diferenciados**: 2° y 3° puesto ahora tienen tinte
  propio en nombre y barra (gris plateado / cobre-bronce) en vez de
  compartir el mismo color que el resto de la lista; el resto (4° en
  adelante) usa una insignia circular con el número.
- **Números y unidades**: valores del ranking en negrita (antes
  regular) para que se lean más rápido; se mantiene `tabular-nums` en
  todos.
- **Transiciones**: la animación de cambio de día ahora combina
  desplazamiento + una leve escala (antes solo desplazamiento); sigue
  respetando `prefers-reduced-motion`.
- **Estados sin datos rediseñados**: el mensaje "Sin días cerrados
  todavía" pasa de párrafo suelto a una tarjeta con ícono y borde
  punteado (`.stats-empty-banner`); el "Sin datos para este día" de
  una tarjeta puntual pasa de texto plano a un bloque centrado con
  ícono (`.ranking-empty-state`), coherente con el resto del diseño.
- **Menos saturación visual**: además del mayor espaciado entre
  tarjetas, se agregó un punto de acento junto a "ESTADÍSTICAS DEL
  DÍA"/"ESTADÍSTICAS TOTALES" para separar mejor esa etiqueta del
  contenido de arriba (nav de día/tabs).

Verificado con Playwright: capturas en 360px y 390px con datos de
prueba (varios jugadores, DÍA y TOTAL, nombres largos, estado sin
días cerrados) — sin scroll horizontal en ningún caso, ellipsis
correcto en podio y filas incluso con nombres largos, y el bug fix de
v0.14.0 (Dinero/Previas mostrando datos reales) sigue funcionando
igual con la nueva presentación.


## v0.14.0 — Bug corregido: atribución de día para Dinero y Previas

Las tarjetas **Dinero gastado total**, **Dinero gastado por
categoría** y **Cantidad de previas** (DÍA y TOTAL) mostraban "Sin
datos para este día"/"Sin datos en todo el viaje" aunque hubiera
gastos y previas reales cargados. No se creó ninguna estructura de
datos nueva: siguen leyendo exclusivamente `adminPlayers[*].data.movements`
y `adminPrevias`, igual que antes.

**Causa:** un gasto o una previa se guarda con la fecha/hora **real**
de carga (`new Date().toISOString()`). Un "día cerrado" (`getStatsClosedDays()`)
es siempre estrictamente anterior a hoy (`key < todayKey()`). El
código anterior comparaba la fecha de carga tal cual
(`isoToLocalDateKey`) contra `dateKey`: como casi todo se carga el
mismo día en que se registra (o, peor, ese mismo día es "hoy" y por
definición nunca puede ser un día cerrado), la comparación
prácticamente nunca coincidía y el ranking quedaba vacío.

**Corrección:** igual que Registro diario, que siempre trabaja sobre
"el día anterior" (`getYesterdayKey()`, porque el usuario carga los
datos de ayer al despertarse), ahora se atribuye cada gasto/previa al
día calendario **anterior** a su fecha real de carga. Nueva función
`isoToTripDayKey(isoString)` (reemplaza a `isoToLocalDateKey`, que ya
no se usa) en los cuatro cálculos que la necesitan: `dayExpenses`,
`dayRankingPrevias`, `totalExpenses`, `totalRankingPrevias`. El resto
de las funciones (`dayRankingDineroTotal`, `dayRankingDineroPorCategoria`,
`totalRankingDineroTotal`, `totalRankingDineroPorCategoria`, y las
cinco estadísticas de Registro diario) no cambiaron: seguían
funcionando bien porque ya comparaban contra `dateKey`/`closedDays`
correctamente.

Verificado: `node --check script.js` sin errores; simulación manual
de un gasto cargado "hoy" (mañana siguiente a la fecha del gasto) que
ahora se atribuye correctamente al día cerrado de "ayer" en vez de
quedar fuera de cualquier día cerrado.

## Estado

v0.2 construida y verificada sobre la base de v0.1. La app sigue siendo
utilizable de punta a punta en mobile: selector de usuario con login por
contraseña, sesión persistente, home, Dinero (con edición/eliminación de
movimientos) y panel de admin básico (solo Gio).

## Implementado

- Diseño mobile-first real, verificado sin overflow horizontal en
  anchos de 360px a 430px (y centrada tipo "app" en desktop/tablet).
- Identidad visual: cielo nocturno de montaña con estrellas animadas,
  paleta oscura + acento ámbar/celeste/violeta, tipografía Outfit (display)
  + Inter (body).
- Pantalla "¿Quién sos?" con grid de los 11 participantes reales (avatar
  con iniciales + color, tap para seleccionar).
- **Login con contraseña**: al tocar un participante se abre un bottom
  sheet pidiendo su contraseña corta. La comparación ignora mayúsculas/
  minúsculas. Si es incorrecta, muestra error y no deja entrar (el campo
  se limpia y vuelve a enfocarse). Si es correcta, guarda la sesión y
  entra a `/home`. Los 11 usuarios y sus contraseñas están definidos en
  `PARTICIPANTS` (`script.js`); Gio conserva `isAdmin: true` y acceso a
  `/admin`. La contraseña ingresada nunca se guarda en `localStorage`, y
  tampoco se guarda la contraseña del participante dentro de
  `currentUser` (solo id/nombre/isAdmin).
- Sesión: `currentUser` en localStorage, separado de los datos del
  usuario (`userData:<id>`).
- Si existe `currentUser` al abrir la web, se entra directo a /home (o
  /admin si el hash lo pide y el usuario es admin) sin mostrar el
  selector.
- Cerrar sesión elimina únicamente `currentUser` (nunca
  `localStorage.clear()`); los `userData:<id>` de todos los usuarios
  permanecen intactos.
- Home: header con saludo al usuario + tarjetas de secciones futuras
  (Dinero, Registro diario, Envío de datos) marcadas como "Próximamente",
  sin funcionalidad real todavía.
- Admin (solo Gio, `isAdmin: true`): listado de participantes + tarjetas
  "Próximamente" de Previas, Estadísticas y Códigos de datos. Si un
  usuario no-admin fuerza la ruta `#/admin`, se lo redirige a /home.
- Navegación inferior tipo app (Home / Admin), visible solo con sesión
  iniciada; el botón Admin solo aparece para Gio.
- Ruteo simple por hash (`#/home`, `#/admin`) sin backend, apto para
  hosting estático (Vercel).
- Verificado con capturas automatizadas en 360px, 375px, 390px y
  desktop (1280px): sin scroll horizontal en ningún caso.

- Sección **Dinero**, accesible desde la tarjeta "Dinero" en /home
  (dejó de estar bloqueada/"Próximamente"):
  - Saldo inicial: al entrar por primera vez se pide obligatoriamente
    cuánto dinero lleva el usuario al viaje (bottom sheet que no se
    puede saltear; si se cierra sin cargar el monto, vuelve a /home).
    Se guarda en `userData:<id>.money.initialBalance`. Editable en
    cualquier momento con el ícono de ajustes (⚙️) del header de Dinero.
  - Gastos: nombre (default "Sin Descrip." si se deja vacío), categoría
    por chips seleccionables — Chocolates, Alcohol, Boliche, Comida,
    Bebida, Actividades, Otros (default "Otros" si no se
    elige ninguna) — y monto. Se valida que el monto sea numérico y
    mayor a 0.
  - Ganancias: nombre (default "Ganancia" si se deja vacío) y monto.
    Se distinguen visualmente del gasto (color celeste, signo "+",
    ícono 💰) tanto en el historial como en la leyenda del donut.
  - **Donut de saldo (SVG)**: implementado con dos `<circle>` SVG
    (`stroke-dasharray`/`stroke-dashoffset`) en vez de `conic-gradient`,
    para bordes perfectamente circulares y sin efecto serrucho en
    cualquier densidad de pantalla (verificado con capturas a 1x y 3x
    DPI). La parte **colorida (ámbar)** representa el dinero que
    todavía queda **disponible** (`saldo inicial + ganancias − gastos`)
    sobre el total disponible al comenzar el viaje
    (`saldo inicial + ganancias`); la parte **gris** representa el
    dinero ya **gastado**. La parte colorida disminuye proporcionalmente
    con cada gasto y vuelve a crecer con cada ganancia. Verificado con
    el caso de ejemplo saldo inicial $100.000 + gasto $25.000 → 75%
    colorido / 25% gris. Maneja correctamente el caso sin gastos ni
    ganancias (100% colorido) sin errores ni NaN. Transición animada al
    cambiar el saldo. El texto del monto dentro del donut usa un
    tamaño de letra reducido para que un valor de 6 cifras (ej.
    "$200.000") entre completo sin desbordar el círculo.
  - **Editar y eliminar movimientos**: cada fila del historial es
    tocable y abre un bottom sheet de acciones ("Editar" / "Eliminar" /
    "Cancelar"). Editar reabre el mismo formulario de alta (gasto o
    ganancia) precargado con nombre, categoría y monto actuales, y
    actualiza el movimiento existente. Eliminar exige un segundo paso
    de confirmación explícita ("¿Eliminar este gasto/ganancia?" con
    botón rojo "Sí, eliminar" y "Cancelar") antes de borrar, evitando
    que un solo toque elimine algo por accidente. Ambas acciones
    disponibles tanto para gastos como para ganancias, y recalculan al
    instante saldo disponible, donut, historial y `localStorage`.
  - Historial: lista de movimientos más reciente primero, con ícono,
    nombre, categoría/etiqueta "Ganancia" y monto con signo.
  - Todo persiste en `userData:<id>.money` (namespaced por usuario).
    Cerrar sesión no borra estos datos (verificado).
  - UX: bottom sheet deslizable para los formularios (login, saldo
    inicial, gasto, ganancia, acciones de movimiento, confirmación de
    borrado), chips táctiles para categoría, botones grandes de
    "− Gasto" / "+ Ganancia", sin scroll horizontal en 360–430px
    (verificado con Chrome headless).

- Sección **Registro diario**, accesible desde la tarjeta "Registro
  diario" en /home (dejó de estar bloqueada/"Próximamente"):
  - El usuario registra los datos del **día anterior** (fecha real del
    dispositivo menos un día). La pantalla muestra esa fecha en un
    banner ("Registrando el día de ayer" + fecha en español) y no hay
    que escribir "Día 1", "Día 2", etc. Los registros se guardan
    internamente bajo una clave de fecha ISO (`YYYY-MM-DD`) en
    `userData:<id>.dailyLog.entries`, lista para que en el futuro se
    calcule el día de viaje automáticamente a partir de una fecha de
    inicio configurada (todavía no implementada).
  - **Horas dormidas**: dos selectores horizontales deslizables (uno
    para hora de dormir, otro para hora de despertarse), con opciones
    cada 10 minutos. Hora de dormir va de 22:00 a 09:00 del día
    siguiente (contempla el cruce de medianoche); hora de despertarse
    va de 06:00 a 16:00. Ningún selector usa input de texto: son
    botones/tarjetas tocables con scroll horizontal contenido dentro
    de su propio bloque (`scroll-snap`), sin generar scroll horizontal
    en la página. Existe un botón **"No dormí"** que, al activarse,
    oculta y descarta ambos selectores (no exige datos de horas).
  - **Siesta** (opcional, oculta por defecto): botón "+ Registrar
    siesta" que revela dos selectores horizontales (inicio y fin)
    entre 14:00 y 22:00 cada 10 minutos. Botón "Quitar siesta" para
    cancelarla si se agregó por error.
  - **Quinta comida**: pregunta con dos chips Sí/No, selección de un
    toque.
  - **Veces al baño**: chips de selección rápida 0 a 5 (sin input
    numérico).
  - **Hora de salida del boliche**: selector horizontal igual al de
    horas de sueño, opciones cada 10 minutos entre 01:00 y 07:00.
    Botón **"No fui al boliche"** que oculta y descarta la hora.
  - **Guardado**: botón "Guardar registro" al final. Si ya existe un
    registro para la fecha del día anterior, se sobrescribe (misma
    clave de fecha) en vez de crear un duplicado. Al reabrir la
    sección se precarga con los datos ya guardados de ese día,
    incluyendo si se había marcado "No dormí" / "No fui al boliche" y
    la siesta si se había agregado. Todo persiste en
    `userData:<id>.dailyLog`, namespaced por usuario; cerrar sesión no
    borra estos datos.
  - UX: tarjetas/secciones dentro de `.home-content` (mismo patrón
    visual que Dinero), botones grandes, feedback visual inmediato al
    seleccionar (chips y opciones de hora resaltadas), sin scroll
    horizontal de página — solo dentro de cada selector de hora.

## Auditoría de datos (v0.4.0)

Se auditó la lógica existente de principio a fin (sesión, Dinero,
Registro diario) contra las reglas de separación por usuario. Resumen
de lo comprobado y lo corregido, documentado acá para que cualquier
cuenta de Claude pueda continuar sin tener que re-auditar desde cero.

### Estructura de datos confirmada

Todo vive en `localStorage`, dos tipos de clave:

- `currentUser` → `{ id, name, isAdmin }` (sesión activa, nunca la
  contraseña). Se borra solo con logout.
- `userData:<id>` → un objeto por participante, namespaced por su
  `id` estable. Forma actual:

  ```
  {
    id: "gio",
    createdAt: "<ISO>",
    money: {
      initialBalance: number | null,
      movements: [
        {
          id, type: "expense" | "income", name, amount,
          category,   // solo en "expense"; ver categorías vigentes
          date: "<ISO>"
        },
        ...
      ]
    },
    dailyLog: {
      entries: {
        "<YYYY-MM-DD>": {           // fecha real del día registrado
          sleep: { didNotSleep: bool, bedtime: "HH:MM"|null, wake: "HH:MM"|null },
          nap: { start: "HH:MM", end: "HH:MM" } | null,
          fifthMeal: "yes" | "no" | null,
          bathroom: 0-5 | null,
          boliche: { didNotGo: bool, time: "HH:MM"|null },
          computed: {               // derivado, recalculado en cada guardado
            sleepMinutes: number|null,
            napMinutes: number|null,
            totalSleepMinutes: number|null,  // sleepMinutes + napMinutes
            bolicheMinutes: number|null
          }
        },
        ...
      }
    }
  }
  ```

  `data.money` y `data.dailyLog` conviven en el mismo objeto pero se
  leen/escriben siempre con lectura-completa + escritura-completa
  (`getUserData` → mutar → `saveUserData`), así que agregar/editar uno
  nunca pisa al otro.

### Separación entre usuarios: confirmada, sin bugs

- `ensureUserData`, `getUserData`, `saveUserData` siempre operan sobre
  `userData:<id>`, nunca sobre una clave global. Probado con Gio,
  Sebas y Jere en secuencia (login → cargar datos → logout → otro
  usuario → volver a Gio): los datos de cada uno permanecen intactos
  y separados.
- `clearCurrentUser` (logout) borra únicamente `currentUser`. Nunca
  usa `localStorage.clear()`. Confirmado que `userData:<id>` de todos
  los usuarios sobrevive al logout.
- Para admin/consolidación futura: como cada usuario vive bajo su
  propia clave `userData:<id>`, juntar los datos de todos es un
  `PARTICIPANTS.map(p => getUserData(p.id))` de solo lectura — no hace
  falta (ni se debe) escribir sobre las claves originales.
- Único ajuste hecho: `clearCurrentUser` también resetea la variable
  en memoria `dailyDateKey` (no es un dato persistido, es solo caché
  de la pantalla de Registro diario) para que, al entrar con otro
  usuario, la pantalla vuelva a leer su propio `dailyLog` en lugar de
  reusar el estado en memoria del usuario anterior. Sin este reset no
  había mezcla de datos guardados (`saveDailyEntry` siempre grabó bajo
  el `id` del usuario logueado), pero si dos usuarios distintos
  entraban en la misma sesión de pestaña sin recargar la página, la
  pantalla podía mostrarle a Sebas el formulario tal como había
  quedado en memoria mientras se navegaba como Gio, antes de guardar.
  Corregido.

### Registro diario: cálculos verificados

Se agregaron y probaron (con casos numéricos, no solo revisados a
ojo) las funciones de duración:

- `sleepDurationMinutes(bedtime, wake)`: minutos entre hora de dormir
  y de despertarse, contemplando cruce de medianoche (si la hora de
  despertarse cae en o antes de la hora de dormir dentro del mismo
  reloj de 24h, se asume día siguiente). Probado 23:00→07:00 = 480 min
  (8h) ✓.
- `napDurationMinutes(nap)`: minutos de siesta, sin cruce de
  medianoche (rango fijo 14:00–22:00). Probado 15:00→16:30 = 90 min
  ✓.
- `totalSleepMinutes`: `sleepMinutes + napMinutes` (con siesta) o solo
  sueño nocturno (sin siesta). Probado 6h sueño + 3h siesta = 9h ✓
  (ejemplo exacto del pedido) y 480+90=570 min (9h30) con los valores
  de arriba ✓.
- `bolicheDurationMinutes(exitTime)`: minutos desde la llegada fija a
  las 01:00 hasta la hora de salida. Probado salida 02:00 = 60 min
  (1h) ✓ y salida 05:30 = 270 min (4h30) ✓ — ambos ejemplos exactos
  del pedido.
- Estos valores se recalculan y se guardan en `entry.computed` cada
  vez que se guarda un registro (no solo se muestran en pantalla),
  para que rankings futuros (más siestas, más tiempo en el boliche,
  etc.) puedan leerlos directamente sin reinterpretar horarios.
- "No dormí" y "No fui al boliche" siguen limpiando (`null`) los
  horarios correspondientes antes de guardar, así que sus
  `computed.sleepMinutes` / `computed.bolicheMinutes` quedan en
  `null` en vez de en un valor inventado.

### Dinero: auditado, un bug de categorías corregido

- Saldo inicial, gastos, ganancias, saldo disponible, historial y
  persistencia por usuario: revisados contra `computeMoneyTotals` y
  probados con datos de ejemplo — el cálculo
  `disponible = inicial + ganancias − gastos` es correcto y persiste
  bien en `userData:<id>.money`.
- **Corregido**: la categoría **"Transporte"** se eliminó de
  `EXPENSE_CATEGORIES`/`CATEGORY_ICONS` (ya no aparece como chip
  seleccionable). Las categorías válidas ahora son: Chocolates,
  Alcohol, Boliche, Comida, Bebida, Actividades, Otros.
- Para no romper gastos ya guardados con categoría "Transporte", se
  agregó `migrateExpenseCategories`: cada vez que se abre la sección
  Dinero de un usuario (`ensureMoneyData`), los movimientos con una
  categoría eliminada se reasignan automáticamente (hoy solo
  "Transporte" → "Otros") y se persiste el cambio, sin tocar nombre,
  monto ni fecha del movimiento. Probado con un gasto "Transporte"
  preexistente: al reabrir Dinero pasa a "Otros" y esa categoría
  queda escrita en `localStorage`.

### Pruebas realizadas (numeradas según lo pedido)

Simuladas con la lógica real del proyecto (funciones de sesión,
`ensureMoneyData`, `migrateExpenseCategories` y las de duración
copiadas tal cual) sobre un `localStorage` de prueba en Node, ya que
este entorno no tiene navegador disponible para correr la app en
vivo:

1. Login Gio + registrar saldo inicial, un gasto y un registro
   diario completo → OK.
2. Logout → solo se borra `currentUser`; `userData:gio` sigue en
   `localStorage` → OK.
3. Login Sebas → OK.
4. Sebas arranca con `initialBalance: null`, sin movimientos y sin
   `dailyLog` → separación confirmada, sin restos de Gio → OK.
5. Logout, login Gio de nuevo → `initialBalance`, movimientos y
   `dailyLog` de Gio intactos → OK.
6. Sueño 23:00→07:00 = 480 min (8h) → OK.
7. Siesta 15:00→16:30 = 90 min; total dormido = 570 min (9h30) → OK.
8. Boliche salida 05:30 = 270 min (4h30); caso spec salida 02:00 =
   60 min (1h) → OK.
9. Gasto con categoría "Transporte" preexistente se migra a "Otros"
   al reabrir Dinero, sin perder monto/nombre/fecha → OK (corregido
   en esta versión).
10. Persistencia tras "recarga" (releer `userData:gio` desde
    `localStorage` como lo haría una página nueva): saldo, gastos y
    `dailyLog.entries` se leen exactamente igual que como se
    guardaron → OK.

No se encontraron pérdidas ni mezclas de datos entre usuarios. Los
dos ajustes de esta versión fueron: reset de `dailyDateKey` en
logout, y migración/eliminación de la categoría "Transporte".

## Exportación de datos (v0.5.0)

Nueva sección **Envío de datos**, accesible desde la tarjeta homónima
en /home (dejó de estar bloqueada/"Próximamente"), pantalla `#/export`.

- **Código de datos**: se genera con `generateExportCode(userId)`,
  que arma un payload (`{ version, user, data: { initialBalance,
  movements, dailyEntries } }`) a partir de los datos **actuales** de
  `userData:<id>` (nunca un valor cacheado), lo pasa por
  `JSON.stringify`, lo ofusca con un XOR reversible simple contra una
  clave fija y lo codifica en Base64 URL-safe, con el prefijo
  `BRL<version>.`. Formato completo, algoritmo y funciones
  responsables documentados en `SPEC.md` → "Código de intercambio
  (implementado)".
- `buildExportPayload(userId)` es el único lugar que decide qué datos
  entran en el código — si se agrega un dato nuevo persistido en el
  futuro, alcanza con sumarlo ahí.
- `decodeExportCode(code)` es la función central inversa (valida
  prefijo y versión, revierte XOR + Base64, parsea el JSON). Ya está
  lista y probada con un round-trip completo (incluyendo emojis y
  comillas en nombres de gastos), pero **todavía no se usa desde
  ninguna pantalla** — la importación en /admin queda para una
  próxima iteración, según lo pedido.
- El código se muestra en un `<textarea readonly>` de solo lectura
  dentro de la pantalla, siempre regenerado al entrar a la sección.
- Botón **"Copiar código"**: copia únicamente el código (no el
  mensaje completo) al portapapeles vía `navigator.clipboard`, con
  fallback a `document.execCommand("copy")` si el navegador no
  soporta la Clipboard API. Muestra confirmación visual "✓ Código
  copiado" (mismo patrón que el mensaje de guardado de Registro
  diario).
- Botón **"📲 Enviar datos a Gio"**: regenera el código en el
  instante del click (por si pasó tiempo en pantalla), arma un enlace
  `https://wa.me/5491127362080?text=...` con el mensaje
  `BARILOCHE_DATA\nCódigo:\n[CODIGO]` y lo abre en una pestaña nueva
  para que el usuario revise el mensaje en WhatsApp antes de mandarlo
  — nunca se envía automáticamente.
- Reutiliza el patrón visual existente (`.daily-section`,
  `.sheet-submit`, `.sheet-cancel-link`, mensaje `.daily-save-msg`)
  sin rehacer la estética general.
- No se implementó todavía: importación desde /admin, estadísticas,
  rankings ni previas, según lo pedido.

## Sistema de jugadores en /admin (v0.6.0)

Nueva sección **Jugadores importados** dentro de /admin, que cierra el
circuito completo: *usuario genera código → Gio lo recibe por WhatsApp
→ /admin → importar/actualizar jugador*. Documentado en detalle en
`SPEC.md` → "Jugadores importados (implementado)"; resumen acá:

- **Almacenamiento**: nueva clave `adminPlayers` en `localStorage`,
  namespaced por `payload.user` (el id estable del participante),
  totalmente separada de `currentUser` y de `userData:<id>`. Es la
  copia consolidada propia de Gio; importar datos de otro jugador
  nunca lee ni escribe `userData:<id>` de nadie (verificado: importar
  a Sebas no modificó `userData:gio`).
- **No se inventó ningún formato de código nuevo**: reutiliza tal
  cual `decodeExportCode`/`EXPORT_CODE_VERSION` ya existentes de la
  sección de exportación.
- **Agregar jugador**: botón "+ Agregar jugador" → bottom sheet con
  textarea grande + botón "Importar". Decodifica el código y corre
  `validateImportPayload` (versión soportada, `user` presente,
  `data.movements` array, `data.initialBalance` `number|null`,
  `data.dailyEntries` objeto). Si falla cualquier validación, mensaje
  de error claro y **cero cambios en `adminPlayers`** (probado con un
  string que no es un código válido). Si el jugador ya existe, no se
  duplica: se muestra un aviso "`<Nombre>` ya está cargado" con
  opción de actualizar. Si es válido y nuevo, se muestra una
  previsualización (jugador, saldo inicial, cantidad de gastos,
  ganancias y registros diarios) antes de guardar; solo al confirmar
  se escribe en `localStorage`.
- **Actualizar jugador**: cada fila de la lista es tocable → sheet de
  acciones → "Actualizar datos" → mismo flujo de pegar/validar/
  previsualizar/confirmar. Si el código pegado pertenece a otro
  jugador distinto al que se estaba actualizando, se rechaza con un
  mensaje explícito (probado: pegar el código de Jere mientras se
  actualizaba a Sebas fue rechazado y no mezcló datos). Al confirmar,
  `data` se reemplaza por completo; `importedAt` se conserva del
  primer import y `updatedAt` se actualiza (probado: tras actualizar,
  `importedAt !== updatedAt`).
- **Duplicados**: estructuralmente imposibles — la clave del mapa es
  siempre el id del participante, así que reimportar el mismo
  jugador siempre cae en el flujo "ya existe" en vez de crear una
  segunda entrada.
- **Interfaz**: contador ("X jugadores cargados"), botón "+ Agregar
  jugador", filas con avatar, nombre, fecha/hora de última
  actualización (`dd/mm hh:mm`, 24 horas) y etiqueta "Cargado". Se
  quitó la tarjeta "Códigos de datos" de "Próximas funciones" (ya
  implementada). Mismo lenguaje visual que el resto de /admin y de
  Dinero (bottom sheet, tarjetas, acento ámbar).
- Verificado con Chrome headless en 360px sin overflow horizontal, en
  todos los pasos (pegar código largo, mensaje de error, previews,
  lista de jugadores).
- No implementado todavía (según lo pedido): estadísticas, rankings,
  previas ni gráficos administrativos a partir de `adminPlayers`.

## Lista única de jugadores en /admin, saldo inicial privado (v0.7.0)

Rediseño de la sección de jugadores de /admin sobre la base de v0.6.0,
sin tocar el sistema de códigos ni el resto de la app. Reemplaza la
sección "Jugadores importados" de v0.6.0. Documentado en detalle en
`SPEC.md` → "Jugadores importados (implementado)"; resumen acá:

- **Una sola lista** ("Jugadores"): ya no existen dos listas
  (`admin-participants` + `admin-players-list`). Ahora `admin-participants`
  es la única lista, siempre con una fila por cada uno de los 11
  participantes de `PARTICIPANTS` (hayan mandado datos o no).
- **"Última actualización" por fila**: cada fila muestra `Última
  actualización: dd/mm hh:mm` (leído de `adminPlayers[id].updatedAt`,
  persistido en `localStorage`) o `Sin datos importados` si ese
  jugador todavía no tiene ninguna entrada en `adminPlayers`.
- **Sin botones por jugador**: las filas ya no son tocables ni abren
  ningún sheet de acciones individual (se eliminó `admin-player-actions`,
  `openAdminPlayerActions` y `adminActionsTargetId`).
- **Botón general "Actualizar código"**: nuevo botón único debajo de la
  lista (`openAdminImportUpdateCode`, modo `"update-code"`). Al pegar un
  código, se decodifica con el mismo `decodeExportCode` de siempre y se
  identifica automáticamente `payload.user`:
  - si no corresponde a ningún id de `PARTICIPANTS`, se muestra el
    error `"<id>" no está registrado en la lista de jugadores` y no se
    escribe nada en `adminPlayers`;
  - si corresponde a un participante conocido, se previsualiza y, al
    confirmar, se crea o actualiza su entrada en `adminPlayers` (mismo
    `payload.user` como clave → nunca duplica), actualizando
    `updatedAt`.
- **"+ Agregar jugador"** se mantiene como botón separado, para el
  primer import de un jugador. Si el código pegado pertenece a alguien
  que ya tiene datos cargados, ya no ofrece "Actualizar datos" ahí
  mismo: solo avisa "`<Nombre>` ya está cargado" y pide usar el botón
  "Actualizar código", sin modificar nada.
- **Saldo inicial privado**: se quitó la fila "Saldo inicial" de la
  previsualización de importación/actualización. `initialBalance`
  sigue viajando y guardándose igual que antes dentro de
  `adminPlayers[id].data.initialBalance` (para usos futuros como "El
  más rata"), pero ya no se renderiza en ningún lugar visible de
  /admin.
- No se cambió el formato de los códigos, ni `decodeExportCode`, ni
  `validateImportPayload`, ni la estética general.
- No se implementaron todavía estadísticas, rankings ni previas.

## Registro manual de previas en /admin (v0.8.0)

Primera parte del sistema de previas (SPEC.md → "Previas"), pantalla
nueva `#/previas` accesible desde una tarjeta tocable "Previas" dentro
de /admin (dejó de estar "Próximamente"; solo aparece la tarjeta de
"Estadísticas" como próxima función). Solo Gio puede entrar: si otro
usuario fuerza el hash `#/previas`, se lo redirige a `/home` (mismo
comportamiento que `#/admin`, probado con Sebas).

- **Participantes**: grid de chips tocables (uno por cada uno de los
  11 participantes de `PARTICIPANTS`), selección múltiple por toque
  (se puede seleccionar y deseleccionar libremente). No hay mínimo
  hasta guardar.
- **Productos**: botón "+ Agregar producto" abre un bottom sheet
  (mismo patrón visual que gasto/ganancia) con tres campos: nombre,
  precio unitario y cantidad (default 1). Cada producto agregado
  aparece en una lista con nombre, "cantidad x precio unitario" y
  subtotal, con un botón "×" para quitarlo antes de guardar.
- **Total**: se recalcula en vivo como la suma de `precio × cantidad`
  de todos los productos cargados. Probado con 2×$5.000 + 3×$1.500 =
  $14.500 exacto.
- **Resumen en vivo**: mientras se arma la previa, una tarjeta muestra
  siempre "Total de la previa", "Participantes" (cantidad) y "A pagar
  por persona" (total ÷ cantidad de participantes seleccionados),
  recalculado en cada cambio de productos o participantes. Probado
  con 6 participantes y total $60.000 → $10.000 por persona exacto.
- **Guardar previa (con confirmación)**: tocar "Guardar previa" valida
  primero que haya al menos un participante seleccionado y al menos
  un producto agregado (probado: sin participantes muestra
  "Seleccioná al menos un participante." y sin productos "Agregá al
  menos un producto.", sin abrir ningún sheet ni tocar
  `localStorage`). Si pasa la validación, se abre un bottom sheet de
  confirmación ("¿Estás seguro de registrar esta previa?") con el
  mismo resumen (total, participantes, monto por persona) y dos
  botones: "Sí, registrar previa" / "Cancelar".
  - **Cancelar**: cierra el sheet sin escribir nada en `localStorage`
    y sin borrar lo cargado (probado: los productos y participantes
    siguen en el formulario después de cancelar).
  - **Confirmar**: recién ahí se escribe la previa. Genera un id
    único con `genId()` (mismo generador ya usado para movimientos de
    Dinero) y guarda `participantIds` (copia de los ids
    seleccionados), `products` (copia de cada producto con su propio
    id, nombre, precio y cantidad), `total`, **`amountPerPerson`**
    (total ÷ cantidad de participantes, calculado una sola vez en
    este paso y persistido tal cual, no recalculado después) y
    `createdAt` (ISO) en la clave de `localStorage` `adminPrevias`
    (array), totalmente separada de `userData:<id>` y de
    `adminPlayers`. Después limpia el formulario (participantes y
    productos en memoria) para poder cargar la próxima previa desde
    cero.
- **Historial de previas**: debajo del formulario, lista todas las
  previas guardadas (más reciente primero), cada una en una tarjeta
  con participantes (nombres resueltos con `resolvePlayerName`),
  productos (resumen "cantidad x nombre"), total, **monto a pagar por
  persona** (`amountPerPerson`, con fallback calculado al vuelo desde
  `total`/cantidad de participantes para previas guardadas antes de
  este campo), fecha/hora (`formatDateTimeShort`, mismo formato
  `dd/mm hh:mm` que "Jugadores") e identificador. Se regenera desde
  `localStorage` cada vez que se entra a la pantalla, así que
  **persiste correctamente tras cerrar y volver a abrir la web**
  (probado con una recarga real del navegador: la previa guardada
  antes de recargar sigue apareciendo idéntica después, y
  `localStorage.adminPrevias` contiene exactamente lo guardado,
  incluyendo `amountPerPerson`).
- Verificado con Chrome headless (Playwright) en 360px y 390px: sin
  overflow horizontal en ningún paso (selección de participantes,
  alta de producto, confirmación, cancelar, guardado, historial).
- No implementado todavía (según lo pedido): eliminar/editar una
  previa ya guardada, códigos ni importación de previas.

## Previas: código, importación y sección especial de Jere (v0.9.0)

Segunda parte del sistema de previas (SPEC.md → "Previas"). Construida
sobre la base de v0.8.0 sin tocar el registro manual existente ni el
sistema de códigos de jugadores.

### Código de una previa e importación en /admin

- Reutiliza exactamente el mismo pipeline de codificación del código
  de intercambio (prefijo `BRL<version>.`, XOR con `EXPORT_XOR_KEY`,
  Base64 URL-safe, mismas funciones `xorBytes`/`bytesToBase64Url`/
  `base64UrlToBytes`/`decodeExportCode`). Solo cambia la forma del
  payload: `{ version, type: "previa", previa: { id,
  participantIds, products, total, amountPerPerson, createdAt } }`
  en vez de `{ version, user, data }`. `decodeExportCode` no necesitó
  ningún cambio: ya era agnóstico a la forma del payload.
- **Generar**: `generatePreviaExportCode(previa)` (vía
  `buildPreviaExportPayload`, único lugar que decide qué campos de la
  previa entran en el código).
- **Validar**: `validatePreviaImportPayload(payload)` comprueba
  versión, `type === "previa"` y que `previa` tenga `id`,
  `participantIds` (array no vacío), `products` (array no vacío),
  `total`/`amountPerPerson` numéricos y `createdAt`.
  `parseAndValidatePastedPreviaCode(rawCode)` combina decodificación +
  validación con mensajes de error listos para el sheet.
- **Interfaz**: nuevo botón "Introducir código de previa" dentro de
  `#/previas` (solo visible en modo admin, es decir, solo Gio llega a
  verlo). Abre un bottom sheet multi-paso: pegar código → si
  `previa.id` ya existe en `adminPrevias`, se muestra "Esta previa ya
  fue importada" y no se toca nada (probado: reimportar el mismo
  código dos veces deja el historial con una sola entrada) →
  previsualización de solo lectura (participantes resueltos,
  productos, total, monto por persona, fecha) → "Confirmar
  importación" escribe recién ahí en `adminPrevias`.
- Al confirmar, se guarda con el **mismo `id`** que traía el código y
  exactamente los mismos campos que una previa cargada a mano
  (`participantIds`, `products`, `total`, `amountPerPerson`,
  `createdAt`): en el historial de `#/previas` una previa importada
  se ve y se comporta idéntica a una registrada directamente por Gio
  (probado con Playwright: historial, nombres resueltos, total y
  monto por persona idénticos).
- Duplicados: estructuralmente evitados por el chequeo de `id` antes
  de escribir (tanto en la previsualización como, por las dudas, de
  nuevo justo antes de guardar).

### Permiso especial: Jere puede registrar previas

- Nuevo flag simple y explícito `canRegisterPrevias: true` agregado
  solo a la entrada de Jere en `PARTICIPANTS` (Gio sigue
  identificándose únicamente por `isAdmin: true`; nadie más tiene
  ninguno de los dos flags). Función `canRegisterLocalPrevia(id)`
  centraliza la regla ("tiene el flag Y no es admin").
- En el Home de Jere (y solo ahí — probado que Sebas no ve la
  sección ni el botón) aparece, debajo de las tarjetas normales de
  Home ("Dinero", "Registro diario", "Envío de datos"), una sección
  adicional **"Previas"** con una tarjeta que lleva a la nueva ruta
  `#/previas-jere`.
- `#/previas-jere` reutiliza **el mismo componente/lógica** que
  `#/previas` de /admin: es la misma función `renderPreviasScreen()`
  (selección de participantes, alta de productos con bottom sheet,
  resumen en vivo de total/participantes/monto por persona,
  confirmación al guardar), controlada por una variable de módulo
  `previaMode` (`"admin"` | `"local"`) que decide únicamente dónde
  persiste (`previaIds()` calcula los ids de DOM y el destino de
  guardado según el modo) — no existe una segunda implementación del
  formulario ni una segunda pantalla administrativa.
- **Almacenamiento separado**: en modo `"local"`, al confirmar la
  previa se guarda en `localStorage` bajo `localPrevias:<id>`
  (namespaced por usuario, hoy solo `localPrevias:jere`) — nunca en
  `adminPrevias`. Esa previa no forma parte de la base administrativa
  consolidada hasta que Gio importa su código desde /admin (probado:
  registrar como Jere no modifica `adminPrevias`).
- Al confirmar en modo local se genera de una el código
  (`generatePreviaExportCode`) y se muestra en un bottom sheet
  ("Código de la previa") con `<textarea readonly>` + botón "Copiar
  código", mismo patrón que "Envío de datos". El historial local
  (debajo del formulario, leído de `localPrevias:<id>`) también
  ofrece un botón "Copiar código para Gio" por cada previa ya
  guardada.
- Jere sigue sin acceso a `/admin`, `#/previas` (la de admin),
  jugadores, estadísticas ni ninguna otra función administrativa: si
  fuerza esos hashes se lo redirige a `/home`, igual que a cualquier
  no-admin (sin cambios en ese comportamiento). Si alguien sin el
  flag `canRegisterPrevias` fuerza `#/previas-jere`, también se lo
  redirige a `/home`.
- Verificado con Playwright en 390px, circuito completo: login Jere →
  ve su Home normal con nav sin botón Admin → aparece sección
  Previas → registra previa con 2 participantes y 1 producto → genera
  código (formato `BRL1....` confirmado) → copia → login Gio → pega el
  código en "Introducir código de previa" → previsualiza → confirma →
  la previa aparece en el historial administrativo de `#/previas` con
  los participantes correctos → reimportar el mismo código no duplica
  → sin overflow horizontal en ningún paso → sin errores de consola.
- No implementado todavía (según lo pedido): eliminar/editar una
  previa ya guardada (ni en `adminPrevias` ni en `localPrevias:<id>`),
  ni estadísticas a partir de las previas.

## Pulido visual de Estadísticas (v0.13.0)

Revisión puramente visual/UX de `#/stats` (DÍA y TOTAL), pedida para
que la sección se sienta como una **competencia del viaje** y no como
un dashboard empresarial. No se modificó ningún cálculo: las 16
funciones `dayRanking*` / `totalRanking*` (v0.11.0/v0.12.0) siguen
exactamente igual, igual que sus fuentes de datos (`adminPlayers` /
`adminPrevias`). Tampoco se agregó ninguna estadística nueva ni se
rehizo la pantalla — sigue siendo la misma pestaña Día/Total con las
mismas 8 tarjetas.

Cambios, todos en la capa de presentación (`renderRankingBars()`,
`renderRankingCard()`, `renderStatsPanel()` en `script.js`, y la
sección "Estadísticas (DÍA / TOTAL)" de `styles.css`):

- **Podio del ganador**: `renderRankingBars()` separa `rows[0]` del
  resto y arma un bloque `.ranking-podium` propio (corona 🏆 con
  animación flotante sutil, fondo con degradé ámbar, borde con glow,
  nombre en tipografía más grande) en vez de que el ganador sea
  simplemente la primera fila con una clase extra. El resto de filas
  (`.ranking-list`) se muestra debajo, cada una con medalla 🥈/🥉 (2°
  y 3° puesto) o número de puesto simple (4° en adelante), vía
  `medalForRank(rank)`.
- **Títulos de competencia**: `renderRankingCard()` ahora recibe un
  parámetro `caption` además de `title`. `title` pasó a ser un título
  lúdico ("¿Quién durmió más?", "El más gastador", "Resistencia en el
  boliche", "¿En qué se fue la plata?", "Rey/reina de las previas",
  etc.) y `caption` conserva, en una leyenda chica debajo, el nombre
  literal del dato ("Horas dormidas", "Gasto total del día") para que
  no haya ambigüedad sobre qué mide cada tarjeta. Ajustado en
  `renderDayStatsReal()` y `renderTotalStatsReal()` (mismo texto base
  para ambos, con la variante "totales"/"acumulado" que ya usaba
  TOTAL en algunos casos).
- **Barras animadas**: las barras arrancan en `width: 0%` (atributo
  `data-pct` con el valor final) y una nueva función
  `animateRankingBars(root)` les asigna su ancho real mediante doble
  `requestAnimationFrame` después de insertar el HTML en el DOM, para
  que el `transition: width` del CSS las anime de forma visible. Se
  llama una sola vez al final de `renderStatsPanel()`, después de
  fijar `panel.innerHTML`, y cubre todas las tarjetas de golpe. Cada
  fila del resto del ranking anima con un pequeño delay creciente
  (`--row-delay`) para dar sensación de cascada; la barra del podio
  anima sin delay pero con una duración algo mayor para que se note
  más.
- **Transiciones entre días**: nuevo estado de módulo `statsNavDir`
  (`-1` anterior / `0` sin dirección / `1` siguiente). Los botones
  `stats-day-prev`/`stats-day-next` lo setean antes de llamar a
  `renderStatsPanel()`; la función lee ese valor, lo resetea a `0`, y
  envuelve el contenido en `<div class="stats-panel-inner ...">` con
  la clase `stats-slide-prev`/`stats-slide-next` correspondiente (o
  ninguna, para un fade simple al cambiar de pestaña Día/Total o en
  el primer render). Como el panel se re-renderiza completo en cada
  navegación (nodos nuevos), la animación CSS se dispara sola sin
  necesidad de forzar reflow.
- **Entrada en cascada de las tarjetas**: en `styles.css`,
  `.stats-real-list .ranking-card:nth-child(1..8)` tiene un
  `animation-delay` creciente sobre el mismo keyframe `statsFadeUp`,
  así las 8 tarjetas aparecen escalonadas en vez de todas de golpe.
- **Feedback visual**: `.stats-tab:active` ahora escala levemente al
  tocar (ya existía en los botones de navegación de día).
- **Legibilidad en celular**: tamaños de fuente de nombre/valor
  dentro del ranking levemente mayores, mejor contraste en la
  leyenda (`.ranking-card-caption`) y nuevo grid de fila con columna
  de puesto/medalla (`.ranking-row`: `18px minmax(0,72px) 1fr auto`,
  con su propia variante en la media query de 360px).
- **`prefers-reduced-motion: reduce`**: nuevo bloque en `styles.css`
  que desactiva todas las animaciones agregadas en este pulido
  (entrada de tarjetas, transición entre días, corona flotante,
  crecimiento de barras) para quien lo tenga activado a nivel
  sistema.
- **Bug encontrado y corregido** (detectado con Playwright al probar
  con un nombre de jugador artificialmente largo, no reportado antes
  de este pulido): el bloque del podio se salía del ancho de la
  tarjeta en vez de truncar el nombre con ellipsis, por falta de
  `min-width: 0` (y `width: 100%`) en la cadena de contenedores flex
  `.ranking-wrap` → `.ranking-podium` → `.ranking-podium-body` →
  `.ranking-podium-top` → `.ranking-podium-name`, y lo mismo en
  `.ranking-list`. Corregido; no afecta ningún cálculo, solo el
  layout.
- Verificado con Playwright en 360px y 390px, con datos de ejemplo
  (varios jugadores, gastos en distintas categorías, previas
  compartidas entre jugadores, un jugador con nombre muy largo):
  podio y ranking se ven correctamente en DÍA y TOTAL, navegación
  entre días con transición direccional, cambio de pestaña con fade,
  entrada en cascada de las 8 tarjetas, sin scroll horizontal en
  ningún ancho probado, sin errores de consola. El estado sin días
  cerrados (tarjetas "Próximamente") se verificó sin cambios.

## Cálculo real de Estadísticas · TOTAL (v0.12.0)

El apartado **TOTAL** de `#/stats` ya no muestra siempre las tarjetas
"Próximamente": cuando hay al menos un día cerrado,
`renderStatsPanel()` llama a `renderTotalStatsReal(closedDays)`
(mismo `getStatsClosedDays()` que usa DÍA para navegar). Si todavía
no hay ningún día cerrado, sigue mostrando
`renderStatsPlaceholderCards()` junto con el mismo mensaje
explicativo que ya usaba DÍA en ese caso.

`renderTotalStatsReal(closedDays)` arma las **mismas ocho tarjetas**
que `renderDayStatsReal()` (mismos íconos, mismo orden, mismo
`renderRankingCard()`/`renderRankingBars()` — ningún componente
visual nuevo), pero cada `dayRanking*` tiene su equivalente
`totalRanking*` que **acumula sobre todos los días cerrados** en vez
de sobre un único `dateKey`:

- `totalRankingHorasDormidas(closedDays)` — suma
  `entry.computed.sleepMinutes` de cada día cerrado donde el jugador
  durmió (se recorre `dailyEntries` filtrando por
  `set.has(key)` contra el conjunto de días cerrados).
- `totalRankingSiestas(closedDays)` — cuenta de días con siesta
  (`entry.nap` con `start`/`end`); a diferencia de la versión DÍA
  ("Sí"/"No"), acá el valor mostrado es la cantidad de siestas
  ("N siestas").
- `totalRankingQuintaComida(closedDays)` — cuenta de días con
  `fifthMeal === "yes"`, sobre los días donde el jugador sí
  respondió (se trackea con un `Set` de "registered" para poder
  mostrar 0 en vez de excluir al jugador si respondió "no" siempre).
- `totalRankingBanio(closedDays)` — suma de `entry.bathroom` de los
  días con ese dato cargado (mismo patrón de `Set` "registered").
- `totalRankingBoliche(closedDays)` — suma de
  `entry.computed.bolicheMinutes` de los días donde el jugador fue
  al boliche (se saltea cualquier día con `didNotGo`).
- `totalExpenses(closedDays)` — análoga a `dayExpenses(dateKey)`
  pero filtrando gastos cuyo día de viaje atribuido
  (`isoToTripDayKey(m.date)`, ver v0.14.0 más abajo) esté dentro
  del conjunto de días cerrados (no de una sola fecha).
  `totalRankingDineroTotal` y `totalRankingDineroPorCategoria` la
  reutilizan igual que las versiones DÍA reutilizan `dayExpenses`.
- `totalRankingPrevias(closedDays)` — de `adminPrevias`, cuenta
  participación acumulada de cada jugador en todas las previas cuya
  fecha de creación cae en algún día cerrado.

`renderRankingBars()` y `renderRankingCard()` ahora reciben un
`emptyMessage` opcional (por defecto "Sin datos para este día.", que
sigue usando DÍA); TOTAL les pasa "Sin datos en todo el viaje." para
las tarjetas sin datos.

Un jugador que no tiene ningún día cerrado con un dato puntual
simplemente no aparece en esa tarjeta (no se inventan ceros); si
tiene datos en algunos días cerrados y no en otros, solo se acumulan
los días donde sí cargó el dato.

No se agregó CSS nuevo: TOTAL reutiliza exactamente las mismas
clases (`.ranking-card`, `.ranking-list`, `.ranking-row`, etc.) que
ya se habían agregado para DÍA en v0.11.0, así que el diseño
mobile-first y el comportamiento sin scroll horizontal ya estaban
cubiertos.

Verificado: sintaxis de `script.js` sin errores; las ocho funciones
`totalRanking*` probadas de forma aislada con un caso de **dos** días
cerrados y tres jugadores con datos parciales (un jugador con datos
solo en un día, días con campos en `null` por "no dormí"/"no fui al
boliche"/quinta comida no respondida) — confirmado a mano que cada
suma/cuenta acumula correctamente sobre los dos días y que el orden
descendente y el ganador destacado siguen funcionando igual que en
DÍA.

## Cálculo real de Estadísticas · DÍA (v0.11.0)

Dentro de la pantalla `#/stats` (ver estructura base más abajo), el
apartado **DÍA** ya no muestra solo tarjetas "Próximamente" cuando
hay al menos un día cerrado: `renderStatsPanel()` llama a
`renderDayStatsReal(currentKey)` en ese caso (si no hay días
cerrados, se sigue mostrando `renderStatsPlaceholderCards()` como
antes). **TOTAL** no cambió: sigue usando siempre
`renderStatsPlaceholderCards()`.

`renderDayStatsReal(dateKey)` arma ocho tarjetas, una por
estadística, cada una con un ranking de **barras horizontales**
(nunca columnas verticales) ordenado de mayor a menor, mediante
`renderRankingCard(icon, accent, title, rows)` →
`renderRankingBars(rows)`:

- El ancho de cada barra es proporcional al valor máximo **del
  propio ranking** (no a una escala fija), así que siempre se ve
  bien sea la unidad minutos, pesos o cantidad de veces.
- El primer puesto (`rows[0]`, ya vienen ordenados) se destaca con
  🏆 antepuesto al nombre, color de acento en nombre/valor y un
  borde con glow en la barra (`.ranking-row-winner`).
- Si el ranking queda vacío (nadie tiene ese dato ese día), la
  tarjeta muestra "Sin datos para este día." en vez de barras.
- Un jugador que no cargó cierto dato ese día simplemente no entra
  en esa tarjeta puntual (no se le asigna 0 artificialmente); sí
  puede aparecer en otras tarjetas donde sí tiene dato.

Las ocho estadísticas y su fuente de datos (siempre `adminPlayers` /
`adminPrevias`, nunca `userData:<id>` directamente):

1. **Horas dormidas** — `entry.computed.sleepMinutes` de
   `dailyEntries[dateKey]` de cada jugador; formateado con
   `formatDuration()`.
2. **Cantidad de siestas** — por día es binario (`entry.nap` con
   `start`/`end` presentes → 1, si no → 0); se muestra "Sí"/"No".
3. **Quinta comida** — `entry.fifthMeal === "yes"` → 1, `"no"` → 0;
   "Sí"/"No". Si `fifthMeal` es `null` (no cargado), el jugador no
   entra en el ranking.
4. **Veces que fue al baño** — `entry.bathroom` (0–5), formateado
   "N vez"/"N veces".
5. **Tiempo dentro del boliche** — `entry.computed.bolicheMinutes`;
   `formatDuration()`.
6. **Dinero gastado total** — suma de `movements` con
   `type === "expense"` de cada jugador cuyo día de viaje atribuido
   (`isoToTripDayKey(m.date)`, ver corrección en v0.14.0 más abajo)
   coincide con `dateKey`; `formatMoney()`.
7. **Dinero gastado por categoría** — mismo conjunto de gastos que el
   punto anterior, pero agrupados por `category` en vez de por
   jugador/nombre (ranking de categorías, no de participantes).
8. **Cantidad de previas** — de `adminPrevias`, se filtran las
   previas cuyo día de viaje atribuido (`isoToTripDayKey(p.createdAt)`)
   cae en `dateKey`, y se cuenta cuántas veces aparece cada `id`
   dentro de `participantIds` (un jugador puede estar en varias
   previas el mismo día).

Función `isoToTripDayKey(isoString)` (análoga a `todayKey()` pero
para cualquier fecha ISO, corregida en v0.14.0 — ver más abajo):
convierte un timestamp completo (`movements[i].date`,
`previa.createdAt`, siempre generados con `new Date().toISOString()`)
al día de viaje al que se atribuye, para poder compararlo contra el
`dateKey` (también local) del
día de viaje seleccionado.

Estilos nuevos en `styles.css`: `.stats-real-list`, `.ranking-card`
(tarjeta vertical, reutiliza `.feature-card`), `.ranking-card-header`,
`.ranking-list`, `.ranking-row` (`grid` de 3 columnas: nombre / barra
/ valor, con `minmax(0, ...)` para que el nombre se recorte con
ellipsis en vez de generar scroll horizontal), `.ranking-bar-track`/
`.ranking-bar-fill`, `.ranking-row-winner` y una media query a 360px
que reduce un poco el ancho de la columna de nombre y el tamaño de
fuente. Verificado que no se introduce scroll horizontal en ningún
ancho entre 360–430px.

Verificado: sintaxis de `script.js` sin errores; las ocho funciones
`dayRanking*` (`dayRankingHorasDormidas`, `dayRankingSiestas`,
`dayRankingQuintaComida`, `dayRankingBanio`, `dayRankingBoliche`,
`dayRankingDineroTotal`, `dayRankingDineroPorCategoria`,
`dayRankingPrevias`) probadas de forma aislada con un set de datos de
ejemplo (tres jugadores con distintas combinaciones de datos
cargados/faltantes, gastos en varias categorías, previas
compartidas) confirmando: orden descendente correcto, formato de
cada valor, y que un jugador sin dato puntual no aparece en esa
tarjeta.

## Estructura base de Estadísticas en /admin (v0.10.0)

Nueva sección **Estadísticas**, accesible desde una tarjeta tocable
"Estadísticas" dentro de /admin (dejó de estar "Próximamente"),
pantalla nueva `#/stats`. Solo Gio puede entrar: si otro usuario
fuerza el hash `#/stats`, se lo redirige a `/home` (mismo
comportamiento que `#/admin` y `#/previas`, agregado a la misma
condición en `navigate()`).

- **Selector de pestaña** arriba de todo: "Día" / "Total"
  (`.stats-tabs`), un solo apartado visible a la vez, estado en la
  variable de módulo `statsTab`.
- **DÍA**:
  - `getStatsClosedDays()` calcula el conjunto de días "cerrados":
    unión de todas las claves de `dailyEntries` de todos los
    jugadores en `adminPlayers`, filtrando cualquier clave `>=` a la
    fecha de hoy (`todayKey()`), y ordenadas de más antigua a más
    reciente. Nunca incluye el día actual ni un día futuro.
  - Navegación `← día →` (`stats-day-prev` / `stats-day-next`) sobre
    ese arreglo mediante el índice `statsDayIndex`; los botones se
    deshabilitan en los extremos (no da la vuelta). El día
    seleccionado se muestra centrado con el mismo formato de fecha en
    español que usa Registro diario (`formatDailyDate`).
  - Si todavía no hay ningún día cerrado (ningún jugador con
    `dailyEntries` importados, o todas sus fechas son de hoy/futuro),
    se muestra "Sin días cerrados" en el título y una nota explicando
    que la navegación se habilita en cuanto haya el primer día
    completo importado; ambas flechas quedan deshabilitadas.
  - Debajo, cuatro tarjetas "Próximamente" (mismo estilo que las
    tarjetas bloqueadas ya existentes en /admin) para las categorías
    previstas: Sueño, Dinero, Boliche, Rankings. Sin cálculo real
    todavía (a propósito, según lo pedido).
- **TOTAL**: misma estructura visual exacta que DÍA (misma barra
  superior `.stats-day-nav`, mismas tarjetas debajo), pero sin
  flechas funcionales — se reemplazan por elementos "fantasma" del
  mismo tamaño para no romper el layout — y el centro muestra "Todo
  el viaje" + la cantidad de días cerrados disponibles (mismo
  `getStatsClosedDays()` que usa DÍA, solo que acá se cuenta el total
  en vez de navegar uno por uno).
- Sin cálculo real de estadísticas todavía en ningún apartado en esta
  versión (v0.10.0); implementado después para DÍA en v0.11.0 y para
  TOTAL en v0.12.0 (ver ambas secciones más arriba).
- Diseño vertical, mobile-first, mismo lenguaje visual que el resto
  de /admin (tarjetas oscuras, acento ámbar, `section-label`).
- Verificado: sintaxis de `script.js` sin errores; lógica de
  `getStatsClosedDays()` probada por separado (excluye hoy y fechas
  futuras, incluye y ordena correctamente los días pasados con
  datos); IDs de `index.html` referenciados desde `script.js`
  confirmados uno por uno.

## Pendiente

- Sistema de días del viaje mediante fecha de inicio configurada (hoy
  el registro diario siempre apunta a "ayer").
- Eliminar/editar una previa ya guardada (`adminPrevias` y
  `localPrevias:<id>`).
- Rankings/estadísticas que todavía no tienen tarjeta propia: hora
  promedio de salida del boliche, gasto diario (serie temporal),
  comparaciones entre participantes más allá del ranking simple,
  títulos humorísticos agregados (más allá del "podio" visual ya
  agregado en v0.13.0, que resalta el ganador de cada estadística
  puntual pero no arma un resumen tipo "títulos del día/viaje").
- Títulos/premios (resumen compuesto entre varias estadísticas, no el
  pulido visual por-estadística de v0.13.0).
- Backups.

## Próximo objetivo

Títulos/premios humorísticos compuestos a partir de los rankings de
DÍA/TOTAL ya calculados (más allá del ganador destacado por tarjeta,
ya resuelto visualmente en v0.13.0), y sistema de días del viaje
(fecha de inicio configurada).

