/* =========================================================
   BARILOCHE WEB — lógica
   ========================================================= */

/* -----------------------------------------------------------
   CONFIGURACIÓN DE PARTICIPANTES
   -----------------------------------------------------------
   Estos son placeholders. Reemplazá "name" por los nombres
   reales del grupo. "id" debe ser único y estable (no lo
   cambies una vez que alguien ya empezó a usar la app, porque
   sus datos quedan guardados bajo ese id). "isAdmin: true"
   es exclusivo de Gio.
   ----------------------------------------------------------- */
const PARTICIPANTS = [
  { id: "gio", name: "Gio", password: "lv", isAdmin: true },
  { id: "marto", name: "Marto", password: "ze" },
  { id: "sebas", name: "Sebas", password: "do" },
  { id: "ger", name: "Ger", password: "te" },
  { id: "nerea", name: "Nerea", password: "ri" },
  { id: "simon", name: "Simon", password: "da" },
  { id: "agus", name: "Agus", password: "ju" },
  { id: "nata", name: "Nata", password: "ch" },
  { id: "barua", name: "Barua", password: "ba" },
  { id: "jere", name: "Jere", password: "so", canRegisterPrevias: true },
  { id: "tobi", name: "Tobi", password: "ma" },
];

const AVATAR_COLORS = ["#ff9f1c", "#4cc9f0", "#c77dff", "#ff5470", "#7bdff2", "#ffd166"];

/* -----------------------------------------------------------
   HERRAMIENTA DE TESTING — simulación de fecha (day())
   -----------------------------------------------------------
   Exclusiva para pruebas manuales desde la consola del navegador.
   No modifica la fecha real del sistema: sólo intercepta el
   "hoy" que usan las funciones de día de viaje (Registro diario
   y Estadísticas), a través de getSimulatedToday().
   Uso:
     day(14, 9)   -> simula el 14/09 (año actual)
     day(15, 9)
     day()        -> vuelve al modo normal (fecha real)
     day("reset") -> ídem
   No usar en producción real con el grupo: es sólo para QA.
   ----------------------------------------------------------- */
let __simulatedDate = null; // Date | null

function getSimulatedToday() {
  return __simulatedDate ? new Date(__simulatedDate.getTime()) : new Date();
}

function day(dia, mes) {
  if (dia === undefined || dia === "reset") {
    __simulatedDate = null;
    console.log("[day] Fecha simulada desactivada. Usando fecha real del sistema.");
    refreshCurrentScreenForDaySim();
    return;
  }
  if (mes === undefined) {
    console.warn('[day] Uso: day(dia, mes) — ej: day(14, 9). Para desactivar: day() o day("reset").');
    return;
  }
  const year = new Date().getFullYear();
  const simulated = new Date(year, mes - 1, dia);
  if (Number.isNaN(simulated.getTime())) {
    console.warn("[day] Fecha inválida.");
    return;
  }
  __simulatedDate = simulated;
  console.log(
    `[day] Fecha simulada activada: ${pad2(dia)}/${pad2(mes)}/${year}. ` +
      'Para volver a la fecha real: day() o day("reset").'
  );
  refreshCurrentScreenForDaySim();
}

// Fuerza un re-render inmediato de la pantalla actual (misma lógica
// que usa el router al navegar) para que el cambio de fecha simulada
// se vea reflejado al toque, sin depender de un refresh de página.
// Sólo se usa desde day(); el resto de la app nunca la necesita
// porque navigate() ya re-renderiza en cada cambio de ruta real.
function refreshCurrentScreenForDaySim() {
  if (typeof navigate !== "function" || typeof getCurrentUser !== "function") return;
  if (!getCurrentUser()) return;
  navigate(typeof routeFromHash === "function" ? routeFromHash() : undefined);
}
if (typeof window !== "undefined") {
  window.day = day;
}

const STORAGE_KEYS = {
  currentUser: "currentUser",
  userData: (id) => `userData:${id}`,
  adminPlayers: "adminPlayers",
  adminPrevias: "adminPrevias",
  localPrevias: (id) => `localPrevias:${id}`,
};

/* -----------------------------------------------------------
   Permisos simples y explícitos (sin sistema de roles complejo)
   -----------------------------------------------------------
   Gio -> admin (PARTICIPANTS[].isAdmin) + puede registrar previas
   (desde /admin, ya implementado).
   Jere -> usuario normal + puede registrar previas (desde una
   sección adicional en su Home, ver "PREVIAS — sección de Jere").
   Nadie más puede registrar previas todavía.
   ----------------------------------------------------------- */
function participantConfig(id) {
  return PARTICIPANTS.find((p) => p.id === id) || null;
}

// Solo true para usuarios NO admin con el flag explícito
// (hoy únicamente Jere). Gio ya registra previas desde /admin.
function canRegisterLocalPrevia(id) {
  const p = participantConfig(id);
  return !!(p && p.canRegisterPrevias && !p.isAdmin);
}

/* -----------------------------------------------------------
   Sesión
   ----------------------------------------------------------- */

function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.currentUser);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Nos aseguramos de que el participante todavía exista en la config.
    const stillExists = PARTICIPANTS.find((p) => p.id === parsed.id);
    return stillExists || null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(participant) {
  // Guardamos solo lo necesario para identificar la sesión; nunca la
  // contraseña, ni siquiera la del participante (no solo la ingresada).
  const sessionData = { id: participant.id, name: participant.name, isAdmin: !!participant.isAdmin };
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(sessionData));
  ensureUserData(participant.id);
}

function clearCurrentUser() {
  // Elimina ÚNICAMENTE la sesión. Nunca localStorage.clear().
  localStorage.removeItem(STORAGE_KEYS.currentUser);
  dailyDateKey = null; // fuerza recargar el registro diario del próximo usuario
}

function ensureUserData(id) {
  const key = STORAGE_KEYS.userData(id);
  if (!localStorage.getItem(key)) {
    const initialData = {
      id,
      createdAt: new Date().toISOString(),
      // Estructura futura (registro diario, etc.) se agrega más
      // adelante sin romper lo ya guardado.
    };
    localStorage.setItem(key, JSON.stringify(initialData));
  }
}

function getUserData(id) {
  const raw = localStorage.getItem(STORAGE_KEYS.userData(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveUserData(id, data) {
  localStorage.setItem(STORAGE_KEYS.userData(id), JSON.stringify(data));
}

/* -----------------------------------------------------------
   Utilidades
   ----------------------------------------------------------- */

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function colorForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

/* -----------------------------------------------------------
   Render: selector de usuario
   ----------------------------------------------------------- */

function renderParticipantGrid() {
  const grid = document.getElementById("participant-grid");
  grid.innerHTML = "";

  PARTICIPANTS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "participant-btn";
    btn.setAttribute("role", "listitem");
    btn.addEventListener("click", () => handleSelectUser(p));

    const avatar = document.createElement("div");
    avatar.className = "participant-avatar";
    avatar.style.background = colorForId(p.id);
    avatar.textContent = getInitials(p.name);

    const name = document.createElement("span");
    name.className = "participant-name";
    name.textContent = p.name;

    btn.appendChild(avatar);
    btn.appendChild(name);

    if (p.isAdmin) {
      const pill = document.createElement("span");
      pill.className = "admin-pill";
      pill.textContent = "Admin";
      btn.appendChild(pill);
    }

    grid.appendChild(btn);
  });
}

let loginParticipant = null;

function handleSelectUser(participant) {
  loginParticipant = participant;
  openSheet("login-password");
}

// Transición animada Login (#screen-select) -> Home, al confirmar la
// contraseña correcta. Mismo lenguaje de movimiento y mismas clases
// que la transición Home -> Dinero/Registro diario/Envío de datos
// (v0.26.0/v0.29.0/v0.30.0): fade + translateY, 100ms por lado, mismo
// color de fondo durante la transición. Se reutilizan las clases
// existentes (`.home-to-money-exit` / `.money-from-home-enter` /
// `#app.home-money-transition-bg`) porque Login y Home comparten la
// clase `.login-screen` y por lo tanto el mismo degradé de fondo que
// arranca en `#eaf6ff`. No afecta ninguna otra navegación: el resto
// de las entradas a `navigate("home")` (logout, back del navegador,
// bottom nav, volver desde Dinero/Registro diario/Envío de datos,
// etc.) siguen sin animar.
// Función genérica que hace el fade+translateY (mismas clases,
// mismo timing/color) entre dos pantallas cualesquiera que estén en
// `screens`. Todas las transiciones puntuales de la app (Login->Home,
// Home<->Dinero/Registro diario/Envío de datos/Previas de Jere,
// Home<->Admin, Admin<->Previas, Admin<->Estadísticas, etc.) son casos
// particulares de esta misma función, para no duplicar la lógica de
// entrada/salida en cada par de pantallas.
function navigateBetweenScreensWithTransition(fromRoute, toRoute) {
  const fromEl = screens[fromRoute];
  const toEl = screens[toRoute];
  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!fromEl || !fromEl.classList.contains("active") || !toEl || reduceMotion) {
    navigate(toRoute);
    return;
  }

  const appEl = document.getElementById("app");
  if (appEl) appEl.classList.add("home-money-transition-bg");

  const onExitEnd = () => {
    fromEl.removeEventListener("animationend", onExitEnd);
    fromEl.classList.remove("home-to-money-exit");

    navigate(toRoute);

    if (toEl) {
      toEl.classList.add("money-from-home-enter");
      const onEnterEnd = () => {
        toEl.removeEventListener("animationend", onEnterEnd);
        toEl.classList.remove("money-from-home-enter");
        if (appEl) appEl.classList.remove("home-money-transition-bg");
      };
      toEl.addEventListener("animationend", onEnterEnd);
    } else if (appEl) {
      appEl.classList.remove("home-money-transition-bg");
    }
  };

  fromEl.addEventListener("animationend", onExitEnd);
  fromEl.classList.add("home-to-money-exit");
}

function navigateSelectToHomeWithTransition() {
  navigateBetweenScreensWithTransition("select", "home");
}

function checkLoginPassword() {
  const input = document.getElementById("input-login-password");
  if (!input || !loginParticipant) return;
  const entered = input.value.trim().toLowerCase();
  const expected = loginParticipant.password.toLowerCase();

  if (entered.length === 0) {
    input.classList.add("error");
    showSheetError("Ingresá tu contraseña.");
    return;
  }

  if (entered !== expected) {
    input.classList.add("error");
    input.value = "";
    input.focus();
    showSheetError("Contraseña incorrecta. Intentá de nuevo.");
    const dots = document.getElementById("login-password-dots");
    if (dots) dots.innerHTML = "";
    return;
  }

  const participant = loginParticipant;
  loginParticipant = null;
  currentSheetType = null;
  sheetOverlay.classList.remove("visible");
  setCurrentUser(participant);
  navigateSelectToHomeWithTransition();
}

/* -----------------------------------------------------------
   Render: home
   ----------------------------------------------------------- */

// Posibles remates para el saludo de Home ("Hola, <nombre> <remate>").
// Se elige uno al azar cada vez que se entra a Home para darle más
// dinamismo; no se persiste en ningún lado, es puramente de sesión.
const HOME_GREETING_QUESTIONS = [
  "¿Como estás?",
  "¿Todo bajo control?",
  "¿Todo bien?",
  "¿Hoy sale previa?",
  "¿Se viene algo bueno?",
  "¿Seguimos vivos?",
  "¿Qué tal tu dia?",
  "¿Disfrutando bariló?",
  "¿Quiero queque?",
  "¿Como va todo?",
  "Loto pregunta cuándo le entregas el tp",
  "Espero te encuentres muy bien ☺️​",
  "¿Dormiste algo?",
  "Simón te envió un mensaje: ​6️⃣​7️⃣​​6️⃣​7️⃣​",
  "que pedazo de web se mandó gio eee",
  "¿Cómo te encuentras?",
  "¿Qué onda chavalín?",
  "Dale nene que hoy la rompes"
];

function pickRandomHomeGreetingQuestion() {
  const idx = Math.floor(Math.random() * HOME_GREETING_QUESTIONS.length);
  return HOME_GREETING_QUESTIONS[idx];
}

function renderHome(user) {
  document.getElementById("home-username").textContent = user.name;
  const greetQuestion = document.querySelector(".home-greet-question");
  if (greetQuestion) {
    greetQuestion.textContent = pickRandomHomeGreetingQuestion();
  }
  const previasSection = document.getElementById("home-previas-section");
  if (previasSection) {
    previasSection.hidden = !canRegisterLocalPrevia(user.id);
  }
  playHomeGreetingAnimation();
}

// Reinicia la animación de entrada del saludo ("Hola," / nombre /
// "¿como estás?") cada vez que se entra a Home. Como los 3 nodos son
// estáticos (no se recrean en cada render), hace falta sacar la
// clase, forzar reflow y volver a ponerla para que el navegador
// vuelva a disparar el @keyframes; si no, solo se vería la primera
// vez que carga la página.
function playHomeGreetingAnimation() {
  const heroBottom = document.querySelector(".home-hero-bottom");
  if (!heroBottom) return;
  heroBottom.classList.remove("home-greeting-animate");
  // eslint-disable-next-line no-unused-expressions
  void heroBottom.offsetWidth; // fuerza reflow para reiniciar el keyframe
  heroBottom.classList.add("home-greeting-animate");
}

/* -----------------------------------------------------------
   Render: admin
   ----------------------------------------------------------- */

function renderAdmin() {
  const list = document.getElementById("admin-participants");
  list.innerHTML = "";
  const players = getAdminPlayers();

  PARTICIPANTS.forEach((p) => {
    const row = document.createElement("div");
    row.className = "admin-participant-row";

    const avatar = document.createElement("div");
    avatar.className = "participant-avatar";
    avatar.style.background = colorForId(p.id);
    avatar.textContent = getInitials(p.name);

    const info = document.createElement("div");
    info.className = "admin-participant-info";

    const name = document.createElement("span");
    name.className = "participant-name";
    name.textContent = p.name;

    const meta = document.createElement("div");
    meta.className = "admin-participant-meta";
    const player = players[p.id];
    meta.textContent = player ? `Última actualización: ${formatDateTimeShort(player.updatedAt)}` : "Sin datos importados";

    info.appendChild(name);
    info.appendChild(meta);
    row.appendChild(avatar);
    row.appendChild(info);

    if (p.isAdmin) {
      const pill = document.createElement("span");
      pill.className = "admin-pill";
      pill.textContent = "Admin";
      row.appendChild(pill);
    }

    list.appendChild(row);
  });
}

/* =============================================================
   ADMIN — JUGADORES IMPORTADOS (vía código de datos)
   =============================================================
   Reutiliza EXACTAMENTE el sistema de códigos ya existente
   (generateExportCode/decodeExportCode, ver sección "EXPORTACIÓN
   DE DATOS" más abajo) — no se inventa ningún formato nuevo.

   Almacenamiento: una única clave "adminPlayers" en localStorage,
   separada de currentUser y de userData:<id>, con la forma:

     adminPlayers = {
       "<id>": {
         id, name, data: { initialBalance, movements, dailyEntries },
         sourceVersion, importedAt, updatedAt
       },
       ...
     }

   Importar o actualizar un jugador NUNCA toca userData:<id> ni
   currentUser: es la copia consolidada propia del administrador.
   ============================================================= */

function getAdminPlayers() {
  const raw = localStorage.getItem(STORAGE_KEYS.adminPlayers);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveAdminPlayers(players) {
  localStorage.setItem(STORAGE_KEYS.adminPlayers, JSON.stringify(players));
}

function resolvePlayerName(id) {
  const known = PARTICIPANTS.find((p) => p.id === id);
  return known ? known.name : id;
}

// Valida la ESTRUCTURA del payload ya decodificado (decodeExportCode
// ya valida prefijo/versión del código en sí y lanza si el string no
// tiene la forma "BRLn.xxxx"). Acá comprobamos, antes de guardar nada,
// que el contenido tenga lo mínimo indispensable para ser un jugador
// válido. Si algo falla, lanza un Error con mensaje claro y NO se
// modifica ningún dato existente.
function validateImportPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("El código no contiene datos reconocibles.");
  }
  if (payload.version !== EXPORT_CODE_VERSION) {
    throw new Error("Este código es de una versión incompatible de la app.");
  }
  if (!payload.user || typeof payload.user !== "string") {
    throw new Error("El código no tiene un identificador de usuario válido.");
  }
  const data = payload.data;
  if (!data || typeof data !== "object") {
    throw new Error("El código no tiene la estructura de datos esperada.");
  }
  if (!Array.isArray(data.movements)) {
    throw new Error("El código no tiene la estructura de datos esperada.");
  }
  if (data.initialBalance !== null && typeof data.initialBalance !== "number") {
    throw new Error("El código no tiene la estructura de datos esperada.");
  }
  if (!data.dailyEntries || typeof data.dailyEntries !== "object") {
    throw new Error("El código no tiene la estructura de datos esperada.");
  }
  return payload;
}

// Punto único: string pegado por Gio -> payload validado, o excepción
// con un mensaje ya apto para mostrar tal cual en el sheet.
function parseAndValidatePastedCode(rawCode) {
  const code = (rawCode || "").trim();
  if (!code) {
    throw new Error("Pegá un código para continuar.");
  }
  let payload;
  try {
    payload = decodeExportCode(code);
  } catch (e) {
    throw new Error("Código inválido o incompleto. Revisá que lo hayas copiado completo.");
  }
  return validateImportPayload(payload);
}

function formatDateTimeShort(isoString) {
  const d = new Date(isoString);
  return (
    d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

// Botón general "Actualizar código": no apunta a un jugador puntual de
// antemano, se identifica automáticamente a partir de payload.user una
// vez que se pega y decodifica el código (ver handleAdminImportPaste).
// Es el único punto de entrada a este sheet: el botón "+ Agregar
// jugador" (y su variante "add" del flujo) se eliminó en v0.23.0, ya
// que no se van a agregar jugadores nuevos desde la app — la lista de
// participantes es siempre la fija de PARTICIPANTS.
function openAdminImportUpdateCode() {
  adminImportTargetId = null;
  adminImportPendingPayload = null;
  adminImportStep = "paste";
  openSheet("admin-import");
}

// Multi-paso dentro del mismo sheet: pegar código -> previsualizar ->
// confirmar. Cada paso re-renderiza el contenido del sheet sin
// cerrarlo. El paso "duplicate" (aviso de jugador ya cargado) existía
// solo para el flujo "+ Agregar jugador", eliminado en v0.23.0: con
// "Actualizar código" como único punto de entrada, pegar el código de
// un jugador ya cargado simplemente actualiza (upsert) su entrada sin
// avisos intermedios, como siempre hizo este botón.
function renderAdminImportSheet() {
  if (adminImportStep === "paste") {
    sheetContent.innerHTML = `
      <h2 class="sheet-title">Actualizar código</h2>
      <p class="sheet-sub">Pegá acá el código que te compartieron desde "Envío de datos"</p>
      <div class="field">
        <label class="field-label" for="admin-import-textarea">Código</label>
        <textarea id="admin-import-textarea" class="admin-import-textarea" rows="4" placeholder="BRL1.xxxxxxxx..." autocapitalize="off" spellcheck="false"></textarea>
      </div>
      <p class="sheet-error" id="sheet-error"></p>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">Importar</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", handleAdminImportPaste);
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    const ta = document.getElementById("admin-import-textarea");
    ta.addEventListener("input", () => ta.classList.remove("error"));
    return;
  }

  if (adminImportStep === "preview") {
    const payload = adminImportPendingPayload;
    const name = resolvePlayerName(payload.user);
    const expenseCount = payload.data.movements.filter((m) => m.type === "expense").length;
    const incomeCount = payload.data.movements.filter((m) => m.type === "income").length;
    const dailyCount = Object.keys(payload.data.dailyEntries).length;

    // El saldo inicial NUNCA se muestra acá (es privado dentro de
    // /admin): se guarda igual en adminPlayers para cálculos futuros
    // ("El más rata"), pero no aparece en esta previsualización.
    sheetContent.innerHTML = `
      <h2 class="sheet-title">Confirmar actualización</h2>
      <p class="sheet-sub">Revisá que sea el jugador correcto antes de guardar</p>
      <div class="admin-preview-card">
        <div class="admin-preview-row"><span>Jugador</span><span>${escapeHtml(name)}</span></div>
        <div class="admin-preview-row"><span>Gastos</span><span>${expenseCount}</span></div>
        <div class="admin-preview-row"><span>Ganancias</span><span>${incomeCount}</span></div>
        <div class="admin-preview-row"><span>Registros diarios</span><span>${dailyCount}</span></div>
      </div>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">Confirmar actualización</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", confirmAdminImport);
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    return;
  }
}

function handleAdminImportPaste() {
  const ta = document.getElementById("admin-import-textarea");
  let payload;
  try {
    payload = parseAndValidatePastedCode(ta.value);
  } catch (e) {
    ta.classList.add("error");
    showSheetError(e.message);
    return;
  }

  // El código siempre tiene que identificar a un jugador de la lista
  // predefinida (PARTICIPANTS). Si no está registrado, no se agrega
  // automáticamente: se avisa y no se toca adminPlayers.
  const known = PARTICIPANTS.find((p) => p.id === payload.user);
  if (!known) {
    ta.classList.add("error");
    showSheetError(`"${payload.user}" no está registrado en la lista de jugadores.`);
    return;
  }

  adminImportPendingPayload = payload;
  adminImportTargetId = payload.user;
  adminImportStep = "preview";
  renderAdminImportSheet();
}

// Único punto que efectivamente escribe en "adminPlayers". Solo se
// llega acá después de decodeExportCode + validateImportPayload +
// previsualización confirmada por Gio; si cualquier validación
// anterior falló, esta función nunca se invoca y no se toca nada.
function confirmAdminImport() {
  const payload = adminImportPendingPayload;
  if (!payload) {
    closeSheet();
    return;
  }
  const players = getAdminPlayers();
  const existing = players[payload.user];
  const now = new Date().toISOString();

  players[payload.user] = {
    id: payload.user,
    name: resolvePlayerName(payload.user),
    data: payload.data,
    sourceVersion: payload.version,
    importedAt: existing ? existing.importedAt : now,
    updatedAt: now,
  };
  saveAdminPlayers(players);

  sheetOverlay.classList.remove("visible");
  currentSheetType = null;
  adminImportTargetId = null;
  adminImportPendingPayload = null;
  adminImportStep = null;
  renderAdmin();
}

/* =============================================================
   ADMIN — PREVIAS (registro manual)
   =============================================================
   Las previas se registran ÚNICAMENTE desde /admin (nunca desde la
   cuenta individual de cada usuario), para evitar duplicaciones,
   según SPEC.md → "Previas". Fuente de verdad: localStorage bajo la
   clave "adminPrevias", totalmente separada de userData:<id> y de
   adminPlayers.

     adminPrevias = [
       {
         id: "<genId>",
         participantIds: ["gio", "sebas", ...],  // quiénes participaron
         products: [
           { id, name, price, quantity },
           ...
         ],
         total: number,        // suma de price*quantity de todos los productos
         createdAt: "<ISO>",
       },
       ...
     ]

   Todavía no implementado (según lo pedido): división del gasto por
   persona, códigos ni importación de previas.
   ============================================================= */

// Estado en memoria de la previa que se está armando (no persiste
// hasta tocar "Guardar previa").
let previaParticipantIds = [];
let previaProducts = [];

// "admin" -> pantalla #/previas dentro de /admin, guarda en
// "adminPrevias" (solo Gio). "local" -> pantalla #/previas-jere
// dentro del Home de un usuario con permiso (solo Jere hoy), guarda
// en "localPrevias:<id>". Es el mismo componente/lógica de armado de
// previa en ambos casos; solo cambia dónde persiste y el conjunto de
// ids del DOM que usa (ver previaIds()).
let previaMode = "admin";

function previaIds() {
  const prefix = previaMode === "local" ? "previa-local" : "previa";
  return {
    main: previaMode === "local" ? "previas-local-main" : "previas-main",
    participantsGroup: `${prefix}-participants-group`,
    productsList: `${prefix}-products-list`,
    addProductBtn: `btn-${prefix}-add-product`,
    error: `${prefix}-error`,
    saveBtn: `btn-${prefix}-save`,
    historyList: `${prefix}-history-list`,
  };
}

function getAdminPrevias() {
  const raw = localStorage.getItem(STORAGE_KEYS.adminPrevias);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveAdminPrevias(previas) {
  localStorage.setItem(STORAGE_KEYS.adminPrevias, JSON.stringify(previas));
}

// Previas registradas localmente por un usuario no-admin con permiso
// (hoy solo Jere), namespaced por su id, totalmente separadas de
// "adminPrevias". NO forman parte de la base administrativa
// consolidada hasta que Gio importa el código correspondiente desde
// /admin (ver "PREVIAS — importación por código").
function getLocalPrevias(userId) {
  const raw = localStorage.getItem(STORAGE_KEYS.localPrevias(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveLocalPrevias(userId, previas) {
  localStorage.setItem(STORAGE_KEYS.localPrevias(userId), JSON.stringify(previas));
}

function computePreviaTotal(products) {
  return products.reduce((sum, prod) => sum + prod.price * prod.quantity, 0);
}

// Monto que le corresponde pagar a cada participante: total dividido en
// partes iguales entre todos los que participaron. Devuelve 0 si por
// algún motivo no hay participantes (no debería pasar: se valida antes).
function computePreviaPerPerson(total, participantCount) {
  if (!participantCount) return 0;
  return total / participantCount;
}

// Compatibilidad hacia atrás: previas guardadas antes de que existiera
// `amountPerPerson` lo recalculan al vuelo para mostrarse igual.
function previaPerPersonValue(previa) {
  if (typeof previa.amountPerPerson === "number") return previa.amountPerPerson;
  return computePreviaPerPerson(previa.total, previa.participantIds.length);
}

function showPreviaError(msg) {
  const ids = previaIds();
  const el = document.getElementById(ids.error);
  if (el) el.textContent = msg;
}

function renderPreviasScreen() {
  const ids = previaIds();
  const main = document.getElementById(ids.main);
  if (!main) return;

  const chips = PARTICIPANTS.map((p) => {
    const selected = previaParticipantIds.includes(p.id);
    return `<button type="button" class="chip${selected ? " selected" : ""}" data-participant="${p.id}">${escapeHtml(p.name)}</button>`;
  }).join("");

  const total = computePreviaTotal(previaProducts);
  const perPerson = computePreviaPerPerson(total, previaParticipantIds.length);

  const importButton =
    previaMode === "admin"
      ? `<button type="button" id="btn-previa-import-code" class="admin-add-btn">Introducir código de previa</button>`
      : "";

  main.innerHTML = `
    <div class="section-label">Nueva previa</div>

    <div class="field">
      <label class="field-label">Participantes</label>
      <div class="chip-group" id="${ids.participantsGroup}">${chips}</div>
    </div>

    <div class="field">
      <label class="field-label">Productos</label>
      <div id="${ids.productsList}" class="previa-products-list"></div>
      <button type="button" id="${ids.addProductBtn}" class="admin-add-btn">+ Agregar producto</button>
    </div>

    <div class="admin-preview-card">
      <div class="admin-preview-row"><span>Total de la previa</span><span>${formatMoney(total)}</span></div>
      <div class="admin-preview-row"><span>Participantes</span><span>${previaParticipantIds.length}</span></div>
      <div class="admin-preview-row"><span>A pagar por persona</span><span>${formatMoney(perPerson)}</span></div>
    </div>

    <p class="sheet-error" id="${ids.error}"></p>
    <button type="button" id="${ids.saveBtn}" class="sheet-submit">Guardar previa</button>

    <div class="section-label">Historial de previas</div>
    ${importButton}
    <div id="${ids.historyList}" class="previa-history-list"></div>
  `;

  renderPreviaProductsList();
  renderPreviaHistory();

  document.getElementById(ids.participantsGroup).addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const id = chip.dataset.participant;
    if (previaParticipantIds.includes(id)) {
      previaParticipantIds = previaParticipantIds.filter((x) => x !== id);
    } else {
      previaParticipantIds.push(id);
    }
    renderPreviasScreen();
  });

  document.getElementById(ids.addProductBtn).addEventListener("click", () => openSheet("previa-product"));
  document.getElementById(ids.saveBtn).addEventListener("click", requestSavePrevia);

  const importBtn = document.getElementById("btn-previa-import-code");
  if (importBtn) importBtn.addEventListener("click", openPreviaImportSheet);
}

function renderPreviaProductsList() {
  const ids = previaIds();
  const list = document.getElementById(ids.productsList);
  if (!list) return;

  if (previaProducts.length === 0) {
    list.innerHTML = `<p class="home-footnote">Todavía no agregaste productos</p>`;
    return;
  }

  list.innerHTML = "";
  previaProducts.forEach((prod) => {
    const row = document.createElement("div");
    row.className = "history-row previa-product-row";

    const icon = document.createElement("div");
    icon.className = "history-icon";
    icon.textContent = "🥤";

    const info = document.createElement("div");
    info.className = "history-info";

    const name = document.createElement("div");
    name.className = "history-name";
    name.textContent = prod.name;

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = `${prod.quantity} x ${formatMoney(prod.price)}`;

    info.appendChild(name);
    info.appendChild(meta);

    const amount = document.createElement("div");
    amount.className = "history-amount";
    amount.textContent = formatMoney(prod.price * prod.quantity);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "previa-product-remove";
    removeBtn.setAttribute("aria-label", `Quitar ${prod.name}`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      previaProducts = previaProducts.filter((p) => p.id !== prod.id);
      renderPreviasScreen();
    });

    row.appendChild(icon);
    row.appendChild(info);
    row.appendChild(amount);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

function renderPreviaHistory() {
  const ids = previaIds();
  const list = document.getElementById(ids.historyList);
  if (!list) return;

  const user = getCurrentUser();
  const previas = previaMode === "local" && user ? getLocalPrevias(user.id) : getAdminPrevias();
  if (previas.length === 0) {
    list.innerHTML = `<p class="home-footnote">Todavía no se registraron previas</p>`;
    return;
  }

  list.innerHTML = previas
    .map((previa) => {
      const names = previa.participantIds.map((id) => escapeHtml(resolvePlayerName(id))).join(", ");
      const productsSummary = previa.products
        .map((p) => `${p.quantity}x ${escapeHtml(p.name)}`)
        .join(", ");
      // En modo local (Jere), cada previa que registra vive solo en su
      // dispositivo hasta que genera el código y Gio lo importa desde
      // /admin: por eso acá se ofrece "Copiar código" por previa.
      const codeButton =
        previaMode === "local"
          ? `<button type="button" class="sheet-cancel-link previa-copy-code-btn" data-previa-id="${previa.id}">Copiar código para Gio</button>`
          : "";
      return `
        <div class="admin-preview-card previa-history-card">
          <div class="admin-preview-row"><span>Participantes</span><span>${names}</span></div>
          <div class="admin-preview-row"><span>Productos</span><span>${productsSummary}</span></div>
          <div class="admin-preview-row"><span>Total</span><span>${formatMoney(previa.total)}</span></div>
          <div class="admin-preview-row"><span>A pagar por persona</span><span>${formatMoney(previaPerPersonValue(previa))}</span></div>
          <div class="admin-preview-row"><span>Fecha</span><span>${formatDateTimeShort(previa.createdAt)}</span></div>
          <div class="admin-preview-row"><span>ID</span><span class="previa-id">${previa.id}</span></div>
          ${codeButton}
        </div>
      `;
    })
    .join("");

  if (previaMode === "local") {
    list.querySelectorAll(".previa-copy-code-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const previa = previas.find((p) => p.id === btn.dataset.previaId);
        if (previa) openPreviaCodeSheet(previa);
      });
    });
  }
}

// Paso 1: valida y abre la confirmación. No escribe nada todavía.
function requestSavePrevia() {
  if (previaParticipantIds.length === 0) {
    showPreviaError("Seleccioná al menos un participante.");
    return;
  }
  if (previaProducts.length === 0) {
    showPreviaError("Agregá al menos un producto.");
    return;
  }
  showPreviaError("");
  openSheet("previa-confirm");
}

function renderPreviaConfirmSheet() {
  const total = computePreviaTotal(previaProducts);
  const count = previaParticipantIds.length;
  const perPerson = computePreviaPerPerson(total, count);

  sheetContent.innerHTML = `
    <h2 class="sheet-title">¿Estás seguro de registrar esta previa?</h2>
    <p class="sheet-sub">Revisá los datos antes de guardar</p>
    <div class="admin-preview-card">
      <div class="admin-preview-row"><span>Total de la previa</span><span>${formatMoney(total)}</span></div>
      <div class="admin-preview-row"><span>Participantes</span><span>${count}</span></div>
      <div class="admin-preview-row"><span>A pagar por persona</span><span>${formatMoney(perPerson)}</span></div>
    </div>
    <button class="sheet-submit" id="sheet-submit-btn" type="button">Sí, registrar previa</button>
    <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
  `;
  document.getElementById("sheet-submit-btn").addEventListener("click", confirmSavePrevia);
  document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
}

// Paso 2: único punto que efectivamente escribe una previa nueva. Solo
// se llega acá después de confirmar explícitamente en el sheet. El monto
// por persona se calcula una sola vez acá y se guarda junto con el resto
// de la previa (no se recalcula después), para que viaje tal cual dentro
// de la previa en cualquier código de exportación futuro.
//
// En modo "admin" (Gio, desde /admin) se escribe directo en
// "adminPrevias": ya es la base consolidada. En modo "local" (Jere,
// desde su Home) se escribe en "localPrevias:<id>" — la previa NO
// pasa a formar parte de la base administrativa hasta que Gio importe
// el código generado (ver "PREVIAS — importación por código").
function confirmSavePrevia() {
  const total = computePreviaTotal(previaProducts);
  const count = previaParticipantIds.length;
  const perPerson = computePreviaPerPerson(total, count);

  const newPrevia = {
    id: genId(),
    participantIds: [...previaParticipantIds],
    products: previaProducts.map((p) => ({ ...p })),
    total,
    amountPerPerson: perPerson,
    createdAt: new Date().toISOString(),
  };

  if (previaMode === "local") {
    const user = getCurrentUser();
    const previas = getLocalPrevias(user.id);
    previas.unshift(newPrevia);
    saveLocalPrevias(user.id, previas);
  } else {
    const previas = getAdminPrevias();
    previas.unshift(newPrevia);
    saveAdminPrevias(previas);
  }

  previaParticipantIds = [];
  previaProducts = [];

  sheetOverlay.classList.remove("visible");
  currentSheetType = null;
  renderPreviasScreen();

  if (previaMode === "local") {
    // Mostramos de una el código para que Jere se lo pueda mandar a
    // Gio sin tener que buscarlo en el historial.
    openPreviaCodeSheet(newPrevia);
  }
}

/* =============================================================
   DINERO
   ============================================================= */

const EXPENSE_CATEGORIES = ["Chocolates", "Alcohol", "Boliche", "Comida", "Bebida", "Actividades", "Otros"];

const CATEGORY_ICONS = {
  Chocolates: "🍫",
  Alcohol: "🍷",
  Boliche: "🪩",
  Comida: "🍔",
  Bebida: "🥤",
  Actividades: "🎿",
  Otros: "📦",
};

// Categorías eliminadas del picker; los gastos ya guardados con estas
// categorías se migran automáticamente a "Otros" (ver
// migrateExpenseCategories) para no romper datos existentes.
const REMOVED_CATEGORY_FALLBACK = { Transporte: "Otros" };

// Metadata para la tarjeta de ranking por jugador de cada categoría
// de gasto (título humorístico exacto, ícono y color de acento).
// Usada tanto por DÍA como por TOTAL; una categoría solo genera
// tarjeta si tiene al menos un gasto cargado en el período mostrado.
const CATEGORY_RANKING_META = {
  Alcohol: { title: "Quién se la patinó más en alcohol", icon: "🍷", accent: "#c77dff" },
  Comida: { title: "Quién es el más gordito de mierda", icon: "🍔", accent: "#ffd166" },
  Chocolates: { title: "Quién es el más dulce", icon: "🍫", accent: "#ff5470" },
  Boliche: { title: "Quién tuvo más ganas de quebrar", icon: "🍾", accent: "#ff5470" },
  Actividades: { title: "Quién gastó más en actividades", icon: "🎿", accent: "#4cc9f0" },
  Bebida: { title: "Quién compró más bebidas s/a", icon: "🥤", accent: "#4cc9f0" },
  Otros: { title: "Quién gastó más en otros", icon: "📦", accent: "#ff9f1c" },
};

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function migrateExpenseCategories(money) {
  // Categorías eliminadas (ej. "Transporte") se reasignan a un
  // reemplazo válido sin tocar nombre/monto/fecha del movimiento.
  let changed = false;
  money.movements.forEach((m) => {
    if (m.type === "expense" && REMOVED_CATEGORY_FALLBACK[m.category]) {
      m.category = REMOVED_CATEGORY_FALLBACK[m.category];
      changed = true;
    }
  });
  return changed;
}

function ensureMoneyData(userId) {
  const data = getUserData(userId) || { id: userId, createdAt: new Date().toISOString() };
  let changed = false;
  if (!data.money) {
    data.money = { initialBalance: null, movements: [] };
    changed = true;
  }
  if (migrateExpenseCategories(data.money)) {
    changed = true;
  }
  if (changed) saveUserData(userId, data);
  return data;
}

function formatMoney(amount) {
  const rounded = Math.round(amount);
  return `$${rounded.toLocaleString("es-AR")}`;
}

function formatDateShort(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function computeMoneyTotals(money) {
  let totalExpense = 0;
  let totalIncome = 0;
  money.movements.forEach((m) => {
    if (m.type === "expense") totalExpense += m.amount;
    else totalIncome += m.amount;
  });
  const initial = money.initialBalance || 0;
  const available = initial + totalIncome - totalExpense;
  return { totalExpense, totalIncome, available, initial };
}

const moneyMain = document.getElementById("money-main");

function renderMoneyScreen() {
  const user = getCurrentUser();
  if (!user) return;
  const data = ensureMoneyData(user.id);
  const money = data.money;

  if (money.initialBalance === null) {
    moneyMain.innerHTML = `
      <div class="money-prompt">
        <div class="prompt-icon">🧳</div>
        <h3>¿Cuánto llevás al viaje?</h3>
        <p>Contanos tu saldo inicial para poder llevar la cuenta de tus gastos y ganancias.</p>
      </div>
    `;
    openSheet("initial");
    return;
  }

  const { totalExpense, totalIncome, available, initial } = computeMoneyTotals(money);
  const donutTotal = initial + totalIncome;
  const availablePct = donutTotal > 0 ? Math.max(0, Math.min(100, (available / donutTotal) * 100)) : 0;
  const DONUT_R = 40;
  const DONUT_CIRC = 2 * Math.PI * DONUT_R;

  moneyMain.innerHTML = `
    <div class="donut-card">
      <div class="donut-wrap">
        <svg class="donut-svg" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="donut-track" cx="50" cy="50" r="${DONUT_R}"></circle>
          <circle class="donut-progress" id="donut-progress" cx="50" cy="50" r="${DONUT_R}"
            stroke-dasharray="${DONUT_CIRC} ${DONUT_CIRC}" stroke-dashoffset="${DONUT_CIRC}"></circle>
        </svg>
        <div class="donut-hole">
          <span class="donut-amount">${formatMoney(available)}</span>
          <span class="donut-caption">Disponible</span>
        </div>
      </div>
      <div class="donut-legend">
        <div class="legend-item"><span class="legend-dot spent"></span>Gastado <span class="legend-value">${formatMoney(totalExpense)}</span></div>
        <div class="legend-item"><span class="legend-dot avail"></span>Disponible <span class="legend-value">${formatMoney(available)}</span></div>
      </div>
    </div>

    <div class="money-actions">
      <button id="btn-add-expense" class="money-action expense" type="button">− Gasto</button>
      <button id="btn-add-income" class="money-action income" type="button">+ Ganancia</button>
    </div>

    <div class="section-label">Historial</div>
    <div id="money-history" class="money-history"></div>
  `;

  const progress = document.getElementById("donut-progress");
  const offset = DONUT_CIRC - (availablePct / 100) * DONUT_CIRC;
  // Se fuerza un reflow antes de animar el offset para que la transición se vea.
  requestAnimationFrame(() => {
    progress.style.strokeDashoffset = String(offset);
  });

  renderMoneyHistory(money.movements);

  document.getElementById("btn-add-expense").addEventListener("click", () => openSheet("expense"));
  document.getElementById("btn-add-income").addEventListener("click", () => openSheet("income"));
}

function renderMoneyHistory(movements) {
  const list = document.getElementById("money-history");
  if (!list) return;

  if (movements.length === 0) {
    list.innerHTML = `<p class="home-footnote">Todavía no registraste movimientos</p>`;
    return;
  }

  list.innerHTML = "";
  movements.forEach((m) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `history-row ${m.type === "income" ? "is-income" : "is-expense"}`;
    row.dataset.id = m.id;
    row.setAttribute("aria-label", `Editar o eliminar ${m.name}`);

    const icon = document.createElement("div");
    icon.className = "history-icon";
    icon.textContent = m.type === "income" ? "💰" : CATEGORY_ICONS[m.category] || "📦";

    const info = document.createElement("div");
    info.className = "history-info";

    const name = document.createElement("div");
    name.className = "history-name";
    name.textContent = m.name;

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent =
      m.type === "income" ? `Ganancia · ${formatDateShort(m.date)}` : `${m.category} · ${formatDateShort(m.date)}`;

    info.appendChild(name);
    info.appendChild(meta);

    const amount = document.createElement("div");
    amount.className = "history-amount";
    amount.textContent = `${m.type === "income" ? "+" : "−"} ${formatMoney(m.amount)}`;

    row.appendChild(icon);
    row.appendChild(info);
    row.appendChild(amount);
    list.appendChild(row);
  });

  list.addEventListener("click", (e) => {
    const row = e.target.closest(".history-row");
    if (!row) return;
    openMovementActions(row.dataset.id);
  });
}

/* -----------------------------------------------------------
   Bottom sheet: saldo inicial / gasto / ganancia
   ----------------------------------------------------------- */

const sheetOverlay = document.getElementById("sheet-overlay");
const sheetContent = document.getElementById("sheet-content");
const sheetEl = document.getElementById("sheet");
let currentSheetType = null;
let selectedCategory = null;
let editingMovementId = null;
let activeMovementId = null;
let adminImportTargetId = null; // id del jugador; se completa recién al decodificar el código pegado
let adminImportPendingPayload = null; // payload ya validado, pendiente de confirmar
let adminImportStep = null; // "paste" | "preview"

function findMovement(money, id) {
  return money.movements.find((m) => m.id === id) || null;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function openMovementActions(id) {
  activeMovementId = id;
  openSheet("movement-actions");
}

function openSheet(type, movement) {
  currentSheetType = type;
  selectedCategory = movement && movement.category ? movement.category : null;
  editingMovementId = movement ? movement.id : null;
  // Estética "Bariloche" (frost) para el menú de contraseña del login
  // y para cualquier sheet abierto desde una pantalla con la clase
  // `.admin-frost` (Admin, Previas de admin, Estadísticas, Money,
  // Previas de Jere y Envío de datos). El resto de los sheets de
  // Home/Daily conserva el tema oscuro original.
  const activeFrostScreen = document.querySelector(".screen.active.admin-frost");
  sheetEl.classList.toggle("sheet-frost", type === "login-password" || !!activeFrostScreen);

  const user = getCurrentUser();
  const data = user ? ensureMoneyData(user.id) : null;

  if (type === "movement-actions") {
    const m = data ? findMovement(data.money, activeMovementId) : null;
    if (!m) {
      closeSheet();
      return;
    }
    const label = m.type === "income" ? "Ganancia" : m.category;
    sheetContent.innerHTML = `
      <h2 class="sheet-title">${escapeHtml(m.name)}</h2>
      <p class="sheet-sub">${label} · ${m.type === "income" ? "+" : "−"} ${formatMoney(m.amount)}</p>
      <button class="sheet-submit" id="sheet-action-edit" type="button">Editar</button>
      <button class="sheet-submit danger" id="sheet-action-delete" type="button">Eliminar</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-action-edit").addEventListener("click", () => {
      openSheet(m.type === "income" ? "income" : "expense", m);
    });
    document.getElementById("sheet-action-delete").addEventListener("click", () => {
      openSheet("delete-confirm");
    });
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    sheetOverlay.classList.add("visible");
    return;
  }

  if (type === "delete-confirm") {
    const m = data ? findMovement(data.money, activeMovementId) : null;
    if (!m) {
      closeSheet();
      return;
    }
    const label = m.type === "income" ? "esta ganancia" : "este gasto";
    sheetContent.innerHTML = `
      <h2 class="sheet-title">¿Eliminar ${label}?</h2>
      <p class="sheet-sub">"${escapeHtml(m.name)}" (${m.type === "income" ? "+" : "−"} ${formatMoney(m.amount)}) se va a borrar. Esta acción no se puede deshacer.</p>
      <button class="sheet-submit danger" id="sheet-submit-btn" type="button">Sí, eliminar</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", submitSheet);
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    sheetOverlay.classList.add("visible");
    return;
  }

  if (type === "admin-import") {
    renderAdminImportSheet();
    sheetOverlay.classList.add("visible");
    return;
  }

  if (type === "previa-confirm") {
    renderPreviaConfirmSheet();
    sheetOverlay.classList.add("visible");
    return;
  }

  if (type === "previa-import") {
    renderPreviaImportSheet();
    sheetOverlay.classList.add("visible");
    return;
  }

  if (type === "previa-code") {
    const previa = previaCodeTarget;
    if (!previa) {
      closeSheet();
      return;
    }
    const code = generatePreviaExportCode(previa);
    sheetContent.innerHTML = `
      <h2 class="sheet-title">Código de la previa</h2>
      <p class="sheet-sub">Enviaselo a Gio para que la importe desde /admin</p>
      <textarea id="previa-code-box" class="export-code-box" readonly rows="4">${code}</textarea>
      <button type="button" id="btn-copy-previa-code" class="sheet-cancel-link">Copiar código</button>
      <p class="daily-save-msg" id="previa-code-copy-msg">✓ Código copiado</p>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">Listo</button>
    `;
    document.getElementById("btn-copy-previa-code").addEventListener("click", () => copyPreviaCode(code));
    document.getElementById("sheet-submit-btn").addEventListener("click", closeSheet);
    sheetOverlay.classList.add("visible");
    return;
  }

  if (type === "login-password") {
    sheetContent.innerHTML = `
      <h2 class="sheet-title">Hola, ${loginParticipant.name}</h2>
      <p class="sheet-sub">Ingresá tu contraseña para entrar</p>
      <div class="field">
        <label class="field-label" for="input-login-password">Contraseña</label>
        <div class="password-dots-box">
          <input id="input-login-password" class="field-input" type="password" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false">
          <div class="password-dots" id="login-password-dots" aria-hidden="true"></div>
        </div>
      </div>
      <p class="sheet-error" id="sheet-error"></p>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">Entrar</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", submitSheet);
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    const pwInput = document.getElementById("input-login-password");
    const pwDots = document.getElementById("login-password-dots");
    // Indicadores dinámicos: un punto por dígito ya escrito, sin
    // mostrar en ningún momento la longitud requerida.
    pwInput.addEventListener("input", () => {
      pwInput.classList.remove("error");
      pwDots.innerHTML = "<span class=\"dot\"></span>".repeat(pwInput.value.length);
    });
    pwInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitSheet();
    });
    sheetOverlay.classList.add("visible");
    pwInput.focus();
    return;
  }

  if (type === "initial") {
    const existing = data && data.money.initialBalance !== null ? data.money.initialBalance : "";
    sheetContent.innerHTML = `
      <h2 class="sheet-title">${existing !== "" ? "Editar saldo inicial" : "Saldo inicial"}</h2>
      <p class="sheet-sub">¿Cuánto dinero llevás al viaje?</p>
      <p class="sheet-sub">Este dato no será tomado en cuenta para las estadísticas.</p>
      <div class="field">
        <label class="field-label" for="input-initial-balance">Monto</label>
        <input id="input-initial-balance" class="field-input amount-input" type="number" inputmode="decimal" min="0" placeholder="$ 0" value="${existing}">
      </div>
      <p class="sheet-error" id="sheet-error"></p>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">Guardar</button>
      ${existing !== "" ? '<button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>' : ""}
    `;
  } else if (type === "expense") {
    const isEdit = !!editingMovementId;
    const chips = EXPENSE_CATEGORIES.map(
      (c) =>
        `<button type="button" class="chip${c === selectedCategory ? " selected" : ""}" data-category="${c}">${CATEGORY_ICONS[c]} ${c}</button>`
    ).join("");
    sheetContent.innerHTML = `
      <h2 class="sheet-title">${isEdit ? "Editar gasto" : "Nuevo gasto"}</h2>
      <p class="sheet-sub">Se descuenta de tu disponible al instante</p>
      <div class="field">
        <label class="field-label" for="input-expense-name">Nombre</label>
        <input id="input-expense-name" class="field-input" type="text" placeholder="Ej: Alfajor" maxlength="40" value="${isEdit ? movement.name.replace(/"/g, "&quot;") : ""}">
      </div>
      <div class="field">
        <label class="field-label">Categoría</label>
        <div class="chip-group" id="expense-chip-group">${chips}</div>
      </div>
      <div class="field">
        <label class="field-label" for="input-expense-amount">Monto</label>
        <input id="input-expense-amount" class="field-input amount-input" type="number" inputmode="decimal" min="0" placeholder="$ 0" value="${isEdit ? movement.amount : ""}">
      </div>
      <p class="sheet-error" id="sheet-error"></p>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">${isEdit ? "Guardar cambios" : "Agregar gasto"}</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("expense-chip-group").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      document.querySelectorAll("#expense-chip-group .chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      selectedCategory = chip.dataset.category;
    });
  } else if (type === "income") {
    const isEdit = !!editingMovementId;
    sheetContent.innerHTML = `
      <h2 class="sheet-title">${isEdit ? "Editar ganancia" : "Nueva ganancia"}</h2>
      <p class="sheet-sub">Suma a tu disponible al instante</p>
      <div class="field">
        <label class="field-label" for="input-income-name">Nombre</label>
        <input id="input-income-name" class="field-input" type="text" placeholder="Ej: Plata de mamá" maxlength="40" value="${isEdit ? movement.name.replace(/"/g, "&quot;") : ""}">
      </div>
      <div class="field">
        <label class="field-label" for="input-income-amount">Monto</label>
        <input id="input-income-amount" class="field-input amount-input" type="number" inputmode="decimal" min="0" placeholder="$ 0" value="${isEdit ? movement.amount : ""}">
      </div>
      <p class="sheet-error" id="sheet-error"></p>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">${isEdit ? "Guardar cambios" : "Agregar ganancia"}</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
  } else if (type === "previa-product") {
    sheetContent.innerHTML = `
      <h2 class="sheet-title">Agregar producto</h2>
      <p class="sheet-sub">Bebida o producto de la previa</p>
      <div class="field">
        <label class="field-label" for="input-previa-product-name">Nombre</label>
        <input id="input-previa-product-name" class="field-input" type="text" placeholder="Ej: Fernet" maxlength="40">
      </div>
      <div class="field">
        <label class="field-label" for="input-previa-product-price">Precio unitario</label>
        <input id="input-previa-product-price" class="field-input amount-input" type="number" inputmode="decimal" min="0" placeholder="$ 0">
      </div>
      <div class="field">
        <label class="field-label" for="input-previa-product-qty">Cantidad</label>
        <input id="input-previa-product-qty" class="field-input" type="number" inputmode="numeric" min="1" placeholder="1" value="1">
      </div>
      <p class="sheet-error" id="sheet-error"></p>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">Agregar producto</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
  }

  document.getElementById("sheet-submit-btn").addEventListener("click", submitSheet);
  const cancelBtn = document.getElementById("sheet-cancel-btn");
  if (cancelBtn) cancelBtn.addEventListener("click", closeSheet);

  sheetOverlay.classList.add("visible");
}

function closeSheet() {
  sheetOverlay.classList.remove("visible");
  const forcingInitial =
    currentSheetType === "initial" && getCurrentUser() && ensureMoneyData(getCurrentUser().id).money.initialBalance === null;
  if (currentSheetType === "login-password") {
    loginParticipant = null;
  }
  editingMovementId = null;
  activeMovementId = null;
  adminImportTargetId = null;
  adminImportPendingPayload = null;
  adminImportStep = null;
  previaImportStep = null;
  previaImportPendingPayload = null;
  previaCodeTarget = null;
  currentSheetType = null;
  if (forcingInitial) {
    // No se cargó saldo inicial: volvemos a home en vez de dejar la
    // pantalla de Dinero en un estado incompleto.
    navigate("home");
  }
}

function showSheetError(msg) {
  const el = document.getElementById("sheet-error");
  if (el) el.textContent = msg;
}

function submitSheet() {
  if (currentSheetType === "login-password") {
    checkLoginPassword();
    return;
  }

  const user = getCurrentUser();
  if (!user) return;
  const data = ensureMoneyData(user.id);

  if (currentSheetType === "initial") {
    const input = document.getElementById("input-initial-balance");
    const value = parseFloat(input.value);
    if (isNaN(value) || value < 0) {
      input.classList.add("error");
      showSheetError("Ingresá un monto válido.");
      return;
    }
    data.money.initialBalance = value;
    saveUserData(user.id, data);
    sheetOverlay.classList.remove("visible");
    currentSheetType = null;
    renderMoneyScreen();
    return;
  }

  if (currentSheetType === "expense") {
    const nameInput = document.getElementById("input-expense-name");
    const amountInput = document.getElementById("input-expense-amount");
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
      amountInput.classList.add("error");
      showSheetError("Ingresá un monto válido.");
      return;
    }
    const name = nameInput.value.trim() || "Sin Descrip.";
    const category = selectedCategory || "Otros";
    if (editingMovementId) {
      const existing = findMovement(data.money, editingMovementId);
      if (existing) {
        existing.name = name;
        existing.category = category;
        existing.amount = amount;
      }
    } else {
      data.money.movements.unshift({
        id: genId(),
        type: "expense",
        name,
        category,
        amount,
        date: new Date().toISOString(),
      });
    }
    saveUserData(user.id, data);
    sheetOverlay.classList.remove("visible");
    currentSheetType = null;
    editingMovementId = null;
    activeMovementId = null;
    renderMoneyScreen();
    return;
  }

  if (currentSheetType === "income") {
    const nameInput = document.getElementById("input-income-name");
    const amountInput = document.getElementById("input-income-amount");
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
      amountInput.classList.add("error");
      showSheetError("Ingresá un monto válido.");
      return;
    }
    const name = nameInput.value.trim() || "Ganancia";
    if (editingMovementId) {
      const existing = findMovement(data.money, editingMovementId);
      if (existing) {
        existing.name = name;
        existing.amount = amount;
      }
    } else {
      data.money.movements.unshift({
        id: genId(),
        type: "income",
        name,
        amount,
        date: new Date().toISOString(),
      });
    }
    saveUserData(user.id, data);
    sheetOverlay.classList.remove("visible");
    currentSheetType = null;
    editingMovementId = null;
    activeMovementId = null;
    renderMoneyScreen();
    return;
  }

  if (currentSheetType === "delete-confirm") {
    data.money.movements = data.money.movements.filter((m) => m.id !== activeMovementId);
    saveUserData(user.id, data);
    sheetOverlay.classList.remove("visible");
    currentSheetType = null;
    editingMovementId = null;
    activeMovementId = null;
    renderMoneyScreen();
    return;
  }

  if (currentSheetType === "previa-product") {
    const nameInput = document.getElementById("input-previa-product-name");
    const priceInput = document.getElementById("input-previa-product-price");
    const qtyInput = document.getElementById("input-previa-product-qty");
    const price = parseFloat(priceInput.value);
    const quantity = parseInt(qtyInput.value, 10);
    if (isNaN(price) || price <= 0) {
      priceInput.classList.add("error");
      showSheetError("Ingresá un precio válido.");
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      qtyInput.classList.add("error");
      showSheetError("Ingresá una cantidad válida.");
      return;
    }
    const name = nameInput.value.trim() || "Producto";
    previaProducts.push({ id: genId(), name, price, quantity });
    sheetOverlay.classList.remove("visible");
    currentSheetType = null;
    renderPreviasScreen();
    return;
  }
}

sheetOverlay.addEventListener("click", (e) => {
  if (e.target === sheetOverlay) closeSheet();
});

/* =============================================================
   REGISTRO DIARIO
   ============================================================= */

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Rangos de cada selector de hora, en minutos desde las 00:00 del día
// en que arranca el rango (pueden superar 1440 para representar que
// cruzan la medianoche, ej: hora de dormir hasta las 09:00 del día
// siguiente).
const TIME_RANGES = {
  bedtime: { start: 22 * 60, end: (24 + 9) * 60 }, // 22:00 -> 09:00 (+1 día)
  wake: { start: 6 * 60, end: 16 * 60 }, // 06:00 -> 16:00
  nap: { start: 14 * 60, end: 22 * 60 }, // 14:00 -> 22:00
  boliche: { start: 1 * 60, end: 7 * 60 }, // 01:00 -> 07:00
};

function buildTimeOptions(rangeKey) {
  const { start, end } = TIME_RANGES[rangeKey];
  const options = [];
  for (let m = start; m <= end; m += 10) {
    const mod = m % (24 * 60);
    options.push(`${pad2(Math.floor(mod / 60))}:${pad2(mod % 60)}`);
  }
  return options;
}

// Día que se está registrando: por ahora siempre "ayer" (fecha real del
// dispositivo). Se guarda como clave de fecha ISO (YYYY-MM-DD) para que,
// cuando exista una fecha de inicio del viaje configurada, se pueda
// calcular automáticamente a qué día de viaje corresponde sin tocar
// esta estructura.
function getYesterdayKey() {
  const d = getSimulatedToday();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDailyDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const label = date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function ensureDailyLogData(userId) {
  const data = getUserData(userId) || { id: userId, createdAt: new Date().toISOString() };
  if (!data.dailyLog) {
    data.dailyLog = { entries: {} };
    saveUserData(userId, data);
  }
  return data;
}

/* -----------------------------------------------------------
   Cálculos de duración (sueño, siesta, boliche)
   -----------------------------------------------------------
   Todas trabajan sobre strings "HH:MM" y devuelven minutos totales
   (o null si falta algún dato). Se guardan junto con el registro para
   que estadísticas futuras no tengan que recalcular ni reinterpretar
   los horarios crudos.
   ----------------------------------------------------------- */

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// Minutos entre hora de dormir y hora de despertarse. Contempla el
// cruce de medianoche (si la hora de despertarse "cae antes" que la de
// dormir dentro del mismo día, se asume que es al día siguiente).
function sleepDurationMinutes(bedtime, wake) {
  if (!bedtime || !wake) return null;
  const bedMin = timeToMinutes(bedtime);
  let wakeMin = timeToMinutes(wake);
  if (wakeMin <= bedMin) wakeMin += 24 * 60;
  return wakeMin - bedMin;
}

// Minutos de siesta (inicio y fin están siempre dentro del mismo rango
// 14:00-22:00, sin cruce de medianoche).
function napDurationMinutes(nap) {
  if (!nap || !nap.start || !nap.end) return null;
  const diff = timeToMinutes(nap.end) - timeToMinutes(nap.start);
  return Math.max(0, diff);
}

// El boliche arranca siempre a la 01:00; la duración es el tiempo
// entre esa llegada fija y la hora de salida registrada.
const BOLICHE_ARRIVAL_MINUTES = 60; // 01:00
function bolicheDurationMinutes(exitTime) {
  if (!exitTime) return null;
  return Math.max(0, timeToMinutes(exitTime) - BOLICHE_ARRIVAL_MINUTES);
}

// Combina sueño nocturno + siesta en un total, para el ejemplo del
// pedido (6h sueño + 3h siesta = 9h dormidas totales). Si no hay datos
// de ninguno de los dos, devuelve null.
function totalSleepMinutes(sleepMin, napMin) {
  if (sleepMin === null && napMin === null) return null;
  return (sleepMin || 0) + (napMin || 0);
}

// Recalcula todos los campos derivados de un registro diario. Se
// guarda dentro de la entrada (`entry.computed`) para que /admin y
// futuras estadísticas no tengan que reinterpretar horarios crudos.
function computeDailyDerived(entry) {
  const sleepMin = entry.sleep.didNotSleep ? null : sleepDurationMinutes(entry.sleep.bedtime, entry.sleep.wake);
  const napMin = napDurationMinutes(entry.nap);
  const bolicheMin = entry.boliche.didNotGo ? null : bolicheDurationMinutes(entry.boliche.time);
  return {
    sleepMinutes: sleepMin,
    napMinutes: napMin,
    totalSleepMinutes: totalSleepMinutes(sleepMin, napMin),
    bolicheMinutes: bolicheMin,
  };
}

function defaultDailyEntry() {
  return {
    sleep: { didNotSleep: false, bedtime: null, wake: null },
    nap: null, // { start, end } | null
    fifthMeal: null, // "yes" | "no" | null
    bathroom: null, // 0-5 | null
    boliche: { didNotGo: false, time: null },
  };
}

let dailyState = defaultDailyEntry();
let dailyDateKey = null;

const dailyMain = document.getElementById("daily-main");

function renderTimeScroll(containerId, rangeKey, selectedValue) {
  const options = buildTimeOptions(rangeKey);
  return `<div class="time-scroll" id="${containerId}" data-range="${rangeKey}">${options
    .map(
      (opt) =>
        `<button type="button" class="time-option${opt === selectedValue ? " selected" : ""}" data-value="${opt}">${opt}</button>`
    )
    .join("")}</div>`;
}

function scrollSelectedIntoView(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const selected = container.querySelector(".time-option.selected");
  if (!selected) return;
  const target = selected.offsetLeft - container.clientWidth / 2 + selected.clientWidth / 2;
  container.scrollTo({ left: Math.max(0, target), behavior: "auto" });
}

function renderDailyScreen() {
  const user = getCurrentUser();
  if (!user) return;

  const freshDailyDateKey = getYesterdayKey();
  if (dailyDateKey === null || dailyDateKey !== freshDailyDateKey) {
    dailyDateKey = freshDailyDateKey;
    const data = ensureDailyLogData(user.id);
    const existing = data.dailyLog.entries[dailyDateKey];
    dailyState = existing ? JSON.parse(JSON.stringify(existing)) : defaultDailyEntry();
  }

  const s = dailyState;
  const derived = computeDailyDerived(s);

  dailyMain.innerHTML = `
    <div class="daily-date-banner">
      <span class="daily-date-eyebrow">Registrando el día de ayer</span>
      <strong>${formatDailyDate(dailyDateKey)}</strong>
    </div>

    <div class="daily-section">
      <div class="section-label">😴 HORAS DORMIDAS</div>
      <button type="button" id="btn-no-sleep" class="toggle-chip${s.sleep.didNotSleep ? " selected" : ""}">No dormí</button>
      <div id="sleep-fields"${s.sleep.didNotSleep ? " hidden" : ""}>
        <div class="picker-block">
          <label class="field-label">Te fuiste a dormir a las..</label>
          ${renderTimeScroll("picker-bedtime", "bedtime", s.sleep.bedtime)}
        </div>
        <div class="picker-block">
          <label class="field-label">Te despertaste a las..</label>
          ${renderTimeScroll("picker-wake", "wake", s.sleep.wake)}
        </div>
        ${derived.sleepMinutes !== null ? `<p class="daily-computed">${formatDuration(derived.sleepMinutes)} de sueño</p>` : ""}
      </div>
    </div>

    <div class="daily-section">
      <div class="section-label">🌤️ Siestita</div>
      ${
        s.nap
          ? `<div class="picker-block">
               <label class="field-label">Inicio</label>
               ${renderTimeScroll("picker-nap-start", "nap", s.nap.start)}
             </div>
             <div class="picker-block">
               <label class="field-label">Fin</label>
               ${renderTimeScroll("picker-nap-end", "nap", s.nap.end)}
             </div>
             ${derived.napMinutes !== null ? `<p class="daily-computed">${formatDuration(derived.napMinutes)} de siesta</p>` : ""}
             <button type="button" id="btn-remove-nap" class="sheet-cancel-link">Quitar siesta</button>`
          : `<button type="button" id="btn-add-nap" class="add-nap-btn">+ Registrar siesta</button>`
      }
    </div>

    ${
      derived.totalSleepMinutes !== null
        ? `<p class="daily-total-sleep">💤 Total dormido: <strong>${formatDuration(derived.totalSleepMinutes)}</strong></p>`
        : ""
    }

    <div class="daily-section">
      <div class="section-label">🍽️ ¿Comiste la quinta comida, gordito?</div>
      <div class="chip-group" id="fifth-meal-group">
        <button type="button" class="chip${s.fifthMeal === "yes" ? " selected" : ""}" data-value="yes">Sí</button>
        <button type="button" class="chip${s.fifthMeal === "no" ? " selected" : ""}" data-value="no">No</button>
      </div>
    </div>

    <div class="daily-section">
      <div class="section-label">💩 ¿Detonaste el baño? ¿Si? ¿Cuantas veces?</div>
      <div class="chip-group" id="bathroom-group">
        ${[0, 1, 2, 3, 4, 5]
          .map((n) => `<button type="button" class="chip${s.bathroom === n ? " selected" : ""}" data-value="${n}">${n}</button>`)
          .join("")}
      </div>
    </div>

    <div class="daily-section">
      <div class="section-label">🍾 ¿A qué hora abandonaste el boliche?</div>
      <button type="button" id="btn-no-boliche" class="toggle-chip${s.boliche.didNotGo ? " selected" : ""}">No fui al boliche</button>
      <div id="boliche-fields"${s.boliche.didNotGo ? " hidden" : ""}>
        <div class="picker-block">
          ${renderTimeScroll("picker-boliche", "boliche", s.boliche.time)}
        </div>
        ${derived.bolicheMinutes !== null ? `<p class="daily-computed">${formatDuration(derived.bolicheMinutes)} en el boliche (desde la 01:00)</p>` : ""}
      </div>
    </div>

    <button type="button" id="btn-save-daily" class="sheet-submit daily-save-btn">Guardar registro</button>
    <p class="daily-save-msg" id="daily-save-msg"></p>
  `;

  // Centrar la opción seleccionada de cada selector visible.
  ["picker-bedtime", "picker-wake", "picker-nap-start", "picker-nap-end", "picker-boliche"].forEach((id) => {
    if (document.getElementById(id)) scrollSelectedIntoView(id);
  });

  attachDailyListeners();
}

function attachDailyListeners() {
  const noSleepBtn = document.getElementById("btn-no-sleep");
  if (noSleepBtn) {
    noSleepBtn.addEventListener("click", () => {
      dailyState.sleep.didNotSleep = !dailyState.sleep.didNotSleep;
      renderDailyScreen();
    });
  }

  const bedtimePicker = document.getElementById("picker-bedtime");
  if (bedtimePicker) {
    bedtimePicker.addEventListener("click", (e) => {
      const btn = e.target.closest(".time-option");
      if (!btn) return;
      dailyState.sleep.bedtime = btn.dataset.value;
      renderDailyScreen();
    });
  }

  const wakePicker = document.getElementById("picker-wake");
  if (wakePicker) {
    wakePicker.addEventListener("click", (e) => {
      const btn = e.target.closest(".time-option");
      if (!btn) return;
      dailyState.sleep.wake = btn.dataset.value;
      renderDailyScreen();
    });
  }

  const addNapBtn = document.getElementById("btn-add-nap");
  if (addNapBtn) {
    addNapBtn.addEventListener("click", () => {
      dailyState.nap = { start: null, end: null };
      renderDailyScreen();
    });
  }

  const removeNapBtn = document.getElementById("btn-remove-nap");
  if (removeNapBtn) {
    removeNapBtn.addEventListener("click", () => {
      dailyState.nap = null;
      renderDailyScreen();
    });
  }

  const napStartPicker = document.getElementById("picker-nap-start");
  if (napStartPicker) {
    napStartPicker.addEventListener("click", (e) => {
      const btn = e.target.closest(".time-option");
      if (!btn) return;
      dailyState.nap.start = btn.dataset.value;
      renderDailyScreen();
    });
  }

  const napEndPicker = document.getElementById("picker-nap-end");
  if (napEndPicker) {
    napEndPicker.addEventListener("click", (e) => {
      const btn = e.target.closest(".time-option");
      if (!btn) return;
      dailyState.nap.end = btn.dataset.value;
      renderDailyScreen();
    });
  }

  const fifthMealGroup = document.getElementById("fifth-meal-group");
  if (fifthMealGroup) {
    fifthMealGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      dailyState.fifthMeal = btn.dataset.value;
      renderDailyScreen();
    });
  }

  const bathroomGroup = document.getElementById("bathroom-group");
  if (bathroomGroup) {
    bathroomGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      dailyState.bathroom = Number(btn.dataset.value);
      renderDailyScreen();
    });
  }

  const noBolicheBtn = document.getElementById("btn-no-boliche");
  if (noBolicheBtn) {
    noBolicheBtn.addEventListener("click", () => {
      dailyState.boliche.didNotGo = !dailyState.boliche.didNotGo;
      renderDailyScreen();
    });
  }

  const bolichePicker = document.getElementById("picker-boliche");
  if (bolichePicker) {
    bolichePicker.addEventListener("click", (e) => {
      const btn = e.target.closest(".time-option");
      if (!btn) return;
      dailyState.boliche.time = btn.dataset.value;
      renderDailyScreen();
    });
  }

  const saveBtn = document.getElementById("btn-save-daily");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveDailyEntry);
  }
}

function saveDailyEntry() {
  const user = getCurrentUser();
  if (!user) return;

  // Si el usuario marcó "No dormí", limpiamos las horas para no dejar
  // datos inconsistentes guardados.
  if (dailyState.sleep.didNotSleep) {
    dailyState.sleep.bedtime = null;
    dailyState.sleep.wake = null;
  }
  if (dailyState.boliche.didNotGo) {
    dailyState.boliche.time = null;
  }

  const data = ensureDailyLogData(user.id);
  const entryToSave = JSON.parse(JSON.stringify(dailyState));
  entryToSave.computed = computeDailyDerived(entryToSave);
  // Si ya existía un registro para este día, se sobrescribe en lugar de
  // crear un duplicado (misma clave = mismo día).
  data.dailyLog.entries[dailyDateKey] = entryToSave;
  saveUserData(user.id, data);

  const msg = document.getElementById("daily-save-msg");
  if (msg) {
    msg.textContent = "✓ Registro guardado";
    msg.classList.add("visible");
    setTimeout(() => msg.classList.remove("visible"), 2000);
  }
}

/* =============================================================
   EXPORTACIÓN DE DATOS (código para enviar por WhatsApp)
   =============================================================
   Formato del código (ver también docs/SPEC.md):

     BRL<version>.<base64url(xor(JSON.stringify(payload), KEY))>

   payload = { version, user, data: { initialBalance, movements,
   dailyEntries } }

   - generateExportCode(userId) es la ÚNICA función que arma el
     código a partir de los datos actuales de localStorage. Si en el
     futuro se agrega un nuevo tipo de dato persistido, este es el
     único lugar que hay que tocar para incluirlo.
   - decodeExportCode(code) es la ÚNICA función que lo revierte a un
     objeto JS. Todavía no se usa en la UI (la importación se hace en
     una próxima iteración), pero ya queda lista y documentada.
   - La ofuscación es un XOR reversible simple + Base64 url-safe, NO
     es cifrado real: alcanza para que el código no sea legible a
     simple vista, tal como pide el pedido.
   ============================================================= */

const EXPORT_CODE_VERSION = 1;
const EXPORT_CODE_PREFIX = "BRL";
const EXPORT_XOR_KEY = "bariloche-2026"; // ofuscación simple, no es una clave secreta real

// XOR es su propia inversa: la misma función sirve para ofuscar y
// para revertir, siempre que se le pase la misma clave.
function xorBytes(bytes, key) {
  const keyBytes = new TextEncoder().encode(key);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(str) {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Único lugar que decide qué datos del usuario forman parte del
// código exportado. Se lee siempre en el momento (nunca un valor
// cacheado), así el código refleja el estado actual de localStorage.
function buildExportPayload(userId) {
  const data = getUserData(userId) || {};
  const money = data.money || { initialBalance: null, movements: [] };
  const dailyEntries = (data.dailyLog && data.dailyLog.entries) || {};

  return {
    version: EXPORT_CODE_VERSION,
    user: userId,
    data: {
      initialBalance: money.initialBalance,
      movements: money.movements,
      dailyEntries: dailyEntries,
    },
  };
}

// Función central de generación: payload -> JSON -> XOR -> Base64url.
function generateExportCode(userId) {
  const payload = buildExportPayload(userId);
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const obfuscated = xorBytes(bytes, EXPORT_XOR_KEY);
  return `${EXPORT_CODE_PREFIX}${EXPORT_CODE_VERSION}.${bytesToBase64Url(obfuscated)}`;
}

// Función central de decodificación (inversa exacta de la de arriba).
// No se usa todavía en la UI, pero queda lista para la importación.
function decodeExportCode(code) {
  const match = /^([A-Z]+)(\d+)\.(.+)$/.exec(code.trim());
  if (!match) throw new Error("Código con formato inválido");
  const [, prefix, version, encoded] = match;
  if (prefix !== EXPORT_CODE_PREFIX) throw new Error("Prefijo de código desconocido");

  const obfuscated = base64UrlToBytes(encoded);
  const bytes = xorBytes(obfuscated, EXPORT_XOR_KEY);
  const json = new TextDecoder().decode(bytes);
  const payload = JSON.parse(json);

  if (String(payload.version) !== version) throw new Error("Versión inconsistente en el código");
  return payload; // { version, user, data: { initialBalance, movements, dailyEntries } }
}

/* =============================================================
   PREVIAS — código de una previa (mismo formato/codificación que
   el código de intercambio de arriba)
   =============================================================
   Reutiliza EXACTAMENTE el mismo pipeline de codificación
   (JSON -> XOR con EXPORT_XOR_KEY -> Base64 URL-safe, prefijo
   "BRL<version>."), las mismas funciones xorBytes/bytesToBase64Url/
   base64UrlToBytes y la misma función decodeExportCode. Lo único
   que cambia es la forma del payload: en vez de
   { version, user, data } lleva { version, type: "previa", previa }.
   decodeExportCode no necesita cambios: ya es agnóstico a la forma
   del payload, solo valida prefijo/versión y devuelve el objeto
   parseado.
   ============================================================= */

// Único lugar que decide qué datos de una previa entran en su
// código. Si en el futuro se agrega un dato nuevo a una previa,
// alcanza con sumarlo acá.
function buildPreviaExportPayload(previa) {
  return {
    version: EXPORT_CODE_VERSION,
    type: "previa",
    previa: {
      id: previa.id,
      participantIds: previa.participantIds,
      products: previa.products,
      total: previa.total,
      amountPerPerson: previa.amountPerPerson,
      createdAt: previa.createdAt,
    },
  };
}

function generatePreviaExportCode(previa) {
  const payload = buildPreviaExportPayload(previa);
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const obfuscated = xorBytes(bytes, EXPORT_XOR_KEY);
  return `${EXPORT_CODE_PREFIX}${EXPORT_CODE_VERSION}.${bytesToBase64Url(obfuscated)}`;
}

// Valida la ESTRUCTURA de un payload ya decodificado con
// decodeExportCode, comprobando que efectivamente sea un código de
// previa (type === "previa") y que traiga todo lo que una previa
// necesita para guardarse igual que si Gio la hubiese registrado a
// mano. Si algo falla, lanza un Error con mensaje claro y no se
// modifica ningún dato.
function validatePreviaImportPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("El código no contiene datos reconocibles.");
  }
  if (payload.version !== EXPORT_CODE_VERSION) {
    throw new Error("Este código es de una versión incompatible de la app.");
  }
  if (payload.type !== "previa" || !payload.previa || typeof payload.previa !== "object") {
    throw new Error("Este código no es un código de previa.");
  }
  const previa = payload.previa;
  if (!previa.id || typeof previa.id !== "string") {
    throw new Error("El código no tiene la estructura de datos esperada.");
  }
  if (!Array.isArray(previa.participantIds) || previa.participantIds.length === 0) {
    throw new Error("El código no tiene la estructura de datos esperada.");
  }
  if (!Array.isArray(previa.products) || previa.products.length === 0) {
    throw new Error("El código no tiene la estructura de datos esperada.");
  }
  if (typeof previa.total !== "number") {
    throw new Error("El código no tiene la estructura de datos esperada.");
  }
  if (typeof previa.amountPerPerson !== "number") {
    throw new Error("El código no tiene la estructura de datos esperada.");
  }
  if (!previa.createdAt || typeof previa.createdAt !== "string") {
    throw new Error("El código no tiene la estructura de datos esperada.");
  }
  return payload;
}

// Punto único: string pegado por Gio -> payload de previa validado,
// o excepción con un mensaje ya apto para mostrar tal cual en el sheet.
function parseAndValidatePastedPreviaCode(rawCode) {
  const code = (rawCode || "").trim();
  if (!code) {
    throw new Error("Pegá un código para continuar.");
  }
  let payload;
  try {
    payload = decodeExportCode(code);
  } catch (e) {
    throw new Error("Código inválido o incompleto. Revisá que lo hayas copiado completo.");
  }
  return validatePreviaImportPayload(payload);
}

/* -----------------------------------------------------------
   Sheet: mostrar/copiar el código de UNA previa recién guardada o
   ya existente (usado desde el modo "local", ej. Jere).
   ----------------------------------------------------------- */
let previaCodeTarget = null;

function openPreviaCodeSheet(previa) {
  previaCodeTarget = previa;
  openSheet("previa-code");
}

function copyPreviaCode(code) {
  const msg = document.getElementById("previa-code-copy-msg");
  const showCopied = () => {
    if (!msg) return;
    msg.classList.add("visible");
    setTimeout(() => msg.classList.remove("visible"), 2000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(showCopied).catch(() => fallbackCopyPrevia(code, showCopied));
  } else {
    fallbackCopyPrevia(code, showCopied);
  }
}

function fallbackCopyPrevia(code, onDone) {
  const box = document.getElementById("previa-code-box");
  if (!box) return;
  box.focus();
  box.select();
  try {
    document.execCommand("copy");
    onDone();
  } catch (e) {
    // El usuario todavía puede seleccionar y copiar manualmente.
  }
}

/* -----------------------------------------------------------
   Sheet: importar una previa por código, desde /admin
   ("Introducir código de previa"). Mismo patrón multi-paso que
   "Jugadores" (paste -> duplicado si ya existe -> preview ->
   confirmar), reutilizando el mismo decodeExportCode. Solo Gio llega
   acá (el botón que abre este sheet solo se renderiza en modo admin).
   ----------------------------------------------------------- */
let previaImportStep = null; // "paste" | "duplicate" | "preview"
let previaImportPendingPayload = null;

function openPreviaImportSheet() {
  previaImportStep = "paste";
  previaImportPendingPayload = null;
  openSheet("previa-import");
}

function renderPreviaImportSheet() {
  if (previaImportStep === "paste") {
    sheetContent.innerHTML = `
      <h2 class="sheet-title">Introducir código de previa</h2>
      <p class="sheet-sub">Pegá acá el código que Jere (u otro participante) te compartió</p>
      <div class="field">
        <label class="field-label" for="previa-import-textarea">Código</label>
        <textarea id="previa-import-textarea" class="admin-import-textarea" rows="4" placeholder="BRL1.xxxxxxxx..." autocapitalize="off" spellcheck="false"></textarea>
      </div>
      <p class="sheet-error" id="sheet-error"></p>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">Importar</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", handlePreviaImportPaste);
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    const ta = document.getElementById("previa-import-textarea");
    ta.addEventListener("input", () => ta.classList.remove("error"));
    return;
  }

  if (previaImportStep === "duplicate") {
    // Ya existe una previa con ese mismo id en adminPrevias: no se
    // duplica, se avisa y no se toca localStorage.
    sheetContent.innerHTML = `
      <h2 class="sheet-title">Esta previa ya fue importada</h2>
      <p class="sheet-sub">Ya habías importado esta previa antes. No se va a duplicar.</p>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">Entendido</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", closeSheet);
    return;
  }

  if (previaImportStep === "preview") {
    const previa = previaImportPendingPayload.previa;
    const names = previa.participantIds.map((id) => escapeHtml(resolvePlayerName(id))).join(", ");
    const productsSummary = previa.products.map((p) => `${p.quantity}x ${escapeHtml(p.name)}`).join(", ");

    sheetContent.innerHTML = `
      <h2 class="sheet-title">Confirmar importación</h2>
      <p class="sheet-sub">Revisá los datos antes de guardar</p>
      <div class="admin-preview-card">
        <div class="admin-preview-row"><span>Participantes</span><span>${names}</span></div>
        <div class="admin-preview-row"><span>Productos</span><span>${productsSummary}</span></div>
        <div class="admin-preview-row"><span>Total</span><span>${formatMoney(previa.total)}</span></div>
        <div class="admin-preview-row"><span>A pagar por persona</span><span>${formatMoney(previa.amountPerPerson)}</span></div>
        <div class="admin-preview-row"><span>Fecha</span><span>${formatDateTimeShort(previa.createdAt)}</span></div>
      </div>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">Confirmar importación</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", confirmPreviaImport);
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    return;
  }
}

function handlePreviaImportPaste() {
  const ta = document.getElementById("previa-import-textarea");
  let payload;
  try {
    payload = parseAndValidatePastedPreviaCode(ta.value);
  } catch (e) {
    ta.classList.add("error");
    showSheetError(e.message);
    return;
  }

  previaImportPendingPayload = payload;

  const existing = getAdminPrevias().find((p) => p.id === payload.previa.id);
  if (existing) {
    previaImportStep = "duplicate";
    renderPreviaImportSheet();
    return;
  }

  previaImportStep = "preview";
  renderPreviaImportSheet();
}

// Único punto que efectivamente escribe una previa importada en
// "adminPrevias". Guarda exactamente la misma forma que una previa
// registrada a mano por Gio (mismo id, mismos campos), así que el
// resultado en el historial es idéntico. Solo se llega acá después
// de decodeExportCode + validatePreviaImportPayload + chequeo de
// duplicado + confirmación explícita.
function confirmPreviaImport() {
  const payload = previaImportPendingPayload;
  if (!payload) {
    closeSheet();
    return;
  }
  const previa = payload.previa;

  const previas = getAdminPrevias();
  // Chequeo de duplicado final (por si se confirma dos veces sin
  // recargar el sheet, o el mismo código llega dos veces): el id de
  // la previa es la clave de unicidad.
  if (!previas.some((p) => p.id === previa.id)) {
    previas.unshift({
      id: previa.id,
      participantIds: [...previa.participantIds],
      products: previa.products.map((p) => ({ ...p })),
      total: previa.total,
      amountPerPerson: previa.amountPerPerson,
      createdAt: previa.createdAt,
    });
    saveAdminPrevias(previas);
  }

  sheetOverlay.classList.remove("visible");
  currentSheetType = null;
  previaImportStep = null;
  previaImportPendingPayload = null;
  renderPreviasScreen();
}

const WHATSAPP_TARGET_NUMBER = "5491127362080";

function buildWhatsappUrl(code) {
  const message = `BARILOCHE_DATA\nCódigo:\n${code}`;
  return `https://wa.me/${WHATSAPP_TARGET_NUMBER}?text=${encodeURIComponent(message)}`;
}

const exportMain = document.getElementById("export-main");

function renderExportScreen() {
  const user = getCurrentUser();
  if (!user) return;

  const code = generateExportCode(user.id);

  exportMain.innerHTML = `
    <div class="daily-section">
      <div class="section-label">📤 Tu código de datos</div>
      <p class="export-hint">Este código junta tu saldo, gastos, ganancias y registros diarios. Enviaselo a un administrador con el botón de abajo.</p>
      <textarea id="export-code-box" class="export-code-box" readonly rows="4">${code}</textarea>
      <button type="button" id="btn-copy-code" class="sheet-cancel-link">Copiar código</button>
      <p class="daily-save-msg" id="export-copy-msg">✓ Código copiado</p>
    </div>

    <button type="button" id="btn-send-whatsapp" class="sheet-submit whatsapp-btn">📲 Enviar datos a un admin</button>
  `;

  document.getElementById("btn-copy-code").addEventListener("click", () => copyExportCode(code));
  document.getElementById("btn-send-whatsapp").addEventListener("click", () => {
    // Se regenera el código en el momento del envío para asegurar que
    // sea siempre el más actual, incluso si pasó tiempo en pantalla.
    const freshCode = generateExportCode(user.id);
    window.open(buildWhatsappUrl(freshCode), "_blank");
  });
}

function copyExportCode(code) {
  const msg = document.getElementById("export-copy-msg");
  const showCopied = () => {
    if (!msg) return;
    msg.classList.add("visible");
    setTimeout(() => msg.classList.remove("visible"), 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(showCopied).catch(() => fallbackCopy(code, showCopied));
  } else {
    fallbackCopy(code, showCopied);
  }
}

function fallbackCopy(code, onDone) {
  const box = document.getElementById("export-code-box");
  if (!box) return;
  box.focus();
  box.select();
  try {
    document.execCommand("copy");
    onDone();
  } catch (e) {
    // Si tampoco funciona el fallback, el usuario todavía puede
    // seleccionar y copiar el texto manualmente desde el textarea.
  }
}

/* =============================================================
   ESTADÍSTICAS (ADMIN)
   =============================================================
   Estructura base de /admin → Estadísticas. Dos apartados:
   - DÍA: navegación ← → entre los días ya cerrados del viaje
     (nunca el día actual ni días futuros).
   - TOTAL: acumula todos los días disponibles, misma estructura
     visual que DÍA.
   Todavía no calcula estadísticas reales ni rankings: solo deja la
   estructura preparada para recibirlos (tarjetas "Próximamente").
   ============================================================= */

let statsTab = "dia"; // "dia" | "total"
let statsDayIndex = null; // índice dentro de getStatsClosedDays()
let statsNavDir = 0; // -1 (día anterior) | 0 (sin dirección, fade) | 1 (día siguiente)

function todayKey() {
  const d = getSimulatedToday();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Un día se considera "cerrado" cuando existe al menos un registro
// diario de algún jugador importado (adminPlayers) para esa fecha, y
// esa fecha es estrictamente anterior a hoy. Nunca incluye el día de
// hoy ni fechas futuras. Devuelve las claves YYYY-MM-DD ordenadas de
// más antigua a más reciente.
function getStatsClosedDays() {
  const players = getAdminPlayers();
  const today = todayKey();
  const keys = new Set();
  Object.values(players).forEach((player) => {
    const entries = (player.data && player.data.dailyEntries) || {};
    Object.keys(entries).forEach((key) => {
      if (key < today) keys.add(key);
    });
  });
  return Array.from(keys).sort();
}

function renderStatsPlaceholderCards() {
  return `
    <div class="card-list stats-placeholder-list">
      <article class="feature-card locked">
        <div class="feature-icon" style="--fc:#4cc9f022;--fi:#4cc9f0">😴</div>
        <div class="feature-text">
          <h3>Sueño</h3>
          <p>Promedios y rankings de horas dormidas</p>
        </div>
        <span class="soon-tag">Próximamente</span>
      </article>
      <article class="feature-card locked">
        <div class="feature-icon" style="--fc:#ff9f1c22;--fi:#ff9f1c">💸</div>
        <div class="feature-text">
          <h3>Dinero</h3>
          <p>Gasto total y por categoría</p>
        </div>
        <span class="soon-tag">Próximamente</span>
      </article>
      <article class="feature-card locked">
        <div class="feature-icon" style="--fc:#ff547022;--fi:#ff5470">🕺</div>
        <div class="feature-text">
          <h3>Boliche</h3>
          <p>Horarios de salida y tiempo adentro</p>
        </div>
        <span class="soon-tag">Próximamente</span>
      </article>
      <article class="feature-card locked">
        <div class="feature-icon" style="--fc:#c77dff22;--fi:#c77dff">🏆</div>
        <div class="feature-text">
          <h3>Rankings</h3>
          <p>Títulos y comparaciones entre participantes</p>
        </div>
        <span class="soon-tag">Próximamente</span>
      </article>
    </div>
  `;
}

/* -----------------------------------------------------------
   Estadísticas reales — apartado DÍA
   -----------------------------------------------------------
   Cada estadística se arma como un ranking de barras horizontales
   (ver renderRankingBars). Todas trabajan sobre adminPlayers y
   adminPrevias, y sobre un único `dateKey` (YYYY-MM-DD) ya "cerrado"
   (ver getStatsClosedDays). Nunca inventan datos: si un jugador no
   tiene el dato correspondiente ese día, simplemente no entra en el
   ranking de esa tarjeta.
   ----------------------------------------------------------- */

// Convierte el ISO string de un movimiento/previa (guardado con
// new Date().toISOString(), hora real de carga) a la clave YYYY-MM-DD
// del día de viaje al que se atribuye ese gasto/previa.
//
// Igual que Registro diario (ver getYesterdayKey), la app asume que
// los datos de "hoy" se cargan recién mañana: alguien anota sus
// gastos de anoche, o Gio carga la previa de anoche, al día
// siguiente. Por eso la clave de atribución es el día calendario
// ANTERIOR a la fecha real de carga, no la fecha de carga tal cual.
//
// Bug corregido: antes se usaba la fecha de carga sin ese corrimiento
// (`isoToLocalDateKey`), así que un gasto o previa cargado "hoy"
// nunca podía coincidir con ningún día cerrado (que por definición es
// siempre `< today`), y las tarjetas de Dinero/Previas mostraban
// "Sin datos para este día" aunque hubiera datos reales cargados.
function isoToTripDayKey(isoString) {
  const d = new Date(isoString);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getAdminPlayersArray() {
  const players = getAdminPlayers();
  return Object.keys(players).map((id) => players[id]);
}

// name/value ya resueltos, ordenados de mayor a menor. `display` es
// el texto que se muestra al final de la barra (con formato/unidad).
function sortRankingDesc(items) {
  return items.slice().sort((a, b) => b.value - a.value);
}

function dayRankingHorasDormidas(dateKey) {
  const rows = [];
  getAdminPlayersArray().forEach((player) => {
    const entry = (player.data.dailyEntries || {})[dateKey];
    if (!entry || !entry.computed || entry.computed.sleepMinutes === null || entry.computed.sleepMinutes === undefined) return;
    rows.push({ name: player.name, value: entry.computed.sleepMinutes, display: formatDuration(entry.computed.sleepMinutes) });
  });
  return sortRankingDesc(rows);
}

function dayRankingSiestas(dateKey) {
  const rows = [];
  getAdminPlayersArray().forEach((player) => {
    const entry = (player.data.dailyEntries || {})[dateKey];
    if (!entry) return;
    const took = entry.nap && entry.nap.start && entry.nap.end ? 1 : 0;
    rows.push({ name: player.name, value: took, display: took ? "Sí" : "No" });
  });
  return sortRankingDesc(rows);
}

function dayRankingQuintaComida(dateKey) {
  const rows = [];
  getAdminPlayersArray().forEach((player) => {
    const entry = (player.data.dailyEntries || {})[dateKey];
    if (!entry || entry.fifthMeal === null || entry.fifthMeal === undefined) return;
    const val = entry.fifthMeal === "yes" ? 1 : 0;
    rows.push({ name: player.name, value: val, display: val ? "Sí" : "No" });
  });
  return sortRankingDesc(rows);
}

function dayRankingBanio(dateKey) {
  const rows = [];
  getAdminPlayersArray().forEach((player) => {
    const entry = (player.data.dailyEntries || {})[dateKey];
    if (!entry || entry.bathroom === null || entry.bathroom === undefined) return;
    rows.push({ name: player.name, value: entry.bathroom, display: entry.bathroom === 1 ? "1 vez" : `${entry.bathroom} veces` });
  });
  return sortRankingDesc(rows);
}

function dayRankingBoliche(dateKey) {
  const rows = [];
  getAdminPlayersArray().forEach((player) => {
    const entry = (player.data.dailyEntries || {})[dateKey];
    if (!entry || !entry.computed || entry.computed.bolicheMinutes === null || entry.computed.bolicheMinutes === undefined) return;
    rows.push({ name: player.name, value: entry.computed.bolicheMinutes, display: formatDuration(entry.computed.bolicheMinutes) });
  });
  return sortRankingDesc(rows);
}

// Devuelve los gastos (type "expense") de todos los jugadores
// importados cuya fecha real de carga cae dentro de `dateKey`.
function dayExpenses(dateKey) {
  const expenses = [];
  getAdminPlayersArray().forEach((player) => {
    const movements = (player.data.movements || []);
    movements.forEach((m) => {
      if (m.type !== "expense") return;
      if (isoToTripDayKey(m.date) !== dateKey) return;
      expenses.push({ playerName: player.name, category: m.category, amount: m.amount });
    });
  });
  return expenses;
}

function dayRankingDineroTotal(dateKey) {
  const totals = {};
  dayExpenses(dateKey).forEach((e) => {
    totals[e.playerName] = (totals[e.playerName] || 0) + e.amount;
  });
  const rows = Object.keys(totals).map((name) => ({ name, value: totals[name], display: formatMoney(totals[name]) }));
  return sortRankingDesc(rows);
}

function dayRankingDineroPorCategoria(dateKey) {
  const totals = {};
  dayExpenses(dateKey).forEach((e) => {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  });
  const rows = Object.keys(totals).map((category) => ({
    name: category,
    value: totals[category],
    display: formatMoney(totals[category]),
  }));
  return sortRankingDesc(rows);
}

// Ranking de jugadores dentro de una categoría puntual (no de
// categorías entre sí): cuánto gastó cada jugador en `category`
// sobre el conjunto de gastos ya calculado (`expenses`). Reutilizado
// por DÍA y TOTAL, cada uno pasándole su propio `dayExpenses` /
// `totalExpenses`.
function rankingPorCategoriaJugador(expenses, category) {
  const totals = {};
  expenses.forEach((e) => {
    if (e.category !== category) return;
    totals[e.playerName] = (totals[e.playerName] || 0) + e.amount;
  });
  const rows = Object.keys(totals).map((name) => ({ name, value: totals[name], display: formatMoney(totals[name]) }));
  return sortRankingDesc(rows);
}

function dayRankingPorCategoriaJugador(dateKey, category) {
  return rankingPorCategoriaJugador(dayExpenses(dateKey), category);
}

function dayRankingPrevias(dateKey) {
  const previas = getAdminPrevias().filter((p) => isoToTripDayKey(p.createdAt) === dateKey);
  const counts = {};
  const nameById = {};
  PARTICIPANTS.forEach((p) => (nameById[p.id] = p.name));
  previas.forEach((previa) => {
    (previa.participantIds || []).forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });
  });
  const rows = Object.keys(counts).map((id) => ({
    name: nameById[id] || id,
    value: counts[id],
    display: `${counts[id]} previa${counts[id] === 1 ? "" : "s"}`,
  }));
  return sortRankingDesc(rows);
}

/* -----------------------------------------------------------
   Estadísticas reales — apartado TOTAL
   -----------------------------------------------------------
   Mismas ocho estadísticas que DÍA, pero acumuladas sobre todos los
   días "cerrados" disponibles (mismo conjunto `getStatsClosedDays()`
   que usa DÍA). Un jugador entra en el ranking de una tarjeta si
   tiene al menos un día cerrado con ese dato cargado (no se inventan
   ceros para jugadores que nunca registraron ese campo); si tiene
   datos en algunos días y en otros no, solo se acumulan los días
   donde sí cargó el dato.
   ----------------------------------------------------------- */

function totalRankingHorasDormidas(closedDays) {
  const set = new Set(closedDays);
  const totals = {};
  getAdminPlayersArray().forEach((player) => {
    const entries = player.data.dailyEntries || {};
    Object.keys(entries).forEach((key) => {
      if (!set.has(key)) return;
      const entry = entries[key];
      if (!entry.computed || entry.computed.sleepMinutes === null || entry.computed.sleepMinutes === undefined) return;
      totals[player.name] = (totals[player.name] || 0) + entry.computed.sleepMinutes;
    });
  });
  const rows = Object.keys(totals).map((name) => ({ name, value: totals[name], display: formatDuration(totals[name]) }));
  return sortRankingDesc(rows);
}

function totalRankingSiestas(closedDays) {
  const set = new Set(closedDays);
  const totals = {};
  getAdminPlayersArray().forEach((player) => {
    const entries = player.data.dailyEntries || {};
    Object.keys(entries).forEach((key) => {
      if (!set.has(key)) return;
      const entry = entries[key];
      const took = entry.nap && entry.nap.start && entry.nap.end ? 1 : 0;
      totals[player.name] = (totals[player.name] || 0) + took;
    });
  });
  const rows = Object.keys(totals).map((name) => ({
    name,
    value: totals[name],
    display: `${totals[name]} siesta${totals[name] === 1 ? "" : "s"}`,
  }));
  return sortRankingDesc(rows);
}

function totalRankingQuintaComida(closedDays) {
  const set = new Set(closedDays);
  const totals = {};
  const registered = new Set();
  getAdminPlayersArray().forEach((player) => {
    const entries = player.data.dailyEntries || {};
    Object.keys(entries).forEach((key) => {
      if (!set.has(key)) return;
      const entry = entries[key];
      if (entry.fifthMeal === null || entry.fifthMeal === undefined) return;
      registered.add(player.name);
      totals[player.name] = (totals[player.name] || 0) + (entry.fifthMeal === "yes" ? 1 : 0);
    });
  });
  const rows = Array.from(registered).map((name) => ({
    name,
    value: totals[name] || 0,
    display: `${totals[name] || 0} vez${(totals[name] || 0) === 1 ? "" : "es"}`,
  }));
  return sortRankingDesc(rows);
}

function totalRankingBanio(closedDays) {
  const set = new Set(closedDays);
  const totals = {};
  const registered = new Set();
  getAdminPlayersArray().forEach((player) => {
    const entries = player.data.dailyEntries || {};
    Object.keys(entries).forEach((key) => {
      if (!set.has(key)) return;
      const entry = entries[key];
      if (entry.bathroom === null || entry.bathroom === undefined) return;
      registered.add(player.name);
      totals[player.name] = (totals[player.name] || 0) + entry.bathroom;
    });
  });
  const rows = Array.from(registered).map((name) => ({
    name,
    value: totals[name] || 0,
    display: (totals[name] || 0) === 1 ? "1 vez" : `${totals[name] || 0} veces`,
  }));
  return sortRankingDesc(rows);
}

function totalRankingBoliche(closedDays) {
  const set = new Set(closedDays);
  const totals = {};
  getAdminPlayersArray().forEach((player) => {
    const entries = player.data.dailyEntries || {};
    Object.keys(entries).forEach((key) => {
      if (!set.has(key)) return;
      const entry = entries[key];
      if (!entry.computed || entry.computed.bolicheMinutes === null || entry.computed.bolicheMinutes === undefined) return;
      totals[player.name] = (totals[player.name] || 0) + entry.computed.bolicheMinutes;
    });
  });
  const rows = Object.keys(totals).map((name) => ({ name, value: totals[name], display: formatDuration(totals[name]) }));
  return sortRankingDesc(rows);
}

// Devuelve los gastos (type "expense") de todos los jugadores
// importados cuya fecha real de carga cae dentro de alguno de los
// días cerrados (`closedDays`).
function totalExpenses(closedDays) {
  const set = new Set(closedDays);
  const expenses = [];
  getAdminPlayersArray().forEach((player) => {
    const movements = player.data.movements || [];
    movements.forEach((m) => {
      if (m.type !== "expense") return;
      if (!set.has(isoToTripDayKey(m.date))) return;
      expenses.push({ playerName: player.name, category: m.category, amount: m.amount });
    });
  });
  return expenses;
}

function totalRankingDineroTotal(closedDays) {
  const totals = {};
  totalExpenses(closedDays).forEach((e) => {
    totals[e.playerName] = (totals[e.playerName] || 0) + e.amount;
  });
  const rows = Object.keys(totals).map((name) => ({ name, value: totals[name], display: formatMoney(totals[name]) }));
  return sortRankingDesc(rows);
}

function totalRankingDineroPorCategoria(closedDays) {
  const totals = {};
  totalExpenses(closedDays).forEach((e) => {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  });
  const rows = Object.keys(totals).map((category) => ({
    name: category,
    value: totals[category],
    display: formatMoney(totals[category]),
  }));
  return sortRankingDesc(rows);
}

function totalRankingPorCategoriaJugador(closedDays, category) {
  return rankingPorCategoriaJugador(totalExpenses(closedDays), category);
}

function totalRankingPrevias(closedDays) {
  const set = new Set(closedDays);
  const previas = getAdminPrevias().filter((p) => set.has(isoToTripDayKey(p.createdAt)));
  const counts = {};
  const nameById = {};
  PARTICIPANTS.forEach((p) => (nameById[p.id] = p.name));
  previas.forEach((previa) => {
    (previa.participantIds || []).forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });
  });
  const rows = Object.keys(counts).map((id) => ({
    name: nameById[id] || id,
    value: counts[id],
    display: `${counts[id]} previa${counts[id] === 1 ? "" : "s"}`,
  }));
  return sortRankingDesc(rows);
}

// Medalla para 2° y 3° puesto; del 4° en adelante se muestra el
// número de puesto simple. `rankClass` es solo para poder pintar la
// fila (plata/bronce) desde CSS sin tocar ningún cálculo.
function medalForRank(rank) {
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

function rankClassFor(rank) {
  if (rank === 2) return " is-silver";
  if (rank === 3) return " is-bronze";
  return "";
}

// Ranking genérico de barras HORIZONTALES, ordenado de mayor a menor
// (los `rows` ya vienen ordenados). El primer puesto se separa en un
// "podio" propio (más grande, con glow y corona) para que sea
// imposible no ver quién va ganando; del 2° en adelante se listan
// abajo con medalla/número de puesto. El ancho de cada barra sigue
// siendo proporcional al valor máximo del propio ranking, nunca a un
// valor fijo, para que siempre se vea bien sin importar la escala
// (minutos, pesos, cantidades). Las barras arrancan en 0% y se
// animan hasta su valor real vía `animateRankingBars()` después de
// insertar el HTML en el DOM (ver `data-pct`).
//
// Nota (pulido visual): esta función solo arma HTML/clases nuevas
// para que se vea mejor (tag "1er puesto", plata/bronce
// diferenciados, brillo en la barra ganadora, estado vacío más
// prolijo). No cambia qué filas entran al ranking ni su orden — eso
// sigue viniendo tal cual de `rows`.
function renderRankingBars(rows, emptyMessage) {
  if (!rows.length) {
    return `
      <div class="ranking-empty-state">
        <span class="ranking-empty-icon" aria-hidden="true">🌙</span>
        <p class="ranking-empty-text">${emptyMessage || "Sin datos para este día."}</p>
      </div>
    `;
  }
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const [winner, ...rest] = rows;
  const winnerPct = Math.max((winner.value / max) * 100, winner.value > 0 ? 4 : 0);

  const podium = `
    <div class="ranking-podium">
      <span class="ranking-podium-crown" aria-hidden="true">🏆</span>
      <div class="ranking-podium-body">
        <div class="ranking-podium-top">
          <span class="ranking-podium-tag">1er puesto</span>
          <span class="ranking-podium-value">${winner.display}</span>
        </div>
        <span class="ranking-podium-name">${escapeHtml(winner.name)}</span>
        <div class="ranking-bar-track ranking-bar-track-winner">
          <div class="ranking-bar-fill ranking-bar-fill-winner" data-pct="${winnerPct}">
            <span class="ranking-bar-shine" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  const restList = rest.length
    ? `
      <div class="ranking-list">
        ${rest
          .map((row, i) => {
            const pct = Math.max((row.value / max) * 100, row.value > 0 ? 4 : 0);
            const rank = i + 2;
            return `
              <div class="ranking-row${rankClassFor(rank)}" style="--row-delay:${i * 60}ms">
                <span class="ranking-rank">${medalForRank(rank)}</span>
                <span class="ranking-name">${escapeHtml(row.name)}</span>
                <div class="ranking-bar-track">
                  <div class="ranking-bar-fill" data-pct="${pct}"></div>
                </div>
                <span class="ranking-value">${row.display}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `
    : "";

  return `<div class="ranking-wrap">${podium}${restList}</div>`;
}

function renderRankingCard(icon, accent, title, caption, rows, emptyMessage) {
  return `
    <article class="feature-card ranking-card" style="--ranking-accent:${accent}">
      <div class="ranking-card-header">
        <div class="feature-icon" style="--fc:${accent}22;--fi:${accent}">${icon}</div>
        <div class="ranking-card-heading">
          <h3>${title}</h3>
          <span class="ranking-card-caption">${caption}</span>
        </div>
      </div>
      ${renderRankingBars(rows, emptyMessage)}
    </article>
  `;
}

// Genera una tarjeta de ranking por cada categoría de gasto que
// tenga al menos un jugador con gasto registrado en el período
// mostrado (`rankingFn(category)` ya viene resuelto para DÍA o
// TOTAL). Las categorías sin ningún gasto simplemente no generan
// tarjeta (no se muestra vacía).
function renderCategoryRankingCards(rankingFn) {
  return EXPENSE_CATEGORIES.map((category) => {
    const rows = rankingFn(category);
    if (!rows.length) return "";
    const meta = CATEGORY_RANKING_META[category];
    return renderRankingCard(meta.icon, meta.accent, meta.title, `Gasto en ${category}`, rows);
  }).join("");
}

// Dispara la animación de crecimiento de las barras recién
// insertadas dentro de `root` (arrancan en 0% por CSS/atributo
// `data-pct` y acá se les asigna el ancho final para que el
// `transition: width` del CSS las anime). Doble rAF para asegurar
// que el navegador ya pintó el estado inicial en 0% antes de
// cambiarlo.
function animateRankingBars(root) {
  const bars = root.querySelectorAll(".ranking-bar-fill[data-pct]");
  if (!bars.length) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bars.forEach((bar) => {
        bar.style.width = `${bar.dataset.pct}%`;
      });
    });
  });
}

function renderDayStatsReal(dateKey) {
  return `
    <div class="card-list stats-real-list">
      ${renderRankingCard("😴", "#4cc9f0", "¿Quién durmió más?", "Horas dormidas", dayRankingHorasDormidas(dateKey))}
      ${renderRankingCard("🛋️", "#4cc9f0", "Fanático de la siesta", "Siesta hoy", dayRankingSiestas(dateKey))}
      ${renderRankingCard("🍔", "#ffd166", "La quinta comida", "¿Comió una quinta?", dayRankingQuintaComida(dateKey))}
      ${renderRankingCard("🚽", "#ffd166", "Maratón de baño", "Veces que fue al baño", dayRankingBanio(dateKey))}
      ${renderRankingCard("🕺", "#ff5470", "Resistencia en el boliche", "Tiempo adentro", dayRankingBoliche(dateKey))}
      ${renderRankingCard("💸", "#ff9f1c", "El más gastador", "Gasto total del día", dayRankingDineroTotal(dateKey))}
      ${renderRankingCard("🧾", "#ff9f1c", "¿En qué se fue la plata?", "Gasto por categoría", dayRankingDineroPorCategoria(dateKey))}
      ${renderCategoryRankingCards((category) => dayRankingPorCategoriaJugador(dateKey, category))}
      ${renderRankingCard("🍻", "#c77dff", "Rey/reina de las previas", "Previas del día", dayRankingPrevias(dateKey))}
    </div>
  `;
}

function renderTotalStatsReal(closedDays) {
  const msg = "Sin datos en todo el viaje.";
  return `
    <div class="card-list stats-real-list">
      ${renderRankingCard("😴", "#4cc9f0", "¿Quién durmió más?", "Horas dormidas totales", totalRankingHorasDormidas(closedDays), msg)}
      ${renderRankingCard("🛋️", "#4cc9f0", "Fanático de la siesta", "Siestas de todo el viaje", totalRankingSiestas(closedDays), msg)}
      ${renderRankingCard("🍔", "#ffd166", "La quinta comida", "Quintas comidas del viaje", totalRankingQuintaComida(closedDays), msg)}
      ${renderRankingCard("🚽", "#ffd166", "Maratón de baño", "Veces al baño en total", totalRankingBanio(closedDays), msg)}
      ${renderRankingCard("🕺", "#ff5470", "Resistencia en el boliche", "Tiempo adentro acumulado", totalRankingBoliche(closedDays), msg)}
      ${renderRankingCard("💸", "#ff9f1c", "El más gastador", "Gasto total del viaje", totalRankingDineroTotal(closedDays), msg)}
      ${renderRankingCard("🧾", "#ff9f1c", "¿En qué se fue la plata?", "Gasto por categoría", totalRankingDineroPorCategoria(closedDays), msg)}
      ${renderCategoryRankingCards((category) => totalRankingPorCategoriaJugador(closedDays, category))}
      ${renderRankingCard("🍻", "#c77dff", "Rey/reina de las previas", "Previas de todo el viaje", totalRankingPrevias(closedDays), msg)}
    </div>
  `;
}

function renderStatsPanel() {
  const panel = document.getElementById("stats-panel");
  if (!panel) return;
  const closedDays = getStatsClosedDays();

  // Dirección de la transición (solo se usa una vez y se resetea:
  // sirve para que ← anterior deslice desde la izquierda y →
  // siguiente deslice desde la derecha; cualquier otro cambio
  // — cambiar de pestaña, primer render — usa un simple fade).
  const navDir = statsNavDir;
  statsNavDir = 0;
  const innerClass = navDir === 1 ? "stats-slide-next" : navDir === -1 ? "stats-slide-prev" : "";

  if (statsTab === "dia") {
    if (statsDayIndex === null || statsDayIndex >= closedDays.length) {
      statsDayIndex = closedDays.length - 1;
    }

    const hasDays = closedDays.length > 0;
    const currentKey = hasDays ? closedDays[statsDayIndex] : null;
    const atFirst = !hasDays || statsDayIndex <= 0;
    const atLast = !hasDays || statsDayIndex >= closedDays.length - 1;

    panel.innerHTML = `
      <div class="stats-panel-inner ${innerClass}">
        <div class="stats-day-nav">
          <button type="button" id="stats-day-prev" class="stats-day-btn" ${atFirst ? "disabled" : ""} aria-label="Día anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="stats-day-label">
            ${hasDays ? `<strong>${formatDailyDate(currentKey)}</strong>` : `<strong>Sin días cerrados</strong>`}
          </div>
          <button type="button" id="stats-day-next" class="stats-day-btn" ${atLast ? "disabled" : ""} aria-label="Día siguiente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        ${
          hasDays
            ? ""
            : `<div class="stats-empty-banner"><span class="stats-empty-banner-icon" aria-hidden="true">🗓️</span><p>Todavía no hay días cerrados del viaje. En cuanto se registre e importe el primer día completo, vas a poder navegarlo acá.</p></div>`
        }
        <div class="section-label">Estadísticas del día</div>
        ${hasDays ? renderDayStatsReal(currentKey) : renderStatsPlaceholderCards()}
      </div>
    `;

    if (hasDays) {
      document.getElementById("stats-day-prev").addEventListener("click", () => {
        if (statsDayIndex > 0) {
          statsDayIndex -= 1;
          statsNavDir = -1;
          renderStatsPanel();
        }
      });
      document.getElementById("stats-day-next").addEventListener("click", () => {
        if (statsDayIndex < closedDays.length - 1) {
          statsDayIndex += 1;
          statsNavDir = 1;
          renderStatsPanel();
        }
      });
    }
  } else {
    const hasDays = closedDays.length > 0;
    panel.innerHTML = `
      <div class="stats-panel-inner ${innerClass}">
        <div class="stats-day-nav stats-day-nav-total">
          <span class="stats-day-btn stats-day-btn-ghost" aria-hidden="true"></span>
          <div class="stats-day-label">
            <strong>Todo el viaje</strong>
            <span class="stats-day-sub">${closedDays.length} día${closedDays.length === 1 ? "" : "s"} cerrado${closedDays.length === 1 ? "" : "s"}</span>
          </div>
          <span class="stats-day-btn stats-day-btn-ghost" aria-hidden="true"></span>
        </div>
        ${
          hasDays
            ? ""
            : `<div class="stats-empty-banner"><span class="stats-empty-banner-icon" aria-hidden="true">🗓️</span><p>Todavía no hay días cerrados del viaje. En cuanto se registre e importe el primer día completo, vas a poder ver el acumulado acá.</p></div>`
        }
        <div class="section-label">Estadísticas totales</div>
        ${hasDays ? renderTotalStatsReal(closedDays) : renderStatsPlaceholderCards()}
      </div>
    `;
  }

  animateRankingBars(panel);
}

function renderStatsScreen() {
  const main = document.getElementById("stats-main");
  main.innerHTML = `
    <div class="stats-tabs" role="tablist">
      <button type="button" class="stats-tab${statsTab === "dia" ? " active" : ""}" data-tab="dia" role="tab" aria-selected="${statsTab === "dia"}">Día</button>
      <button type="button" class="stats-tab${statsTab === "total" ? " active" : ""}" data-tab="total" role="tab" aria-selected="${statsTab === "total"}">Total</button>
    </div>
    <div id="stats-panel"></div>
  `;

  main.querySelectorAll(".stats-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (statsTab === btn.dataset.tab) return;
      statsTab = btn.dataset.tab;
      renderStatsPanel();
      main.querySelectorAll(".stats-tab").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
    });
  });

  renderStatsPanel();
}

/* -----------------------------------------------------------
   Routing simple (hash-based, sin backend)
   ----------------------------------------------------------- */

const screens = {
  select: document.getElementById("screen-select"),
  home: document.getElementById("screen-home"),
  money: document.getElementById("screen-money"),
  daily: document.getElementById("screen-daily"),
  export: document.getElementById("screen-export"),
  admin: document.getElementById("screen-admin"),
  previas: document.getElementById("screen-previas"),
  "previas-jere": document.getElementById("screen-previas-jere"),
  stats: document.getElementById("screen-stats"),
};

const bottomNav = document.getElementById("bottom-nav");
const navAdminBtn = document.getElementById("nav-admin");
const globalSnowfall = document.getElementById("global-snowfall");

/* Reubica el ÚNICO nodo de nieve global como primer hijo de la
   pantalla que se está por mostrar (ver ".global-snowfall" en
   styles.css para el porqué). No crea ni clona nada: mueve el
   mismo elemento del DOM de una pantalla a otra. No hace nada si
   el nodo ya está ahí (evita un reflow innecesario al navegar
   entre pantallas que no cambian, o si el markup no está
   presente por algún motivo). */
function placeGlobalSnowfall(screenEl) {
  if (!screenEl || !globalSnowfall) return;
  if (screenEl.firstChild !== globalSnowfall) {
    screenEl.insertBefore(globalSnowfall, screenEl.firstChild);
  }
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("active", key === name);
  });
  placeGlobalSnowfall(screens[name]);
  window.scrollTo(0, 0);
}

function updateNav(routeName) {
  const buttons = bottomNav.querySelectorAll(".nav-btn");
  buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === routeName);
  });
}

function navigate(route) {
  const user = getCurrentUser();

  if (!user) {
    // Sin sesión: siempre selector, sin importar el hash.
    location.hash = "#/select";
    showScreen("select");
    bottomNav.classList.remove("visible");
    return;
  }

  if ((route === "admin" || route === "previas" || route === "stats") && !user.isAdmin) {
    route = "home";
  }

  if (route === "previas-jere" && !canRegisterLocalPrevia(user.id)) {
    route = "home";
  }

  if (route === "admin") {
    location.hash = "#/admin";
    renderAdmin();
    showScreen("admin");
  } else if (route === "previas") {
    location.hash = "#/previas";
    previaMode = "admin";
    renderPreviasScreen();
    showScreen("previas");
  } else if (route === "stats") {
    location.hash = "#/stats";
    renderStatsScreen();
    showScreen("stats");
  } else if (route === "previas-jere") {
    location.hash = "#/previas-jere";
    previaMode = "local";
    renderPreviasScreen();
    showScreen("previas-jere");
  } else if (route === "money") {
    location.hash = "#/money";
    renderMoneyScreen();
    showScreen("money");
  } else if (route === "daily") {
    location.hash = "#/daily";
    renderDailyScreen();
    showScreen("daily");
  } else if (route === "export") {
    location.hash = "#/export";
    renderExportScreen();
    showScreen("export");
  } else {
    location.hash = "#/home";
    renderHome(user);
    showScreen("home");
  }

  navAdminBtn.hidden = !user.isAdmin;
  bottomNav.classList.add("visible");
  // Nav frost (celeste/blanco) en Home, Dinero, Registro diario, Envío
  // de datos, Previas (de admin o de Jere) y en toda la sección /admin
  // (Admin y Estadísticas comparten la estética "Bariloche" vía la
  // clase `.admin-frost`). Desde v0.23.0 Registro diario también usa
  // esta variante (antes era la única pantalla logueada que conservaba
  // la barra oscura original).
  bottomNav.classList.toggle(
    "bottom-nav-frost",
    route === "home" ||
      route === "admin" ||
      route === "previas" ||
      route === "stats" ||
      route === "money" ||
      route === "previas-jere" ||
      route === "export" ||
      route === "daily"
  );
  // Dinero, Registro diario, Envío de datos y Previas (sección de
  // Jere) son parte de Home: mantenemos ese tab activo.
  // Previas de /admin es parte de Admin: mantenemos ese tab activo.
  updateNav(
    route === "money" || route === "daily" || route === "export" || route === "previas-jere"
      ? "home"
      : route === "previas" || route === "stats"
      ? "admin"
      : route
  );
}

function routeFromHash() {
  const hash = location.hash.replace("#/", "");
  if (hash === "admin") return "admin";
  if (hash === "previas") return "previas";
  if (hash === "stats") return "stats";
  if (hash === "previas-jere") return "previas-jere";
  if (hash === "money") return "money";
  if (hash === "daily") return "daily";
  if (hash === "export") return "export";
  return "home";
}

/* -----------------------------------------------------------
   Eventos
   ----------------------------------------------------------- */

document.getElementById("btn-logout").addEventListener("click", () => {
  clearCurrentUser();
  navigateBetweenScreensWithTransition("home", "select");
});

document.getElementById("btn-admin-back").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("admin", "home");
});

document.getElementById("btn-admin-update-code").addEventListener("click", () => {
  openAdminImportUpdateCode();
});

document.getElementById("card-admin-previas").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("admin", "previas");
});

document.getElementById("btn-previas-back").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("previas", "admin");
});

document.getElementById("card-admin-stats").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("admin", "stats");
});

document.getElementById("btn-stats-back").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("stats", "admin");
});

document.getElementById("card-previas-jere").addEventListener("click", () => {
  navigateHomeToScreenWithTransition("previas-jere");
});

document.getElementById("btn-previas-jere-back").addEventListener("click", () => {
  navigateScreenToHomeWithTransition("previas-jere");
});

// Transición animada Home -> Dinero / Registro diario / Envío de datos.
// Nacida como prueba puntual para "money" (v0.26.0/v0.29.0) y luego
// generalizada a "daily" y "export", que comparten la misma estética
// "Bariloche" (`.admin-frost`) que Dinero. El resto de las navegaciones
// hacia/desde estas pantallas (botón "volver", back del navegador,
// bottom nav, etc.) siguen usando navigate(route) sin cambios.
function navigateHomeToScreenWithTransition(route) {
  navigateBetweenScreensWithTransition("home", route);
}

document.getElementById("card-money").addEventListener("click", () => {
  navigateHomeToScreenWithTransition("money");
});

document.getElementById("btn-money-back").addEventListener("click", () => {
  navigateScreenToHomeWithTransition("money");
});

document.getElementById("btn-money-settings").addEventListener("click", () => {
  openSheet("initial");
});

document.getElementById("card-daily").addEventListener("click", () => {
  navigateHomeToScreenWithTransition("daily");
});

document.getElementById("btn-daily-back").addEventListener("click", () => {
  navigateScreenToHomeWithTransition("daily");
});

document.getElementById("card-export").addEventListener("click", () => {
  navigateHomeToScreenWithTransition("export");
});

document.getElementById("btn-export-back").addEventListener("click", () => {
  navigateScreenToHomeWithTransition("export");
});

// Transición animada Dinero / Registro diario / Envío de datos -> Home
// (inversa de `navigateHomeToScreenWithTransition`, mismas clases,
// mismo timing y color). Se dispara desde el botón "volver" de cada
// una de esas 3 pantallas y desde el ícono "home" del bottom nav
// cuando se está parado en alguna de ellas. El resto de los usos de
// `navigate("home")` (logout, back del navegador, etc.) siguen sin
// animar.
function navigateScreenToHomeWithTransition(fromRoute) {
  navigateBetweenScreensWithTransition(fromRoute, "home");
}

bottomNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-btn");
  if (!btn) return;
  const route = btn.dataset.route;

  // Ícono "home" del bottom nav: si estamos parados en Dinero,
  // Registro diario, Envío de datos, Previas de Jere, Admin,
  // Previas (de admin) o Estadísticas, usa la misma transición
  // animada que el botón "volver" de esas pantallas. Para cualquier
  // otro origen o cualquier otro botón del nav, se mantiene el
  // `navigate()` instantáneo de siempre.
  if (route === "home") {
    const activeAnimatedRoute = [
      "money",
      "daily",
      "export",
      "previas-jere",
      "admin",
      "previas",
      "stats",
    ].find((r) => screens[r] && screens[r].classList.contains("active"));
    if (activeAnimatedRoute) {
      navigateScreenToHomeWithTransition(activeAnimatedRoute);
      return;
    }
  }

  // Ícono "admin" del bottom nav: si estamos parados en Home, Previas
  // (de admin) o Estadísticas, usa la misma transición animada que el
  // resto de las navegaciones hacia/dentro de Admin. Desde cualquier
  // otro origen (o si ya estamos en Admin) se mantiene el
  // `navigate()` instantáneo.
  if (route === "admin") {
    const activeAnimatedOrigin = ["home", "previas", "stats"].find(
      (r) => screens[r] && screens[r].classList.contains("active")
    );
    if (activeAnimatedOrigin) {
      navigateBetweenScreensWithTransition(activeAnimatedOrigin, "admin");
      return;
    }
  }

  navigate(route);
});

window.addEventListener("hashchange", () => {
  navigate(routeFromHash());
});

/* -----------------------------------------------------------
   LOGIN / HOME — fondo interactivo con el scroll (solo decorativo)
   -----------------------------------------------------------
   Mueve las capas de fondo compartidas (montañas, glow, nieve,
   título "BARILOCHE") en función del scroll, para dar sensación de
   profundidad. Reutilizado tal cual entre `#screen-select` (login)
   y `#screen-home`, que comparten exactamente el mismo markup de
   fondo (`.login-bg` y sus capas). No toca el contenido de ninguna
   de las dos pantallas, no lee/escribe `localStorage`, no participa
   en la lógica de login/navegación: solo aplica `transform` inline
   sobre elementos puramente decorativos, buscados siempre dentro de
   la pantalla activa (nunca con un `document.querySelector` global,
   para no mezclar las capas de una pantalla con las de la otra
   cuando ambas existen en el DOM).

   Rendimiento: un solo listener de `scroll` (passive) + uno de
   `resize`, throttleados con requestAnimationFrame (patrón
   "ticking flag" para no encolar más de un cálculo por frame); el
   suavizado del movimiento lo hace la `transition: transform` ya
   declarada en CSS para esas capas, así no hace falta interpolar a
   mano en JS. El desplazamiento se calcula solo mientras
   `#screen-select` o `#screen-home` está en pantalla (se corta
   apenas se navega a otra sección) y se limita a un rango acotado
   (`MAX_SCROLL_PX`) para que el efecto no se dispare con scrolls
   largos.

   Fallback: si el navegador no soporta requestAnimationFrame, o si
   la persona tiene activado "reducir movimiento"
   (`prefers-reduced-motion: reduce`), esta función no agrega
   ningún listener y el fondo queda tal cual — el mismo fondo
   blanco/celeste con nieve estático/animado normal, sin parallax.
   ----------------------------------------------------------- */

const LOGIN_PARALLAX_MAX_SCROLL = 480;

function updateLoginParallax() {
  loginParallaxTicking = false;
  const screenEl = document.querySelector("#screen-select.active, #screen-home.active");
  if (!screenEl) return;

  const y = Math.min(window.scrollY || window.pageYOffset || 0, LOGIN_PARALLAX_MAX_SCROLL);
  const mountains = screenEl.querySelector(".login-mountains");
  const glow = screenEl.querySelector(".login-glow");
  const snow = screenEl.querySelector(".login-snowfall");
  const titleBg = screenEl.querySelector(".login-title-bg");

  if (mountains) mountains.style.transform = `translate3d(0, ${(-y * 0.1).toFixed(2)}px, 0)`;
  if (glow) glow.style.transform = `translate3d(0, ${(y * 0.05).toFixed(2)}px, 0) scale(${(1 + y * 0.0004).toFixed(3)})`;
  if (snow) snow.style.transform = `translate3d(0, ${(y * 0.18).toFixed(2)}px, 0)`;
  // El título "BARILOCHE" queda detrás de las montañas (más "lejos"),
  // así que se mueve más despacio que ellas para reforzar la
  // sensación de profundidad entre las dos capas.
  if (titleBg) titleBg.style.transform = `translate3d(0, ${(-y * 0.05).toFixed(2)}px, 0)`;
}

let loginParallaxTicking = false;
function onLoginParallaxScroll() {
  if (loginParallaxTicking) return;
  loginParallaxTicking = true;
  requestAnimationFrame(updateLoginParallax);
}

function initLoginParallax() {
  const reduceMotion =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof window.requestAnimationFrame !== "function") {
    // Fallback: sin parallax, el fondo queda estático (mismo
    // resultado visual que antes de este cambio).
    return;
  }
  window.addEventListener("scroll", onLoginParallaxScroll, { passive: true });
  window.addEventListener("resize", onLoginParallaxScroll, { passive: true });
}

/* -----------------------------------------------------------
   Init
   ----------------------------------------------------------- */

function init() {
  renderParticipantGrid();
  initLoginParallax();

  const user = getCurrentUser();
  if (user) {
    navigate(routeFromHash());
  } else {
    navigate("select");
  }
}

init();
