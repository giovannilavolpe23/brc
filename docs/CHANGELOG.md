# CHANGELOG

## v0.16.2 (fix: fecha de “Registrar datos” no se actualizaba con day())

Bug puramente visual en `#/daily` (Registrar datos): el banner
“Registrando el día de ayer” cacheaba la clave de fecha
(`dailyDateKey`) una sola vez por sesión, así que al usar la
herramienta de testing `day(dia, mes)` para cambiar la fecha
simulada, el texto se quedaba mostrando la fecha con la que se
había entrado a la pantalla la primera vez.

- `renderDailyScreen()` ahora recalcula la clave de fecha
  (`getYesterdayKey()`, que ya lee la fecha simulada de `day()` a
  través de `getSimulatedToday()`) en cada render, y solo recarga
  el registro guardado de ese día si la clave realmente cambió
  (evita perder datos sin guardar del día que se estaba
  completando si el render se dispara por otra razón).
- Sin `day()` activo sigue usando la fecha real del dispositivo,
  sin cambios.
- Con `day()` activo, como ya actualiza la pantalla actual al
  instante (`refreshCurrentScreenForDaySim`, v0.16.1), el texto de
  “Registrando el día de ayer” ahora cambia apenas se ejecuta
  `day(dia, mes)` en la consola, sin refresh.
- No se hardcodeó ninguna fecha: el texto sale siempre de
  `formatDailyDate(dailyDateKey)`, calculado a partir de la fecha
  interna de la app (real o simulada).
- No se tocó ninguna otra funcionalidad de Registro diario (picks
  de sueño/siesta/boliche, guardado, etc.).



## v0.15.0 (pulido visual v2 de Estadísticas: jerarquía, espaciado, plata/bronce, estados vacíos)

Segunda pasada de pulido puramente visual/UX sobre `#/stats`. No se
tocó ningún cálculo, fuente de datos, día cerrado, categoría, previa
ni formato de código — solo el HTML/clases que arman
`renderRankingBars`/`renderRankingCard` y el CSS de la sección.

- Más espacio entre tarjetas (`.stats-real-list` gap 10px → 20px) y
  dentro de cada tarjeta (línea divisoria bajo el header) para que la
  pantalla no se sienta saturada con las ocho estadísticas juntas.
- Filete superior de color por tarjeta + leyenda en el color de
  acento propio de la estadística, para diferenciarlas de un vistazo.
- Podio del 1er puesto con tag "1er puesto", nombre en su propia
  línea, barra más alta y un destello que la recorre al llenarse.
- 2° y 3° puesto con tinte plata/bronce propio en nombre y barra (ya
  no comparten color con el resto de la lista); 4° en adelante con
  insignia circular numerada.
- Valores del ranking en negrita para lectura más rápida.
- Transición entre días: desplazamiento + leve escala (antes solo
  desplazamiento); se sigue respetando `prefers-reduced-motion`.
- Estados "sin datos" rediseñados: banner con ícono y borde punteado
  para "todavía no hay días cerrados"; bloque centrado con ícono para
  "sin datos para esta tarjeta puntual" (antes ambos eran texto
  plano).
- Punto de acento junto a "ESTADÍSTICAS DEL DÍA"/"ESTADÍSTICAS
  TOTALES" para separar mejor esa etiqueta del bloque de navegación.
- Verificado con Playwright (360px y 390px, varios jugadores, DÍA y
  TOTAL, nombres largos, estado sin días cerrados): sin scroll
  horizontal, ellipsis correcto en podio/filas, y los cálculos de
  Dinero/Previas corregidos en v0.14.0 se siguen viendo bien con la
  nueva presentación.



## v0.14.0 (fix: Dinero/Previas en Estadísticas mostraban "Sin datos" con datos reales)

- **Bug corregido**: las tarjetas "Dinero gastado total", "Dinero
  gastado por categoría" y "Cantidad de previas" (DÍA y TOTAL, dentro
  de `#/stats`) mostraban "Sin datos..." aun cuando `adminPlayers` y
  `adminPrevias` tenían gastos/previas reales. Causa: los gastos y
  las previas se guardan con la fecha/hora real de carga, pero un
  "día cerrado" nunca incluye el día de hoy (`key < todayKey()`); al
  comparar la fecha de carga tal cual contra el día seleccionado, la
  comparación casi nunca coincidía.
- **Fix**: se atribuye cada gasto/previa al día calendario anterior a
  su fecha real de carga (`isoToTripDayKey`, reemplaza a
  `isoToLocalDateKey`), igual que ya hace Registro diario
  (`getYesterdayKey`) — el usuario carga los datos de ayer recién al
  despertarse. Se actualizaron los cuatro puntos que dependían de la
  comparación de fecha: `dayExpenses`, `dayRankingPrevias`,
  `totalExpenses`, `totalRankingPrevias`.
- No se tocaron las demás estadísticas (Horas dormidas, Siestas,
  Quinta comida, Baño, Boliche): ya funcionaban correctamente, siguen
  usando `dailyEntries[dateKey]` sin pasar por esta comparación de
  fecha real de carga.
- No se creó ninguna estructura de datos nueva ni una segunda fuente
  de estadísticas: se sigue leyendo únicamente de `adminPlayers` /
  `adminPrevias`.
- Verificado: `node --check script.js` sin errores; simulación manual
  del caso típico (gasto cargado la mañana siguiente a haberlo hecho)
  confirmando que ahora se atribuye al día cerrado correcto.

## v0.13.0 (pulido visual de Estadísticas: competencia del viaje, no dashboard)

Revisión y pulido puramente visual/UX de la sección **Estadísticas**
(`#/stats`, DÍA y TOTAL). No se tocó ningún cálculo existente, no se
agregaron estadísticas nuevas y no se rehizo la pantalla: sigue
usando las mismas 8 tarjetas, las mismas fuentes de datos
(`adminPlayers` / `adminPrevias`) y las mismas funciones
`dayRanking*` / `totalRanking*` de v0.11.0/v0.12.0, intactas.

- **Podio del ganador**: el 1° puesto de cada ranking ya no es
  simplemente la primera fila de la lista — se separa en un bloque
  propio ("podio") con corona 🏆 animada, fondo con degradé ámbar,
  borde con glow y el nombre en tipografía más grande. El objetivo es
  que sea imposible no ver quién va ganando esa estadística con solo
  mirar la tarjeta un instante.
- **Medallas para el resto del ranking**: 2° puesto con 🥈, 3° con
  🥉, y número de puesto simple del 4° en adelante (antes todos los
  puestos se veían iguales salvo el primero).
- **Títulos más lúdicos**: cada tarjeta pasa de un título literal
  ("Horas dormidas", "Dinero gastado total") a un título de
  competencia ("¿Quién durmió más?", "El más gastador", "Resistencia
  en el boliche", "Rey/reina de las previas", etc.), con una leyenda
  chica debajo que conserva el nombre literal del dato ("Horas
  dormidas", "Gasto total del día") para que siga siendo inequívoco
  qué se está midiendo. Ningún cálculo cambió, solo el copy.
- **Animación de las barras**: las barras ya no aparecen con su ancho
  final de entrada; arrancan en 0% y crecen hasta su valor real con
  una transición suave (`cubic-bezier`), en cascada (cada fila un
  poco después que la anterior). Se implementa con
  `animateRankingBars()`, que setea el ancho final vía
  `requestAnimationFrame` doble después de insertar el HTML, sin
  tocar ningún valor calculado.
- **Transiciones entre días**: navegar con `← día →` ahora desliza el
  contenido en la dirección correspondiente (siguiente entra desde la
  derecha, anterior desde la izquierda); cambiar de pestaña Día/Total
  usa un fade simple. Como el panel se re-renderiza por completo en
  cada navegación, la animación se dispara sola sin necesidad de
  trackear estado adicional más allá de una dirección (`statsNavDir`)
  que se resetea después de usarse.
- **Entrada en cascada de las tarjetas**: al abrir Estadísticas o
  cambiar de día/pestaña, las 8 tarjetas aparecen con un fade+slide
  escalonado en vez de aparecer todas de golpe.
- **Feedback visual**: los tabs Día/Total y los botones de navegación
  ya tenían `:active` con escala; se reforzó la transición para que
  se sienta más responsive al tocar.
- **Legibilidad en celular**: se subieron levemente los tamaños de
  fuente de nombres y valores dentro del ranking, se mejoró el
  contraste de la leyenda de cada tarjeta, y se ajustó el grid de
  cada fila (nueva columna de puesto/medalla) para que seguir
  funcionando sin scroll horizontal en 360–430px, incluso con nombres
  largos (ver bug corregido abajo).
- **Bug encontrado y corregido durante el pulido** (no relacionado a
  cálculos): con nombres de jugador muy largos, el bloque del podio
  se salía del ancho de la tarjeta en vez de truncar con ellipsis,
  por falta de `min-width: 0` en la cadena de contenedores flex
  (`.ranking-wrap`, `.ranking-podium`, `.ranking-list`). Corregido;
  verificado con Playwright en 360px con un nombre artificialmente
  largo que ahora trunca correctamente sin desbordar ni generar
  scroll horizontal.
- CSS nuevo en `styles.css` (sección "Estadísticas (DÍA / TOTAL)"):
  `.stats-panel-inner` (+ variantes `.stats-slide-next` /
  `.stats-slide-prev`), `.ranking-wrap`, `.ranking-podium` y
  subelementos, `.ranking-rank`, más los keyframes `statsFadeUp`,
  `statsSlideNext`, `statsSlidePrev` y `crownFloat`. Se agregó un
  bloque `@media (prefers-reduced-motion: reduce)` que desactiva
  todas las animaciones nuevas de Estadísticas.
- JS modificado en `script.js`: `renderRankingBars()` (arma podio +
  lista, ya no calcula nada nuevo, solo cambia el HTML/orden visual),
  `renderRankingCard()` (nuevo parámetro `caption`), nueva
  `medalForRank()`, nueva `animateRankingBars()`, `renderStatsPanel()`
  (nuevo estado de módulo `statsNavDir` para la dirección de
  transición). `dayRanking*` y `totalRanking*` (los 16
  cálculos) **no se tocaron**.
- Verificado con Playwright en 360px y 390px: `#/stats` con datos de
  ejemplo (varios jugadores, gastos en distintas categorías, previas
  compartidas, un jugador con nombre largo) — podio y ranking se ven
  correctamente en DÍA y TOTAL, navegación entre días con transición
  direccional, cambio de pestaña con fade, sin scroll horizontal, sin
  errores de consola. También verificado el estado sin días cerrados
  (placeholder "Próximamente"), que no cambió.

## v0.12.0 (cálculo real de Estadísticas · TOTAL: mismas 8 estadísticas, acumuladas)

- **TOTAL** deja de mostrar siempre las tarjetas "Próximamente":
  cuando hay al menos un día cerrado, calcula las **mismas ocho
  estadísticas que DÍA**, pero acumulando todos los días cerrados
  disponibles (mismo `getStatsClosedDays()` que ya usaba DÍA para
  navegar), en vez de un único día:
  - Horas dormidas (suma de `sleepMinutes` de todos los días).
  - Cantidad de siestas (cuenta de días con siesta, ya no "Sí"/"No").
  - Quinta comida (cuenta de días con `fifthMeal === "yes"`).
  - Veces que fue al baño (suma de `bathroom` de todos los días).
  - Tiempo total dentro del boliche (suma de `bolicheMinutes`).
  - Dinero gastado total (suma de gastos de todos los días
    cerrados).
  - Dinero gastado por categoría (mismos gastos, agrupados por
    categoría).
  - Cantidad de previas (participación acumulada en todas las
    previas de los días cerrados).
- Ocho nuevas funciones `totalRanking*()` (`totalRankingHorasDormidas`,
  `totalRankingSiestas`, `totalRankingQuintaComida`,
  `totalRankingBanio`, `totalRankingBoliche`,
  `totalRankingDineroTotal`, `totalRankingDineroPorCategoria`,
  `totalRankingPrevias`) y `totalExpenses()` (análoga a
  `dayExpenses()` pero filtrando por el conjunto de días cerrados en
  vez de una sola fecha), todas recibiendo `closedDays` como
  parámetro.
- Nueva `renderTotalStatsReal(closedDays)`, hermana de
  `renderDayStatsReal(dateKey)`: mismas ocho tarjetas, mismos íconos,
  mismo orden — **ningún componente visual nuevo**, se reutilizan
  `renderRankingCard()`/`renderRankingBars()` tal cual.
  `renderRankingBars()`/`renderRankingCard()` ahora aceptan un
  `emptyMessage` opcional ("Sin datos para este día." en DÍA, "Sin
  datos en todo el viaje." en TOTAL).
- Mismo criterio que DÍA para no inventar datos: un jugador entra en
  el ranking de una tarjeta solo si tiene al menos un día cerrado con
  ese dato cargado; si tiene el dato en algunos días y no en otros,
  solo se acumulan los días donde sí lo cargó.
- Sin CSS nuevo: TOTAL reutiliza exactamente las mismas clases que ya
  se habían agregado para DÍA en v0.11.0 (`.ranking-card`,
  `.ranking-row`, barras horizontales, ganador destacado, sin scroll
  horizontal en mobile).
- Verificado: sintaxis de `script.js` sin errores; las ocho funciones
  `totalRanking*` probadas de forma aislada con un caso de dos días
  cerrados y tres jugadores con datos parciales, confirmando
  acumulación correcta, orden descendente y que un jugador sin
  ningún día con determinado dato no aparece en esa tarjeta.

## v0.11.0 (cálculo real de Estadísticas · DÍA: rankings de barras horizontales)

- **DÍA** deja de mostrar tarjetas "Próximamente" (cuando ya hay al
  menos un día cerrado) y calcula ocho rankings reales a partir de
  `adminPlayers` y `adminPrevias`, todos como **rankings de barras
  horizontales** ordenados de mayor a menor, con el primer puesto
  destacado visualmente (🏆, color de acento, borde con glow):
  - Horas dormidas (`entry.computed.sleepMinutes`).
  - Cantidad de siestas (Sí/No, `entry.nap`).
  - Quinta comida (Sí/No, `entry.fifthMeal`).
  - Veces que fue al baño (`entry.bathroom`).
  - Tiempo dentro del boliche (`entry.computed.bolicheMinutes`).
  - Dinero gastado total (suma de `movements` tipo `expense` cuya
    fecha real de carga cae en el día seleccionado).
  - Dinero gastado por categoría (mismo conjunto de gastos,
    agrupado por `category` en vez de por jugador).
  - Cantidad de previas (participación de cada jugador en las
    `adminPrevias` creadas ese día).
- Nueva función `isoToLocalDateKey()` para comparar la fecha real
  (ISO, hora de carga) de un movimiento o una previa contra la clave
  `YYYY-MM-DD` (local) de un día de viaje cerrado.
- Un jugador sin dato para una estadística puntual ese día
  simplemente no aparece en esa tarjeta (no se inventan ceros); si
  ninguno tiene datos, la tarjeta muestra "Sin datos para este día."
  en vez de un ranking vacío.
- Nuevas funciones de render: `renderRankingBars()` (barra horizontal
  genérica, ancho proporcional al máximo del propio ranking) y
  `renderRankingCard()` (tarjeta con ícono + título + ranking),
  usadas por `renderDayStatsReal()`.
- Nuevos estilos `.ranking-card`, `.ranking-list`, `.ranking-row`,
  `.ranking-bar-track/-fill`, `.ranking-row-winner`, con `grid` de
  tres columnas (nombre / barra / valor) que nunca produce scroll
  horizontal y se ajusta con una media query a 360px.
- **TOTAL** no se modificó en esta iteración: sigue mostrando las
  tarjetas "Próximamente", según lo pedido.
- Verificado: sintaxis de `script.js` sin errores; lógica de las
  ocho funciones `dayRanking*` probada de forma aislada con datos de
  ejemplo (varios jugadores, gastos en distintas categorías,
  previas compartidas, jugador sin algún dato del día) confirmando
  orden descendente, formato de cada valor (`formatDuration`,
  `formatMoney`, "Sí"/"No", "N vez/veces") y el HTML generado.

## v0.10.0 (estructura base de Estadísticas en /admin: DÍA / TOTAL)

- Nueva sección **Estadísticas** en /admin (`#/stats`), accesible
  desde una tarjeta tocable que reemplaza el "Próximamente" anterior.
  Exclusiva de Gio: si otro usuario fuerza el hash `#/stats`, se lo
  redirige a /home (misma regla que `#/admin` y `#/previas`).
- Selector de pestaña **DÍA / TOTAL** arriba de todo, con la misma
  identidad visual del resto de /admin.
- **DÍA**: navegación simple ← / → entre los días ya cerrados del
  viaje (`getStatsClosedDays()`: unión de las fechas con registro
  diario de todos los jugadores en `adminPlayers`, excluyendo siempre
  el día de hoy y cualquier fecha futura). El día elegido se muestra
  siempre bien visible en el centro; las flechas se deshabilitan en
  los extremos. Sin días cerrados todavía, se muestra un mensaje
  explicativo en vez de navegación activa.
- **TOTAL**: exactamente la misma estructura visual que DÍA (misma
  barra superior y mismas tarjetas debajo), acumulando todos los días
  disponibles; sin flechas funcionales, con la cantidad total de días
  cerrados en el centro.
- Debajo de la navegación, tarjetas "Próximamente" para las cuatro
  categorías previstas (Sueño, Dinero, Boliche, Rankings): todavía
  sin cálculo real de estadísticas ni rankings, según lo pedido —
  solo queda preparada la estructura para recibirlos.
- Diseño vertical, mobile-first, sin overflow horizontal, reutilizando
  los mismos patrones visuales existentes (tarjetas oscuras, acento
  ámbar, `section-label`).

## v0.9.0 (previas: código + importación en /admin, permiso especial para Jere)

- **Código de una previa**: reutiliza exactamente el mismo
  formato/codificación del código de intercambio ya existente
  (`BRL<version>.` + XOR con `EXPORT_XOR_KEY` + Base64 URL-safe,
  mismas funciones `xorBytes`/`bytesToBase64Url`/`base64UrlToBytes`/
  `decodeExportCode`); solo cambia la forma del payload
  (`{ version, type: "previa", previa: {...} }`). Nuevas funciones
  `buildPreviaExportPayload`, `generatePreviaExportCode`,
  `validatePreviaImportPayload`, `parseAndValidatePastedPreviaCode`.
- **Importar previa por código en /admin**: nuevo botón "Introducir
  código de previa" dentro de `#/previas` (solo Gio). Flujo pegar →
  validar → previsualizar (participantes, productos, total, monto
  por persona, fecha) → confirmar → guardar, igual que el resto de
  las importaciones de la app. Si el `id` de la previa ya estaba en
  `adminPrevias`, se avisa "Esta previa ya fue importada" y no se
  duplica (verificado reimportando el mismo código dos veces). Al
  confirmar, la previa importada queda con exactamente los mismos
  campos que una registrada a mano por Gio, así que se ve y se
  comporta idéntica en el historial.
- **Permiso especial para Jere**: nuevo flag simple y explícito
  `canRegisterPrevias: true` solo en la entrada de Jere dentro de
  `PARTICIPANTS` (Gio sigue siendo el único con `isAdmin: true`).
  Jere sigue siendo un usuario normal: sin acceso a `/admin`,
  jugadores, estadísticas ni ninguna otra función administrativa.
- **Sección "Previas" en el Home de Jere**: nueva ruta
  `#/previas-jere`, accesible desde una tarjeta que aparece debajo de
  las tarjetas normales de Home solo para quien tiene el permiso
  (verificado que Sebas, un usuario normal sin el flag, no la ve).
  Reutiliza el mismo componente/lógica de armado de previa que usa
  /admin (misma función `renderPreviasScreen()`, distinta solo en una
  variable de modo `previaMode` que decide dónde persiste), sin
  crear una segunda interfaz administrativa.
- **Almacenamiento local de Jere**: sus previas se guardan en
  `localStorage` bajo `localPrevias:<id>` (namespaced por usuario,
  separado de `adminPrevias`) hasta que Gio importa el código
  correspondiente desde /admin; no se consideran parte de la base
  administrativa consolidada antes de eso. Al confirmar una previa
  local se muestra de una el código para copiar y enviarle a Gio; el
  historial local también permite copiar el código de cualquier
  previa ya guardada.
- No se implementó todavía (según lo pedido): eliminar/editar una
  previa ya guardada (ni en `adminPrevias` ni en `localPrevias:<id>`),
  ni estadísticas a partir de las previas.
- Verificado con Playwright (Chrome headless) en 390px: circuito
  completo login Jere → Home normal sin nav de Admin → sección
  Previas visible → registrar previa (2 participantes, 1 producto) →
  código generado con formato `BRL1....` → copiar → login Gio →
  pegar código en "Introducir código de previa" → previsualizar →
  confirmar → previa visible en historial administrativo con
  participantes resueltos → reimportar el mismo código no duplica →
  Sebas (usuario normal) sin acceso a la sección ni a `#/previas-jere`
  → sin overflow horizontal en ningún paso → sin errores de consola.
- Documentación: `SPEC.md` y `CURRENT_STATE.md` actualizados a
  v0.9.0.

## v0.8.1 (previas: confirmación al guardar + monto por persona)

- **Confirmación antes de guardar**: tocar "Guardar previa" ya no
  guarda directamente; primero se valida (mínimo 1 participante y 1
  producto) y después se abre un bottom sheet "¿Estás seguro de
  registrar esta previa?" con el resumen completo. Solo al tocar "Sí,
  registrar previa" se escribe en `localStorage`; "Cancelar" no
  modifica nada y deja el formulario tal cual estaba (probado).
- **Monto a pagar por persona**: nuevo cálculo `total ÷ cantidad de
  participantes` (probado con 6 participantes y total $60.000 →
  $10.000 por persona exacto), visible en vivo mientras se arma la
  previa y también en el sheet de confirmación.
- **Resumen claro**: tanto en la pantalla de armado como en el sheet
  de confirmación se muestran juntos "Total de la previa",
  "Participantes" (cantidad) y "A pagar por persona".
- El monto por persona se calcula una sola vez al confirmar y se
  guarda dentro de la propia previa (`amountPerPerson`), para que
  viaje junto con el resto de sus datos en cualquier código de
  exportación futuro que incluya previas, en vez de recalcularse cada
  vez que se muestra.
- El historial de previas ahora también muestra "A pagar por
  persona" en cada tarjeta (con cálculo de respaldo para previas
  guardadas antes de este cambio, que no tenían `amountPerPerson`).
- No se implementó eliminación ni edición de previas ya guardadas
  (según lo pedido).
- Verificado con Chrome headless (Playwright) en 390px: flujo
  completo de selección, agregar producto, cancelar confirmación
  (sin cambios), confirmar (guarda con `amountPerPerson` correcto),
  historial y persistencia tras recarga; sin overflow horizontal.
- Documentación: `SPEC.md` y `CURRENT_STATE.md` actualizados a
  v0.8.1.

## v0.8.0 (registro manual de previas en /admin)

- Primera parte del sistema de previas (SPEC.md → "Previas"), siempre
  desde /admin, nunca desde las cuentas individuales de los usuarios.
- Nueva pantalla `#/previas`, accesible desde una tarjeta tocable
  "Previas" en /admin (dejó de estar "Próximamente"). Restringida a
  Gio: forzar el hash con otro usuario redirige a `/home`, igual que
  `#/admin`.
- **Participantes**: chips de selección múltiple con los 11
  participantes; se puede seleccionar y deseleccionar libremente.
- **Productos**: alta vía bottom sheet (nombre, precio unitario,
  cantidad), con lista editable de productos ya agregados y botón
  para quitar cada uno antes de guardar.
- **Total**: calculado en vivo como suma de `precio × cantidad` de
  todos los productos (probado con 2×$5.000 + 3×$1.500 = $14.500).
- **Guardar previa**: exige al menos un participante y un producto
  (probado, cero cambios en `localStorage` si falta alguno); genera
  un id único (`genId()`) y guarda participantes, productos y total
  en una nueva clave `adminPrevias` de `localStorage`, separada de
  `userData:<id>` y `adminPlayers`.
- **Historial de previas**: lista todas las previas guardadas (más
  reciente primero) con participantes, productos, total, fecha/hora e
  identificador; persiste correctamente tras cerrar y reabrir la web
  (probado con una recarga real del navegador).
- Verificado con Chrome headless (Playwright) en 360px y 390px: sin
  overflow horizontal en ningún paso del flujo.
- No implementado todavía (según lo pedido): dividir el gasto entre
  participantes, códigos ni importación de previas.
- Documentación: `SPEC.md` ampliado con "Previas" → "Registro manual
  (implementado)"; `CURRENT_STATE.md` actualizado a v0.8.0.

## v0.6.0 (sistema de jugadores en /admin)

- Cierra el circuito completo de transferencia de datos: **usuario
  genera código → se lo pasa a Gio por WhatsApp → Gio lo pega en
  /admin → importar/actualizar jugador**. Reutiliza exactamente el
  sistema de códigos ya existente (`decodeExportCode`,
  `EXPORT_CODE_VERSION`) — no se inventó ningún formato nuevo.
- Nueva clave de almacenamiento `adminPlayers` en `localStorage`,
  namespaced por id de participante, completamente separada de
  `currentUser` y de `userData:<id>`. Es la copia consolidada propia
  de Gio: importar datos de un jugador nunca toca los datos locales
  de otro usuario (verificado).
- **Agregar jugador**: nuevo botón "+ Agregar jugador" en /admin →
  bottom sheet con textarea grande + botón "Importar". Nueva función
  `validateImportPayload(payload)` comprueba versión soportada,
  presencia de un id de usuario válido y la estructura esperada de
  `data` (movements/initialBalance/dailyEntries) antes de guardar
  nada; si algo falla, error claro y cero cambios (probado con texto
  que no es un código válido).
- **Detección de duplicados**: si el jugador ya está cargado, se
  avisa explícitamente y se ofrece actualizar en lugar de duplicar
  (probado, sin crear una segunda entrada).
- **Actualizar/editar jugador**: cada fila de la lista de jugadores
  es tocable y permite actualizar sus datos con un código nuevo,
  siguiendo el mismo flujo de pegar → validar → previsualizar →
  confirmar. Nueva validación cruzada: si el código pegado pertenece
  a otro jugador distinto al que se está actualizando, se rechaza con
  mensaje explícito, evitando mezclar datos entre jugadores (probado
  con el código de Jere mientras se actualizaba a Sebas).
- **Previsualización antes de guardar**: al pegar un código válido se
  muestra nombre del jugador, saldo inicial, cantidad de gastos,
  ganancias y registros diarios; los datos solo se escriben en
  `localStorage` al confirmar explícitamente.
- Nueva sección "Jugadores importados" en /admin: contador de
  jugadores cargados, botón de alta y lista con avatar, nombre, fecha
  y hora de última actualización (formato 24h) y etiqueta "Cargado".
  Se quitó la tarjeta "Códigos de datos" de "Próximas funciones", ya
  que pasó a estar implementada.
- Mismo lenguaje visual que el resto de la app (bottom sheet,
  tarjetas oscuras, acento ámbar); no se rehizo la estética general.
- Verificado con Chrome headless en 360px: sin overflow horizontal en
  ningún paso del flujo (textarea con código largo, mensajes de
  error, previsualización, lista de jugadores).
- Documentación: `SPEC.md` ampliado con la sección "Jugadores
  importados (implementado)" (almacenamiento, alta, actualización,
  validación y prevención de duplicados); `CURRENT_STATE.md`
  actualizado a v0.6.0.

## v0.5.0 (exportación de datos por código + WhatsApp)

- Implementada la sección **Envío de datos** de /home, antes marcada
  como "Próximamente".
- Nueva función central de generación `generateExportCode(userId)`:
  arma un código compacto y reversible (`BRL<versión>.<base64url>`)
  a partir de TODOS los datos actuales del usuario (saldo inicial,
  gastos, ganancias y registros diarios), siempre leídos en el
  momento desde `localStorage` (nunca un valor viejo). Internamente
  usa `buildExportPayload(userId)` como único punto donde se decide
  qué datos entran en el código, para que agregar un dato nuevo en
  el futuro no requiera tocar el resto del pipeline.
- Nueva función central de decodificación `decodeExportCode(code)`,
  inversa exacta de la anterior (valida prefijo y versión antes de
  parsear). Probada con un round-trip completo, incluyendo nombres de
  gastos con emojis y comillas. Todavía no se conecta a ninguna
  pantalla (la importación en /admin queda para una próxima
  iteración, según lo pedido).
- El código se ofusca con un XOR reversible simple (clave fija) +
  Base64 URL-safe. No es cifrado criptográfico real, tal como se
  pidió: alcanza con que no sea legible a simple vista y que sea
  compacto para pegar en un mensaje de WhatsApp.
- Formato versionado desde el arranque (`EXPORT_CODE_VERSION = 1`,
  duplicado como prefijo del código y como campo dentro del JSON) para
  poder cambiar la estructura de datos en el futuro sin romper
  códigos ya generados.
- Nueva pantalla `#/export`: muestra el código en un cuadro de solo
  lectura, botón **"Copiar código"** (con confirmación visual "✓
  Código copiado") y botón **"Enviar datos a Gio"**, que regenera el
  código en el momento del click y abre WhatsApp
  (`wa.me/5491127362080`) con el mensaje "BARILOCHE_DATA / Código: /
  [CODIGO]" ya cargado, listo para que el usuario lo revise antes de
  enviarlo (nunca se manda automáticamente).
- Tarjeta "Envío de datos" de home destrabada; el tab inferior "Home"
  se mantiene activo, igual que con Dinero y Registro diario.
- Documentado en `SPEC.md` (sección "Código de intercambio") el
  formato completo del código, la versión actual, el algoritmo paso
  a paso, las funciones responsables de generar/decodificar, qué
  datos contiene y cómo mantener la compatibilidad si el formato
  cambia en el futuro.
- No se tocó la estética general ni el resto de la app. No se
  implementó todavía importación desde /admin, estadísticas,
  rankings ni previas, según lo pedido.

## v0.4.0 (auditoría de datos por usuario + fixes)

- **Auditoría completa de datos**: se revisó toda la lógica de sesión,
  Dinero y Registro diario para confirmar que los datos de cada
  usuario (`userData:<id>`) están correctamente separados, que el
  logout nunca borra datos (solo `currentUser`) y que la futura
  administración va a poder leer los datos de todos sin modificar los
  originales de cada uno. Probado en secuencia real: Gio registra
  datos → logout → Sebas entra limpio → vuelve Gio con sus datos
  intactos. Sin pérdidas ni mezclas encontradas.
- **Fix**: `dailyDateKey` (caché en memoria de qué día está editando
  la pantalla de Registro diario) ahora se resetea al cerrar sesión,
  para que si se inicia sesión con otro usuario en la misma pestaña
  la pantalla vuelva a leer el `dailyLog` de ese usuario en vez de
  reusar el estado en memoria del anterior. No afectaba lo ya
  guardado (`saveDailyEntry` siempre escribía bajo el usuario
  logueado), pero podía mostrar en pantalla, sin guardar todavía,
  datos de otro usuario.
- **Nuevo**: cálculo automático de duraciones en el Registro diario,
  guardado en `entry.computed` junto con cada registro:
  - Horas de sueño entre hora de dormir y de despertarse (contempla
    cruce de medianoche).
  - Duración de la siesta.
  - Sueño total = sueño nocturno + siesta (ej. verificado del
    pedido: 6h + 3h = 9h).
  - Tiempo en el boliche, tomando la 01:00 como hora fija de llegada
    (ej. verificados del pedido: salida 02:00 → 1h, salida 05:30 →
    4h30).
  - Estos valores también se muestran en pantalla como feedback
    inmediato al completar los selectores de hora.
  - "No dormí" / "No fui al boliche" siguen dejando `null` sus
    duraciones correspondientes en vez de un valor inventado.
- **Fix de datos**: eliminada la categoría de gasto **"Transporte"**
  (ya no aparece en el picker de categorías). Las categorías válidas
  ahora son: Chocolates, Alcohol, Boliche, Comida, Bebida,
  Actividades, Otros. Se agregó `migrateExpenseCategories`, que corre
  cada vez que se abre Dinero: cualquier gasto ya guardado con
  "Transporte" se reasigna automáticamente a "Otros" sin tocar
  nombre, monto ni fecha, así que no rompe datos existentes.
- Auditado y confirmado sin cambios: saldo inicial, gastos, ganancias,
  saldo disponible, historial, edición/eliminación de movimientos y
  persistencia por usuario en Dinero siguen funcionando como en
  v0.2.x.
- Documentada en `CURRENT_STATE.md` la estructura completa de datos
  (`userData:<id>.money` y `.dailyLog`) y las reglas de separación
  por usuario confirmadas, para que cualquier continuación del
  proyecto no tenga que re-auditar desde cero.
- No se tocó la estética general ni se implementó el sistema de
  códigos, importación, WhatsApp, estadísticas visuales, rankings
  visuales ni previas, según lo pedido.


## v0.3.0 (sección Registro diario)

- Implementada la sección **Registro diario** de /home, antes marcada
  como "Próximamente".
- El usuario registra los datos del día anterior (fecha real del
  dispositivo − 1 día), mostrada en un banner en español, sin tener
  que escribir manualmente "Día 1", "Día 2", etc. Los registros se
  guardan por clave de fecha ISO (`userData:<id>.dailyLog.entries`),
  preparando el terreno para calcular el día de viaje automáticamente
  cuando exista una fecha de inicio configurada (no implementada
  todavía).
- **Horas dormidas**: selectores horizontales deslizables (sin inputs
  de texto) con opciones cada 10 minutos — hora de dormir 22:00→09:00
  del día siguiente (cruza medianoche correctamente) y hora de
  despertarse 06:00→16:00. Botón "No dormí" que omite y descarta
  ambos datos.
- **Siesta** opcional (oculta por defecto): botón "+ Registrar
  siesta" agrega selectores de inicio/fin entre 14:00 y 22:00 cada 10
  minutos; botón "Quitar siesta" la cancela.
- **Quinta comida**: chips Sí/No de un toque.
- **Veces al baño**: chips de selección rápida 0 a 5, sin input
  numérico.
- **Hora de salida del boliche**: mismo patrón de selector horizontal,
  01:00→07:00 cada 10 minutos, con botón "No fui al boliche" que omite
  y descarta la hora.
- Guardar es idempotente por día: si ya existe un registro para la
  fecha del día anterior, se actualiza en el mismo lugar en vez de
  crear un duplicado, y la pantalla precarga los datos guardados al
  reabrirla (incluyendo "No dormí"/"No fui al boliche" y la siesta).
- Nueva pantalla `#/daily`, accesible desde la tarjeta "Registro
  diario" de home (tarjeta destrabada); el tab inferior "Home" se
  mantiene activo, igual que con Dinero.
- Reutiliza el patrón visual existente (tarjetas tipo `.daily-section`
  sobre `.home-content`, chips táctiles) sin rehacer la estética
  general ni el resto de la app.
- No se tocó ninguna funcionalidad existente (login, Dinero, admin,
  sesión, ruteo).
- No se implementaron estadísticas, rankings, previas, códigos,
  WhatsApp ni otros datos diarios nuevos, según lo pedido.

## v0.2.1 (fix lógica visual del donut)

- Corregida la lógica de colores del donut de Dinero, que estaba
  invertida: ahora la parte **colorida** representa el dinero que
  **todavía queda disponible** (`saldo inicial + ganancias − gastos`)
  sobre el total inicial disponible (`saldo inicial + ganancias`), y la
  parte **gris** representa el dinero ya gastado. La parte colorida
  disminuye con cada gasto y vuelve a crecer con cada ganancia. Se
  ajustaron también los colores de los puntos de la leyenda (antes
  "Gastado" tenía el punto ámbar y "Disponible" el gris; ahora es al
  revés, consistente con el donut).
- Verificado con el ejemplo del pedido: saldo inicial $100.000, gasto
  $25.000, sin ganancias → 75% colorido / 25% gris exacto. También
  verificado que una ganancia posterior vuelve a agrandar la parte
  colorida.
- Corregido el tamaño de letra del monto dentro del donut (achicado)
  para que un saldo de 6 cifras (ej. "$200.000") entre completo sin
  desbordar el círculo, tanto en el saldo inicial como en cualquier
  monto disponible mostrado ahí.
- No se tocó ninguna otra funcionalidad (login, edición/eliminación de
  movimientos, categorías, modelo de datos, diseño general).

## v0.2.0 (login con contraseña, editar/eliminar movimientos, donut SVG)

- **Login con contraseña**: reemplazados los 8 participantes placeholder
  por los 11 usuarios reales (Gio, Marto, Sebas, Ger, Nerea, Simon,
  Agus, Nata, Barua, Jere, Tobi), cada uno con una contraseña corta en
  `PARTICIPANTS` (`script.js`). Al tocar un nombre en el selector se
  abre un bottom sheet pidiendo la contraseña; la comparación ignora
  mayúsculas/minúsculas. Contraseña incorrecta → mensaje de error claro
  y no se entra. Contraseña correcta → se guarda la sesión y se entra a
  `/home`. Gio conserva `isAdmin: true` y acceso a `/admin`.
- `setCurrentUser` ahora guarda en `localStorage` solo id/nombre/
  isAdmin (nunca la contraseña del participante ni la ingresada); el
  resto del comportamiento de sesión (logout borra solo `currentUser`,
  `userData:<id>` persiste) no cambió.
- **Editar y eliminar movimientos**: cada fila del historial de Dinero
  es ahora interactiva. Un toque abre un sheet de acciones ("Editar" /
  "Eliminar" / "Cancelar"). "Editar" reabre el formulario de alta
  (gasto o ganancia) precargado con nombre, categoría y monto actuales
  y actualiza el movimiento existente en lugar de crear uno nuevo.
  "Eliminar" pide una confirmación explícita en un segundo paso antes
  de borrar, para que ningún toque accidental elimine un movimiento.
  Disponible tanto para gastos como para ganancias. Todas las acciones
  recalculan al instante saldo disponible, donut, historial y
  `localStorage`.
- **Donut sin serrucho**: reemplazado el `conic-gradient` por un donut
  SVG (dos `<circle>` con `stroke-dasharray`/`stroke-dashoffset`), lo
  que da bordes perfectamente circulares y consistentes en cualquier
  densidad de pantalla (verificado con capturas a 1x y 3x DPI). Se
  mantiene la paleta (gris = disponible, ámbar = gastado), la
  transición animada y el resto del estilo visual de la tarjeta.
- Verificado con Chrome headless: los 11 usuarios inician sesión
  correctamente con su contraseña ignorando mayúsculas/minúsculas,
  contraseña incorrecta bloquea el acceso, edición y eliminación de
  gastos y ganancias recalculan todo correctamente, `userData` persiste
  tras cerrar sesión, y no hay scroll horizontal en 360px/375px/390px.

## v0.1.0 (sección Dinero)

- Implementada la sección Dinero de /home, antes marcada como
  "Próximamente".
- Saldo inicial obligatorio en el primer ingreso a Dinero, editable
  después desde un ícono de ajustes discreto en el header de la
  sección.
- Registro de gastos con nombre, categoría (Chocolates, Alcohol,
  Boliche, Comida, Bebida, Actividades, Transporte, Otros vía chips) y
  monto; defaults "Sin Descrip." y "Otros" cuando corresponde.
- Registro de ganancias (dinero recibido) con nombre y monto,
  distinguidas visualmente del gasto en historial y donut.
- Gráfico donut de disponible (gris) vs. gastado (ámbar), calculado en
  vivo a partir de saldo inicial + ganancias − gastos; probado sin
  gastos (0%) sin errores.
- Historial de movimientos, más reciente primero, con ícono por
  categoría, nombre, etiqueta y monto con signo.
- Persistencia en `userData:<id>.money`, separada del resto de la app;
  no se toca `currentUser` ni se borra nada al cerrar sesión.
- Nuevo patrón de UI reutilizable: bottom sheet deslizable para
  formularios cortos (saldo inicial, gasto, ganancia) y chips táctiles
  para selección de categoría, siguiendo la identidad visual existente
  (sin rehacer estética general).
- Ruteo: nueva pantalla `#/money`, accesible desde la tarjeta "Dinero"
  de home; el tab inferior "Home" se mantiene activo mientras se está
  en Dinero, ya que es parte de esa sección.
- Verificado con Chrome headless en 360px/375px/390px: sin overflow
  horizontal, saldo/gastos/ganancias se calculan y persisten
  correctamente, y `userData` sobrevive al logout.

## v0.1.0 (build mobile)

- Construida la v0.1 funcional completa (index.html, styles.css,
  script.js), reemplazando los archivos vacíos del proyecto.
- Diseño mobile-first corregido y verificado: sin overflow horizontal
  entre 360px y 430px de ancho; en desktop la app queda centrada como
  una tarjeta tipo teléfono en vez de un layout de escritorio.
- Nueva identidad visual: header con cielo de montaña nocturno
  (estrellas animadas + siluetas de montaña en SVG), paleta oscura con
  acentos ámbar/celeste/violeta, tipografía Outfit + Inter.
- Selector de usuario ("¿Quién sos?") con grid de participantes,
  avatares con inicial y color por persona.
- Sesión implementada según spec: `currentUser` separado de
  `userData:<id>`; cerrar sesión borra solo `currentUser`, nunca los
  datos del usuario ni `localStorage.clear()`.
- Con sesión activa, la app entra directo a /home y no vuelve a mostrar
  el selector.
- Home reconstruida: saludo al usuario + tarjetas "Próximamente" de
  Dinero, Registro diario y Envío de datos (sin lógica real todavía,
  según lo pedido).
- Admin reconstruida: exclusiva para Gio, con listado de participantes
  y tarjetas "Próximamente" de Previas, Estadísticas y Códigos de
  datos. Acceso bloqueado (redirige a home) para no-admins.
- Navegación inferior fija tipo app (Home/Admin), visible solo con
  sesión iniciada.
- Ruteo por hash sin backend (`#/home`, `#/admin`), compatible con
  hosting estático en Vercel.
- Verificación automatizada con Chrome headless en 360px, 375px, 390px
  y 1280px: sin scroll horizontal, sesión persiste tras recargar,
  logout conserva `userData`.

## v0.1.0 (spec inicial)

- Creación del proyecto Bariloche Web.
- Definición de arquitectura inicial.
- Definición de usuarios.
- Definición de /home y /admin.
- Definición de persistencia mediante localStorage.
- Definición de futuras funcionalidades.
- Primera estructura visual.