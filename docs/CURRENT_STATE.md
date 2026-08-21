# CURRENT STATE

## Versión

v0.45.0 — Modo prueba: `testData()` / `clearTestData()`

## v0.45.0 — Modo prueba: `testData()` / `clearTestData()`

Nueva herramienta de testing manual, exclusiva de consola del
navegador (`window.testData`, `window.clearTestData`), totalmente
aislada del funcionamiento normal de la app — igual que `day()`
(v0.16.0): no agrega ninguna pantalla, ruta ni botón visible.

- **`testData()`**: genera, para **todos** los `PARTICIPANTS`, datos
  ficticios reutilizando exactamente las estructuras ya existentes:
  - Saldo inicial (`money.initialBalance`): aleatorio entre $200.000
    y $400.000 — solo referencia interna para generar los gastos,
    nunca mostrado en ningún lado (mismo criterio que ya regía para
    el saldo inicial real, ver SPEC.md → "Saldo inicial — privado").
  - Gastos (`money.movements`, `type: "expense"`) en las 7
    categorías vigentes de `EXPENSE_CATEGORIES` (nunca Transporte),
    con nombre, monto y cantidad de compras distintos por jugador,
    dejando entre 0% y 20% del saldo inicial sin gastar y sin superar
    nunca el saldo disponible (inicial + ganancias).
  - Ganancias (`type: "income"`, 0 a 2 por jugador), ya que el
    sistema de ingresos existe (ver SPEC.md → "Dinero").
  - 6 días de Registro diario (`dailyLog.entries`) por jugador: hora
    de dormir/despertar y horas dormidas, siesta opcional, quinta
    comida, veces al baño (0–5), hora de salida del boliche (siempre
    posterior a la 01:00 cuando el jugador "fue"), y voto de la
    encuesta "¿Quién estuvo más destruido anoche?" — todo calculado
    con `computeDailyDerived()` real, sin reinventar ningún cálculo.
  - Los datos se escriben en `userData:<id>` (para que el propio
    usuario vea sus datos en Dinero/Registro diario/Envío de datos)
    **y** en `adminPlayers` (mismo formato exacto que
    `confirmAdminImport`: `{ id, name, data, sourceVersion,
    importedAt, updatedAt }`), porque Estadísticas/Títulos/Rachas
    siempre leen de `adminPlayers`, nunca de `userData:<id>`
    directamente.
- **`clearTestData()`**: elimina únicamente lo generado por
  `testData()`. Antes de sobreescribir nada, `testData()` guarda un
  backup (`localStorage`, clave `__testDataBackup`) de lo que hubiera
  antes en `userData:<id>` y `adminPlayers[id]` de cada jugador (o
  `null` si no había nada real todavía); `clearTestData()` restaura
  ese backup tal cual y borra el backup. Nunca toca `currentUser` ni
  ninguna otra clave.
- Los días generados usan `getSimulatedToday()` (respeta `day()` si
  está activo) y siempre quedan como días cerrados válidos para
  `getStatsClosedDays()`, así que sirven para probar Estadísticas
  (DÍA/TOTAL), Títulos (por estadística/encuesta/racha), rankings por
  categoría de gasto y el propio Registro diario/Dinero del usuario.
- No se ejecuta automáticamente ninguna función de prueba: hace falta
  llamarlas a mano desde la consola.
- Verificado: `node --check script.js` sin errores; simulación
  completa en Node (con `localStorage` simulado) ejecutando
  `testData()` para los 11 participantes — las 7 categorías de gasto
  presentes en cada jugador, ninguna con "Transporte", gasto total
  siempre ≤ saldo disponible, salida del boliche siempre > 01:00
  cuando fue, 6 días cerrados detectados por `getStatsClosedDays()` —
  y `clearTestData()` restaurando exactamente los datos reales
  previos de un usuario de prueba, dejando `adminPlayers` vacío (no
  había ninguno antes de correr `testData()`).

## v0.44.0 — Títulos: pulido visual final de las 3 subsecciones

Pulido final, puramente visual, de las 3 subsecciones de `#/titulos`
(`#/titulos-estadistica`, `#/titulos-encuesta`, `#/titulos-racha`),
que ya tenían cálculo real (v0.39.0, v0.42.0 y v0.43.0
respectivamente). No se tocó ningún cálculo ni dato — ver esas 3
entradas para el detalle de cómo se calcula cada título. Como las 3
comparten `renderTituloProfileCard`/`renderTituloBadge`, el pulido se
hizo en un único lugar y se refleja en las 3 por igual.

- **Estructura conceptual, igual en las 3** (sin cambios, solo mejor
  presentada): cada perfil es JUGADOR (avatar + nombre) → una o más
  insignias, cada una `🏆 Título` + descripción del logro obtenido
  (leyenda de la estadística/encuesta/racha + valor puntual). Nunca
  ranking de barras horizontales ni número de puesto — los títulos
  son premios ya obtenidos, no una competencia en curso.
- **De dónde sale el título de cada subsección, explícito**:
  `renderTitulosSourceNote(icon, accent, html)` (nueva, `script.js`)
  agrega una línea corta arriba de las pestañas Día/Total de cada
  pantalla — "📊 estadísticas que ya mide la app" (Por estadística),
  "🗳️ encuestas votadas por los participantes" (Por encuesta), "🔥
  racha más larga de días consecutivos" (Por racha) — para que la
  fuente de cada subsección quede clara aunque las 3 compartan
  exactamente el mismo diseño de perfil/insignia. CSS nueva:
  `.titulos-source-note` (+ variante clara en `.screen.admin-frost`).
- **Jerarquía y espaciado mejorados** (`styles.css`): nombre del
  jugador más grande (17px→19px) con recorte por ellipsis para
  nombres largos; avatar más grande (46px→52px) con anillo doble;
  insignia de cantidad de títulos rediseñada como píldora con ícono
  🏆; separación entre perfiles de jugador aumentada (`gap`
  14px→22px en `.titulos-profile-list`); insignias de título con más
  padding e ícono de medallón más grande (38px→42px); watermark de
  🏆 muy translúcido en cada tarjeta (puramente decorativo, oculto
  con `prefers-reduced-motion`).
- **Animaciones**: se mantiene tal cual la cascada de entrada
  existente (`statsFadeUp`, mismo delay escalonado); se suma
  únicamente una transición liviana al tocar tarjeta/insignia
  (`:active`), sin animaciones nuevas de por sí.
- **Mobile-first**: nuevo `@media (max-width: 359px)` para los
  anchos más chicos del rango objetivo; verificado sin scroll
  horizontal en 360–430px, incluso con nombres largos.
- **Verificado explícitamente que ninguna de las 3 subsecciones use
  rankings**: ni barras horizontales, ni número de puesto, ni
  ningún componente `.ranking-*` de Estadísticas — se comprobó
  navegando Día/Total en las 3 pantallas.
- No se tocó `buildTitulosByPlayer`, `buildTitulosByPlayerAllTiedWinners`,
  `TITULOS_CONFIG`, `ENCUESTAS_CONFIG`, `RACHAS_CONFIG` ni ninguna
  `dayFn`/`totalFn`.

## v0.43.0 — Títulos por racha: cálculo real (boliche, quinta comida, baño, chocolates, alcohol)

Primer cálculo real dentro de `#/titulos-racha` (antes placeholder
"Próximamente"). El título se lo lleva quien haya conseguido la
racha más larga de días CONSECUTIVOS EN EL CALENDARIO cumpliendo un
hábito — no un valor puntual de un día ni una votación. Reutiliza
EXACTAMENTE la misma presentación de perfiles de v0.41.0/v0.42.0 —
ningún componente ni CSS nuevo.

- **5 tipos de racha implementados** (`RACHAS_CONFIG`, nombres
  provisionales, `provisional: true`, fáciles de renombrar):
  - 🕺 "Rey de la noche" — mayor racha yendo al boliche.
  - 🍔 "Racha comilona" — mayor racha comiendo quinta comida.
  - 🚽 "Intestino de hierro" — mayor racha yendo al baño.
  - 🍫 "Racha dulce" — mayor racha gastando en categoría Chocolates.
  - 🍷 "Racha alcohólica" — mayor racha gastando en categoría
    Alcohol.
- **`isNextDayKey(prevKey, dateKey)`** (nueva): compara dos claves
  YYYY-MM-DD y dice si son días calendario consecutivos. Motor de
  rachas nuevo: `longestStreak(days, predicateFn)` recorre una
  lista de días cerrados y devuelve la racha más larga de días
  consecutivos donde el predicado dio `true` — un día que no cumple,
  o un salto de calendario entre dos días de la lista (aunque ambos
  hayan cumplido), corta la racha.
- **Predicados por hábito** (nuevos, uno por tipo de racha):
  `playerFueAlBoliche`, `playerComioQuintaComida`,
  `playerFueAlBanio`, `playerGastoEnCategoria(player, dateKey,
  category)` — todos leen exactamente los mismos campos que ya usan
  Estadísticas/Títulos por estadística (`entry.computed.bolicheMinutes`,
  `entry.fifthMeal`, `entry.bathroom`, `dayExpenses()`), sin ningún
  cálculo nuevo sobre datos crudos.
- **`streakRankingRows(days, predicate)`** (nueva): arma filas
  name/value/display con la racha más larga de cada jugador
  (`sortRankingDesc`, reutilizada); un jugador con racha 0 no entra
  en las filas.
- **DÍA usa el historial hasta ese día, no solo ese día** (a
  diferencia de "Por estadística"/"Por encuesta"): `daysUpTo(closedDays,
  dateKey)` recorta `closedDays` hasta el día seleccionado inclusive
  antes de calcular la racha — una racha por definición necesita el
  historial previo.
- **TOTAL** usa todo el historial de días cerrados del viaje.
- **Empates resueltos igual que "Por encuesta"**:
  `buildTitulosByPlayerAllTiedWinners(configs, getRows)` (nueva,
  generalizada a partir de la función que antes se llamaba
  `buildTitulosByPlayerFromEncuestas` — ahora un wrapper de una
  línea sobre esta) reparte el título entre TODOS los jugadores
  empatados en la racha máxima. `buildTitulosByPlayerFromRachas` la
  reutiliza sin duplicar lógica.
- **DÍA/TOTAL propios**: `titulosRachaTab`, `titulosRachaDayIndex`,
  `titulosRachaNavDir` — mismo patrón de pestañas y barra
  `← día →` sobre `getStatsClosedDays()` que "Por estadística"/"Por
  encuesta" (`renderTitulosRachaPanel()`,
  `renderTitulosRachaScreen()`), estado completamente independiente.
- **index.html**: `#screen-titulos-racha` dejó de ser
  `.feature-card.locked` con `.soon-tag` y ahora tiene
  `<main id="titulos-racha-main">`, igual que las otras 2
  subsecciones.
- **Ruteo**: `navigate("titulos-racha")` ahora llama a
  `renderTitulosRachaScreen()` antes de mostrar la pantalla.
- **Sin CSS nuevo**: el resultado usa exactamente
  `.titulo-profile-card`/`.titulo-badge` de v0.41.0 — mismo look que
  "Por estadística"/"Por encuesta".
- No se tocó ninguna estadística de `#/stats`, ni el cálculo de
  "Por estadística" (`TITULOS_CONFIG`/`buildTitulosByPlayer`) ni el
  de "Por encuesta" (`ENCUESTAS_CONFIG`, salvo el refactor no
  funcional de `buildTitulosByPlayerFromEncuestas` mencionado
  arriba, que produce exactamente el mismo resultado que antes).
- Verificado: `node --check script.js` sin errores; llaves de
  `styles.css` balanceadas; simulación manual de `longestStreak`
  confirmando que (a) un salto de calendario entre dos días
  "cerrados" corta la racha aunque ambos días cumplan el hábito, (b)
  el recorte "hasta ese día" (`daysUpTo`) no ve datos futuros, y (c)
  dos jugadores con la misma racha máxima quedan ambos con el mismo
  `value`, listos para que `buildTitulosByPlayerAllTiedWinners` les
  otorgue el título a los dos.

## v0.42.0 — Títulos por encuesta: cálculo real ("El más destruido")

Primer título con cálculo real dentro de `#/titulos-encuesta` (antes
placeholder "Próximamente"), a partir de la encuesta diaria "¿Quién
estuvo más destruido anoche?" (voto ya capturado desde v0.40.0).
Reutiliza EXACTAMENTE la misma presentación de perfiles creada en
v0.41.0 para "Por estadística" — no se creó ningún componente visual
nuevo.

- **`ENCUESTAS_CONFIG`** (nueva, `script.js`): arreglo de
  configuración análogo a `TITULOS_CONFIG`, hoy con una sola entrada
  (`destroyedVote` → título "El más destruido"). Preparado para
  sumar encuestas futuras sin tocar el resto del render.
- **`tallyVotesForDay(dateKey, field)`/`tallyVotesForDays(closedDays,
  field)`** (nuevas): cuentan los votos de un campo de encuesta
  dentro de `dailyEntries` — por día puntual o sumando todos los
  días cerrados. `votesToRankingRows()` convierte ese conteo a filas
  `name/value/display` ordenadas de mayor a menor (reutiliza
  `sortRankingDesc`, ya usado por las estadísticas).
- **`buildTitulosByPlayerFromEncuestas(getRows)`** (nueva): agrupa
  por jugador igual que `buildTitulosByPlayer` (v0.41.0), pero
  reparte el título entre **todos los empatados en el primer
  puesto** en vez de a uno solo — así un empate de votos no rompe la
  interfaz ni obliga a elegir arbitrariamente un ganador.
  `buildTitulosByPlayer`, usado por "Por estadística", no se tocó.
- **`renderTitulosEncuestaDayReal()`/`renderTitulosEncuestaTotalReal()`**
  (nuevas): arman la lista de perfiles reutilizando tal cual
  `renderTituloProfileCard` (la misma tarjeta de perfil de "Por
  estadística", sin ningún cambio); mismo `.stats-empty-banner`
  cuando nadie votó en el período.
- **DÍA/TOTAL propios**: `titulosEncuestaTab`,
  `titulosEncuestaDayIndex`, `titulosEncuestaNavDir` — mismo patrón
  de pestañas y barra `← día →` sobre `getStatsClosedDays()` que ya
  usa "Por estadística" (`renderTitulosEncuestaPanel()`,
  `renderTitulosEncuestaScreen()`), estado completamente
  independiente del de "Por estadística" y de Estadísticas.
- **index.html**: `#screen-titulos-encuesta` dejó de ser
  `.feature-card.locked` con `.soon-tag` y ahora tiene
  `<main id="titulos-encuesta-main">`, igual que
  `#screen-titulos-estadistica`.
- **Ruteo**: `navigate("titulos-encuesta")` ahora llama a
  `renderTitulosEncuestaScreen()` antes de mostrar la pantalla
  (antes solo hacía `showScreen`).
- **Sin CSS nuevo**: cero clases nuevas — el resultado se ve
  idéntico a los perfiles de "Por estadística" (`.titulo-profile-card`/
  `.titulo-badge` de v0.41.0), tal como pedía el enunciado.
- No se tocó ninguna estadística de `#/stats`, ningún cálculo de
  "Por estadística" (`TITULOS_CONFIG`/`buildTitulosByPlayer`), la
  captura del voto en Registro diario, ni "Títulos por racha" (sigue
  como placeholder).
- Verificado: `node --check script.js` sin errores; llaves de
  `styles.css` balanceadas; simulación manual del conteo de votos
  con empate (dos participantes con la misma cantidad de votos en un
  día) confirmando que ambos quedan en la lista con `value` igual y
  que `buildTitulosByPlayerFromEncuestas` les otorga el título a los
  dos.

## v0.41.0 — Títulos por estadística: nueva presentación visual (perfiles de jugador)

Rediseño **puramente visual** de `#/titulos-estadistica` (ver
v0.39.0 más abajo para el cálculo, que no cambió). Antes se mostraba
una tarjeta por estadística con el mismo look que un ranking de
Estadísticas (podio + barra); ahora se agrupa por jugador, porque un
título representa un logro obtenido, no una competencia en curso.

- **Qué cambió**: en vez de "una tarjeta por título", ahora es "un
  perfil por jugador con la lista de títulos que ganó". El cálculo
  de quién gana cada título sigue siendo exactamente
  `TITULOS_CONFIG` + `dayRanking...`/`totalRanking...` de
  Estadísticas (ver v0.39.0) — no se tocó ni un número.
- **`buildTitulosByPlayer(getRows)`** (nueva, `script.js`): recorre
  `TITULOS_CONFIG`, resuelve el ganador de cada título (mismo
  `rows[0]` de siempre) y agrupa esos resultados por nombre de
  jugador. Devuelve un perfil por cada participante de
  `PARTICIPANTS` que ganó al menos un título, en el mismo orden que
  esa lista. Un jugador sin ningún título todavía **no genera
  perfil** (mismo criterio de "no inventar nada" que ya regía antes
  para las tarjetas vacías).
- **Render nuevo**: `renderTituloBadge()` (una insignia: ícono +
  nombre del título + estadística/valor con que se ganó),
  `renderTituloProfileCard()` (perfil de un jugador: avatar +
  nombre + lista de insignias) y `renderTitulosProfiles()` (arma
  todos los perfiles del período). `renderTitulosDayReal()`/
  `renderTitulosTotalReal()` ahora llaman a estas funciones nuevas
  en vez de a `renderTituloCard()`/`renderTitulosCards()`, que se
  eliminaron. Mismos mensajes de `.stats-empty-banner` que antes
  cuando no hay ningún título repartido en el período.
- **CSS nuevo**: `.titulo-profile-card`, `.titulo-profile-header`,
  `.titulo-profile-avatar` (mismas `getInitials()`/`colorForId()`
  que el resto de la app), `.titulo-badge-list`, `.titulo-badge` y
  overrides en `.screen.admin-frost` para el tratamiento "vidrio"
  blanco/celeste. Sin barras horizontales ni número de puesto —
  deliberadamente distinto de `.ranking-card`/`.ranking-podium`
  (que Estadísticas sigue usando sin cambios). Insignias con
  medallón/glow del color propio del título para dar sensación de
  trofeo sin exagerar. Misma cascada de entrada (`statsFadeUp`),
  misma navegación Día/Total, mismo hub/bottom nav/nieve global que
  antes — nada de eso se tocó.
- No se tocó ninguna estadística de `#/stats`, ningún cálculo de
  Dinero/Registro diario/Previas, `TITULOS_CONFIG`, "Títulos por
  encuesta" ni "Títulos por racha" (siguen como placeholders).
- Verificado: `node --check script.js` sin errores; llaves de
  `styles.css` balanceadas; simulación manual del agrupamiento por
  jugador con datos de prueba (mismo resultado esperado: cada
  ganador aparece una sola vez con todos sus títulos juntos).

## v0.40.0 — Encuesta diaria "¿Quién estuvo más destruido anoche?" en Registro diario

Nueva pregunta dentro de Registro diario, debajo de la sección de
boliche y antes del botón "Guardar registro". Solo captura y
persiste el voto — **no se implementó ningún título ni ranking a
partir de esta encuesta todavía** (queda para una próxima
iteración, según lo pedido).

- **`defaultDailyEntry()`** suma un campo nuevo, `destroyedVote`
  (id de `PARTICIPANTS` votado, o `null`), al mismo objeto que ya
  guarda sueño, siesta, quinta comida, baño y boliche — no es una
  clave de `localStorage` separada, así que viaja automáticamente
  con el resto de `dailyLog.entries[<fecha>]`: se importa en
  `adminPlayers` y se incluye en el código de exportación sin tocar
  `buildExportPayload` (ya serializaba `dailyEntries` completo).
- **UI**: nueva `.daily-section` con chips (`#destroyed-vote-group`,
  mismo componente `.chip-group`/`.chip` que "Quinta comida"/"Veces
  al baño") con una opción por participante — **excepto el usuario
  logueado**, que directamente no aparece en la lista (así "no te
  podés votar a vos mismo" queda garantizado por diseño, sin
  validación adicional en la UI). Selección única: tocar una opción
  reemplaza cualquier voto anterior.
- **`saveDailyEntry()`**: además de limpiar sueño/boliche cuando
  corresponde, descarta el voto si por algún motivo coincidiera con
  el id del usuario logueado (defensa extra, ya que la UI ya excluye
  esa opción). El resto del guardado no cambió: mismo mecanismo de
  "sobrescribir en vez de duplicar" que ya usa Registro diario
  (misma clave de fecha `dailyDateKey`), así que si el usuario ya
  había votado ese día, volver a guardar no crea una segunda
  entrada — y al reabrir Registro diario, el voto guardado se
  precarga seleccionado (mismo patrón que el resto de los campos).
- Sin CSS nuevo: reutiliza `.daily-section`, `.section-label`,
  `.chip-group`, `.chip` (con `flex-wrap`, ya soportaba una fila
  larga de opciones sin overflow horizontal). Misma estética
  "Bariloche" blanco/celeste del resto de Registro diario.
- No se tocó ningún otro campo de Registro diario, ninguna función
  `dayRanking*`/`totalRanking*` de Estadísticas, ni "Títulos por
  encuesta" (sigue como placeholder "Próximamente").
- Verificado: `node --check script.js` sin errores.

## v0.39.0 — Cálculo real de "Títulos por estadística"

Dentro de `#/titulos-estadistica` (ver v0.38.0 más abajo para la
estructura de navegación), las pestañas Día/Total ya calculan
títulos reales en vez de mostrar siempre el estado vacío fijo.

- **Qué es un "título por estadística"**: para cada estadística
  competitiva que ya calcula Estadísticas (horas dormidas, siestas,
  quinta comida, veces al baño, tiempo en el boliche, dinero
  gastado, previas), se le asigna un título humorístico a quien
  tenga el mejor resultado. DÍA y TOTAL se calculan por separado:
  - **DÍA** usa exactamente las mismas funciones `dayRanking*` de
    Estadísticas, así que el título de un día puntual se calcula
    solamente con los datos disponibles hasta ese día.
  - **TOTAL** usa las mismas funciones `totalRanking*`, acumulando
    todos los días cerrados disponibles.
  - Ninguna de las 14 funciones (`dayRanking*`/`totalRanking*`) se
    tocó ni se duplicó: Títulos las reutiliza tal cual como fuente
    única de verdad, así que un cambio futuro en el cálculo de una
    estadística se refleja automáticamente en su título.
- **Datos reales, sin inventar nada**: si ninguna estadística tiene
  datos todavía en el período mostrado, se ve un
  `.stats-empty-banner` explicativo; si una estadística puntual no
  tiene ningún dato cargado en ese período, simplemente no genera su
  tarjeta de título (no se inventa un ganador). No se usa ni se
  muestra el saldo inicial en ningún lado (igual que en el resto de
  la app).
- **Navegación DÍA propia**: se agregó la misma barra `← día →` que
  ya usa Estadísticas (`getStatsClosedDays()`, nunca el día actual ni
  uno futuro), con su propio estado
  (`titulosEstadisticaDayIndex`/`titulosStatsNavDir`), independiente
  del de Estadísticas — navegar los días en Títulos no afecta el día
  seleccionado en `#/stats`, y viceversa.
- **Preparado para agregar/modificar títulos fácilmente**: nuevo
  `TITULOS_CONFIG` en `script.js`, un arreglo donde cada entrada es
  `{ icon, accent, title, caption, provisional?, dayFn, totalFn }`.
  Agregar un título nuevo (o cambiar el nombre de uno existente) es
  sumar/editar una sola entrada; no hay que tocar el resto del
  render. Los títulos sin nombre definitivo todavía llevan
  `provisional: true` y muestran una etiqueta "Provisional" junto al
  nombre — hoy son todos menos "El más dormilón" (horas dormidas) y
  "El más gastador" (dinero gastado), que ya se consideran
  definitivos por ser ejemplos exactos del pedido original.
- **Diseño**: cada título se muestra con el mismo look que una
  tarjeta de ranking de Estadísticas (`renderRankingCard`/
  `renderRankingBars`, sin tocarlas), pero mostrando únicamente el
  podio del ganador (se le pasa solo `rows[0]`, nunca el resto del
  ranking) — tiene más sentido como "título" que como lista
  completa. Mismas animaciones (barras que crecen, cascada de
  tarjetas, slide entre días) y misma estética "Bariloche" que el
  resto de `/admin`, sin CSS nuevo salvo una regla mínima para la
  etiqueta "Provisional" (reutiliza `.soon-tag` ya existente).
- No se tocó ninguna estadística existente de `#/stats`, ningún
  cálculo de Dinero/Registro diario/Previas, "Títulos por encuesta"
  ni "Títulos por racha" (siguen como placeholders "Próximamente").
- Verificado: `node --check script.js` sin errores; llaves de
  `styles.css` balanceadas; revisado a mano que las 7 estadísticas
  configuradas en `TITULOS_CONFIG` reutilizan exactamente las mismas
  funciones `dayRanking*`/`totalRanking*` ya probadas en
  Estadísticas, sin reimplementar ningún cálculo.

## v0.38.0 — Apartado "Títulos" en /admin: estructura de navegación (3 subsecciones)

Nuevo apartado `/admin` → **Títulos** (`#/titulos`), debajo de
Estadísticas. Por ahora es solo estructura visual y de navegación —
sin ningún cálculo de títulos todavía —, pensada para conectar la
lógica real más adelante sin tener que rehacer el andamiaje.

- En la pantalla Admin, debajo de la sección "Estadísticas" se agregó
  una nueva sección `"Títulos"` con una única card `#card-admin-titulos`
  (ícono 🏆) que navega a `#/titulos`.
- `#/titulos` (`screen-titulos`) es un hub con 3 subsecciones, cada
  una en su propia pantalla:
  1. **Títulos por estadística** (`#/titulos-estadistica`,
     `#card-titulos-estadistica`) — única de las 3 con pestañas
     **Día/Total** (reutiliza `.stats-tabs`/`.stats-tab`, el mismo
     componente y comportamiento que usa Estadísticas), porque sus
     títulos van a salir de la misma fuente de datos (día cerrado del
     viaje / acumulado total). Cada pestaña muestra por ahora un
     `.stats-empty-banner` ("Todavía no hay títulos por día/totales…").
  2. **Títulos por encuesta** (`#/titulos-encuesta`,
     `#card-titulos-encuesta`) — placeholder `"Próximamente"`
     (`.feature-card.locked` + `.soon-tag`, mismo componente que ya
     usaban las tarjetas bloqueadas de Estadísticas).
  3. **Títulos por racha** (`#/titulos-racha`, `#card-titulos-racha`)
     — mismo tratamiento de placeholder que Por encuesta.
- Todas las pantallas nuevas (`screen-titulos`,
  `screen-titulos-estadistica`, `screen-titulos-encuesta`,
  `screen-titulos-racha`) llevan la clase `admin-frost` (misma
  estética "Bariloche" blanco/celeste que Admin/Estadísticas/Previas),
  reutilizan `.admin-hero`/`.hero-badge`/`.hero-name`/`.card-list`/
  `.feature-card` sin escribir CSS nuevo, y muestran la nieve global
  igual que el resto (`placeGlobalSnowfall`).
- **Navegación e integración**: se agregaron las 4 rutas nuevas
  (`titulos`, `titulos-estadistica`, `titulos-encuesta`,
  `titulos-racha`) al router existente (`screens`, `navigate()`,
  `routeFromHash()`), protegidas por el mismo guard de "solo admin"
  que ya usan `admin`/`previas`/`stats`. El bottom nav las trata como
  parte del tab "Admin" (`updateNav`) y usa la variante clara
  `.bottom-nav-frost`, igual que Estadísticas/Previas.
- **Animación de entrada/salida**: Admin↔Títulos, Títulos↔"Por
  estadística", Títulos↔"Por encuesta" y Títulos↔"Por racha" usan
  exactamente la misma función genérica
  `navigateBetweenScreensWithTransition(fromRoute, toRoute)` que ya
  usan Admin↔Previas y Admin↔Estadísticas (fade + `translateY`, mismo
  timing, misma curva, mismo fondo `#eaf6ff` durante la transición).
  No se creó ninguna animación nueva. También se sumaron las 4 rutas
  a las listas de orígenes animados del bottom nav (íconos "Home" y
  "Admin"), igual que Previas/Estadísticas.
- Nueva función `renderTitulosEstadisticaScreen()` (+ su panel
  `renderTitulosEstadisticaPanel()`) en `script.js`, con su propio
  estado de pestaña `titulosEstadisticaTab` ("dia" | "total"),
  independiente de `statsTab`. Las otras 2 subsecciones no necesitan
  función de render: su placeholder es HTML estático en `index.html`.
- No se tocó ningún dato, cálculo, `localStorage`, ni el
  comportamiento de Estadísticas, Previas o cualquier otra sección
  existente — verificado con un recorrido completo (Admin → Títulos →
  cada subsección → volver, y Admin → Estadísticas / Admin → Previas
  siguen funcionando igual que antes).
- Sin CSS nuevo: todo el look reutiliza clases ya existentes.

## v0.37.0 — Duración de la animación de encabezados de Estadísticas subida a 1.35s

Único cambio: `.stats-section-heading { transition: ... }` pasa de
0.85s a 1.35s (`transform` + `opacity`), para que el desplazamiento
lateral de los 4 encabezados se vea claramente. Todo lo demás sigue
exactamente igual: mismo `translateX(±16px)`, misma dirección por
encabezado (1°/3° izquierda, 2°/4° derecha), mismo trigger por
`IntersectionObserver` al hacer scroll, misma curva, mismo `opacity`,
una sola animación por encabezado.

## v0.36.0 — Ajustes de encabezados de Estadísticas (animación + texto quitado)

Dos ajustes puntuales sobre los encabezados de sección de v0.35.0:

- La transición de entrada de los 4 encabezados (`.stats-section-heading`)
  pasa de 0.45s a 0.85s (`transform` + `opacity`), para que se perciba
  claramente el desplazamiento lateral. Misma dirección por
  encabezado (1°/3° izquierda, 2°/4° derecha), mismo `±16px`, mismo
  trigger por `IntersectionObserver` al hacer scroll, una sola vez
  por encabezado — nada de eso cambió.
- Se eliminó el texto "Estadísticas del día" (pestaña DÍA, arriba del
  primer encabezado nuevo). "Estadísticas totales" (pestaña TOTAL) no
  se tocó.

- **JS**: se quitó el `<div class="section-label">Estadísticas del
  día</div>` en `renderStatsPanel()`.
- **CSS**: `.stats-section-heading { transition: ... 0.45s ... }` →
  `0.85s`.
- Sin cambios en lógica de estadísticas, día/total, datos, cálculos,
  persistencia, tarjetas, otros textos, diseño general ni otras
  animaciones.

## v0.35.0 — Organización visual de Estadísticas + encabezados de sección

`#/stats` (Estadísticas, dentro de /admin — Gio) ahora agrupa sus
tarjetas de ranking, tanto en DÍA como en TOTAL, bajo 4 encabezados
temáticos, sin cambiar ningún cálculo ni dato:

1. `-Datos de registro-` → Horas dormidas, Siesta hoy, La quinta
   comida, Veces que fue al baño, Tiempo dentro del boliche, Gasto
   total del día.
2. `-Pulso del viaje-` → Gasto por categoría (tarjeta agregada).
3. `-Gastos por categoría-` → ranking por jugador de cada categoría de
   gasto con movimientos (Chocolates/Alcohol/Boliche/Comida/Bebida/
   Actividades/Otros).
4. `-PREVIAS-` → Previas del día / de todo el viaje.

Cada encabezado entra con un fade + `translateX` (1° y 3° desde la
izquierda, 2° y 4° desde la derecha) la primera vez que aparece en el
viewport al hacer scroll, vía `IntersectionObserver`, y no se vuelve
a animar aunque el usuario haga scroll hacia arriba y abajo de nuevo.
Solo los 4 encabezados animan así — las tarjetas, barras e íconos
existentes siguen con sus animaciones de siempre, sin cambios.

- **JS**: `renderStatsSectionHeading(text, direction)` genera el
  `<div>` de cada encabezado; se llama 4 veces dentro de
  `renderDayStatsReal()` y `renderTotalStatsReal()`, sin alterar el
  orden ni el contenido de ninguna tarjeta existente.
  `observeStatsSectionHeadings(root)`, llamada desde
  `renderStatsPanel()` junto a `animateRankingBars(panel)`, maneja el
  `IntersectionObserver` (uno solo, reutilizado) que agrega
  `stats-heading-visible` la primera vez que cada encabezado es
  visible y luego deja de observarlo. Sin soporte de
  `IntersectionObserver`, se muestran directos sin animar.
- **CSS**: nuevo bloque `.stats-section-heading` (+ `-left`/`-right`/
  `-line`/`-text`/`.stats-heading-visible`) en `styles.css`, con la
  paleta ya resuelta de `.admin-frost` (celeste/blanco). Se ajustó el
  selector de la cascada de entrada de las tarjetas de
  `:nth-child(1..8)` a `:nth-of-type(1..8)` para que la posición se
  siga contando solo entre las tarjetas (`<article>`) y no se vea
  afectada por los encabezados (`<div>`) intercalados — mismo
  resultado visual que antes.
- **Alcance**: `renderStatsPlaceholderCards()` (pantalla vacía, sin
  días cerrados todavía) no lleva encabezados. No existe una vista de
  Estadísticas separada para "usuario común" — es la única
  implementación de Estadísticas de la app (exclusiva de Gio/admin),
  así que la reorganización se aplicó directamente ahí.
- No se tocó ningún dato, cálculo, persistencia, permiso, ruta,
  componente ni estilo existente fuera de lo descripto arriba.

## v0.34.0 — Transición Previas/Estadísticas → Admin (ícono bottom nav) y Home → Login (Cerrar sesión)

Se completaron dos casos que habían quedado sin animar en v0.33.0:

- El ícono "admin" (tuerca) del bottom nav ahora anima también al
  tocarlo estando parado en Previas o Estadísticas (antes solo
  animaba desde Home; el botón "volver" de cada pantalla ya animaba
  desde v0.33.0, esto solo faltaba para el ícono del nav).
- El botón "Cerrar sesión" de Home ahora anima la salida hacia Login
  (antes era un salto instantáneo).

Mismo fade + `translateY` (100ms por lado), mismos `cubic-bezier` y
mismo fondo `#eaf6ff` que el resto de las transiciones ya
implementadas.

- **JS**: el bloque del ícono "admin" en el listener de `bottomNav`
  ahora busca el origen activo entre `home`, `previas` y `stats` (antes
  solo `home`) y llama a
  `navigateBetweenScreensWithTransition(origen, "admin")`. `btn-logout`
  llama ahora a `navigateBetweenScreensWithTransition("home", "select")`
  en vez de `navigate("select")` directo; `clearCurrentUser()` se sigue
  llamando exactamente igual, sin cambios en la lógica de sesión (el
  fallback de `navigate()` cuando no hay usuario logueado sigue
  funcionando igual dentro de la transición, ya que arma la pantalla
  `select` de la misma forma).
- **CSS**: sin cambios — se reutilizan las mismas clases ya
  existentes (`.home-to-money-exit`, `.money-from-home-enter`,
  `#app.home-money-transition-bg`).
- No se tocó ningún otro dato, cálculo, permiso, ruta ni estilo
  existente.

## v0.33.0 — Transición Home↔Admin, Admin↔Previas, Admin↔Estadísticas y Home↔Previas de Jere

Se extendió la misma transición animada (fade + `translateY`, 100ms
por lado, mismos `cubic-bezier`, mismo `#eaf6ff` de fondo) usada por
Dinero/Registro diario/Envío de datos (v0.26.0 en adelante) a las
navegaciones dentro del perfil de Gio y a Previas de Jere:

- Home ↔ Admin (ícono "admin" del bottom nav para ir; botón "volver"
  de Admin o ícono "home" del bottom nav para volver).
- Admin ↔ Previas (tarjeta "Previas" de Admin para ir; botón "volver"
  de Previas para volver a Admin; ícono "home" del bottom nav estando
  en Previas para ir directo a Home).
- Admin ↔ Estadísticas (tarjeta "Estadísticas" de Admin para ir;
  botón "volver" de Estadísticas para volver a Admin; ícono "home"
  del bottom nav estando en Estadísticas para ir directo a Home).
- Home ↔ Previas de Jere (tarjeta "Previas" del Home de Jere para ir;
  botón "volver", o ícono "home" del bottom nav estando en Previas de
  Jere, para volver) — antes esta pantalla no tenía ninguna animación
  de entrada/salida.

- **JS**: nueva función genérica `navigateBetweenScreensWithTransition(fromRoute, toRoute)`
  en `script.js`; reemplaza el cuerpo de
  `navigateHomeToScreenWithTransition(route)`,
  `navigateScreenToHomeWithTransition(fromRoute)` y
  `navigateSelectToHomeWithTransition()`, que ahora son wrappers de
  una línea sobre ella (mismo comportamiento exacto de antes para
  Login→Home y Home↔Dinero/Registro diario/Envío de datos).
- `btn-admin-back`, `card-admin-previas`, `btn-previas-back`,
  `card-admin-stats`, `btn-stats-back`, `card-previas-jere` y
  `btn-previas-jere-back` llaman ahora a
  `navigateBetweenScreensWithTransition(...)` (o a
  `navigateHomeToScreenWithTransition`/`navigateScreenToHomeWithTransition`
  para Previas de Jere, que cuelga de Home) en vez de `navigate(...)`
  directo.
- El listener de `bottomNav` suma: ícono "home" estando en Admin,
  Previas o Estadísticas → transición animada hacia Home (además de
  Dinero/Registro diario/Envío de datos/Previas de Jere, ya cubiertas
  desde v0.32.0); ícono "admin" estando en Home → transición animada
  hacia Admin. Cualquier otro origen/destino sigue usando
  `navigate(route)` instantáneo, sin cambios.
- **CSS**: sin clases nuevas — se reutilizan `.home-to-money-exit`,
  `.money-from-home-enter` y `#app.home-money-transition-bg`
  (genéricas: solo `opacity`/`transform` y un fondo compartido por
  todas las pantallas logueadas vía `.admin-frost`). Se actualizó el
  comentario que las documenta en `styles.css`.
- No se tocó ningún otro dato, cálculo, permiso, ruta ni estilo
  existente.

## v0.32.0 — Transición Dinero/Registro diario/Envío de datos → Home

Se extendió la misma transición animada (v0.26.0/v0.29.0/v0.30.0/
v0.31.0) a la navegación de vuelta: al tocar la flechita "volver" en
Dinero, Registro diario o Envío de datos, o al tocar el ícono "home"
del bottom nav estando en cualquiera de esas 3 pantallas, ahora se ve
el mismo fade + `translateY` (100ms por lado, mismos `cubic-bezier`,
mismo `#eaf6ff` de fondo) en vez del salto instantáneo anterior.

- **JS**: nueva función `navigateScreenToHomeWithTransition(fromRoute)`
  en `script.js`, estructuralmente inversa de
  `navigateHomeToScreenWithTransition(route)` (ver v0.30.0): la
  pantalla de origen (`fromRoute`) hace la salida con
  `.home-to-money-exit` y, al terminar, se ejecuta `navigate("home")`
  (sin cambios) y Home entra con `.money-from-home-enter`. Mismo
  fallback sin animar si la pantalla de origen no está activa o hay
  `prefers-reduced-motion`, mismo manejo de
  `home-money-transition-bg` en `#app` durante toda la transición.
- `btn-money-back`, `btn-daily-back` y `btn-export-back` llaman ahora
  a `navigateScreenToHomeWithTransition("money")` /
  `navigateScreenToHomeWithTransition("daily")` /
  `navigateScreenToHomeWithTransition("export")` respectivamente, en
  vez de `navigate("home")` directo. El resto de esos handlers no
  cambió (`btn-money-settings` sigue abriendo el sheet de "initial"
  sin tocar).
- El listener de `bottomNav` ahora distingue el botón `data-route="home"`:
  si al tocarlo la pantalla activa es `money`, `daily` o `export`,
  dispara `navigateScreenToHomeWithTransition(...)` con esa pantalla
  en vez de `navigate("home")` directo. Para cualquier otra pantalla
  de origen (Admin, Estadísticas, Previas, etc.) o para el botón
  `nav-admin`, el comportamiento es exactamente el mismo de antes:
  `navigate(route)` instantáneo.
- **CSS**: sin cambios — no se agregó ninguna clase nueva. Se
  reutilizan tal cual `.home-to-money-exit`, `.money-from-home-enter`
  y `#app.home-money-transition-bg`, ya que la dirección de la
  animación (fade + pequeño desplazamiento vertical) es la misma
  independientemente de si se entra o se sale de Dinero/Registro
  diario/Envío de datos.
- No se tocó ninguna otra navegación: logout, back del navegador, la
  transición Login → Home (v0.31.0) ni la transición Home → Dinero/
  Registro diario/Envío de datos (v0.30.0), que siguen usando sus
  propias funciones sin cambios.
- Verificado: `node --check script.js` sin errores.

## v0.31.0 — Transición Login → Home

Se extendió la transición animada, que hasta ahora cubría únicamente
las navegaciones desde Home hacia Dinero/Registro diario/Envío de
datos (v0.26.0/v0.29.0/v0.30.0), a la navegación Login → Home: al
ingresar la contraseña correcta en el selector de usuario, Login hace
fade-out y Home hace fade-in en vez del salto instantáneo anterior.
Mismo timing (100ms por lado), misma curva (`cubic-bezier(0.4, 0, 1,
1)` salida / `cubic-bezier(0, 0, 0.2, 1)` entrada) y mismo color de
fondo (`#eaf6ff`) que ya usaban las otras transiciones.

- **JS**: nueva función `navigateSelectToHomeWithTransition()` en
  `script.js`, con la misma estructura que
  `navigateHomeToScreenWithTransition(route)` (ver v0.30.0): si
  `#screen-select` no está activo o hay `prefers-reduced-motion`, cae
  directo a `navigate("home")` sin animar; si no, agrega
  `home-money-transition-bg` a `#app`, anima la salida de Login con
  `.home-to-money-exit`, al terminar ejecuta `navigate("home")` (sin
  cambios) y anima la entrada de Home con `.money-from-home-enter`,
  quitando la clase de `#app` al final.
- `checkLoginPassword()` (validación de contraseña dentro del sheet
  "¿Quién sos?") llama ahora a
  `navigateSelectToHomeWithTransition()` en el punto donde antes
  llamaba a `navigate("home")` directo, justo después de cerrar el
  sheet y de `setCurrentUser(participant)`. Nada más de esa función
  cambió: la validación de contraseña, los mensajes de error y el
  manejo de los dots siguen exactamente igual.
- **CSS**: sin cambios — no se agregó ninguna clase nueva. Las mismas
  `.home-to-money-exit` / `.money-from-home-enter` /
  `#app.home-money-transition-bg` ya existentes se reutilizan tal
  cual, porque `#screen-select` (Login) y `#screen-home` comparten la
  clase `.login-screen` y por lo tanto el mismo degradé de fondo que
  arranca en `#eaf6ff` — el mismo motivo por el que ya se podían
  reutilizar sin cambios para Dinero/Registro diario/Envío de datos
  (que en cambio comparten `.admin-frost`).
- No se tocó ninguna otra navegación: logout (que vuelve a mostrar
  Login sin animar), back del navegador, bottom nav, ni las
  navegaciones Home → Dinero/Registro diario/Envío de datos, que
  siguen usando su propia función (`navigateHomeToScreenWithTransition`)
  sin cambios.
- Verificado: `node --check script.js` sin errores.

## v0.30.0 — Transición Home → Dinero/Registro diario/Envío de datos

Se extendió la transición animada que existía únicamente para Home →
Dinero (ver v0.26.0 y v0.29.0 más abajo) a las otras dos tarjetas de
Home: `#card-daily` (Registro diario) y `#card-export` (Envío de
datos). Las tres usan ahora exactamente el mismo timing (100ms por
lado), la misma curva (`cubic-bezier(0.4, 0, 1, 1)` salida /
`cubic-bezier(0, 0, 0.2, 1)` entrada) y el mismo color de fondo
(`#eaf6ff`) que ya tenía la transición de Dinero.

- **JS**: la función `navigateHomeToMoneyWithTransition()` se
  renombró/generalizó a `navigateHomeToScreenWithTransition(route)`
  en `script.js`. Recibe la pantalla destino (`"money"`, `"daily"` o
  `"export"`) y hace exactamente lo mismo que antes hacía para
  Dinero: si no se viene de Home o hay `prefers-reduced-motion`, cae
  directo a `navigate(route)` sin animar; si no, agrega
  `home-money-transition-bg` a `#app`, anima la salida de Home con
  `.home-to-money-exit`, al terminar ejecuta `navigate(route)` (sin
  cambios) y anima la entrada de la pantalla destino con
  `.money-from-home-enter`, quitando la clase de `#app` al final.
- Los listeners de `#card-daily` y `#card-export` llaman ahora a
  `navigateHomeToScreenWithTransition("daily")` /
  `navigateHomeToScreenWithTransition("export")` en vez de invocar
  `navigate(...)` directamente. El de `#card-money` sigue llamando a
  la misma función, ahora con `"money"` como argumento.
- **CSS**: sin cambios — no se agregó ninguna clase nueva. Las mismas
  `.home-to-money-exit` / `.money-from-home-enter` /
  `#app.home-money-transition-bg` de antes se reutilizan para las 3
  pantallas, porque Dinero, Registro diario y Envío de datos
  comparten la clase `.screen.admin-frost` y por lo tanto el mismo
  degradé de fondo que arranca en `#eaf6ff`.
- El resto de las navegaciones sigue exactamente igual: volver desde
  cualquiera de las 3 pantallas (`btn-money-back`, `btn-daily-back`,
  `btn-export-back`) sigue usando `navigate("home")` sin animar, y el
  bottom nav / back del navegador tampoco animan.
- Verificado: `node --check script.js` sin errores.

## v0.29.0 — Transición Home → Dinero: timing + color de fondo

Ajuste puntual sobre la transición de v0.26.0 (Home → Dinero al tocar
`#card-money`). No se tocó ninguna otra sección, navegación ni
funcionalidad.

- **Duración**: la salida de Home (`.home-to-money-exit`) pasa de
  160ms a 100ms. La entrada de Dinero (`.money-from-home-enter`)
  también pasa a 100ms (antes 200ms), para que ambas mitades de la
  transición duren lo mismo y se sientan parejas.
- **Curva más suave**: ambas animaciones dejan `ease-out` por una
  curva `cubic-bezier` dedicada (`cubic-bezier(0.4, 0, 1, 1)` en la
  salida, `cubic-bezier(0, 0, 0.2, 1)` en la entrada), pensada para
  que la desaceleración/aceleración se sienta más suave que el
  `ease-out` genérico anterior.
- **Fix del flash oscuro de fondo**: `.screen.login-screen` (Home) y
  `.screen.admin-frost` (Dinero) pintan su propio fondo claro
  (degradé que arranca en `#eaf6ff`) directamente sobre el `.screen`,
  así que al bajar su `opacity` durante la animación quedaba expuesto
  por un instante el fondo oscuro por defecto de `#app`
  (`var(--bg)`, `#0d0d17`) — el "efecto pantalla negra" reportado.
  Se agregó una clase nueva, `home-money-transition-bg`, que
  `navigateHomeToMoneyWithTransition()` (`script.js`) agrega a `#app`
  apenas arranca la transición y quita recién cuando termina la
  animación de entrada de Dinero (o de inmediato si por algún motivo
  no hay pantalla de Dinero a la que entrar). Esa clase solo pone
  `background: #eaf6ff` en `#app` — el mismo tono con el que ya
  arrancan los degradés de Home y Dinero — así que durante el fade se
  ve como si el contenido de una pantalla se borrara y apareciera el
  de la otra, en vez de un parpadeo oscuro entre medio.
- Nada más cambió: mismo disparador (`#card-money`), mismo
  `translateY(±10px)` combinado con `opacity`, mismo fallback a
  `navigate("money")` sin animar si no se viene de Home o si
  `prefers-reduced-motion` está activo, mismo respeto de esa
  preferencia (el nuevo bloque `#app.home-money-transition-bg` no
  tiene animación propia, así que no hace falta cubrirlo en el
  `@media (prefers-reduced-motion: reduce)` ya existente). El resto
  de las navegaciones (Dinero → Home, cualquier otra sección, back
  del navegador, bottom nav) sigue sin animación, sin cambios.
- Verificado: `node --check script.js` sin errores; llaves de
  `styles.css` balanceadas; revisado a mano que
  `home-money-transition-bg` se agrega al iniciar la transición y se
  quita siempre al terminar (tanto en el camino normal como en el
  caso borde sin `moneyEl`).

## v0.28.0 — Saludo de Home: rediseño visual + saludo aleatorio

Dos cambios acotados al saludo de Home (`.home-hero-bottom`: "Hola,"
/ nombre / remate), sin tocar ninguna otra sección ni funcionalidad.

### 1. Rediseño visual (claridad, tamaños, colores)

Los 3 textos dejaron de heredar el estilo genérico de `.eyebrow`
(pensado para etiquetas chicas en mayúscula con letter-spacing
ancho) y pasaron a reglas propias, más legibles y con mejor
jerarquía, dentro de la misma paleta celeste/azul "Bariloche" ya
usada en login/Home:

- `.home-greet-hola` ("Hola,"): 15px, semibold, `#5b7c94` (azul
  grisáceo suave), sin mayúsculas forzadas ni letter-spacing ancho.
- `.home-greet-name` (nombre, sigue siendo `<h1 id="home-username">`):
  un poco más grande que antes — `clamp(28px, 9vw, 36px)` en vez de
  `clamp(26px, 8vw, 32px)` — para reforzarlo como elemento
  protagonista del saludo.
- `.home-greet-question` (remate/pregunta): 17px, semibold, celeste
  de acento `#2f8fd1` (mismo tono que ya se usaba en otros textos de
  acento de la estética "Bariloche"), tampoco en mayúsculas.
- Las reglas nuevas se agregaron junto a `.hero-name` en
  `styles.css`, con selectores de clase (`.home-greet-name.hero-name`,
  etc.) que ganan por especificidad sin necesidad de tocar
  `.hero-name` ni `.eyebrow` de forma global — así que Admin y el
  resto de usos de esas clases base no se ven afectados.
- La animación de entrada escalonada de v0.27.0 (`homeGreetFromLeft`
  / `homeGreetFromDepth`, clase `.home-greeting-animate` reiniciada
  desde `playHomeGreetingAnimation()` en cada entrada a Home) se
  conserva exactamente igual: mismos 3 elementos, mismos delays
  (0/160/340ms), misma duración total (~760ms), mismo respeto de
  `prefers-reduced-motion`. Solo cambió la apariencia final de los
  textos, no cómo llegan a esa posición.

### 2. Saludo aleatorio (remate dinámico)

El remate de la pregunta ya no es un texto fijo en el HTML. Ahora
`renderHome(user)` en `script.js`, en cada entrada a Home, sortea uno
de 8 remates posibles (`HOME_GREETING_QUESTIONS`,
`pickRandomHomeGreetingQuestion()`) y lo escribe en
`.home-greet-question` **antes** de disparar
`playHomeGreetingAnimation()` (así el texto ya está actualizado
cuando arranca la animación de entrada):

```js
const HOME_GREETING_QUESTIONS = [
  "¿Como estás?",
  "¿Todo bajo control?",
  "¿Todo bien?",
  "¿hoy sale previa?",
  "¿se viene algo bueno?",
  "¿seguimos vivos?",
  "¿qué tal tu dia?",
  "¿disfrutando barilo?",
];
```

- El `<p class="eyebrow home-greet-question">` en `index.html`
  conserva "¿como estás?" como contenido estático de partida (por si
  el JS tarda en correr o para quien lea el markup fuente), pero en
  la práctica `renderHome()` lo pisa siempre con una opción elegida
  al azar en cuanto se entra a `/home` — incluida la primera vez
  después del login.
- Elección puramente de sesión/render: no se guarda en
  `localStorage` ni en ningún otro lado, así que puede repetirse la
  misma opción dos veces seguidas (no hay lógica de "no repetir la
  anterior").
- No afecta `currentUser`, `userData:<id>` ni ningún otro dato; es
  estrictamente texto mostrado en pantalla.

### Qué NO cambió

Ninguna otra sección, texto, tarjeta, header, logo, montañas, nieve,
botones, navbar, la transición Home → Dinero (v0.26.0), ni ninguna
otra pantalla o funcionalidad.

## v0.27.0 — Animación de entrada del saludo en Home

Prueba puntual y aislada: los 3 textos del saludo de Home (`.eyebrow`
"Hola,", `#home-username.hero-name` con el nombre, `.eyebrow`
"¿como estás?") ahora entran con una secuencia escalonada de
transform + opacity en vez de aparecer estáticos.

- **Markup sin romper nada existente**: en `index.html` se sumaron
  las clases `home-greet-hola`, `home-greet-name` y
  `home-greet-question` a los 3 elementos ya existentes dentro de
  `.home-hero-bottom`, junto a sus clases originales (`eyebrow`,
  `hero-name`) que no se tocaron. Ninguna otra sección, texto,
  tarjeta, header, logo, montaña, nieve ni botón fue modificado.
- **Secuencia**: "Hola," entra desde la izquierda
  (`translateX(-48px) → 0` + opacity), con delay 0. El nombre entra
  con sensación de profundidad (`translateX(40px) scale(0.82) → 0
  scale(1)` + opacity), delay 160ms. "¿como estás?" repite el mismo
  estilo que "Hola," (entra desde la izquierda), delay 340ms.
  Duración total ≈ 760ms (dentro del rango 700–1000ms pedido).
  `cubic-bezier(0.16, 1, 0.3, 1)` para una desaceleración suave,
  "premium", sin rebote.
- **Solo transform + opacity**: sin animar `width`, `margin` ni
  otras propiedades que disparen reflow. La posición/tamaño/tipografía
  final de los 3 textos es exactamente la que tenían antes — la
  animación solo afecta cómo llegan.
- **Se ejecuta al entrar a Home, no en cada micro-render**: los 3
  nodos son estáticos en el DOM (no se recrean), así que agregar la
  clase `.home-greeting-animate` una sola vez no alcanzaría para que
  vuelva a jugar en próximas visitas. `renderHome()` en `script.js`
  ahora llama a `playHomeGreetingAnimation()`, que saca la clase,
  fuerza un reflow (`void heroBottom.offsetWidth`) y la vuelve a
  poner — truco estándar para reiniciar un `@keyframes` en un nodo
  que ya la tenía. Como `renderHome()` solo se invoca desde la rama
  "home" de `navigate()` (un único choke point), la secuencia se
  dispara en cada entrada real a Home y nunca por cuenta propia
  mientras el usuario permanece ahí.
- **`prefers-reduced-motion`**: toda la regla de animación está
  dentro de `@media (prefers-reduced-motion: no-preference)`; con
  la preferencia de reducir movimiento activada, la clase
  `.home-greeting-animate` no dispara ningún `animation`, así que
  los 3 textos se muestran directo en su posición/opacidad final
  (no hay estado oculto aplicado fuera de una animación en curso).
- **Sin librerías nuevas**: CSS `@keyframes` + un `classList`
  add/remove puntual en JS, reutilizando el mismo patrón mobile-first
  (transform/opacity) ya usado en el resto de la web.
- Verificado: sin overflow horizontal, sin interferencia con scroll,
  posición final idéntica a la anterior, sin tocar Dinero, Registro
  diario, Envío de datos, bottom nav, header, logo, montañas, nieve
  ni la transición Home → Dinero (ver v0.26.0).

## v0.26.0 — Transición Home → Dinero (slide + fade, prueba puntual)

Primera prueba de animación de navegación, acotada exclusivamente al
botón que lleva de Home a Dinero (`#card-money`). El resto de las
navegaciones (Dinero → Home, Home → cualquier otra sección, back del
navegador, bottom nav) sigue usando `navigate()` sin ningún cambio.

- **CSS**: dos animaciones nuevas en `styles.css`, agregadas después
  de `.screen.active` — `.home-to-money-exit` (Home: `opacity: 1→0` +
  `translateY(0→-10px)`, 160ms) y `.money-from-home-enter` (Dinero:
  `opacity: 0→1` + `translateY(10px→0)`, 200ms). Solo `transform` +
  `opacity`, sin reflow. Envueltas en
  `@media (prefers-reduced-motion: reduce) { animation: none; }`
  para desactivarse con esa preferencia.
- **JS**: nueva función `navigateHomeToMoneyWithTransition()` en
  `script.js`, usada únicamente por el listener de `#card-money`
  (antes llamaba directo a `navigate("money")`). Si el usuario no
  viene de Home o tiene `prefers-reduced-motion` activado, cae al
  `navigate("money")` original sin animar. Si no, anima la salida de
  Home (160ms), y al terminar (`animationend`) recién ahí llama a
  `navigate("money")` normal y anima la entrada de Dinero (200ms) —
  secuencial, para no superponer dos `.screen` en el flujo normal del
  documento y evitar saltos de layout. Duración total ≈ 360ms.
  `navigate()`, `showScreen()` y el resto de los listeners de
  navegación no se tocaron.

## v0.25.0 — Nieve global en toda la web

La nieve (misma clase `.snowflake`, misma animación
`@keyframes login-snow-fall` ya usada en LOGIN/Home) ahora es un
elemento visual permanente en **todas** las secciones de la app, no
solo en login/Home: Dinero, Registro diario, Envío de datos,
/admin, Previas de admin, Estadísticas y Previas de Jere también la
tienen.

- **Un único componente, no duplicado**: `index.html` define un solo
  contenedor `#global-snowfall` (16 `<span class="snowflake">`) que
  arranca como hijo de `#app`. `script.js` lo reubica como **primer
  hijo de la pantalla activa** dentro de `showScreen()` — el único
  choke point por el que ya pasaba toda navegación — con
  `insertBefore`, moviendo el mismo nodo de pantalla en pantalla en
  vez de clonar markup en cada sección (`placeGlobalSnowfall()`).
  Verificado con Playwright: en cada una de las 9 pantallas
  (`select`, `home`, `money`, `daily`, `export`, `admin`, `previas`,
  `stats`, `previas-jere`) el nodo aparece como primer hijo de esa
  pantalla y solo existe **un** `#global-snowfall` en todo el
  documento.
- **Por qué reubicar en vez de un overlay fijo fuera de las
  pantallas**: la mayoría de las pantallas (todas, hoy — tema
  "Bariloche" blanco/celeste) pintan su propio fondo con degradé
  opaco directamente en `.screen` (`.screen.admin-frost`, ver
  SPEC.md → Diseño). Un overlay puesto antes de todas las
  `.screen` en el DOM habría quedado tapado por ese fondo opaco.
  Insertar la nieve como primer hijo DENTRO de la pantalla activa la
  deja por encima del fondo propio de esa pantalla pero por debajo
  de absolutamente todo el contenido real (headers, cards, botones,
  inputs, textos), que sigue viniendo después en el DOM.
- **Cubre toda la altura, no solo arriba**: `position: fixed;
  height: 100dvh` — se mantiene ocupando el viewport completo en
  cualquier scroll. Verificado con Playwright: el
  `getBoundingClientRect()` del contenedor es idéntico antes y
  después de un `window.scrollTo(0, 300)`, o sea sigue "cayendo" sin
  interrupciones mientras se scrollea, exactamente como se pidió.
- **Siempre detrás de todo, nunca bloquea clicks**: al ser primer
  hijo de la pantalla activa, cualquier contenido real de esa
  pantalla pinta por encima automáticamente (sin necesitar
  `z-index` en cada componente). El bottom nav (`z-index: 20`) y los
  bottom sheets (`z-index: 60`) no son hijos de `.screen` — son
  hermanos con su propio `z-index` ya existente — así que quedan
  intactos y por encima sin ningún cambio. `pointer-events: none`
  en el contenedor asegura que nunca intercepte toques. Verificado
  con Playwright: `elementFromPoint` sobre el centro de una card
  (incluso después de hacer scroll hasta ella) nunca resuelve a
  `.snowflake` ni a `#global-snowfall`.
- **Independiente del parallax de LOGIN/Home**: `.login-snowfall`
  (con su parallax atado al scroll, `updateLoginParallax()`) sigue
  existiendo tal cual, sin tocar una línea — es una capa totalmente
  aparte de la nueva `#global-snowfall`, que no tiene parallax ni
  reacciona al scroll. En login/Home conviven ambas (la nieve del
  header con parallax + la nieve ambiental global), sin que se vea
  saturado.
- **Sutil, no satura la pantalla**: 16 copos en total para todo el
  alto de la página (antes eran 12, pero confinados solo a la franja
  del header en login/Home), tamaños/velocidades variados,
  `prefers-reduced-motion` respetado (la regla ya existente para
  `.snowflake` cubre también estos copos sin cambios adicionales).
- **Rendimiento en celulares**: la caída sigue siendo pura animación
  CSS (sin JS por frame, igual que antes); lo único que agrega JS es
  un `insertBefore` puntual en cada navegación (mover un nodo ya
  existente, no crear/destruir elementos), sin listeners nuevos de
  scroll ni de resize.
- No se tocó ningún dato, cálculo, `localStorage` ni ruta/navegación
  existente: cambio puramente visual. Verificado con Playwright
  corriendo de nuevo toda la suite de pruebas de Previas (registro,
  importación por código, permisos de Jere) sin ninguna regresión.
- Verificado sin overflow horizontal ni errores de consola en las 9
  pantallas, en login/registro/importación de previas completos, y
  con capturas de pantalla en login, Home, Registro diario y
  /admin confirmando la nieve visible pero discreta detrás del
  contenido en las cuatro.

## v0.24.0 — Registro diario suma la estética "Bariloche" (blanco/celeste)

Cambio puramente visual, siguiendo exactamente el mismo patrón ya
usado para Dinero (v0.20.2), Previas de Jere (v0.21.0) y Envío de
datos (v0.22.0): no se tocó ningún cálculo, dato, horario ni
`localStorage` de la sección Registro diario (`renderDailyScreen`,
`computeDailyDerived`, `getYesterdayKey`, `formatDailyDate`,
`renderTimeScroll`, `defaultDailyEntry`, `ensureDailyLogData`, etc.).

### Alcance

`#screen-daily` pasa a compartir la paleta blanco/celeste fría de
LOGIN/Home/Dinero/Previas/Admin/Envío de datos, sumando la clase
`admin-frost` a su `<section>` en `index.html` (mismo mecanismo que
el resto de las pantallas con esta estética). Con este cambio ya no
queda ninguna pantalla logueada con el tema oscuro original: Registro
diario era la última.

### Cómo se hizo (mínimo código, máxima reutilización)

- `renderDailyScreen()` no cambió: sigue armando el mismo markup
  (`.daily-date-banner`, `.daily-section`, `.toggle-chip`,
  `.chip`/`.chip-group`, `.picker-block`, `.field-label`,
  `.time-scroll`/`.time-option`, `.add-nap-btn`, `.daily-computed`,
  `.daily-total-sleep`, `.sheet-cancel-link`, `.sheet-submit`). Como
  todas esas clases ya estaban construidas sobre las variables de
  color compartidas (`--surface`, `--surface-2`, `--border`,
  `--text*`, redefinidas dentro de `.screen.admin-frost` desde
  v0.20.0), heredan el nuevo look en cascada sin reescribir ninguna
  clase.
- `.daily-hero` ya reutilizaba `.admin-hero`, así que la cabecera
  hereda tal cual el mismo glow celeste, botón volver, badge y
  eyebrow/hero-name que ya usan Admin/Dinero/Export.
- Se agregaron reglas nuevas en `styles.css`, todas scoped a
  `.screen.admin-frost`:
  - mismo tratamiento "vidrio" (`backdrop-filter: blur(10px)` +
    sombra celeste) que ya usan `.donut-card`/`.money-prompt`/
    `.history-row`/`.daily-section` (Envío de datos), aplicado también
    a `.daily-date-banner` y `.daily-total-sleep`;
  - recoloreo a celeste (`#2f8fd1`) o rosa de contraste
    (`#d6284a`) de los pocos elementos que usaban `--accent-2` (cian
    `#4cc9f0`, pensado para fondo oscuro y con bajo contraste sobre
    blanco) o rosa "a fuego" fijo: `.time-option.selected` (hora
    elegida en cada scroll horizontal), `.toggle-chip.selected` ("No
    dormí"/"No fui al boliche" activados), `.add-nap-btn` ("+
    Registrar siesta"), `.daily-computed`/`.daily-total-sleep strong`
    (duración de sueño/siesta/boliche calculada) y `.daily-save-msg`
    (confirmación al guardar).
  - `.chip.selected` ya tenía su override celeste desde v0.20.0 (se
    reutiliza tal cual para "quinta comida"/"baño").
- `openSheet()` no aplica ningún sheet en Registro diario (no abre
  bottom sheets propios: todo se guarda con el botón "Guardar
  registro" en la misma pantalla), así que no hizo falta ningún
  cambio ahí.
- `navigate()` (`script.js`) suma `route === "daily"` a la condición
  que togglea `bottom-nav-frost`, para que la barra inferior se vea
  celeste/blanca también dentro de `#/daily` (antes era la única
  pantalla logueada donde la barra se veía oscura).

### Verificación

Revisado a mano contra el código existente: `node --check script.js`
sin errores, llaves de `styles.css` balanceadas, `renderDailyScreen` y
el resto del flujo de Registro diario (horas de dormir/despertar,
siesta opcional, quinta comida, baño, hora de salida del boliche,
cálculos derivados, guardado) sin cambios de comportamiento — solo la
clase `admin-frost` agregada a `<section id="screen-daily">` y las
reglas de color/vidrio nuevas descriptas arriba. Ningún registro
existente en `dailyLog.entries` cambió de valor o formato.

## v0.23.0 — Se elimina el botón "+ Agregar jugador" y su flujo asociado

Simplificación de la sección "Jugadores" en /admin: no se van a
agregar jugadores nuevos desde la app (la lista de participantes
siempre es la fija de `PARTICIPANTS`), así que el botón "+ Agregar
jugador" y toda su interfaz asociada dejan de existir. "Actualizar
código" queda como único punto de entrada para importar/actualizar
los datos de un jugador, sin cambios en su comportamiento.

### Qué se eliminó

- El botón `#btn-admin-add-player` ("+ Agregar jugador") en
  `index.html`, y su listener en `script.js`.
- La función `openAdminImportAdd()`.
- El paso `"duplicate"` de `renderAdminImportSheet()` (el bottom
  sheet "`<Nombre>` ya está cargado, usá 'Actualizar código'"), que
  solo existía para el flujo "+ Agregar jugador".
- La variable de módulo `adminImportMode` (`"add"` | `"update-code"`)
  y todas sus ramas condicionales: como ahora solo existe un flujo,
  el título del sheet ("Actualizar código"), el botón de confirmación
  ("Confirmar actualización") y el chequeo de duplicado en
  `handleAdminImportPaste()` quedaron hardcodeados a ese único
  comportamiento en vez de decidirse por un modo.

### Qué NO cambió

- **"Actualizar código"** (`openAdminImportUpdateCode()`) sigue
  funcionando exactamente igual: pegar código → decodificar
  (`decodeExportCode`) → validar (`validateImportPayload`) →
  identificar el jugador contra `PARTICIPANTS` → previsualizar →
  "Confirmar actualización" → `confirmAdminImport()` escribe en
  `adminPlayers` (upsert: crea si no existía, actualiza si ya
  existía). Mismo comportamiento de siempre para un jugador nuevo
  (antes solo alcanzable con "+ Agregar jugador", ahora también con
  "Actualizar código", ya que ambos flujos hacían upsert en la
  práctica).
- `adminPlayers`, `PARTICIPANTS`, `decodeExportCode`,
  `validateImportPayload`, `resolvePlayerName`, `confirmAdminImport`,
  el saldo inicial privado, la lista única de jugadores
  (`renderAdmin()`) y el resto de /admin (Previas, Estadísticas): sin
  ningún cambio.
- Ninguna otra sección (Login, Home, Dinero, Registro diario, Envío
  de datos, Previas de admin/Jere, Estadísticas): sin cambios de
  lógica, datos, `localStorage` ni estilos.

### Verificación

`node --check script.js` sin errores; llaves de `styles.css`
balanceadas (no se tocó `styles.css`: `.admin-add-btn` sigue
compartida con "Introducir código de previa"/"+ Agregar producto" sin
cambios). Revisado a mano que no queda ninguna referencia a
`btn-admin-add-player`, `openAdminImportAdd` ni `adminImportMode` en
`script.js`/`index.html`.

## v0.22.0 — Envío de datos con la estética "Bariloche" blanco/celeste

## v0.22.0 — Envío de datos suma la estética "Bariloche" (blanco/celeste)

Cambio puramente visual, siguiendo exactamente el mismo patrón ya
usado para Dinero (v0.20.2) y Previas de Jere (v0.21.0): no se tocó
ningún cálculo, dato, código de exportación, formato ni `localStorage`
de la sección Envío de datos (`generateExportCode`, `copyExportCode`,
`fallbackCopy`, `buildWhatsappUrl`, etc.).

### Alcance

`#screen-export` pasa a compartir la paleta blanco/celeste fría de
LOGIN/Home/Dinero/Previas/Admin, sumando la clase `admin-frost` a su
`<section>` en `index.html` (mismo mecanismo que el resto de las
pantallas con esta estética). Con este cambio, Registro diario queda
como la única pantalla logueada que conserva el tema oscuro original.

### Cómo se hizo (mínimo código, máxima reutilización)

- `renderExportScreen()` no cambió: sigue armando el mismo markup
  (`.daily-section`, `.export-hint`, `.export-code-box`,
  `.sheet-cancel-link`, `.daily-save-msg`,
  `.sheet-submit.whatsapp-btn`). Como todas esas clases ya estaban
  construidas sobre las variables de color compartidas (`--surface`,
  `--surface-2`, `--border`, `--text*`, `--accent`, redefinidas
  dentro de `.screen.admin-frost` desde v0.20.0), heredan el nuevo
  look en cascada sin reescribir ninguna clase.
- `.export-hero` ya reutilizaba `.admin-hero`, así que la cabecera
  hereda tal cual el mismo glow celeste, botón volver, badge y
  eyebrow/hero-name que ya usan Admin/Dinero/Previas: cero CSS nuevo
  necesario para el header.
- Se agregó una única regla nueva en `styles.css`, scoped a
  `.screen.admin-frost .daily-section`, para sumar el mismo
  tratamiento "vidrio" (`backdrop-filter: blur(10px)` + sombra
  celeste) que ya usan `.donut-card`/`.money-prompt`/`.history-row`
  en Dinero, así la tarjeta que contiene el código se lee como parte
  del mismo bloque visual. Como está scoped a `admin-frost`, no
  afecta la misma clase `.daily-section` reutilizada por Registro
  diario (que no lleva esa clase y sigue con el tema oscuro).
- `.whatsapp-btn` conserva su verde de marca (`#25d366`) sin ningún
  cambio, igual en tema oscuro y en tema claro — es un color de marca
  externa, no parte de la paleta interna de la app.
- `openSheet()` ya aplicaba `sheet-frost` a cualquier sheet abierto
  desde una pantalla `admin-frost` (lógica de v0.20.0, sin tocar);
  Envío de datos no abre ningún sheet propio (el código se muestra
  directo en `.home-content`), así que no hizo falta ningún cambio
  ahí.
- `navigate()` (`script.js`) suma `route === "export"` a la condición
  que togglea `bottom-nav-frost`, para que la barra inferior se vea
  celeste/blanca también dentro de `#/export` (antes se veía oscura
  ahí, aunque el resto de la pantalla ya fuera celeste).

### Verificación

Revisado a mano contra el código existente: `node --check script.js`
sin errores, llaves de `styles.css` balanceadas, `renderExportScreen`
y el resto del flujo de Envío de datos (generar código, copiar,
enviar por WhatsApp) sin cambios de comportamiento — solo la clase
`admin-frost` agregada a `<section id="screen-export">` y la nueva
regla de vidrio en `.daily-section`. Registro diario confirmado sin
cambios (única pantalla logueada que sigue con el tema oscuro
original).

## v0.21.0 — Previas de Jere con la estética "Bariloche" + navbar con más blur

## v0.21.0 — Previas de Jere ("Bariloche") + glassmorphism reforzado en la navbar

Dos cambios puramente visuales, sin tocar ningún cálculo, dato,
permiso ni `localStorage`.

### 1. Previas de Jere suma la estética "Bariloche" (blanco/celeste)

`#screen-previas-jere` (`#/previas-jere`) pasa a compartir la paleta
blanco/celeste fría de LOGIN/Home/Admin/Dinero, sumando la clase
`admin-frost` a su `<section>` en `index.html` (mismo mecanismo ya
usado para `#screen-money`, `#screen-admin`, `#screen-previas` y
`#screen-stats`). Era la única pantalla logueada, fuera de Registro
diario y Envío de datos, que seguía con el tema oscuro original.

- No se tocó `previaMode`, `previaIds()`, `renderPreviasScreen()` ni
  ninguna otra función de `script.js` relacionada con el registro,
  guardado (`localPrevias:<id>`) o generación/copia de código de una
  previa: es exclusivamente una capa de presentación sobre la misma
  pantalla ya documentada (SPEC.md → "Permiso especial: Jere puede
  registrar previas").
- Como todos los componentes reutilizados por esta pantalla
  (`.feature-card`, `.chip`, `.field-input`, `.previa-product-row`,
  `.admin-preview-card`, `.previa-history-list`, etc.) ya estaban
  construidos sobre las variables de color compartidas, heredan el
  nuevo look sin reescribir esas clases.
- `openSheet()` ya aplicaba `sheet-frost` a cualquier sheet abierto
  desde una pantalla `admin-frost`, así que los sheets propios del
  modo local (agregar producto, confirmar previa, "Código de la
  previa") pasan a usar esa variante sin ningún cambio en
  `script.js`. Se agregó una única regla CSS nueva,
  `.sheet.sheet-frost .export-code-box` (mismo tratamiento que
  `.admin-import-textarea`), porque el `<textarea readonly>` de
  "Código de la previa" no estaba cubierto todavía y quedaba con el
  fondo oscuro original dentro de un sheet ya claro.
- `navigate()` suma `route === "previas-jere"` a la condición que
  togglea `bottom-nav-frost`, así la barra inferior también se ve
  celeste/blanca dentro de esta pantalla (antes se veía oscura ahí,
  aunque el resto de la pantalla ya fuera celeste).

### 2. Navbar: glassmorphism/blur notablemente más marcado

`.bottom-nav` (estilo oscuro) y `.bottom-nav-frost` (estilo celeste,
Home/Admin/Dinero/Previas/Estadísticas) comparten el mismo ajuste:
fondo bastante más transparente (opacidad 0.88/0.92 → 0.55 en ambas
variantes) combinado con un `backdrop-filter` más fuerte (`blur(14px)`
→ `blur(28px) saturate(160%)`). El resultado: se ve claramente lo que
hay detrás de la navbar, desenfocado, sin que el fondo casi opaco de
antes lo tape. Se aplica a las navbars de todas las pantallas
logueadas (usuarios y admin) porque ambas variantes comparten la
misma regla base `.bottom-nav`; solo se sobreescribe el color de
fondo en `.bottom-nav-frost`, igual que antes.

- No se tocó ningún color de ícono/texto (`--text-faint`/`--accent`
  en modo oscuro, `#4d6b82`/`#2f8fd1` en modo frost), así que los
  elementos de navegación mantienen buen contraste sobre cualquier
  fondo que quede desenfocado detrás.
- Cambio de dos bloques de CSS (`.bottom-nav`, `.bottom-nav-frost`),
  reutilizando exactamente las mismas variables/selectores que ya
  existían: no se agregó ningún componente, clase ni lógica nueva en
  `script.js`.

### Verificación

Revisado a mano contra el código existente: `node --check script.js`
sin errores, llaves de `styles.css` balanceadas, `renderPreviasScreen`
y el resto del flujo de Previas de Jere sin cambios de comportamiento
(solo la clase `admin-frost` agregada a su `<section>`), y las reglas
nuevas de `.sheet-frost`/`.bottom-nav`/`.bottom-nav-frost` siguen el
mismo patrón ya usado por el resto de la estética "Bariloche".

## v0.20.2 — Dinero suma la estetica "Bariloche" (blanco/celeste)

Cambio puramente visual, siguiendo exactamente el mismo patron ya
usado para /admin (v0.20.0): no se toco ningun calculo, dato,
localStorage ni comportamiento de la seccion Dinero (renderMoneyScreen,
renderMoneyHistory, computeMoneyTotals, ensureMoneyData, migracion de
categorias, submitSheet, etc.).

### Alcance

#screen-money pasa a compartir la paleta blanco/celeste fria de
LOGIN/Home/Admin, sumando la clase admin-frost a su <section> en
index.html (mismo mecanismo que #screen-admin, #screen-previas y
#screen-stats). Registro diario y Envio de datos NO se tocaron: siguen
con el tema oscuro original.

### Como se hizo (minimo codigo, maxima reutilizacion)

- .money-hero ya era admin-hero money-hero, asi que hereda tal cual
  las reglas genericas .screen.admin-frost .admin-hero (glow celeste,
  boton volver, badge, eyebrow, hero-name) que ya existian para Admin:
  cero CSS nuevo necesario para la cabecera.
- El resto de los componentes de Dinero (.donut-card, .donut-track,
  .donut-progress, .donut-hole, .money-prompt, .history-row,
  .section-label) ya estaban escritos sobre las variables compartidas
  (--surface, --surface-2, --border, --accent, --text*), que
  .screen.admin-frost ya redefine a tonos blancos/celestes; heredan el
  nuevo look en cascada sin tocar esas clases.
- La dona sigue siendo el mismo <svg> con el mismo
  stroke-dasharray/stroke-dashoffset (DONUT_R, DONUT_CIRC) y el mismo
  stroke-linecap: round de v0.20.1; el arco que antes era ambar
  (--accent) ahora sale celeste (#2f8fd1) automaticamente por la
  redefinicion de la variable, sin tocar el markup ni el calculo del
  offset en script.js.
- Se agrego un bloque nuevo en styles.css, scoped a
  .screen.admin-frost, para: (a) sumar .donut-card, .money-prompt y
  .history-row al mismo tratamiento "vidrio" (blur + sombra celeste)
  que ya usan .feature-card/.ranking-card en Admin, para que dona,
  saldo e historial se lean como un mismo bloque visual; (b)
  recolorear .money-action.expense/.income y
  .history-row.is-expense/.is-income .history-amount, que tenian
  colores fijos (rosa/celeste "a fuego") pensados para el tema oscuro
  y perdian contraste sobre fondo blanco.
- openSheet() ya activaba sheet-frost para cualquier sheet abierto
  desde una pantalla con la clase admin-frost (logica de v0.20.0, sin
  tocar). Al sumar esa clase a #screen-money, los sheets de saldo
  inicial, gasto, ganancia y editar/eliminar movimiento pasaron a usar
  esa variante automaticamente, sin ningun cambio en script.js.

### Verificacion

Con Playwright (390px), flujo completo como usuario no-admin (Marto):
cargar saldo inicial, agregar un gasto (Comida) y una ganancia, ver la
dona/leyenda/historial actualizados, y abrir el sheet de
editar/eliminar un movimiento. Paleta blanca/celeste consistente con
Home/Admin en las tres capas (pantalla, tarjetas, sheet), montos y
calculos (saldo, gastado, disponible) correctos, dona con extremos
redondeados intactos, sin scroll horizontal.

## v0.20.1 — Dona de Dinero con extremos redondeados (`stroke-linecap: round`)

Cambio mínimo y puramente visual, exclusivo del gráfico donut de la
sección Dinero (`.donut-progress` en `styles.css`). No se tocó
`index.html` ni `script.js`: ni el markup del SVG (`#donut-progress`,
`DONUT_R`/`DONUT_CIRC`), ni el cálculo de `stroke-dasharray`/
`stroke-dashoffset` (`renderMoneyScreen()`, `updateDonut()`), ni los
colores (`var(--surface-2)` para el track, `var(--accent)` para el
progreso), ni la lógica de saldo/gastos/ganancias.

- Único cambio: `.donut-progress { stroke-linecap: butt; }` →
  `stroke-linecap: round;`. El arco que representa el disponible
  (`--accent`, ámbar) ya no corta en línea recta en ninguno de sus
  dos extremos: ahora ambos terminan con una punta redondeada, dando
  un acabado suave contra el resto del círculo (`.donut-track`, gris,
  siempre completo por debajo) en vez de un corte abrupto — es en ese
  límite donde visualmente se percibe el quiebre entre "disponible" y
  "gastado".
- Mismos porcentajes, mismos cálculos, mismos colores, misma
  animación (`transition: stroke-dashoffset 0.5s ease`, sin cambios),
  mismo comportamiento mobile-first: no se agregó ningún elemento ni
  regla nueva, solo se cambió el valor de una propiedad ya existente.
- Verificado con Playwright (390px): con saldo inicial $100.000 y un
  gasto de $25.000 (75% disponible / 25% gastado, mismo caso de
  ejemplo ya documentado), el arco ámbar se ve con ambos extremos
  redondeados y el resto de la tarjeta (monto, leyenda, historial,
  botones "− Gasto"/"+ Ganancia") sin ningún cambio visual.

## v0.20.0 — Sección /admin completa con la estética "Bariloche"

Cambio puramente visual. No se tocó ningún cálculo, dato, permiso,
`localStorage` ni comportamiento: ni `renderAdmin`, `renderPreviasScreen`,
`renderStatsScreen`, las funciones `dayRanking*`/`totalRanking*`,
`decodeExportCode`/`generateExportCode`, ni ninguna validación. Solo
color, fondo, sombras y algunas variantes ya existentes del mismo
lenguaje visual del login/Home.

### Alcance

Las tres pantallas de /admin — Admin (`#screen-admin`), Previas de
admin (`#screen-previas`) y Estadísticas (`#screen-stats`) — pasan a
compartir la paleta blanco/celeste fría ya usada en LOGIN y Home, vía
una nueva clase `admin-frost` agregada directamente en el `<section>`
de cada una (`index.html`). **No se tocó** `#screen-previas-jere`
(sección de Previas en el Home de Jere, no es parte de /admin): sigue
con el tema oscuro original, igual que Money, Registro diario y Envío
de datos.

### Cómo se hizo (mínimo código, máxima reutilización)

- Casi todos los componentes de /admin ya estaban construidos sobre
  las variables de color compartidas (`--bg`, `--surface`,
  `--surface-2`, `--border`, `--text`, `--text-dim`, `--text-faint`,
  `--accent`, `--accent-ink`), no sobre colores fijos. Por eso, un
  único bloque nuevo en `styles.css` que **redefine esas variables
  dentro del scope `.screen.admin-frost`** (mismos tonos que ya usan
  Login/Home: `#10233a` texto, `#4d6b82` texto secundario, `#2f8fd1`
  acento, fondo `#eaf6ff → #ffffff`) alcanza para que la mayoría de
  las tarjetas, filas, botones e inputs hereden el nuevo look sin
  reescribir cada clase una por una (`.feature-card`,
  `.admin-participant-row`, `.chip`, `.field-input`, `.ranking-card`,
  `.stats-day-nav`, etc.).
- Se agregó también `color: var(--text)` a `.screen.admin-frost`:
  algunas clases reutilizadas (ej. `.participant-name`, usada tanto
  en el login como en las filas de "Jugadores") no declaran su propio
  `color` y heredaban el blanco del tema oscuro original directamente
  de `body`; declarar el color también en el contenedor de la
  pantalla corrige la herencia para toda la pantalla sin tocar esa
  clase compartida.
- Solo se sobreescribieron explícitamente, dentro de `.screen.admin-frost`,
  los pocos lugares que tenían el acento ámbar "hardcodeado" (no vía
  variable): el header (`.admin-hero`, con el mismo glow celeste
  suave que ya usa `.home-hero`, sin duplicar montañas/nieve del
  login — ver "Por qué sin montañas/nieve" más abajo), los botones
  "Actualizar código"/"+ Agregar jugador" (`.admin-add-btn`), el tab
  activo Día/Total (`.stats-tab.active`), el podio del 1er puesto de
  cada ranking (`.ranking-podium` y sus subelementos, `.ranking-bar-fill-winner`),
  los chips seleccionados (`.chip.selected`) y los avisos
  (`.admin-notice`) — todos pasan de ámbar a celeste para no romper
  la paleta fría.
- `.feature-card`, `.admin-participant-row`, `.ranking-card` y
  `.stats-empty-banner` reciben además `backdrop-filter: blur` y una
  sombra celeste suave para el mismo efecto "vidrio" que ya usan las
  cards de Home/login.

### Sheets abiertos desde /admin

Los bottom sheets que se abren desde /admin (pegar código de
jugador/previa, agregar producto de previa, confirmar previa) son el
mismo componente genérico `#sheet` compartido con el resto de la app
(Money, Daily, Export). Ya existía una variante `.sheet-frost`
(agregada en v0.19.0 solo para el sheet de contraseña del login); en
vez de duplicarla, `openSheet()` (`script.js`) ahora también la aplica
cuando **la pantalla activa tiene la clase `.admin-frost`**:

```js
const activeFrostScreen = document.querySelector(".screen.active.admin-frost");
sheetEl.classList.toggle("sheet-frost", type === "login-password" || !!activeFrostScreen);
```

Esto es agnóstico al `type` del sheet (no hubo que listar
`"admin-import"`, `"previa-product"`, `"previa-confirm"`,
`"previa-import"` a mano) y automáticamente **no** afecta los sheets
de `"previa-product"`/`"previa-confirm"` cuando se abren desde
`#screen-previas-jere` (Jere, no lleva `admin-frost`): siguen con el
sheet oscuro original, como corresponde por no ser parte de /admin.

`.sheet.sheet-frost` se amplió con reglas para los componentes que
antes no necesitaba cubrir (solo los usaba el sheet de contraseña):
`.admin-import-textarea`, `.admin-preview-card`/`.admin-preview-row`,
`.admin-notice`, `.chip`/`.chip.selected`, `.previa-product-remove` y
`.sheet-submit.danger`.

### Navbar y tabs

`navigate()` (`script.js`) ya togglaba `bottom-nav-frost` en
Home/Admin (v0.19.0); se amplió a `previas` y `stats` para que la
barra inferior celeste/blanca se mantenga también dentro de esas dos
pantallas de /admin (antes se veía oscura ahí, aunque el resto de la
pantalla ya fuera celeste). Previas de Jere y Money/Daily/Export
siguen sin la variante frost, sin cambios.

### Por qué sin montañas/nieve en /admin

El pedido explícito fue "mantener las montañas, gradientes y efectos
donde tengan sentido, **sin saturar la interfaz administrativa**". Se
optó por no duplicar el markup de montañas/nieve/parallax del login
en cada header de /admin (hubiera significado repetir un SVG grande
y su lógica de parallax tres veces, además de recargar visualmente
una pantalla pensada para trabajar con datos). En su lugar, el header
de /admin usa el mismo tipo de glow celeste radial que ya usa
`.home-hero`, sin silueta de montaña ni nieve — mantiene la identidad
visual (mismos tonos, mismo tipo de degradé) sin saturar.

### Verificado

Con Playwright en 390px (Admin, Previas con datos de ejemplo —
selección de participantes, agregar producto, sheet de confirmación,
historial —, Estadísticas DÍA con datos reales de 3 jugadores —
podio, medallas, barras, tabs, navegación de día): buen contraste en
todos los textos (incluida la fila de "Jugadores", que antes de la
corrección de herencia de `color` se veía con el nombre en gris claro
apenas legible), sheets de admin con la variante frost aplicada
correctamente, sin scroll horizontal, y `#screen-previas-jere` /
Money / Daily / Export confirmados sin cambios (tema oscuro
original intacto).

## v0.19.0 — NAVBAR (Home/Admin) + MENÚ DE CONTRASEÑA: estética "Bariloche" + puntos dinámicos sin pista de longitud

## v0.19.0 — Navbar de Home/Admin y menú de contraseña con estética "Bariloche"

Cambio puramente visual. No se tocó `checkLoginPassword`,
`handleSelectUser`, `localStorage`, navegación (`navigate`,
`routeFromHash`) ni ninguna otra funcionalidad. Money, Registro
diario, Envío de datos y el resto de los sheets (gasto, ganancia,
saldo inicial, producto de previa, etc.) **no se tocaron**: siguen
con el tema oscuro original.

### Navbar (`#bottom-nav`)

- `#bottom-nav` es un único componente compartido por todas las
  pantallas logueadas (Home, Admin, Money, Daily, Export, Previas,
  Estadísticas). Como el pedido era acotado a `/home` y
  `/home/admin`, no se restyleó la clase base `.bottom-nav`: se
  agregó una variante `.bottom-nav-frost` (gradiente blanco/celeste,
  borde superior celeste sutil, textos en `#4d6b82`/`#2f8fd1`) que
  `navigate()` (`script.js`) togglea según la pantalla activa
  (`route === "home" || route === "admin"`). En Money/Daily/Export
  —aunque el tab activo visualmente sea "Home"— la barra sigue con
  el estilo oscuro original, tal como se pidió.
- Reutiliza exactamente los mismos tonos que ya usan Home y el
  login (`#2f8fd1`, `#4d6b82`, `rgba(76, 201, 240, .35)`); no se creó
  ninguna paleta nueva.

### Menú de contraseña (`login-password` sheet)

- El sheet de bottom-sheet genérico (`#sheet`) es compartido por
  todos los formularios de la app (gasto, ganancia, saldo inicial,
  producto de previa, contraseña de login, etc.). Se agregó una
  variante `.sheet-frost`, que `openSheet()` togglea únicamente
  cuando `type === "login-password"` — el resto de los formularios
  no se ve afectado.
- `.sheet-frost` reutiliza tal cual los tonos ya usados en Home/login
  (fondo con gradiente blanco→celeste, título `#10233a`, subtítulo
  `#4d6b82`, borde/foco celeste `#4cc9f0`, botón "Entrar" celeste).
- **Puntos dinámicos, sin pista de longitud**: se quitó el
  `placeholder="••"` del input de contraseña (esos dos puntos eran
  el único indicio visual de "se esperan 2 dígitos"). El input real
  sigue siendo funcional (foco, teclado, `Enter` para confirmar,
  lógica de `checkLoginPassword()` intacta) pero su texto queda
  `color: transparent`; encima se dibuja `#login-password-dots`, que
  en el mismo listener `input` que ya limpiaba el estado de error
  ahora también redibuja un `<span class="dot">` por cada carácter
  ya escrito (`pwInput.value.length`), sin mostrar en ningún momento
  cuántos dígitos hacen falta. Si la contraseña es incorrecta,
  `checkLoginPassword()` vacía el input (como ya hacía) y también
  vacía los puntos, para que el estado visual quede consistente.
- Verificado con Playwright: 0 puntos al abrir el sheet, 1 punto al
  escribir 1 carácter, 2 al escribir 2, los puntos se limpian tras
  una contraseña incorrecta, y el login sigue navegando
  correctamente a Home tras una contraseña correcta (`0 errores` de
  consola, `location.hash` y `#home-username` verificados).

## v0.18.0 — HOME: misma estética "Bariloche" del login (montañas, título, nieve, parallax) + tarjetas más grandes

## v0.18.0 — HOME: estética "Bariloche" compartida con el login + rediseño de las 3 tarjetas

Cambio puramente visual, **exclusivo de `#screen-home`**. No se tocó
lógica de sesión/login (`renderParticipantGrid`, `handleSelectUser`,
`checkLoginPassword`, `renderHome` solo sigue seteando
`#home-username`), `localStorage`, navegación (`navigate`,
`bottom-nav`), estadísticas ni ningún registro. Money, Registro
diario, Envío de datos y Admin **no se tocaron**: siguen con el tema
oscuro original, sus propios `.admin-hero`/`.feature-card` no
recibieron ningún estilo nuevo (todo lo agregado está scoped a
`#screen-home` o a la clase compartida `.login-screen`, que solo
llevan `#screen-select` y `#screen-home`).

### Mismo lenguaje visual que el login, reutilizado tal cual

- **Markup idéntico de fondo**: el header de Home
  (`.home-hero`) ahora contiene exactamente la misma estructura que
  `.login-bg` del login — `.login-glow`, `.login-title-bg` ("BARILOCHE"),
  `<svg class="login-mountains">` (mismos paths/gradientes de
  montaña, solo con ids de gradiente renombrados `hmgrad1`/`hmgrad2`
  para no colisionar con los `lmgrad1`/`lmgrad2` del login, ya que
  ambos bloques conviven en el mismo documento) y `.login-snowfall`
  con los mismos 12 copos. **No se creó ningún componente nuevo**:
  es el mismo HTML copiado, ninguna clase CSS nueva de fondo.
- **Mismo fondo celeste/blanco en toda la pantalla**: la regla que
  antes vivía en `#screen-select.login-screen` (gradiente de fondo,
  `overflow: hidden`) se generalizó a `.login-screen` (sin el
  selector de ID), y `#screen-home` ahora lleva también esa clase.
  `justify-content: flex-end` (que solo tiene sentido para el login,
  donde el grid de jugadores se pega abajo) quedó en una regla aparte
  `#screen-select.login-screen`, así que Home conserva su flujo
  normal de arriba hacia abajo.
- **Mismos tonos de texto**: `.login-screen .eyebrow` (antes scoped
  solo a `#screen-select`) ahora también broadea a Home, y se agregó
  `.login-screen .hero-name` con el mismo tratamiento que ya tenía
  `.select-title` (color `#10233a`, `text-shadow` celeste) — así el
  saludo ("Hola, `<nombre>`") usa el mismo estilo que el título del
  login sin duplicar la regla.
- **Mismo parallax de scroll**: `updateLoginParallax()` (`script.js`)
  se generalizó para buscar la pantalla activa entre `#screen-select`
  y `#screen-home` (`document.querySelector("#screen-select.active,
  #screen-home.active")`) y aplicar el transform solo dentro de esa
  pantalla (antes usaba `document.querySelector` global, lo que
  hubiera tomado siempre las capas del login por ser las primeras en
  el DOM). Mismas velocidades por capa que en el login (montañas
  `-0.1`, glow `+0.05` con escala, nieve `+0.18`, título `-0.05`);
  mismo throttling con `requestAnimationFrame` y mismo respeto de
  `prefers-reduced-motion` (los selectores de la media query ya eran
  por clase, no por ID, así que cubren ambas pantallas sin cambios).
- **Botón de logout e insignia "Bariloche" del hero**: pasan a un
  estilo "vidrio" claro (`.home-hero .icon-btn`, `.home-hero
  .hero-badge`) con los mismos tonos celeste (`rgba(76, 201, 240,
  .35)`, `#2f8fd1`) que ya usan las cards de jugador del login.
- **Composición**: `.home-hero-bottom` (el bloque de saludo) baja su
  `margin-top` para quedar debajo de la línea de las montañas, igual
  criterio que ya se usó para `.login-content` en el login (v0.17.2),
  así el saludo no compite visualmente con el título "BARILOCHE".

### Rediseño de las 3 secciones: más espacio vertical aprovechado

- `#screen-home .feature-card` pasa a un estilo "vidrio" (mismos
  valores que `#screen-select .participant-btn`: fondo blanco
  translúcido, `backdrop-filter: blur`, borde celeste sutil, sombra
  azulada) con bastante más padding (`24px 20px` vs `14px` antes) e
  ícono más grande (`60×60px`, antes `44×44px`), título en `18px`
  (antes `15px`) y bajada en `14px` (antes `13px`) — cada tarjeta
  ocupa considerablemente más alto de pantalla, y el `gap` entre
  tarjetas también creció (`16px`, antes `10px`).
- Se mantienen exactamente las mismas 3 secciones (Dinero, Registro
  diario, Envío de datos) y la sección condicional de Previas para
  Jere, con la misma funcionalidad, los mismos `id` (`card-money`,
  `card-daily`, `card-export`, `card-previas-jere`) y el mismo
  comportamiento de tap/navegación — no se tocó ningún listener de
  `script.js` asociado a estas cards.
- `.section-label` y `.home-footnote` dentro de `#screen-home` pasan
  a tonos celeste/gris-azulado legibles sobre el nuevo fondo claro,
  sin afectar sus usos en Admin/Estadísticas (donde siguen con los
  tonos oscuros originales, al estar scoped a `#screen-home`).
- Verificado con Playwright en 360px y 390px, con los usuarios Gio
  (sin Previas) y Jere (con Previas): sin scroll horizontal en
  ningún caso, las 3 (o 4, con Jere) tarjetas se ven notablemente más
  grandes y con menos espacio vacío que antes, `#nav-admin`/`#btn-*`
  siguen navegando correctamente a Money/Daily/Export/Admin, que
  conservan su tema oscuro sin ningún cambio visual.

## v0.17.2 — LOGIN: título grande "BARILOCHE" detrás de las montañas + reajuste de composición

## v0.17.2 — LOGIN: título "BARILOCHE" detrás de las montañas + reajuste de composición

Cambio puramente visual y aditivo sobre la estética "Bariloche" del
login (v0.17.0/v0.17.1), **exclusivo de `#screen-select`**. No se
tocó lógica de login (`renderParticipantGrid`, `handleSelectUser`,
`checkLoginPassword`), `localStorage`, navegación, jugadores ni
estadísticas.

- **Nuevo elemento `.login-title-bg`** (`<p aria-hidden="true">BARILOCHE</p>`
  dentro de `.login-bg`, en el `index.html`): un título grande y
  protagonista, con tipografía display (`var(--font-display)`, peso
  800), en degradé de texto blanco → celeste (`background-clip: text`,
  mismos tonos que ya usa el resto del fondo — `--accent`/celestes del
  gradiente del login), pensado como portada de viaje.
- **Las montañas lo tapan parcialmente, no solo quedan "debajo"**: en
  el markup, `.login-title-bg` se ubica *antes* que
  `<svg class="login-mountains">`, dentro del mismo padre (`.login-bg`)
  y sin que ninguno de los dos tenga `z-index` propio — con
  `z-index: auto` el orden de pintado lo decide el orden del DOM, así
  que las montañas (que vienen después) se pintan encima del texto y
  lo recortan visualmente donde se superponen los picos, en vez de
  simplemente aparecer una sobre otra sin solaparse. Verificado con
  capturas en 360px y 390px: los picos de las montañas cubren
  parte de las letras de "BARILOCHE".
- **Profundidad/parallax propio**: `updateLoginParallax()` (`script.js`)
  ahora también mueve `.login-title-bg`, a una velocidad menor que
  `.login-mountains` (factor `-0.05` vs `-0.1` de las montañas) para
  reforzar la sensación de que el título está más "atrás" en la
  composición. Usa la misma `transition: transform` con
  `translate3d`/`will-change` que el resto de las capas del fondo, así
  que hereda el mismo suavizado y el mismo respeto de
  `prefers-reduced-motion: reduce` (sin listener → sin transform →
  capa estática) ya implementado en v0.17.1.
- **Integrado con el fondo existente**: vive dentro de `.login-bg`
  (`overflow: hidden`), tiene `pointer-events: none` y
  `user-select: none` (no interfiere con los toques sobre las cards
  ni es seleccionable), y usa los mismos tonos celeste/blanco del
  gradiente de fondo y del glow ya existentes — no se agregó ninguna
  paleta nueva.
- **Reajuste de composición** (`styles.css`, solo dentro de
  `#screen-select`): `.login-content` baja su `margin-top` de `210px`
  a `228px`, así "VIAJE DE EGRESADOS" queda ligeramente más abajo,
  más cerca de la línea inferior de las montañas. Se agregó
  `margin-top: 14px` a `#screen-select.login-screen .select-title`
  (el "¿Quién sos?"), para separarlo un poco más de "VIAJE DE
  EGRESADOS" y darle más aire respecto de los elementos de arriba.
  Nada de esto afecta el grid de jugadores, el scroll ni el resto del
  layout.
- Verificado con Playwright en 360px y 390px, con y sin scroll: sin
  overflow horizontal en ningún caso (el título es más ancho que la
  pantalla en algunos anchos, pero queda recortado por el
  `overflow: hidden` de `.login-bg`, que es `position: absolute`
  y no afecta el ancho del documento), la lógica de selección de
  usuario y contraseña sigue funcionando sin cambios, y las clases
  nuevas (`.login-title-bg`) son exclusivas de `#screen-select`.

## v0.17.1 — LOGIN: fondo interactivo con el scroll (parallax sutil)

Cambio puramente visual y aditivo sobre la estética "Bariloche" del
login (v0.17.0), **exclusivo de `#screen-select`**. No se modificó
la lógica de autenticación, `localStorage`, la navegación ni ninguna
otra pantalla.

- **Qué se mueve**: las tres capas decorativas del fondo del login
  — `.login-glow` (el resplandor celeste/violeta), `.login-mountains`
  (la silueta de montañas nevadas) y `.login-snowfall` (el
  contenedor de los 12 copos) — reciben un `transform: translate3d`
  proporcional al scroll, calculado en la nueva función
  `updateLoginParallax()` de `script.js`. Cada capa se mueve a una
  velocidad distinta (montañas más lento y hacia arriba, glow y
  nieve más rápido y hacia abajo) para dar sensación de profundidad
  al recorrer el grid de jugadores.
- **Qué NO se mueve**: `.login-content` (título, subtítulo y grid de
  jugadores) nunca recibe transform — las cards quedan perfectamente
  quietas y legibles, sin deformarse ni desplazarse por el efecto.
  Cada `.snowflake` sigue con su propia animación de caída
  (`@keyframes login-snow-fall`) sin cambios; el transform del
  contenedor `.login-snowfall` se compone con el de cada copo sin
  pisarlo (son elementos padre/hijo, cada uno con su propio
  transform).
- **Cómo se calcula** (`initLoginParallax()`, llamada una sola vez
  desde `init()`): un único listener de `scroll` (+ uno de `resize`)
  en `window`, con `{ passive: true }`, throttleado con
  `requestAnimationFrame` mediante un flag `loginParallaxTicking`
  para nunca encolar más de un cálculo por frame. Dentro del
  handler, si `#screen-select` no tiene la clase `active` (no es la
  pantalla visible), no hace nada — así no gasta ciclos cuando el
  usuario ya navegó a Home/Admin/Estadísticas/etc. El desplazamiento
  se calcula sobre `window.scrollY` acotado a
  `LOGIN_PARALLAX_MAX_SCROLL = 480` px, para que el efecto no se
  dispare de forma exagerada con scrolls largos.
- **Suavizado barato**: la interpolación fluida no se hace a mano en
  JS (nada de animar con `setInterval`/loops propios) — cada capa ya
  tiene `transition: transform 0.35s cubic-bezier(...)` en CSS, así
  que el navegador anima el paso entre valores de scroll con
  aceleración de GPU (`translate3d` + `will-change: transform`);
  JS solo escribe el valor final por frame, throttleado.
- **Fallback sin JS/con "reducir movimiento"**: `initLoginParallax()`
  revisa `prefers-reduced-motion: reduce` y la existencia de
  `requestAnimationFrame` antes de agregar los listeners; si alguna
  falla, no se agrega ningún listener y las tres capas se quedan en
  su `transform: translate3d(0, 0, 0)` base (fondo estático, igual
  que en v0.17.0, sin parallax). También se agregó
  `@media (prefers-reduced-motion: reduce) { transition: none }`
  sobre esas capas para no animar ninguna transición de más si el
  valor llegara a cambiar igual.
- Verificado: `script.js` sigue con sintaxis válida y sin tocar
  ninguna función de login/routing/estadísticas existente; las
  clases `.login-glow`/`.login-mountains`/`.login-snowfall` son
  exclusivas de `#screen-select` (no aparecen en ninguna otra
  pantalla), así que el efecto no puede filtrarse a Home/Admin/etc.

## v0.17.0 — Rediseño experimental de LOGIN: estética "Bariloche" (blanco/celeste, nieve) + grid 2 columnas

Cambio puramente visual, **exclusivo de la pantalla de login**
(`#screen-select`, "¿Quién sos?"). No se tocó `script.js` en
absoluto: la lógica de autenticación (`renderParticipantGrid`,
`handleSelectUser`, `checkLoginPassword`), `localStorage`, la
navegación y el resto de las pantallas (Home, Admin, Estadísticas,
Registro diario) quedan intactas y siguen con el tema oscuro
original. Solo se editaron `index.html` (markup de `#screen-select`)
y `styles.css`.

- **Grid de jugadores en 2 columnas**: `.participant-grid` dentro de
  `#screen-select` pasa de `repeat(3, 1fr)` a `repeat(2, 1fr)`
  (scoped con el selector `#screen-select .participant-grid` para no
  afectar otros usos de esas mismas clases — ver más abajo). Entran
  2 cards por fila en mobile, el resto aparece con scroll vertical
  normal del contenedor. Se mantienen los 11 participantes
  existentes (`PARTICIPANTS`) sin cambios.
- **Fondo blanco/celeste con nieve**: `#screen-select` reemplaza el
  fondo oscuro con estrellas por `linear-gradient(180deg, #eaf6ff →
  #ffffff)` más un glow radial celeste/violeta suave
  (`.login-glow`), una silueta SVG de montañas nevadas en tonos
  celestes con picos blancos (`.login-mountains`, nueva, no reusa el
  `.mountains` oscuro de Home/Admin) y una capa de copos
  (`.login-snowfall` → 12 `<span class="snowflake">` con posición,
  duración, delay y deriva horizontal fijados por variables CSS
  inline por copo). La caída es 100% CSS (`@keyframes
  login-snow-fall`, `animation: ... linear infinite`), sin JS: pocos
  copos (12), loop continuo y suave, `pointer-events: none` en todo
  el contenedor para que nunca intercepten toques, y respeta
  `prefers-reduced-motion` (copos estáticos, sin animación, si el
  usuario lo tiene activado). La capa de nieve queda en
  `z-index: 1`, detrás del contenido (`.login-content`, `z-index: 2`).
- **Cards de jugador estilo "vidrio"**: fondo blanco translúcido con
  `backdrop-filter: blur`, borde celeste sutil, sombra azulada,
  avatar con halo blanco. Título y subtítulo del login pasan a
  tonos oscuros sobre fondo claro para mantener legibilidad
  (`#10233a` / `#4d6b82`), y el pill "Admin" cambia a degradé celeste
  para contrastar sobre blanco (antes naranja sobre fondo oscuro).
- **Sin tocar clases compartidas**: `.participant-avatar`,
  `.participant-name`, `.admin-pill` y `.eyebrow` se siguen usando
  también en Admin (ej. filas de participantes de Previas) y en el
  resto de la app; sus reglas base quedaron exactamente como
  estaban. Los estilos nuevos se agregaron con selectores scoped
  bajo `#screen-select`/`#screen-select.login-screen`, que ganan por
  especificidad solo dentro del login sin modificar el
  comportamiento en ningún otro lado. Verificado revisando que no
  quedó ninguna clase compartida con su regla base editada o
  eliminada.
- **Mobile-first, sin trabajo de desktop**: no se agregó ninguna
  media query nueva para pantallas grandes; el layout de 2 columnas
  y la nieve se probaron pensando en 360–430px, que es donde vive
  `#app` (con su centrado existente en desktop, sin cambios).

Pendiente (a propósito, no pedido en este pase): extender esta
estética al resto de la app (Home, Admin, Estadísticas, Registro
diario) si el experimento visual del login funciona.

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
    "$200.000") entre completo sin desbordar el círculo. Extremos del
    arco ámbar redondeados (`stroke-linecap: round`, v0.20.1) en vez
    de terminar en línea recta.
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
7b. **Ranking por jugador dentro de cada categoría** (v0.16.3) —
   además de la tarjeta anterior (que rankea categorías entre sí),
   una tarjeta por categoría (Alcohol, Comida, Chocolates, Boliche,
   Actividades, Bebida, Otros) rankeando jugadores según cuánto
   gastaron en esa categoría puntual. Mismo conjunto de gastos que
   los puntos 6/7 (`dayExpenses`/`totalExpenses`, sin cambios),
   filtrado por `category` y sumado por jugador vía
   `rankingPorCategoriaJugador(expenses, category)` →
   `dayRankingPorCategoriaJugador(dateKey, category)` /
   `totalRankingPorCategoriaJugador(closedDays, category)`. Títulos
   humorísticos y colores de acento fijos en `CATEGORY_RANKING_META`.
   `renderCategoryRankingCards(rankingFn)` genera la tarjeta solo
   para categorías con al menos un gasto en el período mostrado (sin
   gastos → sin tarjeta, no se inventa un estado vacío); reutiliza
   `renderRankingCard`/`renderRankingBars` sin modificarlos, así que
   el ganador de cada categoría queda destacado igual que en el
   resto de rankings (🏆, color de acento, glow). Insertada en
   `renderDayStatsReal`/`renderTotalStatsReal` justo después de la
   tarjeta "¿En qué se fue la plata?" del punto 7.
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

Verificado también (v0.16.3) `rankingPorCategoriaJugador` +
`dayRankingPorCategoriaJugador`/`totalRankingPorCategoriaJugador`
con ese mismo set de ejemplo: cada categoría con gastos genera su
tarjeta con el jugador de mayor gasto en el puesto 1, una categoría
sin ningún gasto no genera tarjeta, y las tarjetas de categorías con
datos solo en DÍA o solo en TOTAL aparecen exclusivamente en el
apartado correspondiente.

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