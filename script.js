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
const DEFAULT_PARTICIPANTS = [
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
const PARTICIPANTS = DEFAULT_PARTICIPANTS.map((participant) => ({ ...participant }));
const ORIGINAL_PARTICIPANT_IDS = new Set(DEFAULT_PARTICIPANTS.map((participant) => participant.id));

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
  apiAccessToken: "apiAccessToken",
  pendingApiOperations: "pendingApiOperations",
  userData: (id) => `userData:${id}`,
  adminPlayers: "adminPlayers",
  adminPrevias: "adminPrevias",
  localPrevias: (id) => `localPrevias:${id}`,
};

const DEFAULT_API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:"
    ? "http://localhost:3000"
    : "https://bariloche-web.onrender.com";
const API_BASE_URL = (window.BARILOCHE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
let apiLoginPromise = null;
let pendingApiSyncPromise = null;
let pendingApiSyncTimer = null;
let adminCreatePlayerOpen = false;
let adminCreatePlayerSubmitting = false;
let adminDeletePlayerTarget = null;
const moneyApiLoadedUsers = new Set();
const dailyApiLoadedKeys = new Set();
const previasApiLoadedKeys = new Set();
const moneyApiLoadingUsers = new Set();
const moneyApiFailedUsers = new Set();
const dailyApiLoadingKeys = new Set();
const dailyApiFailedKeys = new Set();
const previasApiLoadingKeys = new Set();
const previasApiFailedKeys = new Set();
const statsApiFailed = {};
let participantsApiLoading = false;
let sessionExpiredHandled = false;
let dailySaveSubmitting = false;

function renderApiLoadingBanner(message) {
  return `
    <div class="api-loading-banner" role="status">
      <span class="api-loading-dot" aria-hidden="true"></span>
      <span>${message}</span>
    </div>
  `;
}

function showSessionExpiredMessage() {
  let el = document.getElementById("session-expired-message");
  if (!el) {
    el = document.createElement("div");
    el.id = "session-expired-message";
    el.className = "session-message";
    document.body.appendChild(el);
  }
  el.textContent = "Tu sesión venció. Volvé a iniciar sesión.";
  el.classList.add("visible");
}

function hideSessionExpiredMessage() {
  const el = document.getElementById("session-expired-message");
  if (el) el.classList.remove("visible");
}

function resetApiReadFailures() {
  moneyApiFailedUsers.clear();
  dailyApiFailedKeys.clear();
  previasApiFailedKeys.clear();
  Object.keys(statsApiFailed).forEach((key) => delete statsApiFailed[key]);
}

function handleExpiredApiSession() {
  if (sessionExpiredHandled) return;
  if (!localStorage.getItem(STORAGE_KEYS.currentUser)) return;

  sessionExpiredHandled = true;
  localStorage.removeItem(STORAGE_KEYS.apiAccessToken);
  localStorage.removeItem(STORAGE_KEYS.currentUser);
  dailyDateKey = null;
  resetApiReadFailures();
  if (sheetOverlay) sheetOverlay.classList.remove("visible");
  currentSheetType = null;
  navigate("select");
  showSessionExpiredMessage();
}

async function apiFetch(path, options = {}) {
  const { skipSessionExpiredHandling = false, ...fetchOptions } = options;
  if (path !== "/auth/login" && !localStorage.getItem(STORAGE_KEYS.apiAccessToken) && apiLoginPromise) {
    try {
      await apiLoginPromise;
    } catch (e) {
      // Si el login API falla, la llamada protegida seguirá sin token y caerá en el fallback existente.
    }
  }

  const accessToken = localStorage.getItem(STORAGE_KEYS.apiAccessToken);
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });
  if (!skipSessionExpiredHandling && path !== "/auth/login" && accessToken && response.status === 401) {
    handleExpiredApiSession();
  }
  return response;
}

function getPendingApiOperations() {
  const raw = localStorage.getItem(STORAGE_KEYS.pendingApiOperations);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((op) => op && typeof op.id === "string") : [];
  } catch (e) {
    return [];
  }
}

function savePendingApiOperations(operations) {
  if (!operations.length) {
    localStorage.removeItem(STORAGE_KEYS.pendingApiOperations);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.pendingApiOperations, JSON.stringify(operations));
}

function enqueuePendingApiOperation(operation) {
  const operations = getPendingApiOperations();
  const existingIndex = operations.findIndex((op) => op.id === operation.id);
  const now = new Date().toISOString();
  const nextOperation = {
    ...operation,
    createdAt: operation.createdAt || now,
    attempts: operation.attempts || 0,
  };

  if (existingIndex >= 0) {
    operations[existingIndex] = {
      ...operations[existingIndex],
      ...nextOperation,
      createdAt: operations[existingIndex].createdAt || nextOperation.createdAt,
      attempts: operations[existingIndex].attempts || 0,
    };
  } else {
    operations.push(nextOperation);
  }
  savePendingApiOperations(operations);
}

function removePendingApiOperation(operationId) {
  savePendingApiOperations(getPendingApiOperations().filter((op) => op.id !== operationId));
}

function markPendingApiAttempt(operationId) {
  const operations = getPendingApiOperations();
  const operation = operations.find((op) => op.id === operationId);
  if (!operation) return;
  operation.attempts = (operation.attempts || 0) + 1;
  operation.lastAttemptAt = new Date().toISOString();
  savePendingApiOperations(operations);
}

function isRetryableApiResponse(response) {
  return response.status === 408 || response.status === 429 || response.status >= 500;
}

function isRetryableApiError(error) {
  return error instanceof TypeError || (error && (error.name === "TypeError" || error.name === "AbortError"));
}

function isApiOperationSuccess(response, successStatuses) {
  return response.ok || successStatuses.includes(response.status);
}

async function tryApiOperation(operation, successStatuses = []) {
  try {
    const response = await apiFetch(operation.path, {
      method: operation.method,
      body: operation.payload === undefined ? undefined : JSON.stringify(operation.payload),
    });

    if (isApiOperationSuccess(response, successStatuses)) {
      return { status: "synced", response };
    }
    if (response.status === 401) return { status: "auth", response };
    if (isRetryableApiResponse(response)) return { status: "retry", response };
    return { status: "terminal", response };
  } catch (error) {
    if (isRetryableApiError(error)) return { status: "retry", error };
    return { status: "terminal", error };
  }
}

function schedulePendingApiSync(delayMs = 0) {
  if (pendingApiSyncTimer) {
    if (delayMs > 0) return;
    clearTimeout(pendingApiSyncTimer);
    pendingApiSyncTimer = null;
  }
  pendingApiSyncTimer = setTimeout(() => {
    pendingApiSyncTimer = null;
    processPendingApiOperations();
  }, delayMs);
}

async function processPendingApiOperations() {
  if (pendingApiSyncPromise) return pendingApiSyncPromise;
  if (!localStorage.getItem(STORAGE_KEYS.apiAccessToken)) return;

  pendingApiSyncPromise = (async () => {
    const operations = getPendingApiOperations();
    for (const operation of operations) {
      if (!getPendingApiOperations().some((op) => op.id === operation.id)) continue;
      markPendingApiAttempt(operation.id);
      const result = await tryApiOperation(operation, operation.successStatuses || []);
      if (result.status === "synced") {
        await applySyncedApiOperation(operation, result.response);
        removePendingApiOperation(operation.id);
      } else if (result.status === "auth") {
        break;
      } else if (result.status === "terminal") {
        removePendingApiOperation(operation.id);
        console.warn("[apiQueue] Operación descartada por error funcional:", operation.type || operation.id);
      }
    }
  })();

  try {
    await pendingApiSyncPromise;
  } finally {
    pendingApiSyncPromise = null;
  }
}

async function applySyncedApiOperation(operation, response) {
  if (operation.type !== "money_movement_create" || !operation.localUserId || !response) return;

  try {
    const payload = await response.clone().json();
    const data = ensureMoneyData(operation.localUserId);
    const localMovement = findMovement(data.money, operation.payload && operation.payload.legacyId);
    if (!localMovement) return;

    localMovement.apiSynced = true;
    localMovement.apiId = payload.movement && payload.movement.id;
    saveUserData(operation.localUserId, data);
  } catch (e) {
    // La operación ya fue aceptada por la API; si no se puede leer el JSON, no se reintenta.
  }
}

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

function participantFromApiUser(user) {
  return {
    id: user.legacyId,
    apiId: user.id,
    name: user.displayName,
    isAdmin: user.role === "admin",
    canRegisterPrevias: Array.isArray(user.permissions) && user.permissions.includes("create_previa"),
  };
}

function replaceParticipantsFromApi(users) {
  const localById = new Map(PARTICIPANTS.map((participant) => [participant.id, participant]));
  const apiParticipants = users.map((user) => {
    const participant = participantFromApiUser(user);
    const local = localById.get(participant.id);
    return local && local.password ? { ...participant, password: local.password } : participant;
  });
  PARTICIPANTS.splice(0, PARTICIPANTS.length, ...apiParticipants);
}

async function refreshParticipantsFromApi() {
  if (participantsApiLoading) return false;
  participantsApiLoading = true;
  if (screens.admin && screens.admin.classList.contains("active")) renderAdmin();
  try {
    const response = await apiFetch("/auth/users");
    if (!response.ok) return false;

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.users)) return false;

    replaceParticipantsFromApi(payload.users);
    renderParticipantGrid();
    if (screens.admin && screens.admin.classList.contains("active")) renderAdmin();
    if (screens.daily && screens.daily.classList.contains("active")) renderDailyScreen();
    if ((screens.previas && screens.previas.classList.contains("active")) || (screens["previas-jere"] && screens["previas-jere"].classList.contains("active"))) {
      renderPreviasScreen();
    }
    return true;
  } catch (e) {
    return false;
  } finally {
    participantsApiLoading = false;
    if (screens.admin && screens.admin.classList.contains("active")) renderAdmin();
  }
}

/* -----------------------------------------------------------
   Sesión
   ----------------------------------------------------------- */

function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.currentUser);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Preferimos la versión más fresca del participante si ya vino de API.
    const stillExists = PARTICIPANTS.find((p) => p.id === parsed.id);
    return stillExists || parsed;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(participant) {
  sessionExpiredHandled = false;
  hideSessionExpiredMessage();
  resetApiReadFailures();
  // Guardamos solo lo necesario para identificar la sesión; nunca la
  // contraseña, ni siquiera la del participante (no solo la ingresada).
  localStorage.removeItem(STORAGE_KEYS.apiAccessToken);
  const sessionData = { id: participant.id, name: participant.name, isAdmin: !!participant.isAdmin };
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(sessionData));
  ensureUserData(participant.id);
}

function clearCurrentUser() {
  // Elimina ÚNICAMENTE la sesión. Nunca localStorage.clear().
  sessionExpiredHandled = false;
  hideSessionExpiredMessage();
  localStorage.removeItem(STORAGE_KEYS.currentUser);
  localStorage.removeItem(STORAGE_KEYS.apiAccessToken);
  dailyDateKey = null; // fuerza recargar el registro diario del próximo usuario
}

async function loginApiInBackground(username, password) {
  const loginPromise = (async () => {
    const data = await loginApi(username, password);
    if (data) {
      schedulePendingApiSync();
    }
  })();

  apiLoginPromise = loginPromise;
  try {
    await loginPromise;
  } catch (e) {
    // La sesión local sigue siendo la fuente de continuidad del frontend actual.
  } finally {
    if (apiLoginPromise === loginPromise) apiLoginPromise = null;
  }
}

async function loginApi(username, password) {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) return null;

  const data = await response.json();
  if (typeof data.accessToken === "string" && data.accessToken) {
    localStorage.setItem(STORAGE_KEYS.apiAccessToken, data.accessToken);
  }
  return data;
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

async function checkLoginPassword() {
  const input = document.getElementById("input-login-password");
  if (!input || !loginParticipant) return;
  const enteredRaw = input.value.trim();
  const entered = enteredRaw.toLowerCase();

  if (enteredRaw.length === 0) {
    input.classList.add("error");
    showSheetError("Ingresá tu contraseña.");
    return;
  }

  if (typeof loginParticipant.password === "string" && entered !== loginParticipant.password.toLowerCase()) {
    input.classList.add("error");
    input.value = "";
    input.focus();
    showSheetError("Contraseña incorrecta. Intentá de nuevo.");
    const dots = document.getElementById("login-password-dots");
    if (dots) dots.innerHTML = "";
    return;
  }

  let participant = loginParticipant;
  let apiLoginData = null;
  if (typeof participant.password !== "string") {
    apiLoginData = await loginApi(participant.id, enteredRaw);
    if (!apiLoginData || !apiLoginData.user) {
      input.classList.add("error");
      input.value = "";
      input.focus();
      showSheetError("Contraseña incorrecta. Intentá de nuevo.");
      return;
    }
    participant = participantFromApiUser(apiLoginData.user);
    const index = PARTICIPANTS.findIndex((p) => p.id === participant.id);
    if (index >= 0) PARTICIPANTS[index] = participant;
    else PARTICIPANTS.push(participant);
    renderParticipantGrid();
  }

  loginParticipant = null;
  currentSheetType = null;
  sheetOverlay.classList.remove("visible");
  setCurrentUser(participant);
  if (typeof participant.password === "string") {
    loginApiInBackground(participant.id, entered);
  } else {
    if (apiLoginData && typeof apiLoginData.accessToken === "string" && apiLoginData.accessToken) {
      localStorage.setItem(STORAGE_KEYS.apiAccessToken, apiLoginData.accessToken);
    }
    schedulePendingApiSync();
  }
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
  "Dale nene que hoy la rompes",
  "Hermosa mañana, verdad?",
  "A ver esa nave pipirispela",
  "Agarrá un destornillador y metetelo en el culo",
  "Turip ip ip",
  "¿Qué es un PLC?",
  "Hoy minimo dos gordas e",
  "¡Guarda con simon cuando duermas!",
  "Si te sentís mal, acordate que peor es ser hincha de racing",
  "Recordá: por más que empujes, si la pija es corta..",
  "Eres muy lindo pequeño",
  "Pedazo de putita",
  "Trolita barata",
  "Te la saco?",
  "Chupaverga",
  "Judío",
  "¿Ya quebraste pequeño?",
  "El baño está ocupado (nata 🥛)",
  "Recuerda: No importa de donde tomes mientras tengas sed.",
  "Miranda pregunta si sobró una egresada.",
  "¿Estas masivo bro?",
  "Cambiate la tanga",
  "Usá forro (como si fueras a garchar 😔)",
  "Para qué trajiste los forros???",
  "Bañate porfa",
  "Los datos serán enviados a Sperman."
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
    if (greetQuestion.textContent == "Turip ip ip") {
      const turip = new Audio('ip.mp3');
      turip.volume = 0.02;
      turip.play()
    }
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
  const panel = document.getElementById("admin-create-player-panel");
  const showCreateBtn = document.getElementById("btn-admin-show-create-player");

  if (panel) panel.hidden = !adminCreatePlayerOpen;
  if (showCreateBtn) showCreateBtn.hidden = adminCreatePlayerOpen;
  if (participantsApiLoading) {
    list.insertAdjacentHTML("beforeend", renderApiLoadingBanner("Actualizando jugadores..."));
  }

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

    if (!ORIGINAL_PARTICIPANT_IDS.has(p.id)) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "admin-player-delete-btn";
      deleteBtn.setAttribute("aria-label", `Eliminar a ${p.name}`);
      deleteBtn.dataset.playerId = p.id;
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/>
          <path d="M8 6V4h8v2"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v5"/>
          <path d="M14 11v5"/>
        </svg>
      `;
      deleteBtn.addEventListener("click", () => openAdminDeletePlayerConfirm(p));
      row.appendChild(deleteBtn);
    }

    list.appendChild(row);
  });
}

function hasPendingApiOperation(operationId) {
  return getPendingApiOperations().some((op) => op.id === operationId);
}

function hasPendingApiOperationPrefix(prefix) {
  return getPendingApiOperations().some((op) => op.id.startsWith(prefix));
}

function setAdminCreatePlayerPanel(open) {
  adminCreatePlayerOpen = open;
  const panel = document.getElementById("admin-create-player-panel");
  const showCreateBtn = document.getElementById("btn-admin-show-create-player");
  const error = document.getElementById("admin-create-player-error");
  if (panel) panel.hidden = !open;
  if (showCreateBtn) showCreateBtn.hidden = open;
  if (error) error.textContent = "";
  if (!open) {
    const nameInput = document.getElementById("admin-new-player-name");
    const passwordInput = document.getElementById("admin-new-player-password");
    if (nameInput) nameInput.value = "";
    if (passwordInput) passwordInput.value = "";
  }
}

async function handleAdminCreatePlayerClick() {
  if (adminCreatePlayerSubmitting) return;
  const nameInput = document.getElementById("admin-new-player-name");
  const passwordInput = document.getElementById("admin-new-player-password");
  const submitBtn = document.getElementById("btn-admin-create-player");
  const msg = document.getElementById("admin-player-list-msg");
  const error = document.getElementById("admin-create-player-error");
  if (!nameInput || !passwordInput) return;

  const name = nameInput.value.trim();
  const password = passwordInput.value;
  if (msg) {
    msg.textContent = "";
    msg.classList.remove("visible");
  }
  if (error) error.textContent = "";

  if (!name) {
    if (error) error.textContent = "Ingresá un nombre.";
    nameInput.focus();
    return;
  }
  if (!password.trim()) {
    if (error) error.textContent = "Ingresá una contraseña.";
    passwordInput.focus();
    return;
  }

  adminCreatePlayerSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Agregando...";
  }

  try {
    const response = await apiFetch("/admin/users", {
      method: "POST",
      body: JSON.stringify({ name, password }),
    });

    if (response.status === 401 || response.status === 403) {
      if (error) error.textContent = "No tenés permiso para crear jugadores.";
      return;
    }
    if (response.status === 400) {
      const payload = await response.json().catch(() => null);
      if (error) error.textContent = payload && payload.error === "user_already_exists" ? "Ese jugador ya existe." : "Revisá nombre y contraseña.";
      return;
    }
    if (!response.ok) {
      if (error) error.textContent = "No se pudo crear el jugador.";
      return;
    }

    const payload = await response.json();
    if (payload && payload.user) {
      const created = participantFromApiUser(payload.user);
      if (!PARTICIPANTS.some((participant) => participant.id === created.id)) {
        PARTICIPANTS.push(created);
      }
    }
    setAdminCreatePlayerPanel(false);
    renderParticipantGrid();
    renderAdmin();
    if (msg) {
      msg.textContent = "✓ Jugador agregado";
      msg.classList.add("visible");
      setTimeout(() => msg.classList.remove("visible"), 2000);
    }
    refreshParticipantsFromApi();
  } catch (e) {
    if (error) error.textContent = "No se pudo crear el jugador. Si no hay señal, probá de nuevo después.";
  } finally {
    adminCreatePlayerSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Agregar";
    }
  }
}

async function handleAdminDeletePlayerConfirm() {
  const participant = adminDeletePlayerTarget;
  const submitBtn = document.getElementById("sheet-submit-btn");
  if (!participant || ORIGINAL_PARTICIPANT_IDS.has(participant.id)) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Eliminando...";
  }

  try {
    const response = await apiFetch(`/admin/users/${encodeURIComponent(participant.id)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      showSheetError(response.status === 400 ? "Este jugador no se puede eliminar." : "No se pudo eliminar el jugador.");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Eliminar";
      }
      return;
    }

    const index = PARTICIPANTS.findIndex((p) => p.id === participant.id);
    if (index >= 0) PARTICIPANTS.splice(index, 1);
    adminDeletePlayerTarget = null;
    closeSheet();
    renderParticipantGrid();
    renderAdmin();
    const msg = document.getElementById("admin-player-list-msg");
    if (msg) {
      msg.textContent = "✓ Jugador eliminado";
      msg.classList.add("visible");
      setTimeout(() => msg.classList.remove("visible"), 2000);
    }
  } catch (e) {
    showSheetError("No se pudo eliminar el jugador. Probá de nuevo después.");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Eliminar";
    }
  }
}

function handleAdminResetDataClick() {
  const error = document.getElementById("admin-reset-data-error");
  const msg = document.getElementById("admin-reset-data-msg");
  if (error) error.textContent = "";
  if (msg) {
    msg.textContent = "";
    msg.classList.remove("visible");
  }
  openSheet("admin-reset-data-confirm");
}

async function handleAdminResetDataConfirm() {
  if (adminResetSubmitting) return;
  const input = document.getElementById("input-admin-reset-password");
  const submitBtn = document.getElementById("sheet-submit-btn");
  const password = input ? input.value : "";

  if (!password) {
    if (input) input.classList.add("error");
    showSheetError("Ingresá la contraseña.");
    return;
  }

  adminResetSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Eliminando...";
  }

  try {
    const response = await apiFetch("/admin/dev/reset-data", {
      method: "DELETE",
      body: JSON.stringify({ password }),
      skipSessionExpiredHandling: true,
    });

    if (response.status === 401 || response.status === 403) {
      showSheetError("Contraseña incorrecta o permiso insuficiente.");
      return;
    }

    if (!response.ok) {
      showSheetError("No se pudieron eliminar los datos de prueba.");
      return;
    }

    clearStatsApiCache();
    closeSheet();
    const error = document.getElementById("admin-reset-data-error");
    const msg = document.getElementById("admin-reset-data-msg");
    if (error) error.textContent = "";
    if (msg) {
      msg.textContent = "✓ Datos de prueba eliminados";
      msg.classList.add("visible");
      setTimeout(() => msg.classList.remove("visible"), 2500);
    }
    if (screens.stats && screens.stats.classList.contains("active")) {
      renderStatsScreen();
    }
  } catch (e) {
    showSheetError("No se pudieron eliminar los datos de prueba.");
  } finally {
    adminResetSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Eliminar datos";
    }
  }
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
let previaSaveSubmitting = false;
let previaSaveMessage = "";

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

function previaApiPayload(previa) {
  return {
    id: previa.id,
    participantIds: previa.participantIds,
    products: previa.products.map((product) => ({
      id: product.id,
      name: product.name,
      price: Math.round(product.price),
      quantity: product.quantity,
    })),
    total: Math.round(previa.total),
    amountPerPerson: Math.round(previa.amountPerPerson),
    createdAt: previa.createdAt,
  };
}

function previaFromApi(previa) {
  return {
    id: previa.legacyId || previa.id,
    apiId: previa.id,
    participantIds: previa.participantIds || [],
    products: (previa.products || []).map((product) => ({
      id: product.legacyId || product.id,
      apiId: product.id,
      name: product.name,
      price: product.unitPrice,
      quantity: product.quantity,
    })),
    total: previa.totalAmount,
    amountPerPerson: previa.amountPerParticipant,
    createdAt: previa.occurredAt,
    apiSynced: true,
  };
}

function mergePreviasCache(storageKey, apiPrevias) {
  const pendingIds = new Set(
    getPendingApiOperations()
      .filter((op) => op.type === "previa_create" && op.payload && op.payload.id)
      .map((op) => op.payload.id)
  );
  let localPrevias = [];
  try {
    localPrevias = JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch (e) {
    localPrevias = [];
  }
  const localPending = Array.isArray(localPrevias)
    ? localPrevias.filter((previa) => !previa.apiSynced || pendingIds.has(previa.id))
    : [];
  const mergedById = new Map();

  (apiPrevias || []).map(previaFromApi).forEach((previa) => mergedById.set(previa.id, previa));
  localPending.forEach((previa) => mergedById.set(previa.id, previa));

  localStorage.setItem(
    storageKey,
    JSON.stringify(Array.from(mergedById.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  );
}

async function loadPreviasFromApi() {
  const user = getCurrentUser();
  if (!user) return;
  const cacheKey = previaMode === "local" ? STORAGE_KEYS.localPrevias(user.id) : STORAGE_KEYS.adminPrevias;
  const loadedKey = `${user.id}:${previaMode}`;
  if (previasApiLoadedKeys.has(loadedKey)) return;
  if (previasApiLoadingKeys.has(loadedKey) || previasApiFailedKeys.has(loadedKey)) return;
  if (hasPendingApiOperationPrefix("previa:create:")) return;

  previasApiLoadedKeys.add(loadedKey);
  previasApiLoadingKeys.add(loadedKey);
  try {
    const response = await apiFetch("/previas");
    if (!response.ok) {
      previasApiLoadedKeys.delete(loadedKey);
      previasApiFailedKeys.add(loadedKey);
      return;
    }

    const payload = await response.json();
    mergePreviasCache(cacheKey, payload.previas || []);
  } catch (e) {
    previasApiLoadedKeys.delete(loadedKey);
    previasApiFailedKeys.add(loadedKey);
  } finally {
    previasApiLoadingKeys.delete(loadedKey);
    if ((screens.previas && screens.previas.classList.contains("active")) || (screens["previas-jere"] && screens["previas-jere"].classList.contains("active"))) {
      renderPreviasScreen();
    }
  }
}

function previaCreateOperation(previa) {
  return {
    id: `previa:create:${previa.id}`,
    type: "previa_create",
    method: "POST",
    path: "/previas",
    payload: previaApiPayload(previa),
    successStatuses: [409],
  };
}

async function syncPreviaToApi(previa) {
  const operation = previaCreateOperation(previa);
  const result = await tryApiOperation(operation, operation.successStatuses);
  if (result.status === "synced") {
    removePendingApiOperation(operation.id);
    await markPreviaSynced(previa, result.response);
    schedulePendingApiSync(500);
  } else if (result.status === "retry") {
    enqueuePendingApiOperation(operation);
  }
}

async function markPreviaSynced(previa, response) {
  let syncedPrevia = { ...previa, apiSynced: true };

  if (response && response.status !== 409) {
    try {
      const payload = await response.clone().json();
      if (payload && payload.previa) syncedPrevia = previaFromApi(payload.previa);
    } catch (e) {
      // La previa ya fue aceptada por la API; si no se puede leer el body,
      // alcanza con marcar el registro local como sincronizado.
    }
  }

  const storageKeys = [STORAGE_KEYS.adminPrevias];
  const user = getCurrentUser();
  if (user) storageKeys.push(STORAGE_KEYS.localPrevias(user.id));

  storageKeys.forEach((storageKey) => {
    let previas = [];
    try {
      previas = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch (e) {
      previas = [];
    }
    if (!Array.isArray(previas)) return;

    const index = previas.findIndex((item) => item.id === previa.id);
    if (index === -1) return;
    previas[index] = syncedPrevia;
    localStorage.setItem(storageKey, JSON.stringify(previas));
  });
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
  loadPreviasFromApi();
  const user = getCurrentUser();
  const previasLoadingKey = user ? `${user.id}:${previaMode}` : "";
  const previasLoading = !!previasLoadingKey && previasApiLoadingKeys.has(previasLoadingKey);

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
    ${previasLoading ? renderApiLoadingBanner("Cargando previas compartidas...") : ""}
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
    <p class="daily-save-msg${previaSaveMessage ? " visible" : ""}" id="${ids.error}-saved">${previaSaveMessage}</p>
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
  previaSaveMessage = "";
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
  if (previaSaveSubmitting) return;
  previaSaveSubmitting = true;
  const submitBtn = document.getElementById("sheet-submit-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando...";
  }

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
  previaSaveMessage = "✓ Previa guardada";
  syncPreviaToApi(newPrevia);

  previaParticipantIds = [];
  previaProducts = [];

  sheetOverlay.classList.remove("visible");
  currentSheetType = null;
  renderPreviasScreen();
  if (previaSaveMessage) {
    setTimeout(() => {
      previaSaveMessage = "";
      if ((screens.previas && screens.previas.classList.contains("active")) || (screens["previas-jere"] && screens["previas-jere"].classList.contains("active"))) {
        renderPreviasScreen();
      }
    }, 2200);
  }

  if (previaMode === "local") {
    // Mostramos de una el código para que Jere se lo pueda mandar a
    // Gio sin tener que buscarlo en el historial.
    openPreviaCodeSheet(newPrevia);
  }
  previaSaveSubmitting = false;
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

function moneyMovementDateKey(movement) {
  return isoToTripDayKey(movement.date);
}

function moneyMovementApiPayload(movement) {
  return {
    legacyId: movement.id,
    type: movement.type,
    amount: Math.round(movement.amount),
    category: movement.type === "expense" ? movement.category || "Otros" : null,
    description: movement.name || null,
    movementDate: moneyMovementDateKey(movement),
  };
}

function localDateForTripDay(dateKey) {
  return typeof dateKey === "string" ? tdTripDayKeyToIso(dateKey) : new Date().toISOString();
}

function moneyMovementFromApi(movement) {
  return {
    id: movement.legacyId || movement.id,
    apiId: movement.id,
    apiSynced: true,
    type: movement.type,
    name: movement.description || (movement.type === "income" ? "Ganancia" : "Sin Descrip."),
    category: movement.type === "expense" ? movement.category || "Otros" : undefined,
    amount: movement.amount,
    date: localDateForTripDay(movement.movementDate),
  };
}

function mergeMoneyFromApi(userId, apiMoney) {
  const data = ensureMoneyData(userId);
  const pendingIds = new Set(
    getPendingApiOperations()
      .filter((op) => op.type && op.type.startsWith("money_movement_") && op.payload && op.payload.legacyId)
      .map((op) => op.payload.legacyId)
  );
  const localPending = data.money.movements.filter((movement) => !movement.apiSynced || pendingIds.has(movement.id));
  const apiMovements = Array.isArray(apiMoney.movements) ? apiMoney.movements.map(moneyMovementFromApi) : [];
  const mergedById = new Map();

  apiMovements.forEach((movement) => mergedById.set(movement.id, movement));
  localPending.forEach((movement) => mergedById.set(movement.id, movement));

  data.money = {
    initialBalance: apiMoney.initialBalance ?? data.money.initialBalance,
    movements: Array.from(mergedById.values()).sort((a, b) => new Date(b.date) - new Date(a.date)),
  };
  saveUserData(userId, data);
}

async function loadMoneyFromApi(userId) {
  if (moneyApiLoadedUsers.has(userId)) return;
  if (moneyApiLoadingUsers.has(userId) || moneyApiFailedUsers.has(userId)) return;
  if (hasPendingApiOperationPrefix("money:")) return;

  moneyApiLoadedUsers.add(userId);
  moneyApiLoadingUsers.add(userId);
  try {
    const response = await apiFetch("/money");
    if (!response.ok) {
      moneyApiLoadedUsers.delete(userId);
      moneyApiFailedUsers.add(userId);
      return;
    }
    const apiMoney = await response.json();
    mergeMoneyFromApi(userId, apiMoney);
  } catch (e) {
    moneyApiLoadedUsers.delete(userId);
    moneyApiFailedUsers.add(userId);
  } finally {
    moneyApiLoadingUsers.delete(userId);
    if (screens.money && screens.money.classList.contains("active")) renderMoneyScreen();
  }
}

function moneyMovementCreateOperation(userId, movement) {
  return {
    id: `money:create:${movement.id}`,
    type: "money_movement_create",
    localUserId: userId,
    method: "POST",
    path: "/money/movements",
    payload: moneyMovementApiPayload(movement),
  };
}

function moneyMovementPatchOperation(movement) {
  return {
    id: `money:patch:${movement.id}`,
    type: "money_movement_patch",
    method: "PATCH",
    path: `/money/movements/${encodeURIComponent(movement.id)}`,
    payload: moneyMovementApiPayload(movement),
  };
}

function moneyMovementDeleteOperation(movement) {
  return {
    id: `money:delete:${movement.id}`,
    type: "money_movement_delete",
    method: "DELETE",
    path: `/money/movements/${encodeURIComponent(movement.id)}`,
  };
}

async function syncInitialBalanceToApi(amount) {
  try {
    await apiFetch("/money/initial-balance", {
      method: "PUT",
      body: JSON.stringify({ amount: Math.round(amount) }),
    });
  } catch (e) {
    // El saldo local ya quedó guardado; un fallo de API no cambia el flujo actual.
  }
}

async function syncCreatedMoneyMovementToApi(userId, movement) {
  if (movement.type === "expense" && !EXPENSE_CATEGORIES.includes(movement.category)) return;

  const operation = moneyMovementCreateOperation(userId, movement);
  const result = await tryApiOperation(operation);
  if (result.status === "retry") {
    enqueuePendingApiOperation(operation);
    return;
  }
  if (result.status !== "synced") return;

  removePendingApiOperation(operation.id);
  try {
    const payload = await result.response.json();
    const data = ensureMoneyData(userId);
    const localMovement = findMovement(data.money, movement.id);
    if (!localMovement) return;

    localMovement.apiSynced = true;
    localMovement.apiId = payload.movement && payload.movement.id;
    saveUserData(userId, data);
    schedulePendingApiSync(500);
  } catch (e) {
    // Si la respuesta no puede parsearse, el movimiento ya quedó sincronizado del lado de la API.
  }
}

async function syncUpdatedMoneyMovementToApi(movement) {
  if (!movement) return;
  if (movement.type === "expense" && !EXPENSE_CATEGORIES.includes(movement.category)) return;

  if (!movement.apiSynced) {
    const user = getCurrentUser();
    const pendingCreateId = `money:create:${movement.id}`;
    if (user && getPendingApiOperations().some((op) => op.id === pendingCreateId)) {
      enqueuePendingApiOperation(moneyMovementCreateOperation(user.id, movement));
    }
    return;
  }

  const operation = moneyMovementPatchOperation(movement);
  const result = await tryApiOperation(operation);
  if (result.status === "synced") {
    removePendingApiOperation(operation.id);
    schedulePendingApiSync(500);
  } else if (result.status === "retry") {
    enqueuePendingApiOperation(operation);
  }
}

async function syncDeletedMoneyMovementToApi(movement) {
  if (!movement) return;
  removePendingApiOperation(`money:create:${movement.id}`);
  removePendingApiOperation(`money:patch:${movement.id}`);
  if (!movement.apiSynced) return;

  const operation = moneyMovementDeleteOperation(movement);
  const result = await tryApiOperation(operation);
  if (result.status === "synced" || result.status === "terminal") {
    removePendingApiOperation(operation.id);
    if (result.status === "synced") schedulePendingApiSync(500);
  } else if (result.status === "retry") {
    enqueuePendingApiOperation(operation);
  }
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
  loadMoneyFromApi(user.id);
  const moneyLoading = moneyApiLoadingUsers.has(user.id);

  if (money.initialBalance === null) {
    moneyMain.innerHTML = `
      ${moneyLoading ? renderApiLoadingBanner("Cargando tu dinero...") : ""}
      <div class="money-prompt">
        <div class="prompt-icon">🧳</div>
        <h3>¿Cuánto llevás al viaje?</h3>
        <p>Contanos tu saldo inicial para poder llevar la cuenta de tus gastos y ganancias.</p>
      </div>
    `;
    if (!moneyLoading) openSheet("initial");
    return;
  }

  const { totalExpense, totalIncome, available, initial } = computeMoneyTotals(money);
  const donutTotal = initial + totalIncome;
  const availablePct = donutTotal > 0 ? Math.max(0, Math.min(100, (available / donutTotal) * 100)) : 0;
  const DONUT_R = 40;
  const DONUT_CIRC = 2 * Math.PI * DONUT_R;

  moneyMain.innerHTML = `
    ${moneyLoading ? renderApiLoadingBanner("Cargando tu dinero...") : ""}
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
let backupImportStep = null; // "paste" | "preview"
let backupImportPendingPayload = null; // payload de backup completo, ya validado, pendiente de confirmar
let adminResetSubmitting = false;

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

function openAdminDeletePlayerConfirm(participant) {
  adminDeletePlayerTarget = participant;
  openSheet("admin-delete-player-confirm");
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

  if (type === "admin-delete-player-confirm") {
    const participant = adminDeletePlayerTarget;
    if (!participant) {
      closeSheet();
      return;
    }
    sheetContent.innerHTML = `
      <h2 class="sheet-title">¿Eliminar a ${escapeHtml(participant.name)}?</h2>
      <p class="sheet-sub">Esta acción eliminará este jugador de la app. Sus datos históricos no se borran.</p>
      <p class="sheet-error" id="sheet-error"></p>
      <button class="sheet-submit danger" id="sheet-submit-btn" type="button">Eliminar</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", handleAdminDeletePlayerConfirm);
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    sheetOverlay.classList.add("visible");
    return;
  }

  if (type === "admin-reset-data-confirm") {
    sheetContent.innerHTML = `
      <h2 class="sheet-title">Eliminar datos de prueba</h2>
      <p class="sheet-sub">Esto elimina movimientos, registros diarios, votos y previas sincronizadas. No elimina usuarios, roles, permisos, preguntas ni saldos iniciales.</p>
      <div class="field">
        <label class="field-label" for="input-admin-reset-password">Contraseña de reset</label>
        <input id="input-admin-reset-password" class="field-input" type="password" autocomplete="off">
      </div>
      <p class="sheet-error" id="sheet-error"></p>
      <button class="sheet-submit danger" id="sheet-submit-btn" type="button">Eliminar datos</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", handleAdminResetDataConfirm);
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    const input = document.getElementById("input-admin-reset-password");
    input.addEventListener("input", () => input.classList.remove("error"));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAdminResetDataConfirm();
    });
    sheetOverlay.classList.add("visible");
    input.focus();
    return;
  }

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

  if (type === "backup-import") {
    renderBackupImportSheet();
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
  backupImportStep = null;
  backupImportPendingPayload = null;
  adminDeletePlayerTarget = null;
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
    syncInitialBalanceToApi(value);
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
    let movementToSync = null;
    if (editingMovementId) {
      const existing = findMovement(data.money, editingMovementId);
      if (existing) {
        existing.name = name;
        existing.category = category;
        existing.amount = amount;
        movementToSync = existing;
      }
    } else {
      movementToSync = {
        id: genId(),
        type: "expense",
        name,
        category,
        amount,
        date: new Date().toISOString(),
      };
      data.money.movements.unshift(movementToSync);
    }
    saveUserData(user.id, data);
    if (editingMovementId) {
      syncUpdatedMoneyMovementToApi(movementToSync);
    } else {
      syncCreatedMoneyMovementToApi(user.id, movementToSync);
    }
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
    let movementToSync = null;
    if (editingMovementId) {
      const existing = findMovement(data.money, editingMovementId);
      if (existing) {
        existing.name = name;
        existing.amount = amount;
        movementToSync = existing;
      }
    } else {
      movementToSync = {
        id: genId(),
        type: "income",
        name,
        amount,
        date: new Date().toISOString(),
      };
      data.money.movements.unshift(movementToSync);
    }
    saveUserData(user.id, data);
    if (editingMovementId) {
      syncUpdatedMoneyMovementToApi(movementToSync);
    } else {
      syncCreatedMoneyMovementToApi(user.id, movementToSync);
    }
    sheetOverlay.classList.remove("visible");
    currentSheetType = null;
    editingMovementId = null;
    activeMovementId = null;
    renderMoneyScreen();
    return;
  }

  if (currentSheetType === "delete-confirm") {
    const deletedMovement = findMovement(data.money, activeMovementId);
    data.money.movements = data.money.movements.filter((m) => m.id !== activeMovementId);
    saveUserData(user.id, data);
    syncDeletedMoneyMovementToApi(deletedMovement);
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
  if (typeof dateKey !== "string") return "";
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
    destroyedVote: null, // id de PARTICIPANTS | null — encuesta "¿Quién estuvo más destruido anoche?"
  };
}

let dailyState = defaultDailyEntry();
let dailyDateKey = null;

const dailyMain = document.getElementById("daily-main");

function dailyEntryApiPayload(entry) {
  return {
    sleep: {
      didNotSleep: !!entry.sleep.didNotSleep,
      bedtime: entry.sleep.bedtime || null,
      wake: entry.sleep.wake || null,
    },
    nap: entry.nap ? { start: entry.nap.start, end: entry.nap.end } : null,
    fifthMeal: entry.fifthMeal ?? null,
    bathroom: entry.bathroom ?? null,
    boliche: {
      didNotGo: !!entry.boliche.didNotGo,
      time: entry.boliche.time || null,
    },
  };
}

function dailyEntryOperation(dateKey, entry) {
  return {
    id: `daily-entry:put:${dateKey}`,
    type: "daily_entry_put",
    method: "PUT",
    path: `/daily-entries/${encodeURIComponent(dateKey)}`,
    payload: dailyEntryApiPayload(entry),
  };
}

function destroyedVoteOperation(dateKey, votedUserId) {
  return {
    id: `survey-vote:destroyed_vote:${dateKey}`,
    type: "destroyed_vote_put",
    method: "PUT",
    path: `/surveys/destroyed_vote/${encodeURIComponent(dateKey)}/vote`,
    payload: { votedUserId },
  };
}

async function syncDailyEntryToApi(dateKey, entry) {
  const entryOperation = dailyEntryOperation(dateKey, entry);
  const entryResult = await tryApiOperation(entryOperation);
  if (entryResult.status === "synced") {
    removePendingApiOperation(entryOperation.id);
    schedulePendingApiSync(500);
  } else if (entryResult.status === "retry") {
    enqueuePendingApiOperation(entryOperation);
  }

  if (entry.destroyedVote) {
    const voteOperation = destroyedVoteOperation(dateKey, entry.destroyedVote);
    const voteResult = await tryApiOperation(voteOperation);
    if (voteResult.status === "synced") {
      removePendingApiOperation(voteOperation.id);
      schedulePendingApiSync(500);
    } else if (voteResult.status === "retry") {
      enqueuePendingApiOperation(voteOperation);
    }
  }
}

function dailyEntryFromApi(entry, destroyedVote) {
  const local = {
    sleep: {
      didNotSleep: !!entry.sleep.didNotSleep,
      bedtime: entry.sleep.bedtime || null,
      wake: entry.sleep.wake || null,
    },
    nap: entry.nap ? { start: entry.nap.start || null, end: entry.nap.end || null } : null,
    fifthMeal: entry.fifthMeal ?? null,
    bathroom: entry.bathroom ?? null,
    boliche: {
      didNotGo: !!entry.boliche.didNotGo,
      time: entry.boliche.time || null,
    },
    destroyedVote: destroyedVote || null,
  };
  local.computed = computeDailyDerived(local);
  return local;
}

function legacyIdForApiUserId(apiUserId) {
  const participant = PARTICIPANTS.find((p) => p.apiId === apiUserId || p.id === apiUserId);
  return participant ? participant.id : apiUserId;
}

async function loadDailyEntryFromApi(userId, dateKey) {
  const key = `${userId}:${dateKey}`;
  if (dailyApiLoadedKeys.has(key)) return;
  if (dailyApiLoadingKeys.has(key) || dailyApiFailedKeys.has(key)) return;
  if (hasPendingApiOperation(`daily-entry:put:${dateKey}`) || hasPendingApiOperation(`survey-vote:destroyed_vote:${dateKey}`)) return;

  dailyApiLoadedKeys.add(key);
  dailyApiLoadingKeys.add(key);
  try {
    const [entryResponse, votesResponse] = await Promise.all([
      apiFetch(`/daily-entries/${encodeURIComponent(dateKey)}`),
      apiFetch(`/surveys/${encodeURIComponent(dateKey)}/my-votes`),
    ]);
    if (entryResponse.status === 404) return;
    if (!entryResponse.ok) {
      dailyApiLoadedKeys.delete(key);
      dailyApiFailedKeys.add(key);
      return;
    }

    const entryPayload = await entryResponse.json();
    let destroyedVote = null;
    if (votesResponse.ok) {
      const votesPayload = await votesResponse.json();
      const vote = votesPayload.votes && votesPayload.votes.find((item) => item.surveyKey === "destroyed_vote");
      if (vote) destroyedVote = legacyIdForApiUserId(vote.votedUserId);
    }

    const data = ensureDailyLogData(userId);
    data.dailyLog.entries[dateKey] = dailyEntryFromApi(entryPayload.entry, destroyedVote);
    saveUserData(userId, data);
    if (screens.daily && screens.daily.classList.contains("active") && dailyDateKey === dateKey) dailyState = JSON.parse(JSON.stringify(data.dailyLog.entries[dateKey]));
  } catch (e) {
    dailyApiLoadedKeys.delete(key);
    dailyApiFailedKeys.add(key);
  } finally {
    dailyApiLoadingKeys.delete(key);
    if (screens.daily && screens.daily.classList.contains("active") && dailyDateKey === dateKey) renderDailyScreen();
  }
}

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
  loadDailyEntryFromApi(user.id, dailyDateKey);
  const dailyLoading = dailyApiLoadingKeys.has(`${user.id}:${dailyDateKey}`);

  const s = dailyState;
  const derived = computeDailyDerived(s);

  dailyMain.innerHTML = `
    <div class="daily-date-banner">
      <span class="daily-date-eyebrow">Registrando el día de ayer</span>
      <strong>${formatDailyDate(dailyDateKey)}</strong>
    </div>
    ${dailyLoading ? renderApiLoadingBanner("Cargando tu registro guardado...") : ""}

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

    <div class="daily-section">
      <div class="section-label">🥴 ¿Quién estuvo más destruido anoche?</div>
      <div class="chip-group daily-poll-group" id="destroyed-vote-group">
        ${PARTICIPANTS.filter((p) => p.id !== user.id)
          .map(
            (p) =>
              `<button type="button" class="chip${s.destroyedVote === p.id ? " selected" : ""}" data-value="${p.id}">${escapeHtml(p.name)}</button>`
          )
          .join("")}
      </div>
    </div>

    <button type="button" id="btn-save-daily" class="sheet-submit daily-save-btn" ${dailySaveSubmitting ? "disabled" : ""}>${
      dailySaveSubmitting ? "Guardando..." : "Guardar registro"
    }</button>
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

  const destroyedVoteGroup = document.getElementById("destroyed-vote-group");
  if (destroyedVoteGroup) {
    destroyedVoteGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      dailyState.destroyedVote = btn.dataset.value;
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

async function saveDailyEntry() {
  if (dailySaveSubmitting) return;
  const user = getCurrentUser();
  if (!user) return;
  dailySaveSubmitting = true;
  const saveBtn = document.getElementById("btn-save-daily");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando...";
  }

  // Si el usuario marcó "No dormí", limpiamos las horas para no dejar
  // datos inconsistentes guardados.
  if (dailyState.sleep.didNotSleep) {
    dailyState.sleep.bedtime = null;
    dailyState.sleep.wake = null;
  }
  if (dailyState.boliche.didNotGo) {
    dailyState.boliche.time = null;
  }
  // Defensa extra: la UI ya excluye al propio usuario de las opciones,
  // pero si por algún motivo quedó un voto a sí mismo en el estado, se
  // descarta antes de guardar (nunca se persiste un autovoto).
  if (dailyState.destroyedVote === user.id) {
    dailyState.destroyedVote = null;
  }

  const data = ensureDailyLogData(user.id);
  const entryToSave = JSON.parse(JSON.stringify(dailyState));
  entryToSave.computed = computeDailyDerived(entryToSave);
  // Si ya existía un registro para este día, se sobrescribe en lugar de
  // crear un duplicado (misma clave = mismo día).
  data.dailyLog.entries[dailyDateKey] = entryToSave;
  saveUserData(user.id, data);
  try {
    await syncDailyEntryToApi(dailyDateKey, entryToSave);

    const msg = document.getElementById("daily-save-msg");
    if (msg) {
      msg.textContent = "✓ Registro guardado";
      msg.classList.add("visible");
      setTimeout(() => msg.classList.remove("visible"), 2000);
    }
  } finally {
    dailySaveSubmitting = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar registro";
    }
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
    const importedPrevia = {
      id: previa.id,
      participantIds: [...previa.participantIds],
      products: previa.products.map((p) => ({ ...p })),
      total: previa.total,
      amountPerPerson: previa.amountPerPerson,
      createdAt: previa.createdAt,
    };
    previas.unshift(importedPrevia);
    saveAdminPrevias(previas);
    syncPreviaToApi(importedPrevia);
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
   AJUSTES — DATOS: backup completo de la app (implementado)
   =============================================================
   Sección "Datos" dentro de /admin → Ajustes, al final de la
   página. Genera un único código que junta TODOS los datos
   persistidos de la app (no solo los de un jugador, a diferencia
   del "código de intercambio" de arriba), reutilizando exactamente
   el mismo pipeline de codificación (xorBytes/bytesToBase64Url,
   prefijo "BRL<version>."). No modifica ningún dato existente: es
   de solo lectura sobre localStorage.
   ============================================================= */

const BACKUP_CODE_VERSION = 1;

// Único lugar que decide qué entra en el backup completo. Se lee
// siempre en el momento desde localStorage (nunca un valor cacheado):
// PARTICIPANTS (jugadores), userData:<id> de todos ellos (saldo
// inicial, gastos/ingresos, registros diarios completos — sueño,
// siesta, quinta comida, baño, boliche y la encuesta "destroyedVote"
// viajan dentro de dailyEntries), adminPlayers (consolidado de
// Gio, fuente real de Estadísticas/Títulos/Rachas) y adminPrevias +
// localPrevias:<id> (previas, tanto las de admin como las locales de
// Jere). Títulos/rachas no se persisten aparte: se calculan siempre
// a partir de estos mismos datos (TITULOS_CONFIG/ENCUESTAS_CONFIG/
// RACHAS_CONFIG), así que ya quedan cubiertos.
function buildFullBackupPayload() {
  const userData = {};
  PARTICIPANTS.forEach((p) => {
    userData[p.id] = getUserData(p.id);
  });

  const localPrevias = {};
  PARTICIPANTS.filter((p) => canRegisterLocalPrevia(p.id)).forEach((p) => {
    const raw = localStorage.getItem(STORAGE_KEYS.localPrevias(p.id));
    localPrevias[p.id] = raw ? JSON.parse(raw) : [];
  });

  return {
    version: BACKUP_CODE_VERSION,
    type: "backup",
    generatedAt: new Date().toISOString(),
    participants: PARTICIPANTS,
    userData,
    adminPlayers: getAdminPlayers(),
    adminPrevias: JSON.parse(localStorage.getItem(STORAGE_KEYS.adminPrevias) || "[]"),
    localPrevias,
  };
}

function generateFullBackupCode() {
  const payload = buildFullBackupPayload();
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const obfuscated = xorBytes(bytes, EXPORT_XOR_KEY);
  return `${EXPORT_CODE_PREFIX}${BACKUP_CODE_VERSION}.${bytesToBase64Url(obfuscated)}`;
}

function copyBackupCode(code) {
  const msg = document.getElementById("backup-copy-msg");
  const showCopied = () => {
    if (!msg) return;
    msg.classList.add("visible");
    setTimeout(() => msg.classList.remove("visible"), 2000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(showCopied).catch(() => fallbackCopyBackup(code, showCopied));
  } else {
    fallbackCopyBackup(code, showCopied);
  }
}

function fallbackCopyBackup(code, onDone) {
  const box = document.getElementById("backup-code-box");
  if (!box) return;
  box.focus();
  box.select();
  try {
    document.execCommand("copy");
    onDone();
  } catch (e) {
    // El usuario todavía puede seleccionar y copiar a mano.
  }
}

function handleExportBackupClick() {
  const code = generateFullBackupCode();
  const box = document.getElementById("backup-code-box");
  box.value = code;
  box.hidden = false;
  copyBackupCode(code);
}

/* -----------------------------------------------------------
   AJUSTES — DATOS: "Importar backup"
   -----------------------------------------------------------
   Mismo patrón multi-paso (pegar -> previsualizar -> confirmar) que
   "Actualizar código" (jugador) y "Previa import" de más arriba,
   reutilizando el mismo sheet (openSheet/sheetContent/closeSheet) y
   las mismas clases visuales. Valida ANTES de tocar nada: si el
   código es inválido, corrupto o de otro tipo/versión, no se guarda
   nada y se muestra un error claro en el propio sheet. Recién
   después de la confirmación explícita del paso "preview" se
   reemplazan los datos, y se recarga la app para que todo el estado
   en memoria (pantallas, caches de Estadísticas/Registro diario,
   etc.) arranque limpio con los datos restaurados.
   ----------------------------------------------------------- */

// Valida la ESTRUCTURA de un payload ya decodificado, comprobando
// que sea justo un backup completo (type === "backup") de una
// versión conocida y que traiga las 5 piezas que junta
// buildFullBackupPayload(). Si algo falla, lanza un Error con
// mensaje claro y no se modifica ningún dato.
function validateBackupImportPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("El código no contiene datos reconocibles.");
  }
  if (payload.type !== "backup") {
    throw new Error("Este código no es un backup (parece ser otro tipo de código de esta app).");
  }
  if (payload.version !== BACKUP_CODE_VERSION) {
    throw new Error("Este backup es de una versión incompatible de la app.");
  }
  if (!Array.isArray(payload.participants)) {
    throw new Error("El backup no tiene la estructura de datos esperada.");
  }
  if (!payload.userData || typeof payload.userData !== "object") {
    throw new Error("El backup no tiene la estructura de datos esperada.");
  }
  if (!payload.adminPlayers || typeof payload.adminPlayers !== "object") {
    throw new Error("El backup no tiene la estructura de datos esperada.");
  }
  if (!Array.isArray(payload.adminPrevias)) {
    throw new Error("El backup no tiene la estructura de datos esperada.");
  }
  if (!payload.localPrevias || typeof payload.localPrevias !== "object") {
    throw new Error("El backup no tiene la estructura de datos esperada.");
  }
  return payload;
}

// Punto único: string pegado -> payload de backup validado, o
// excepción con un mensaje ya apto para mostrar tal cual en el sheet.
function parseAndValidatePastedBackupCode(rawCode) {
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
  return validateBackupImportPayload(payload);
}

function openBackupImportSheet() {
  backupImportStep = "paste";
  backupImportPendingPayload = null;
  openSheet("backup-import");
}

function renderBackupImportSheet() {
  if (backupImportStep === "paste") {
    sheetContent.innerHTML = `
      <h2 class="sheet-title">Importar backup</h2>
      <p class="sheet-sub">Pegá acá un código generado con "Exportar backup"</p>
      <div class="field">
        <label class="field-label" for="backup-import-textarea">Código</label>
        <textarea id="backup-import-textarea" class="admin-import-textarea" rows="4" placeholder="BRL1.xxxxxxxx..." autocapitalize="off" spellcheck="false"></textarea>
      </div>
      <p class="sheet-error" id="sheet-error"></p>
      <button class="sheet-submit" id="sheet-submit-btn" type="button">Continuar</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", handleBackupImportPaste);
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    const ta = document.getElementById("backup-import-textarea");
    ta.addEventListener("input", () => ta.classList.remove("error"));
    return;
  }

  if (backupImportStep === "preview") {
    const payload = backupImportPendingPayload;
    const playerCount = payload.participants.length;
    const expenseCount = Object.values(payload.userData).reduce(
      (sum, ud) => sum + ((ud && ud.money && ud.money.movements) || []).filter((m) => m.type === "expense").length,
      0
    );
    const incomeCount = Object.values(payload.userData).reduce(
      (sum, ud) => sum + ((ud && ud.money && ud.money.movements) || []).filter((m) => m.type === "income").length,
      0
    );
    const dailyCount = Object.values(payload.userData).reduce(
      (sum, ud) => sum + Object.keys((ud && ud.dailyLog && ud.dailyLog.entries) || {}).length,
      0
    );
    const previaCount =
      payload.adminPrevias.length + Object.values(payload.localPrevias).reduce((sum, arr) => sum + (arr || []).length, 0);

    sheetContent.innerHTML = `
      <h2 class="sheet-title">Confirmar importación</h2>
      <p class="sheet-sub">Esto va a REEMPLAZAR todos los datos actuales de la app por los del backup. No se puede deshacer.</p>
      <div class="admin-preview-card">
        <div class="admin-preview-row"><span>Generado el</span><span>${formatDateTimeShort(payload.generatedAt)}</span></div>
        <div class="admin-preview-row"><span>Jugadores</span><span>${playerCount}</span></div>
        <div class="admin-preview-row"><span>Gastos</span><span>${expenseCount}</span></div>
        <div class="admin-preview-row"><span>Ganancias</span><span>${incomeCount}</span></div>
        <div class="admin-preview-row"><span>Registros diarios</span><span>${dailyCount}</span></div>
        <div class="admin-preview-row"><span>Previas</span><span>${previaCount}</span></div>
      </div>
      <button class="sheet-submit danger" id="sheet-submit-btn" type="button">Reemplazar datos actuales</button>
      <button class="sheet-cancel-link" id="sheet-cancel-btn" type="button">Cancelar</button>
    `;
    document.getElementById("sheet-submit-btn").addEventListener("click", confirmBackupImport);
    document.getElementById("sheet-cancel-btn").addEventListener("click", closeSheet);
    return;
  }
}

function handleBackupImportPaste() {
  const ta = document.getElementById("backup-import-textarea");
  let payload;
  try {
    payload = parseAndValidatePastedBackupCode(ta.value);
  } catch (e) {
    ta.classList.add("error");
    showSheetError(e.message);
    return;
  }

  backupImportPendingPayload = payload;
  backupImportStep = "preview";
  renderBackupImportSheet();
}

// Único punto que efectivamente reemplaza datos: solo se llega acá
// después de decodeExportCode + validateBackupImportPayload +
// previsualización confirmada a mano. Escribe exactamente las mismas
// claves que lee buildFullBackupPayload() (userData:<id> de cada
// participante, adminPlayers, adminPrevias, localPrevias:<id>), y
// nunca toca "currentUser" (la sesión activa se mantiene). Termina
// recargando la página para que todo el estado en memoria de la app
// arranque de cero con los datos ya restaurados.
function confirmBackupImport() {
  const payload = backupImportPendingPayload;
  if (!payload) {
    closeSheet();
    return;
  }

  PARTICIPANTS.forEach((p) => {
    const ud = payload.userData[p.id];
    if (ud) {
      saveUserData(p.id, ud);
    } else {
      localStorage.removeItem(STORAGE_KEYS.userData(p.id));
    }
  });

  saveAdminPlayers(payload.adminPlayers || {});
  saveAdminPrevias(payload.adminPrevias || []);

  PARTICIPANTS.filter((p) => canRegisterLocalPrevia(p.id)).forEach((p) => {
    const list = payload.localPrevias[p.id] || [];
    localStorage.setItem(STORAGE_KEYS.localPrevias(p.id), JSON.stringify(list));
  });

  backupImportStep = null;
  backupImportPendingPayload = null;
  location.reload();
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
let statsApiTotal = null;
const statsApiDays = {};
const statsApiPending = {};

async function fetchStatsFromApi(scope, dateKey) {
  const path = scope === "total" ? "/stats/total" : `/stats/day/${encodeURIComponent(dateKey)}`;
  const response = await apiFetch(path);
  if (!response.ok) throw new Error("stats_api_failed");
  const stats = await response.json();
  if (JSON.stringify(stats).includes("initialBalance")) throw new Error("stats_api_leaked_private_data");
  return stats;
}

function requestStatsPanelRefresh(scope, dateKey) {
  const requestKey = scope === "total" ? "total" : `day:${dateKey}`;
  if (statsApiPending[requestKey]) return;
  if (statsApiFailed[requestKey]) return;

  delete statsApiFailed[requestKey];
  statsApiPending[requestKey] = true;
  fetchStatsFromApi(scope, dateKey)
    .then((stats) => {
      if (scope === "total") statsApiTotal = stats;
      else statsApiDays[dateKey] = stats;
      renderStatsPanel();
    })
    .catch(() => {
      statsApiFailed[requestKey] = true;
      // Si la API no está disponible, se conserva el render local actual.
    })
    .finally(() => {
      statsApiPending[requestKey] = false;
      if (screens.stats && screens.stats.classList.contains("active")) renderStatsPanel();
      refreshActiveTitulosPanel();
    });
}

function refreshActiveTitulosPanel() {
  if (screens["titulos-estadistica"] && screens["titulos-estadistica"].classList.contains("active")) renderTitulosEstadisticaPanel();
  if (screens["titulos-encuesta"] && screens["titulos-encuesta"].classList.contains("active")) renderTitulosEncuestaPanel();
  if (screens["titulos-racha"] && screens["titulos-racha"].classList.contains("active")) renderTitulosRachaPanel();
}

function clearStatsApiCache() {
  statsApiTotal = null;
  Object.keys(statsApiDays).forEach((key) => delete statsApiDays[key]);
  Object.keys(statsApiFailed).forEach((key) => delete statsApiFailed[key]);
}

function statsUserName(stats, userId) {
  const user = (stats.users || []).find((u) => u.id === userId);
  if (user) return user.displayName;
  const participant = PARTICIPANTS.find((p) => p.id === userId);
  return participant ? participant.name : userId;
}

function apiRankingRows(stats, rows, displayFn) {
  return (rows || []).map((row) => ({
    name: statsUserName(stats, row.userId),
    value: row.value,
    display: displayFn(row.value),
  }));
}

function apiCategoryRows(rows) {
  return (rows || []).map((row) => ({
    name: row.category,
    value: row.value,
    display: formatMoney(row.value),
  }));
}

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

// Encabezado temático que separa visualmente cada grupo de
// estadísticas ("-Datos de registro-", "-Pulso del viaje-",
// "-Gastos por categoría-", "-PREVIAS-"). Puramente presentacional:
// no toca ningún dato ni cálculo. `direction` ("left" | "right")
// define desde qué lado entra al hacerse visible (ver
// `observeStatsSectionHeadings`); arranca sin la clase
// `stats-heading-visible`, así el estado inicial (desplazado +
// opacity 0) lo define el CSS y no hay salto visual antes de que el
// IntersectionObserver la agregue.
function renderStatsSectionHeading(text, direction) {
  return `
    <div class="stats-section-heading stats-section-heading-${direction}" data-stats-heading>
      <span class="stats-section-heading-line" aria-hidden="true"></span>
      <span class="stats-section-heading-text">${text}</span>
      <span class="stats-section-heading-line" aria-hidden="true"></span>
    </div>
  `;
}

let statsHeadingObserver = null;

// Observa los encabezados de sección recién insertados en `root` y,
// apenas cada uno entra en el viewport, le agrega
// `stats-heading-visible` (dispara la animación de entrada por CSS)
// y deja de observarlo — así la animación corre una sola vez por
// encabezado y no se reinicia al volver a scrollear. Si el navegador
// no soporta IntersectionObserver, se muestran directamente sin
// animar (no rompe nada, solo no anima).
function observeStatsSectionHeadings(root) {
  const headings = root.querySelectorAll("[data-stats-heading]");
  if (!headings.length) return;

  if (typeof IntersectionObserver === "undefined") {
    headings.forEach((h) => h.classList.add("stats-heading-visible"));
    return;
  }

  if (!statsHeadingObserver) {
    statsHeadingObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("stats-heading-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, threshold: 0.15 }
    );
  }

  headings.forEach((h) => statsHeadingObserver.observe(h));
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
      ${renderStatsSectionHeading("-Datos de registro-", "left")}
      ${renderRankingCard("😴", "#4cc9f0", "¿Quién durmió más?", "Horas dormidas", dayRankingHorasDormidas(dateKey))}
      ${renderRankingCard("🛋️", "#4cc9f0", "Fanático de la siesta", "Siesta hoy", dayRankingSiestas(dateKey))}
      ${renderRankingCard("🍔", "#ffd166", "La quinta comida", "¿Comió una quinta?", dayRankingQuintaComida(dateKey))}
      ${renderRankingCard("🚽", "#ffd166", "Maratón de baño", "Veces que fue al baño", dayRankingBanio(dateKey))}
      ${renderRankingCard("🕺", "#ff5470", "Resistencia en el boliche", "Tiempo adentro", dayRankingBoliche(dateKey))}
      ${renderRankingCard("💸", "#ff9f1c", "El más gastador", "Gasto total del día", dayRankingDineroTotal(dateKey))}
      ${renderStatsSectionHeading("-Pulso del viaje-", "right")}
      ${renderRankingCard("🧾", "#ff9f1c", "¿En qué se fue la plata?", "Gasto por categoría", dayRankingDineroPorCategoria(dateKey))}
      ${renderStatsSectionHeading("-Gastos por categoría-", "left")}
      ${renderCategoryRankingCards((category) => dayRankingPorCategoriaJugador(dateKey, category))}
      ${renderStatsSectionHeading("-PREVIAS-", "right")}
      ${renderRankingCard("🍻", "#c77dff", "Rey/reina de las previas", "Previas del día", dayRankingPrevias(dateKey))}
    </div>
  `;
}

function renderTotalStatsReal(closedDays) {
  const msg = "Sin datos en todo el viaje.";
  return `
    <div class="card-list stats-real-list">
      ${renderStatsSectionHeading("-Datos de registro-", "left")}
      ${renderRankingCard("😴", "#4cc9f0", "¿Quién durmió más?", "Horas dormidas totales", totalRankingHorasDormidas(closedDays), msg)}
      ${renderRankingCard("🛋️", "#4cc9f0", "Fanático de la siesta", "Siestas de todo el viaje", totalRankingSiestas(closedDays), msg)}
      ${renderRankingCard("🍔", "#ffd166", "La quinta comida", "Quintas comidas del viaje", totalRankingQuintaComida(closedDays), msg)}
      ${renderRankingCard("🚽", "#ffd166", "Maratón de baño", "Veces al baño en total", totalRankingBanio(closedDays), msg)}
      ${renderRankingCard("🕺", "#ff5470", "Resistencia en el boliche", "Tiempo adentro acumulado", totalRankingBoliche(closedDays), msg)}
      ${renderRankingCard("💸", "#ff9f1c", "El más gastador", "Gasto total del viaje", totalRankingDineroTotal(closedDays), msg)}
      ${renderStatsSectionHeading("-Pulso del viaje-", "right")}
      ${renderRankingCard("🧾", "#ff9f1c", "¿En qué se fue la plata?", "Gasto por categoría", totalRankingDineroPorCategoria(closedDays), msg)}
      ${renderStatsSectionHeading("-Gastos por categoría-", "left")}
      ${renderCategoryRankingCards((category) => totalRankingPorCategoriaJugador(closedDays, category))}
      ${renderStatsSectionHeading("-PREVIAS-", "right")}
      ${renderRankingCard("🍻", "#c77dff", "Rey/reina de las previas", "Previas de todo el viaje", totalRankingPrevias(closedDays), msg)}
    </div>
  `;
}

function renderApiCategoryRankingCards(stats) {
  const byCategoryAndUser = (stats.money && stats.money.byCategoryAndUser) || {};
  return EXPENSE_CATEGORIES.map((category) => {
    const rows = apiRankingRows(stats, byCategoryAndUser[category] || [], formatMoney);
    if (!rows.length) return "";
    const meta = CATEGORY_RANKING_META[category];
    return renderRankingCard(meta.icon, meta.accent, meta.title, `Gasto en ${category}`, rows);
  }).join("");
}

function renderDayStatsFromApi(stats) {
  return `
    <div class="card-list stats-real-list">
      ${renderStatsSectionHeading("-Datos de registro-", "left")}
      ${renderRankingCard("😴", "#4cc9f0", "¿Quién durmió más?", "Horas dormidas", apiRankingRows(stats, stats.dailyEntries.sleepMinutes, formatDuration))}
      ${renderRankingCard("🛋️", "#4cc9f0", "Fanático de la siesta", "Siesta hoy", apiRankingRows(stats, stats.dailyEntries.siestas, (value) => (value ? "Sí" : "No")))}
      ${renderRankingCard("🍔", "#ffd166", "La quinta comida", "¿Comió una quinta?", apiRankingRows(stats, stats.dailyEntries.fifthMeals, (value) => (value ? "Sí" : "No")))}
      ${renderRankingCard("🚽", "#ffd166", "Maratón de baño", "Veces que fue al baño", apiRankingRows(stats, stats.dailyEntries.bathroom, (value) => (value === 1 ? "1 vez" : `${value} veces`)))}
      ${renderRankingCard("🕺", "#ff5470", "Resistencia en el boliche", "Tiempo adentro", apiRankingRows(stats, stats.dailyEntries.bolicheMinutes, formatDuration))}
      ${renderRankingCard("💸", "#ff9f1c", "El más gastador", "Gasto total del día", apiRankingRows(stats, stats.money.totalSpentByUser, formatMoney))}
      ${renderStatsSectionHeading("-Pulso del viaje-", "right")}
      ${renderRankingCard("🧾", "#ff9f1c", "¿En qué se fue la plata?", "Gasto por categoría", apiCategoryRows(stats.money.rankingByCategory))}
      ${renderStatsSectionHeading("-Gastos por categoría-", "left")}
      ${renderApiCategoryRankingCards(stats)}
      ${renderStatsSectionHeading("-PREVIAS-", "right")}
      ${renderRankingCard("🍻", "#c77dff", "Rey/reina de las previas", "Previas del día", apiRankingRows(stats, stats.previas.byParticipant, (value) => `${value} previa${value === 1 ? "" : "s"}`))}
    </div>
  `;
}

function renderTotalStatsFromApi(stats) {
  const msg = "Sin datos en todo el viaje.";
  return `
    <div class="card-list stats-real-list">
      ${renderStatsSectionHeading("-Datos de registro-", "left")}
      ${renderRankingCard("😴", "#4cc9f0", "¿Quién durmió más?", "Horas dormidas totales", apiRankingRows(stats, stats.dailyEntries.sleepMinutes, formatDuration), msg)}
      ${renderRankingCard("🛋️", "#4cc9f0", "Fanático de la siesta", "Siestas de todo el viaje", apiRankingRows(stats, stats.dailyEntries.siestas, (value) => `${value} siesta${value === 1 ? "" : "s"}`), msg)}
      ${renderRankingCard("🍔", "#ffd166", "La quinta comida", "Quintas comidas del viaje", apiRankingRows(stats, stats.dailyEntries.fifthMeals, (value) => `${value} vez${value === 1 ? "" : "es"}`), msg)}
      ${renderRankingCard("🚽", "#ffd166", "Maratón de baño", "Veces al baño en total", apiRankingRows(stats, stats.dailyEntries.bathroom, (value) => (value === 1 ? "1 vez" : `${value} veces`)), msg)}
      ${renderRankingCard("🕺", "#ff5470", "Resistencia en el boliche", "Tiempo adentro acumulado", apiRankingRows(stats, stats.dailyEntries.bolicheMinutes, formatDuration), msg)}
      ${renderRankingCard("💸", "#ff9f1c", "El más gastador", "Gasto total del viaje", apiRankingRows(stats, stats.money.totalSpentByUser, formatMoney), msg)}
      ${renderStatsSectionHeading("-Pulso del viaje-", "right")}
      ${renderRankingCard("🧾", "#ff9f1c", "¿En qué se fue la plata?", "Gasto por categoría", apiCategoryRows(stats.money.rankingByCategory), msg)}
      ${renderStatsSectionHeading("-Gastos por categoría-", "left")}
      ${renderApiCategoryRankingCards(stats)}
      ${renderStatsSectionHeading("-PREVIAS-", "right")}
      ${renderRankingCard("🍻", "#c77dff", "Rey/reina de las previas", "Previas de todo el viaje", apiRankingRows(stats, stats.previas.byParticipant, (value) => `${value} previa${value === 1 ? "" : "s"}`), msg)}
    </div>
  `;
}

function renderStatsPanel() {
  const panel = document.getElementById("stats-panel");
  if (!panel) return;
  const localClosedDays = getStatsClosedDays();
  const closedDays = statsApiTotal && Array.isArray(statsApiTotal.closedDays) ? statsApiTotal.closedDays : localClosedDays;

  // Dirección de la transición (solo se usa una vez y se resetea:
  // sirve para que ← anterior deslice desde la izquierda y →
  // siguiente deslice desde la derecha; cualquier otro cambio
  // — cambiar de pestaña, primer render — usa un simple fade).
  const navDir = statsNavDir;
  statsNavDir = 0;
  const innerClass = navDir === 1 ? "stats-slide-next" : navDir === -1 ? "stats-slide-prev" : "";

  if (statsTab === "dia") {
    if (statsDayIndex === null || statsDayIndex < 0 || statsDayIndex >= closedDays.length) {
      statsDayIndex = closedDays.length - 1;
    }

    const hasDays = closedDays.length > 0;
    const currentKey = hasDays ? closedDays[statsDayIndex] : null;
    const atFirst = !hasDays || statsDayIndex <= 0;
    const atLast = !hasDays || statsDayIndex >= closedDays.length - 1;
    const dayRequestKey = currentKey ? `day:${currentKey}` : "";
    if (hasDays && !statsApiDays[currentKey]) requestStatsPanelRefresh("day", currentKey);

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
        <div>
        <button class="ffd"></button>
        </div>
        ${
          hasDays
            ? ""
            : `<div class="stats-empty-banner"><span class="stats-empty-banner-icon" aria-hidden="true">🗓️</span><p>Todavía no hay días cerrados del viaje. En cuanto se registre e importe el primer día completo, vas a poder navegarlo acá.</p></div>`
        }
        ${dayRequestKey && statsApiPending[dayRequestKey] ? renderApiLoadingBanner("Cargando estadísticas compartidas...") : ""}
        ${hasDays ? (statsApiDays[currentKey] ? renderDayStatsFromApi(statsApiDays[currentKey]) : renderDayStatsReal(currentKey)) : renderStatsPlaceholderCards()}
      </div>
    `;

    // 1. Seleccionamos el botón por su clase (.ffd)
    const botonFfd = document.querySelector(".ffd");

    // 2. Escuchamos el evento de clic
    botonFfd.addEventListener("click", () => {
      // 3. Creamos y reproducimos el sonido directamente
      const sonido = new Audio('ffd.mp3');
      sonido.currentTime = 0; // Reinicia el sonido si se pulsa varias veces
      sonido.play().catch(error => console.log("Error al reproducir:", error));
    });
    

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
    if (!statsApiTotal) requestStatsPanelRefresh("total");
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
        ${statsApiPending.total ? renderApiLoadingBanner("Cargando estadísticas compartidas...") : ""}
        ${hasDays ? (statsApiTotal ? renderTotalStatsFromApi(statsApiTotal) : renderTotalStatsReal(closedDays)) : renderStatsPlaceholderCards()}
      </div>
    `;
  }

  animateRankingBars(panel);
  observeStatsSectionHeadings(panel);
}

function renderStatsScreen() {
  const main = document.getElementById("stats-main");
  Object.keys(statsApiFailed).forEach((key) => delete statsApiFailed[key]);
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

  requestStatsPanelRefresh("total");
  renderStatsPanel();
}

/* =============================================================
   TÍTULOS (ADMIN)
   =============================================================
   Estructura de navegación de /admin → Títulos: un hub (screen-titulos)
   con 3 categorías — por estadística, por encuesta, por racha —, cada
   una en su propia pantalla. Todavía sin lógica de cálculo: cada
   subsección deja lista la estructura visual ("Próximamente") para
   conectar los títulos reales más adelante.
   "Por estadística" ya prepara pestañas Día/Total (reutiliza
   .stats-tabs, igual que Estadísticas) porque sus títulos van a
   salir de esa misma fuente de datos (día cerrado del viaje /
   acumulado total).
   ============================================================= */

let titulosEstadisticaTab = "dia"; // "dia" | "total"
let titulosEstadisticaDayIndex = null; // índice dentro de getStatsClosedDays(), propio de Títulos
let titulosStatsNavDir = 0; // -1 anterior / 0 sin dirección / 1 siguiente (mismo patrón que statsNavDir)

/* -----------------------------------------------------------
   Configuración de "Títulos por estadística"
   -----------------------------------------------------------
   Cada entrada define un título competitivo: el título se lo lleva
   quien tenga el mejor resultado en esa estadística (ganador del
   ranking ya calculado por Estadísticas — mismas funciones
   dayRanking.../totalRanking..., sin duplicar ningún cálculo).
   Agregar o modificar un título es sumar/editar una entrada acá; no
   hace falta tocar el resto del render.

   `title` es el nombre del título en sí. Los marcados con
   `provisional: true` todavía no tienen nombre definitivo — se
   muestran con una etiqueta "Provisional" hasta que se definan.
   `caption` describe el dato literal que decide al ganador, igual
   que la leyenda de las tarjetas de Estadísticas.
   ----------------------------------------------------------- */
const TITULOS_CONFIG = [
  {
    key: "sleep",
    icon: "😴",
    accent: "#4cc9f0",
    title: "El más dormilón",
    caption: "Horas dormidas",
    dayFn: dayRankingHorasDormidas,
    totalFn: totalRankingHorasDormidas,
  },
  {
    key: "nap",
    icon: "🛌",
    accent: "#c77dff",
    title: "El rey de la siesta",
    caption: "Siestas",
    provisional: true,
    dayFn: dayRankingSiestas,
    totalFn: totalRankingSiestas,
  },
  {
    key: "fifthMeal",
    icon: "🍔",
    accent: "#ff9f1c",
    title: "El más comilón",
    caption: "Quinta comida",
    provisional: true,
    dayFn: dayRankingQuintaComida,
    totalFn: totalRankingQuintaComida,
  },
  {
    key: "bathroom",
    icon: "🚽",
    accent: "#06d6a0",
    title: "El más urgente",
    caption: "Veces que fue al baño",
    provisional: true,
    dayFn: dayRankingBanio,
    totalFn: totalRankingBanio,
  },
  {
    key: "boliche",
    icon: "🕺",
    accent: "#ff5470",
    title: "El más aguante del boliche",
    caption: "Tiempo en el boliche",
    provisional: true,
    dayFn: dayRankingBoliche,
    totalFn: totalRankingBoliche,
  },
  {
    key: "money",
    icon: "💸",
    accent: "#ffd166",
    title: "El más gastador",
    caption: "Dinero gastado",
    dayFn: dayRankingDineroTotal,
    totalFn: totalRankingDineroTotal,
  },
  {
    key: "previas",
    icon: "🍻",
    accent: "#118ab2",
    title: "El más previero",
    caption: "Previas",
    provisional: true,
    dayFn: dayRankingPrevias,
    totalFn: totalRankingPrevias,
  },
];

/* -----------------------------------------------------------
   Presentación de "Títulos por estadística": perfiles de jugador
   -----------------------------------------------------------
   El CÁLCULO de quién gana cada título sigue siendo exactamente el
   mismo (config.dayFn/config.totalFn → mismas funciones
   dayRanking.../totalRanking... de Estadísticas, `rows[0]` = ganador).
   Lo único que cambia acá es cómo se agrupa y se dibuja ese
   resultado: en vez de una tarjeta por estadística (con barra de
   ranking, como una competencia), se arma un perfil por jugador con
   la lista de títulos que ganó — porque un título es un logro
   obtenido, no una competencia en curso. Ningún dato ni cálculo se
   toca acá, solo el agrupamiento y el HTML/CSS de presentación.
   ----------------------------------------------------------- */

// Nota corta de "de dónde sale el título" arriba de las pestañas
// Día/Total de cada una de las 3 subsecciones de Títulos. Las 3
// comparten exactamente la misma estructura de perfil/insignia
// (`renderTituloProfileCard`/`renderTituloBadge`), así que esta línea
// es lo que deja explícito, en cada pantalla, cuál es la fuente de
// esos títulos puntuales (estadística medida por la app, votación de
// los participantes o racha de días consecutivos) sin duplicar CSS
// ni componentes nuevos.
function renderTitulosSourceNote(icon, accent, html) {
  return `
    <div class="titulos-source-note" style="--titulos-source-accent:${accent}">
      <span class="titulos-source-note-icon" aria-hidden="true">${icon}</span>
      <p>${html}</p>
    </div>
  `;
}

// Recorre TITULOS_CONFIG, resuelve el ganador de cada título
// (idéntico cálculo que antes) y agrupa esos resultados por nombre
// de jugador. Un título sin datos en el período mostrado
// simplemente no se reparte (no se inventa un ganador, igual que
// antes). Devuelve un array en el mismo orden que PARTICIPANTS,
// incluyendo solo a quienes ganaron al menos un título.
function buildTitulosByPlayer(getRows) {
  const wonByName = new Map(); // nombre del jugador -> [{ config, winner }]
  TITULOS_CONFIG.forEach((config) => {
    const rows = getRows(config);
    if (!rows.length) return;
    const winner = rows[0];
    if (!wonByName.has(winner.name)) wonByName.set(winner.name, []);
    wonByName.get(winner.name).push({ config, winner });
  });

  return PARTICIPANTS.filter((p) => wonByName.has(p.name)).map((p) => ({
    participant: p,
    titles: wonByName.get(p.name),
  }));
}

// Una insignia/trofeo individual dentro del perfil de un jugador:
// ícono + nombre del título + descripción de qué estadística ganó
// (misma leyenda `caption` que ya usaba la tarjeta por estadística,
// más el valor puntual con el que lo ganó).
function renderTituloBadge({ config, winner }) {
  const provisionalTag = config.provisional
    ? ' <span class="soon-tag titulo-provisional-tag">Provisional</span>'
    : "";
  return `
    <div class="titulo-badge" style="--titulo-accent:${config.accent}">
      <span class="titulo-badge-icon" aria-hidden="true">${config.icon}</span>
      <div class="titulo-badge-text">
        <span class="titulo-badge-name">${config.title}${provisionalTag}</span>
        <span class="titulo-badge-caption">${config.caption} · ${winner.display}</span>
      </div>
    </div>
  `;
}

// Perfil de un jugador: nombre + avatar (mismas iniciales/color que
// el resto de la app, `getInitials`/`colorForId`) y, debajo, la
// lista de títulos que ganó.
function renderTituloProfileCard({ participant, titles }) {
  const badgesHtml = titles.map(renderTituloBadge).join("");
  return `
    <article class="titulo-profile-card">
      <div class="titulo-profile-header">
        <div class="titulo-profile-avatar" style="background:${colorForId(participant.id)}">${getInitials(participant.name)}</div>
        <div class="titulo-profile-heading">
          <h3>${escapeHtml(participant.name)}</h3>
          <span class="titulo-profile-count">${titles.length} título${titles.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div class="titulo-badge-list">${badgesHtml}</div>
    </article>
  `;
}

// Arma un perfil por cada jugador que ganó al menos un título en el
// período mostrado (`getRows(config)` ya resuelve DÍA o TOTAL).
function renderTitulosProfiles(getRows) {
  const profiles = buildTitulosByPlayer(getRows);
  return profiles.map(renderTituloProfileCard).join("");
}

function titulosApiParticipant(stats, userId) {
  const user = (stats.users || []).find((item) => item.id === userId);
  if (!user) return { id: userId, name: statsUserName(stats, userId) };
  return { id: user.legacyId || user.id, apiId: user.id, name: user.displayName };
}

function titulosApiRows(stats, config) {
  const daily = stats.dailyEntries || {};
  const money = stats.money || {};
  const previas = stats.previas || {};
  const displayCount = (unit) => (value) => `${value} ${unit}${value === 1 ? "" : "s"}`;
  const displayDayYesNo = (value) => (value ? "Sí" : "No");

  const byKey = {
    sleep: [daily.sleepMinutes, formatDuration],
    nap: [daily.siestas, stats.scope === "day" ? displayDayYesNo : displayCount("siesta")],
    fifthMeal: [daily.fifthMeals, stats.scope === "day" ? displayDayYesNo : (value) => `${value} vez${value === 1 ? "" : "es"}`],
    bathroom: [daily.bathroom, (value) => (value === 1 ? "1 vez" : `${value} veces`)],
    boliche: [daily.bolicheMinutes, formatDuration],
    money: [money.totalSpentByUser, formatMoney],
    previas: [previas.byParticipant, displayCount("previa")],
    destroyedVote: [(stats.surveys || {}).destroyed_vote, displayCount("voto")],
    streakBoliche: [(stats.streaks || {}).boliche, displayCount("día")],
    streakFifthMeal: [(stats.streaks || {}).fifthMeal, displayCount("día")],
    streakBathroom: [(stats.streaks || {}).bathroom, displayCount("día")],
    streakChocolates: [(stats.streaks || {}).chocolates, displayCount("día")],
    streakAlcohol: [(stats.streaks || {}).alcohol, displayCount("día")],
  };

  const [rows, displayFn] = byKey[config.key] || [[], String];
  return (rows || []).map((row) => ({
    userId: row.userId,
    name: statsUserName(stats, row.userId),
    value: row.value,
    display: displayFn(row.value),
  }));
}

function renderTitulosProfilesFromApi(stats, configs, allTied) {
  const wonByUserId = new Map();

  configs.forEach((config) => {
    const rows = titulosApiRows(stats, config);
    if (!rows.length) return;
    const topValue = rows[0].value;
    const winners = allTied ? rows.filter((row) => row.value === topValue) : [rows[0]];
    winners.forEach((winner) => {
      const key = winner.userId;
      if (!wonByUserId.has(key)) wonByUserId.set(key, { participant: titulosApiParticipant(stats, key), titles: [] });
      wonByUserId.get(key).titles.push({ config, winner });
    });
  });

  return Array.from(wonByUserId.values()).map(renderTituloProfileCard).join("");
}

// DÍA: cada título se calcula únicamente con los datos disponibles
// hasta ese día puntual (mismas funciones dayRanking* que usa
// Estadísticas, que ya filtran por `dateKey`).
function renderTitulosDayReal(dateKey) {
  const profilesHtml = statsApiDays[dateKey]
    ? renderTitulosProfilesFromApi(statsApiDays[dateKey], TITULOS_CONFIG, false)
    : renderTitulosProfiles((config) => config.dayFn(dateKey));
  if (!profilesHtml) {
    return `
      <div class="stats-empty-banner">
        <span class="stats-empty-banner-icon" aria-hidden="true">🏆</span>
        <p>Todavía no hay datos cargados para este día, así que no hay ningún título para repartir.</p>
      </div>
    `;
  }
  return `<div class="card-list titulos-profile-list">${profilesHtml}</div>`;
}

// TOTAL: cada título se calcula acumulando todos los días cerrados
// disponibles (mismas funciones totalRanking* que usa Estadísticas).
function renderTitulosTotalReal(closedDays) {
  const profilesHtml = statsApiTotal
    ? renderTitulosProfilesFromApi(statsApiTotal, TITULOS_CONFIG, false)
    : renderTitulosProfiles((config) => config.totalFn(closedDays));
  if (!profilesHtml) {
    return `
      <div class="stats-empty-banner">
        <span class="stats-empty-banner-icon" aria-hidden="true">🏆</span>
        <p>Todavía no hay datos acumulados del viaje, así que no hay ningún título para repartir.</p>
      </div>
    `;
  }
  return `<div class="card-list titulos-profile-list">${profilesHtml}</div>`;
}

function getSharedStatsClosedDays() {
  return statsApiTotal && Array.isArray(statsApiTotal.closedDays) ? statsApiTotal.closedDays : getStatsClosedDays();
}

function renderTitulosEstadisticaPanel() {
  const panel = document.getElementById("titulos-estadistica-panel");
  if (!panel) return;
  if (!statsApiTotal) requestStatsPanelRefresh("total");
  const closedDays = getSharedStatsClosedDays();

  const navDir = titulosStatsNavDir;
  titulosStatsNavDir = 0;
  const innerClass = navDir === 1 ? "stats-slide-next" : navDir === -1 ? "stats-slide-prev" : "";

  if (titulosEstadisticaTab === "dia") {
    if (titulosEstadisticaDayIndex === null || titulosEstadisticaDayIndex >= closedDays.length) {
      titulosEstadisticaDayIndex = closedDays.length - 1;
    }

    const hasDays = closedDays.length > 0;
    const currentKey = hasDays ? closedDays[titulosEstadisticaDayIndex] : null;
    const atFirst = !hasDays || titulosEstadisticaDayIndex <= 0;
    const atLast = !hasDays || titulosEstadisticaDayIndex >= closedDays.length - 1;
    if (hasDays && !statsApiDays[currentKey]) requestStatsPanelRefresh("day", currentKey);

    panel.innerHTML = `
      <div class="stats-panel-inner ${innerClass}">
        <div class="stats-day-nav">
          <button type="button" id="titulos-day-prev" class="stats-day-btn" ${atFirst ? "disabled" : ""} aria-label="Día anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="stats-day-label">
            ${hasDays ? `<strong>${formatDailyDate(currentKey)}</strong>` : `<strong>Sin días cerrados</strong>`}
          </div>
          <button type="button" id="titulos-day-next" class="stats-day-btn" ${atLast ? "disabled" : ""} aria-label="Día siguiente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        ${
          hasDays
            ? ""
            : `<div class="stats-empty-banner"><span class="stats-empty-banner-icon" aria-hidden="true">🏆</span><p>Todavía no hay días cerrados del viaje. En cuanto se registre e importe el primer día completo, vas a poder ver los títulos de ese día acá.</p></div>`
        }
        ${hasDays ? renderTitulosDayReal(currentKey) : ""}
      </div>
    `;

    if (hasDays) {
      document.getElementById("titulos-day-prev").addEventListener("click", () => {
        if (titulosEstadisticaDayIndex > 0) {
          titulosEstadisticaDayIndex -= 1;
          titulosStatsNavDir = -1;
          renderTitulosEstadisticaPanel();
        }
      });
      document.getElementById("titulos-day-next").addEventListener("click", () => {
        if (titulosEstadisticaDayIndex < closedDays.length - 1) {
          titulosEstadisticaDayIndex += 1;
          titulosStatsNavDir = 1;
          renderTitulosEstadisticaPanel();
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
            : `<div class="stats-empty-banner"><span class="stats-empty-banner-icon" aria-hidden="true">🏆</span><p>Todavía no hay días cerrados del viaje. En cuanto se registre e importe el primer día completo, vas a poder ver los títulos de todo el viaje acá.</p></div>`
        }
        ${hasDays ? renderTitulosTotalReal(closedDays) : ""}
      </div>
    `;
  }

  animateRankingBars(panel);
  observeStatsSectionHeadings(panel);
}

function renderTitulosEstadisticaScreen() {
  const main = document.getElementById("titulos-estadistica-main");
  main.innerHTML = `
    ${renderTitulosSourceNote("📊", "#4cc9f0", "Estos títulos salen de las <strong>estadísticas</strong> que ya mide la app (sueño, gastos, boliche, baño, previas...): se lo lleva quien tenga el mejor resultado en cada una.")}
    <div class="stats-tabs" role="tablist">
      <button type="button" class="stats-tab${titulosEstadisticaTab === "dia" ? " active" : ""}" data-tab="dia" role="tab" aria-selected="${titulosEstadisticaTab === "dia"}">Día</button>
      <button type="button" class="stats-tab${titulosEstadisticaTab === "total" ? " active" : ""}" data-tab="total" role="tab" aria-selected="${titulosEstadisticaTab === "total"}">Total</button>
    </div>
    <div id="titulos-estadistica-panel"></div>
  `;

  main.querySelectorAll(".stats-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (titulosEstadisticaTab === btn.dataset.tab) return;
      titulosEstadisticaTab = btn.dataset.tab;
      renderTitulosEstadisticaPanel();
      main.querySelectorAll(".stats-tab").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
    });
  });

  renderTitulosEstadisticaPanel();
}

/* =============================================================
   TÍTULOS POR ENCUESTA
   -------------------------------------------------------------
   Títulos que se otorgan a partir de encuestas votadas por los
   participantes (no de una estadística medida por la app). Por
   ahora hay una sola encuesta implementada — "¿Quién estuvo más
   destruido anoche?" (el voto ya se captura y persiste dentro de
   Registro diario, ver `destroyedVote` en `defaultDailyEntry()`) —
   pero la estructura (`ENCUESTAS_CONFIG`) está preparada para sumar
   encuestas futuras de la misma forma en que `TITULOS_CONFIG` ya
   permite sumar estadísticas nuevas: una entrada nueva, sin tocar
   el resto del render.

   Misma separación DÍA/TOTAL que "Por estadística": propio estado
   (`titulosEncuestaTab`/`titulosEncuestaDayIndex`), propia barra
   `← día →` sobre los mismos días cerrados (`getStatsClosedDays()`),
   y el resultado se dibuja reutilizando EXACTAMENTE la misma
   estructura visual de perfiles (`renderTituloProfileCard`/
   `renderTituloBadge`, sin ningún componente ni CSS nuevo) — nunca
   como un ranking de estadísticas.
   ============================================================= */

let titulosEncuestaTab = "dia"; // "dia" | "total"
let titulosEncuestaDayIndex = null; // índice dentro de getStatsClosedDays(), propio de Títulos por encuesta
let titulosEncuestaNavDir = 0; // -1 anterior / 0 sin dirección / 1 siguiente (mismo patrón que statsNavDir)

// Cuenta los votos de una encuesta para un día puntual: recorre el
// registro diario de ese día de cada jugador importado y suma 1 al
// id votado en `field` (ignora a quien no votó ese día — no se
// inventa ningún voto). `field` es el nombre del campo dentro de
// `dailyEntries[dateKey]` (hoy solo existe "destroyedVote", pero
// cualquier encuesta futura que se guarde del mismo modo dentro del
// registro diario puede reutilizar esta misma función).
function tallyVotesForDay(dateKey, field) {
  const tally = {}; // id del votado -> cantidad de votos
  getAdminPlayersArray().forEach((player) => {
    const entry = (player.data.dailyEntries || {})[dateKey];
    if (!entry) return;
    const votedId = entry[field];
    if (!votedId) return;
    tally[votedId] = (tally[votedId] || 0) + 1;
  });
  return tally;
}

// TOTAL: suma los votos de todos los días cerrados disponibles,
// reutilizando tallyVotesForDay día por día (sin duplicar el
// cálculo de conteo).
function tallyVotesForDays(closedDays, field) {
  const tally = {};
  closedDays.forEach((dateKey) => {
    const dayTally = tallyVotesForDay(dateKey, field);
    Object.keys(dayTally).forEach((id) => {
      tally[id] = (tally[id] || 0) + dayTally[id];
    });
  });
  return tally;
}

// Convierte un conteo de votos { id: cantidad } en filas
// name/value/display ya ordenadas de mayor a menor (mismo formato y
// mismo `sortRankingDesc` que usan las estadísticas de siempre), así
// el resto del pipeline de Títulos (que arma perfiles a partir de
// filas ordenadas) no necesita saber que estas filas vienen de una
// votación y no de una medición.
function votesToRankingRows(tally) {
  const rows = Object.keys(tally).map((id) => {
    const participant = PARTICIPANTS.find((p) => p.id === id);
    const votes = tally[id];
    return {
      name: participant ? participant.name : id,
      value: votes,
      display: votes === 1 ? "1 voto" : `${votes} votos`,
    };
  });
  return sortRankingDesc(rows);
}

/* -----------------------------------------------------------
   Configuración de "Títulos por encuesta"
   -----------------------------------------------------------
   Cada entrada define un título votado: se lo lleva quien haya
   recibido más votos en la encuesta correspondiente. Agregar una
   encuesta nueva es sumar una entrada acá (con su propio `dayFn`/
   `totalFn` armados sobre `tallyVotesForDay`/`tallyVotesForDays` +
   `votesToRankingRows`) — no hace falta tocar el resto del render.
   ----------------------------------------------------------- */
const ENCUESTAS_CONFIG = [
  {
    key: "destroyedVote",
    icon: "🥴",
    accent: "#c77dff",
    title: "El más destruido",
    caption: 'Ganó la votación de "¿Quién estuvo más destruido anoche?"',
    dayFn: (dateKey) => votesToRankingRows(tallyVotesForDay(dateKey, "destroyedVote")),
    totalFn: (closedDays) => votesToRankingRows(tallyVotesForDays(closedDays, "destroyedVote")),
  },
];

// Agrupa por jugador los títulos que resultan de un conjunto de
// "configs" (cada uno con su propio `getRows(config)` ya resuelto
// para DÍA o TOTAL), repartiendo el título entre TODOS los que
// hayan quedado empatados en el primer puesto — no solo al primero
// de la lista — para no elegir arbitrariamente un ganador entre un
// empate real. Es el mismo criterio de "resolver empates sin romper
// la interfaz" que usan tanto "Por encuesta" como "Por racha", así
// que vive acá una sola vez y ambos lo reutilizan.
function buildTitulosByPlayerAllTiedWinners(configs, getRows) {
  const wonByName = new Map(); // nombre del jugador -> [{ config, winner }]
  configs.forEach((config) => {
    const rows = getRows(config);
    if (!rows.length) return;
    const topValue = rows[0].value;
    const winners = rows.filter((row) => row.value === topValue);
    winners.forEach((winner) => {
      if (!wonByName.has(winner.name)) wonByName.set(winner.name, []);
      wonByName.get(winner.name).push({ config, winner });
    });
  });

  return PARTICIPANTS.filter((p) => wonByName.has(p.name)).map((p) => ({
    participant: p,
    titles: wonByName.get(p.name),
  }));
}

// Agrupa los títulos por encuesta ganados por cada jugador, igual
// que `buildTitulosByPlayer` para "Por estadística" — con una
// diferencia: acá el título se reparte a TODOS los que hayan
// quedado empatados en el primer puesto (empate de votos), no solo
// al primero de la lista, para no elegir arbitrariamente un ganador
// entre un empate real. Esto es lo que permite "resolver empates
// sin romper la interfaz": cada empatado recibe su propio perfil
// con el mismo título, en vez de forzar un único ganador o mostrar
// un estado roto.
function buildTitulosByPlayerFromEncuestas(getRows) {
  return buildTitulosByPlayerAllTiedWinners(ENCUESTAS_CONFIG, getRows);
}

// Arma un perfil por cada jugador que ganó al menos un título por
// encuesta en el período mostrado, reutilizando EXACTAMENTE la misma
// tarjeta de perfil que "Por estadística" (`renderTituloProfileCard`)
// — nunca como un ranking de estadísticas.
function renderTitulosEncuestaProfiles(getRows) {
  const profiles = buildTitulosByPlayerFromEncuestas(getRows);
  return profiles.map(renderTituloProfileCard).join("");
}

// DÍA: cada título por encuesta se calcula únicamente con los votos
// de ese día puntual.
function renderTitulosEncuestaDayReal(dateKey) {
  const profilesHtml = statsApiDays[dateKey]
    ? renderTitulosProfilesFromApi(statsApiDays[dateKey], ENCUESTAS_CONFIG, true)
    : renderTitulosEncuestaProfiles((config) => config.dayFn(dateKey));
  if (!profilesHtml) {
    return `
      <div class="stats-empty-banner">
        <span class="stats-empty-banner-icon" aria-hidden="true">🗳️</span>
        <p>Todavía no hay votos cargados para este día, así que no hay ningún título por encuesta para repartir.</p>
      </div>
    `;
  }
  return `<div class="card-list titulos-profile-list">${profilesHtml}</div>`;
}

// TOTAL: cada título por encuesta se calcula sumando los votos de
// todos los días cerrados disponibles.
function renderTitulosEncuestaTotalReal(closedDays) {
  const profilesHtml = statsApiTotal
    ? renderTitulosProfilesFromApi(statsApiTotal, ENCUESTAS_CONFIG, true)
    : renderTitulosEncuestaProfiles((config) => config.totalFn(closedDays));
  if (!profilesHtml) {
    return `
      <div class="stats-empty-banner">
        <span class="stats-empty-banner-icon" aria-hidden="true">🗳️</span>
        <p>Todavía no hay votos acumulados del viaje, así que no hay ningún título por encuesta para repartir.</p>
      </div>
    `;
  }
  return `<div class="card-list titulos-profile-list">${profilesHtml}</div>`;
}

function renderTitulosEncuestaPanel() {
  const panel = document.getElementById("titulos-encuesta-panel");
  if (!panel) return;
  if (!statsApiTotal) requestStatsPanelRefresh("total");
  const closedDays = getSharedStatsClosedDays();

  const navDir = titulosEncuestaNavDir;
  titulosEncuestaNavDir = 0;
  const innerClass = navDir === 1 ? "stats-slide-next" : navDir === -1 ? "stats-slide-prev" : "";

  if (titulosEncuestaTab === "dia") {
    if (titulosEncuestaDayIndex === null || titulosEncuestaDayIndex >= closedDays.length) {
      titulosEncuestaDayIndex = closedDays.length - 1;
    }

    const hasDays = closedDays.length > 0;
    const currentKey = hasDays ? closedDays[titulosEncuestaDayIndex] : null;
    const atFirst = !hasDays || titulosEncuestaDayIndex <= 0;
    const atLast = !hasDays || titulosEncuestaDayIndex >= closedDays.length - 1;
    if (hasDays && !statsApiDays[currentKey]) requestStatsPanelRefresh("day", currentKey);

    panel.innerHTML = `
      <div class="stats-panel-inner ${innerClass}">
        <div class="stats-day-nav">
          <button type="button" id="titulos-encuesta-day-prev" class="stats-day-btn" ${atFirst ? "disabled" : ""} aria-label="Día anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="stats-day-label">
            ${hasDays ? `<strong>${formatDailyDate(currentKey)}</strong>` : `<strong>Sin días cerrados</strong>`}
          </div>
          <button type="button" id="titulos-encuesta-day-next" class="stats-day-btn" ${atLast ? "disabled" : ""} aria-label="Día siguiente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        ${
          hasDays
            ? ""
            : `<div class="stats-empty-banner"><span class="stats-empty-banner-icon" aria-hidden="true">🗳️</span><p>Todavía no hay días cerrados del viaje. En cuanto se registre e importe el primer día completo, vas a poder ver los títulos por encuesta de ese día acá.</p></div>`
        }
        ${hasDays ? renderTitulosEncuestaDayReal(currentKey) : ""}
      </div>
    `;

    if (hasDays) {
      document.getElementById("titulos-encuesta-day-prev").addEventListener("click", () => {
        if (titulosEncuestaDayIndex > 0) {
          titulosEncuestaDayIndex -= 1;
          titulosEncuestaNavDir = -1;
          renderTitulosEncuestaPanel();
        }
      });
      document.getElementById("titulos-encuesta-day-next").addEventListener("click", () => {
        if (titulosEncuestaDayIndex < closedDays.length - 1) {
          titulosEncuestaDayIndex += 1;
          titulosEncuestaNavDir = 1;
          renderTitulosEncuestaPanel();
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
            : `<div class="stats-empty-banner"><span class="stats-empty-banner-icon" aria-hidden="true">🗳️</span><p>Todavía no hay días cerrados del viaje. En cuanto se registre e importe el primer día completo, vas a poder ver los títulos por encuesta de todo el viaje acá.</p></div>`
        }
        ${hasDays ? renderTitulosEncuestaTotalReal(closedDays) : ""}
      </div>
    `;
  }

  animateRankingBars(panel);
  observeStatsSectionHeadings(panel);
}

function renderTitulosEncuestaScreen() {
  const main = document.getElementById("titulos-encuesta-main");
  main.innerHTML = `
    ${renderTitulosSourceNote("🗳️", "#c77dff", "Estos títulos salen de las <strong>encuestas votadas por los participantes</strong> en Registro diario (ej. \"¿Quién estuvo más destruido anoche?\"): se lo lleva quien reciba más votos.")}
    <div class="stats-tabs" role="tablist">
      <button type="button" class="stats-tab${titulosEncuestaTab === "dia" ? " active" : ""}" data-tab="dia" role="tab" aria-selected="${titulosEncuestaTab === "dia"}">Día</button>
      <button type="button" class="stats-tab${titulosEncuestaTab === "total" ? " active" : ""}" data-tab="total" role="tab" aria-selected="${titulosEncuestaTab === "total"}">Total</button>
    </div>
    <div id="titulos-encuesta-panel"></div>
  `;

  main.querySelectorAll(".stats-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (titulosEncuestaTab === btn.dataset.tab) return;
      titulosEncuestaTab = btn.dataset.tab;
      renderTitulosEncuestaPanel();
      main.querySelectorAll(".stats-tab").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
    });
  });

  renderTitulosEncuestaPanel();
}

/* =============================================================
   TÍTULOS POR RACHA
   -------------------------------------------------------------
   Títulos que se otorgan a partir de la MEJOR RACHA de días
   consecutivos cumpliendo un hábito (ir al boliche, comer quinta
   comida, ir al baño, gastar en una categoría puntual, etc.) — no
   de un valor puntual de un día ni de una votación. El título se lo
   lleva quien haya conseguido la racha más larga en el período
   mostrado.

   "Racha" = días CONSECUTIVOS EN EL CALENDARIO (no solo índices
   consecutivos dentro de `getStatsClosedDays()`): si hay un día sin
   cerrar en el medio, la racha se corta ahí, aunque ese hueco no
   aparezca en la lista de días cerrados (`isNextDayKey`).

   - **DÍA**: la racha se calcula con los datos disponibles HASTA
     ese día puntual (todos los días cerrados desde el principio del
     viaje hasta el día seleccionado en la barra `← día →`) — a
     diferencia de "Por estadística"/"Por encuesta", donde DÍA usa
     solo el dato de ESE día. Acá no aplica: una racha por
     definición necesita el historial previo.
   - **TOTAL**: la racha se calcula con todo el historial de días
     cerrados del viaje.

   `RACHAS_CONFIG` es un arreglo de configuración igual en espíritu a
   `TITULOS_CONFIG`/`ENCUESTAS_CONFIG`: cada entrada define un
   `predicate(player, dateKey)` que dice si ESE jugador cumplió el
   hábito ESE día — el motor de rachas (`longestStreak`) hace el
   resto. Agregar un tipo de racha nuevo es sumar una entrada acá;
   no hace falta tocar el resto del render. Los nombres de título
   son provisionales (`provisional: true`, misma convención que
   `TITULOS_CONFIG`) y quedan fáciles de renombrar más adelante.

   El resultado se dibuja reutilizando EXACTAMENTE la misma
   estructura visual de perfiles que "Por estadística"/"Por
   encuesta" (`renderTituloProfileCard`/`renderTituloBadge`, sin
   ningún componente ni CSS nuevo) — nunca como un ranking de
   barras. Empates (misma racha máxima entre dos o más jugadores) se
   resuelven con `buildTitulosByPlayerAllTiedWinners`, igual que
   "Por encuesta": el título se reparte entre todos los empatados.
   ============================================================= */

let titulosRachaTab = "dia"; // "dia" | "total"
let titulosRachaDayIndex = null; // índice dentro de getStatsClosedDays(), propio de Títulos por racha
let titulosRachaNavDir = 0; // -1 anterior / 0 sin dirección / 1 siguiente (mismo patrón que statsNavDir)

// ¿`dateKey` es exactamente el día calendario siguiente a `prevKey`?
// Ambas claves son YYYY-MM-DD. Se usa para saber si dos días
// cerrados consecutivos en la lista son también consecutivos en el
// calendario (si no lo son, la racha se corta ahí).
function isNextDayKey(prevKey, dateKey) {
  const [py, pm, pd] = prevKey.split("-").map(Number);
  const prevDate = new Date(py, pm - 1, pd);
  prevDate.setDate(prevDate.getDate() + 1);
  const nextKey = `${prevDate.getFullYear()}-${pad2(prevDate.getMonth() + 1)}-${pad2(prevDate.getDate())}`;
  return nextKey === dateKey;
}

// Motor de rachas: recorre `days` (claves YYYY-MM-DD ya ordenadas de
// más antigua a más reciente) y devuelve la racha más larga de días
// consecutivos en el calendario donde `predicateFn(dateKey)` dio
// `true`. Un día que no cumple corta la racha en curso; un salto de
// calendario entre dos días de la lista también la corta, aunque
// ambos hayan cumplido el hábito.
function longestStreak(days, predicateFn) {
  let best = 0;
  let current = 0;
  let prevKey = null;
  days.forEach((dateKey) => {
    const consecutive = prevKey !== null && isNextDayKey(prevKey, dateKey);
    if (predicateFn(dateKey)) {
      current = consecutive ? current + 1 : 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
    prevKey = dateKey;
  });
  return best;
}

// Arma las filas name/value/display (mismo formato que
// Estadísticas) con la racha más larga de cada jugador para un
// `predicate` dado, sobre el conjunto `days` ya recortado (hasta el
// día seleccionado para DÍA, o todo el historial para TOTAL). Un
// jugador con racha 0 (nunca cumplió el hábito en el período) no
// entra en las filas — no hay racha que premiar.
function streakRankingRows(days, predicate) {
  const rows = getAdminPlayersArray()
    .map((player) => {
      const streak = longestStreak(days, (dateKey) => predicate(player, dateKey));
      return {
        name: player.name,
        value: streak,
        display: streak === 1 ? "1 día" : `${streak} días`,
      };
    })
    .filter((row) => row.value > 0);
  return sortRankingDesc(rows);
}

// `days` recortado HASTA `dateKey` inclusive, dentro de
// `closedDays` (para DÍA: la racha usa todo lo disponible hasta ese
// punto, no solo ese día suelto).
function daysUpTo(closedDays, dateKey) {
  const idx = closedDays.indexOf(dateKey);
  if (idx === -1) return closedDays;
  return closedDays.slice(0, idx + 1);
}

// Predicados: ¿el jugador cumplió el hábito ESE día puntual? Todos
// leen exactamente los mismos campos que ya usan Estadísticas/
// Títulos por estadística, sin ningún cálculo nuevo sobre los datos
// crudos.
function playerFueAlBoliche(player, dateKey) {
  const entry = (player.data.dailyEntries || {})[dateKey];
  return !!(entry && entry.computed && entry.computed.bolicheMinutes !== null && entry.computed.bolicheMinutes !== undefined);
}

function playerComioQuintaComida(player, dateKey) {
  const entry = (player.data.dailyEntries || {})[dateKey];
  return !!entry && entry.fifthMeal === "yes";
}

function playerFueAlBanio(player, dateKey) {
  const entry = (player.data.dailyEntries || {})[dateKey];
  return !!entry && entry.bathroom !== null && entry.bathroom !== undefined && entry.bathroom > 0;
}

// ¿El jugador tuvo al menos un gasto en `category` ese día? Reusa
// `dayExpenses(dateKey)`, la misma fuente que ya arma los rankings
// por categoría de Estadísticas.
function playerGastoEnCategoria(player, dateKey, category) {
  return dayExpenses(dateKey).some((e) => e.playerName === player.name && e.category === category);
}

/* -----------------------------------------------------------
   Configuración de "Títulos por racha"
   -----------------------------------------------------------
   Cada entrada define un título de racha: se lo lleva quien haya
   conseguido la racha más larga de días consecutivos cumpliendo
   `predicate`. `dayFn(closedDays, dateKey)`/`totalFn(closedDays)`
   arman las filas ya recortadas al período correspondiente sobre
   `streakRankingRows`. Agregar un tipo de racha nuevo (u otra
   categoría de gasto) es sumar una entrada acá.
   ----------------------------------------------------------- */
const RACHAS_CONFIG = [
  {
    key: "streakBoliche",
    icon: "🕺",
    accent: "#ff5470",
    title: "Rey de la noche",
    caption: "Mayor racha de días yendo al boliche",
    provisional: true,
    dayFn: (closedDays, dateKey) => streakRankingRows(daysUpTo(closedDays, dateKey), playerFueAlBoliche),
    totalFn: (closedDays) => streakRankingRows(closedDays, playerFueAlBoliche),
  },
  {
    key: "streakFifthMeal",
    icon: "🍔",
    accent: "#ff9f1c",
    title: "Racha comilona",
    caption: "Mayor racha de días comiendo quinta comida",
    provisional: true,
    dayFn: (closedDays, dateKey) => streakRankingRows(daysUpTo(closedDays, dateKey), playerComioQuintaComida),
    totalFn: (closedDays) => streakRankingRows(closedDays, playerComioQuintaComida),
  },
  {
    key: "streakBathroom",
    icon: "🚽",
    accent: "#06d6a0",
    title: "Intestino de hierro",
    caption: "Mayor racha de días yendo al baño",
    provisional: true,
    dayFn: (closedDays, dateKey) => streakRankingRows(daysUpTo(closedDays, dateKey), playerFueAlBanio),
    totalFn: (closedDays) => streakRankingRows(closedDays, playerFueAlBanio),
  },
  {
    key: "streakChocolates",
    icon: "🍫",
    accent: "#c77dff",
    title: "Racha dulce",
    caption: "Mayor racha de días gastando en chocolates",
    provisional: true,
    dayFn: (closedDays, dateKey) =>
      streakRankingRows(daysUpTo(closedDays, dateKey), (player, dk) => playerGastoEnCategoria(player, dk, "Chocolates")),
    totalFn: (closedDays) => streakRankingRows(closedDays, (player, dk) => playerGastoEnCategoria(player, dk, "Chocolates")),
  },
  {
    key: "streakAlcohol",
    icon: "🍷",
    accent: "#118ab2",
    title: "Racha alcohólica",
    caption: "Mayor racha de días gastando en alcohol",
    provisional: true,
    dayFn: (closedDays, dateKey) =>
      streakRankingRows(daysUpTo(closedDays, dateKey), (player, dk) => playerGastoEnCategoria(player, dk, "Alcohol")),
    totalFn: (closedDays) => streakRankingRows(closedDays, (player, dk) => playerGastoEnCategoria(player, dk, "Alcohol")),
  },
];

// Agrupa los títulos por racha ganados por cada jugador, con el
// mismo criterio de empates que "Por encuesta": el título se
// reparte entre TODOS los que hayan quedado con la racha máxima.
function buildTitulosByPlayerFromRachas(getRows) {
  return buildTitulosByPlayerAllTiedWinners(RACHAS_CONFIG, getRows);
}

// Arma un perfil por cada jugador que ganó al menos un título por
// racha en el período mostrado, reutilizando EXACTAMENTE la misma
// tarjeta de perfil que "Por estadística"/"Por encuesta"
// (`renderTituloProfileCard`) — nunca como un ranking de barras.
function renderTitulosRachaProfiles(getRows) {
  const profiles = buildTitulosByPlayerFromRachas(getRows);
  return profiles.map(renderTituloProfileCard).join("");
}

// DÍA: cada racha se calcula con los datos disponibles hasta ese día
// puntual (`daysUpTo` ya recorta `closedDays` dentro de cada
// `dayFn` de `RACHAS_CONFIG`).
function renderTitulosRachaDayReal(closedDays, dateKey) {
  const profilesHtml = statsApiDays[dateKey]
    ? renderTitulosProfilesFromApi(statsApiDays[dateKey], RACHAS_CONFIG, true)
    : renderTitulosRachaProfiles((config) => config.dayFn(closedDays, dateKey));
  if (!profilesHtml) {
    return `
      <div class="stats-empty-banner">
        <span class="stats-empty-banner-icon" aria-hidden="true">🔥</span>
        <p>Todavía no hay ninguna racha en curso hasta este día, así que no hay ningún título por racha para repartir.</p>
      </div>
    `;
  }
  return `<div class="card-list titulos-profile-list">${profilesHtml}</div>`;
}

// TOTAL: cada racha se calcula sobre todo el historial de días
// cerrados del viaje.
function renderTitulosRachaTotalReal(closedDays) {
  const profilesHtml = statsApiTotal
    ? renderTitulosProfilesFromApi(statsApiTotal, RACHAS_CONFIG, true)
    : renderTitulosRachaProfiles((config) => config.totalFn(closedDays));
  if (!profilesHtml) {
    return `
      <div class="stats-empty-banner">
        <span class="stats-empty-banner-icon" aria-hidden="true">🔥</span>
        <p>Todavía no hay ninguna racha registrada en todo el viaje, así que no hay ningún título por racha para repartir.</p>
      </div>
    `;
  }
  return `<div class="card-list titulos-profile-list">${profilesHtml}</div>`;
}

function renderTitulosRachaPanel() {
  const panel = document.getElementById("titulos-racha-panel");
  if (!panel) return;
  if (!statsApiTotal) requestStatsPanelRefresh("total");
  const closedDays = getSharedStatsClosedDays();

  const navDir = titulosRachaNavDir;
  titulosRachaNavDir = 0;
  const innerClass = navDir === 1 ? "stats-slide-next" : navDir === -1 ? "stats-slide-prev" : "";

  if (titulosRachaTab === "dia") {
    if (titulosRachaDayIndex === null || titulosRachaDayIndex >= closedDays.length) {
      titulosRachaDayIndex = closedDays.length - 1;
    }

    const hasDays = closedDays.length > 0;
    const currentKey = hasDays ? closedDays[titulosRachaDayIndex] : null;
    const atFirst = !hasDays || titulosRachaDayIndex <= 0;
    const atLast = !hasDays || titulosRachaDayIndex >= closedDays.length - 1;
    if (hasDays && !statsApiDays[currentKey]) requestStatsPanelRefresh("day", currentKey);

    panel.innerHTML = `
      <div class="stats-panel-inner ${innerClass}">
        <div class="stats-day-nav">
          <button type="button" id="titulos-racha-day-prev" class="stats-day-btn" ${atFirst ? "disabled" : ""} aria-label="Día anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="stats-day-label">
            ${hasDays ? `<strong>${formatDailyDate(currentKey)}</strong>` : `<strong>Sin días cerrados</strong>`}
          </div>
          <button type="button" id="titulos-racha-day-next" class="stats-day-btn" ${atLast ? "disabled" : ""} aria-label="Día siguiente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        ${
          hasDays
            ? ""
            : `<div class="stats-empty-banner"><span class="stats-empty-banner-icon" aria-hidden="true">🔥</span><p>Todavía no hay días cerrados del viaje. En cuanto se registre e importe el primer día completo, vas a poder ver los títulos por racha hasta ese día acá.</p></div>`
        }
        ${hasDays ? renderTitulosRachaDayReal(closedDays, currentKey) : ""}
      </div>
    `;

    if (hasDays) {
      document.getElementById("titulos-racha-day-prev").addEventListener("click", () => {
        if (titulosRachaDayIndex > 0) {
          titulosRachaDayIndex -= 1;
          titulosRachaNavDir = -1;
          renderTitulosRachaPanel();
        }
      });
      document.getElementById("titulos-racha-day-next").addEventListener("click", () => {
        if (titulosRachaDayIndex < closedDays.length - 1) {
          titulosRachaDayIndex += 1;
          titulosRachaNavDir = 1;
          renderTitulosRachaPanel();
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
            : `<div class="stats-empty-banner"><span class="stats-empty-banner-icon" aria-hidden="true">🔥</span><p>Todavía no hay días cerrados del viaje. En cuanto se registre e importe el primer día completo, vas a poder ver los títulos por racha de todo el viaje acá.</p></div>`
        }
        ${hasDays ? renderTitulosRachaTotalReal(closedDays) : ""}
      </div>
    `;
  }

  animateRankingBars(panel);
  observeStatsSectionHeadings(panel);
}

function renderTitulosRachaScreen() {
  const main = document.getElementById("titulos-racha-main");
  main.innerHTML = `
    ${renderTitulosSourceNote("🔥", "#ff5470", "Estos títulos salen de la <strong>racha más larga de días consecutivos</strong> cumpliendo un hábito (ir al boliche, comer quinta comida, gastar en una categoría...): se lo lleva quien sostenga la racha más larga.")}
    <div class="stats-tabs" role="tablist">
      <button type="button" class="stats-tab${titulosRachaTab === "dia" ? " active" : ""}" data-tab="dia" role="tab" aria-selected="${titulosRachaTab === "dia"}">Día</button>
      <button type="button" class="stats-tab${titulosRachaTab === "total" ? " active" : ""}" data-tab="total" role="tab" aria-selected="${titulosRachaTab === "total"}">Total</button>
    </div>
    <div id="titulos-racha-panel"></div>
  `;

  main.querySelectorAll(".stats-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (titulosRachaTab === btn.dataset.tab) return;
      titulosRachaTab = btn.dataset.tab;
      renderTitulosRachaPanel();
      main.querySelectorAll(".stats-tab").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
    });
  });

  renderTitulosRachaPanel();
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
  titulos: document.getElementById("screen-titulos"),
  "titulos-estadistica": document.getElementById("screen-titulos-estadistica"),
  "titulos-encuesta": document.getElementById("screen-titulos-encuesta"),
  "titulos-racha": document.getElementById("screen-titulos-racha"),
  ajustes: document.getElementById("screen-ajustes"),
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

  const isAdminOnlyRoute =
    route === "admin" ||
    route === "previas" ||
    route === "ajustes";
  if (isAdminOnlyRoute && !user.isAdmin) {
    route = "home";
  }

  if (route === "previas-jere" && !canRegisterLocalPrevia(user.id)) {
    route = "home";
  }

  if (route === "admin") {
    location.hash = "#/admin";
    adminCreatePlayerOpen = false;
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
  } else if (route === "titulos") {
    location.hash = "#/titulos";
    showScreen("titulos");
  } else if (route === "titulos-estadistica") {
    location.hash = "#/titulos-estadistica";
    renderTitulosEstadisticaScreen();
    showScreen("titulos-estadistica");
  } else if (route === "titulos-encuesta") {
    location.hash = "#/titulos-encuesta";
    renderTitulosEncuestaScreen();
    showScreen("titulos-encuesta");
  } else if (route === "titulos-racha") {
    location.hash = "#/titulos-racha";
    renderTitulosRachaScreen();
    showScreen("titulos-racha");
  } else if (route === "ajustes") {
    location.hash = "#/ajustes";
    showScreen("ajustes");
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
  // de datos, Previas (de admin o de Jere), Estadísticas y toda la
  // sección /admin usan la estética "Bariloche" vía la clase
  // `.admin-frost`. Desde v0.23.0 Registro diario también usa esta
  // variante (antes era la única pantalla logueada que conservaba la
  // barra oscura original).
  bottomNav.classList.toggle(
    "bottom-nav-frost",
    route === "home" ||
      route === "admin" ||
      route === "previas" ||
      route === "stats" ||
      route === "titulos" ||
      route === "titulos-estadistica" ||
      route === "titulos-encuesta" ||
      route === "titulos-racha" ||
      route === "ajustes" ||
      route === "money" ||
      route === "previas-jere" ||
      route === "export" ||
      route === "daily"
  );
  // Dinero, Registro diario, Envío de datos y Previas (sección de
  // Jere) son parte de Home: mantenemos ese tab activo.
  // Previas y Ajustes son parte de Admin. Logros usa internamente las
  // rutas históricas "titulos".
  updateNav(
    route === "money" || route === "daily" || route === "export" || route === "previas-jere"
      ? "home"
      : route === "previas" || route === "ajustes"
      ? "admin"
      : route === "titulos" || route === "titulos-estadistica" || route === "titulos-encuesta" || route === "titulos-racha"
      ? "titulos"
      : route
  );
}

function routeFromHash() {
  const hash = location.hash.replace("#/", "");
  if (hash === "admin") return "admin";
  if (hash === "previas") return "previas";
  if (hash === "stats") return "stats";
  if (hash === "titulos") return "titulos";
  if (hash === "titulos-estadistica") return "titulos-estadistica";
  if (hash === "titulos-encuesta") return "titulos-encuesta";
  if (hash === "titulos-racha") return "titulos-racha";
  if (hash === "ajustes") return "ajustes";
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

document.getElementById("btn-admin-show-create-player").addEventListener("click", () => {
  setAdminCreatePlayerPanel(true);
  const input = document.getElementById("admin-new-player-name");
  if (input) input.focus();
});

document.getElementById("btn-admin-create-player").addEventListener("click", handleAdminCreatePlayerClick);

document.getElementById("btn-admin-cancel-create-player").addEventListener("click", () => {
  setAdminCreatePlayerPanel(false);
});

document.getElementById("btn-admin-reset-data").addEventListener("click", handleAdminResetDataClick);

document.getElementById("card-admin-previas").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("admin", "previas");
});

document.getElementById("btn-previas-back").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("previas", "admin");
});

document.getElementById("btn-stats-back").addEventListener("click", () => {
  navigateScreenToHomeWithTransition("stats");
});

document.getElementById("btn-titulos-back").addEventListener("click", () => {
  navigateScreenToHomeWithTransition("titulos");
});

document.getElementById("card-titulos-estadistica").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("titulos", "titulos-estadistica");
});

document.getElementById("btn-titulos-estadistica-back").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("titulos-estadistica", "titulos");
});

document.getElementById("card-titulos-encuesta").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("titulos", "titulos-encuesta");
});

document.getElementById("btn-titulos-encuesta-back").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("titulos-encuesta", "titulos");
});

document.getElementById("card-titulos-racha").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("titulos", "titulos-racha");
});

document.getElementById("btn-titulos-racha-back").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("titulos-racha", "titulos");
});

document.getElementById("card-admin-ajustes").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("admin", "ajustes");
});

document.getElementById("btn-ajustes-back").addEventListener("click", () => {
  navigateBetweenScreensWithTransition("ajustes", "admin");
});

document.getElementById("btn-export-backup").addEventListener("click", handleExportBackupClick);

document.getElementById("btn-import-backup").addEventListener("click", openBackupImportSheet);

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
      "titulos",
      "titulos-estadistica",
      "titulos-encuesta",
      "titulos-racha",
      "ajustes",
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
    const activeAnimatedOrigin = [
      "home",
      "previas",
      "stats",
      "titulos",
      "titulos-estadistica",
      "titulos-encuesta",
      "titulos-racha",
      "ajustes",
    ].find((r) => screens[r] && screens[r].classList.contains("active"));
    if (activeAnimatedOrigin) {
      navigateBetweenScreensWithTransition(activeAnimatedOrigin, "admin");
      return;
    }
  }

  if (route === "stats") {
    const activeAnimatedOrigin = ["home", "admin"].find((r) => screens[r] && screens[r].classList.contains("active"));
    if (activeAnimatedOrigin) {
      navigateBetweenScreensWithTransition(activeAnimatedOrigin, "stats");
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

/* =============================================================
   MODO PRUEBA — testData() / clearTestData()
   =============================================================
   Herramienta exclusiva de testing manual (consola del navegador),
   totalmente aislada del funcionamiento normal de la app. No agrega
   ninguna estructura nueva de datos: reutiliza tal cual userData:<id>
   (money/dailyLog) y adminPlayers, exactamente como los escribe la
   app real (ver ensureMoneyData/ensureDailyLogData, "money" en
   submitSheet, y confirmAdminImport).

   testData():
     - genera saldo inicial, gastos (todas las categorías vigentes
       salvo Transporte), ganancias y varios días de Registro diario
       ficticios para TODOS los PARTICIPANTS;
     - los escribe en userData:<id> (para que el propio usuario vea
       sus datos en Dinero/Registro diario/Envío de datos) Y en
       adminPlayers (porque Estadísticas/Títulos/Rachas SIEMPRE leen
       de adminPlayers, nunca de userData:<id> directamente — ver
       SPEC.md → "Estadísticas");
     - antes de sobreescribir, guarda un backup de lo que hubiera en
       ambas claves para cada jugador.

   clearTestData() restaura ese backup (o borra la clave si no había
   nada real antes), eliminando únicamente lo generado por testData().
   ----------------------------------------------------------- */

const TEST_DATA_MARKER = "__isTestData";
const TEST_BACKUP_KEY = "__testDataBackup";

function tdRandInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function tdPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function tdTimeStr(hh, mm) {
  return `${pad2(hh % 24)}:${pad2(mm)}`;
}

// Descripciones variadas por categoría (solo para que los gastos de
// prueba no se vean todos iguales; no es una estructura nueva, sigue
// siendo el mismo campo "name" de siempre).
const TEST_EXPENSE_DESCRIPTIONS = {
  Chocolates: ["Cofler", "Bon o Bon", "Alfajor Guaymallén", "Milka", "Rocklets"],
  Alcohol: ["Fernet", "Cerveza", "Gin tonic", "Vino", "Vodka"],
  Boliche: ["Entrada", "Guardarropa", "Trago en la barra", "Remis a la vuelta"],
  Comida: ["Panchos", "Hamburguesa", "Empanadas", "Pizza", "Sandwich"],
  Bebida: ["Agua", "Coca Cola", "Gatorade", "Jugo"],
  Actividades: ["Excursión Catedral", "Alquiler de esquís", "Circuito chico", "Rafting"],
  Otros: ["Farmacia", "Recuerdo", "Carga de celular", "Varios"],
};

const TEST_INCOME_NAMES = ["Ganancia en cartas", "Me prestaron plata", "Cambio de dólares", "Ganancia"];

// Un registro diario de prueba, con la misma forma exacta de
// defaultDailyEntry()/computeDailyDerived() ya existentes.
function generateTestDailyEntry(otherIds) {
  const entry = defaultDailyEntry();

  if (Math.random() < 0.85) {
    entry.sleep.bedtime = tdTimeStr(tdPick([22, 23, 0, 1, 2]), tdPick([0, 10, 20, 30, 40, 50]));
    entry.sleep.wake = tdTimeStr(tdPick([7, 8, 9, 10, 11, 12, 13]), tdPick([0, 10, 20, 30, 40, 50]));
  } else {
    entry.sleep.didNotSleep = true;
  }

  if (Math.random() < 0.4) {
    const start = tdTimeStr(tdPick([14, 15, 16, 17, 18]), tdPick([0, 20, 40]));
    const endMinutes = Math.min(timeToMinutes(start) + tdPick([20, 30, 40, 60, 90, 120]), timeToMinutes("22:00"));
    entry.nap = { start, end: tdTimeStr(Math.floor(endMinutes / 60), endMinutes % 60) };
  }

  entry.fifthMeal = Math.random() < 0.5 ? "yes" : "no";
  entry.bathroom = tdRandInt(0, 5);

  if (Math.random() < 0.6) {
    // La llegada al boliche es fija a la 01:00, así que la salida
    // siempre tiene que ser posterior.
    const exitHour = tdPick([1, 2, 3, 4, 5, 6]);
    const exitMin = exitHour === 1 ? tdPick([10, 20, 30, 40, 50]) : tdPick([0, 10, 20, 30, 40, 50]);
    entry.boliche.time = tdTimeStr(exitHour, exitMin);
  } else {
    entry.boliche.didNotGo = true;
  }

  entry.destroyedVote = otherIds.length && Math.random() < 0.7 ? tdPick(otherIds) : null;
  return entry;
}

// Inverso de isoToTripDayKey: para que un gasto/ganancia "cargado" el
// día siguiente a dayKey quede atribuido exactamente a dayKey (misma
// regla de corrimiento que ya usa el resto de la app).
function tdTripDayKeyToIso(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d + 1, tdRandInt(8, 20), tdRandInt(0, 59));
  return date.toISOString();
}

function testData() {
  const now = getSimulatedToday();
  const NUM_DAYS = 6;
  const backup = { userData: {}, adminPlayers: {} };
  const adminPlayers = getAdminPlayers();

  PARTICIPANTS.forEach((participant) => {
    const id = participant.id;

    // Backup de lo que hubiera ANTES de pisar nada, para poder
    // restaurarlo tal cual con clearTestData().
    backup.userData[id] = localStorage.getItem(STORAGE_KEYS.userData(id));
    backup.adminPlayers[id] = adminPlayers[id] || null;

    const initialBalance = tdRandInt(200000, 400000);

    // Días de prueba: los últimos NUM_DAYS días de calendario antes de
    // "hoy" (respeta day() si está simulando otra fecha), siempre
    // días cerrados según getStatsClosedDays().
    const dayKeys = [];
    for (let i = NUM_DAYS; i >= 1; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayKeys.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
    }

    const otherIds = PARTICIPANTS.filter((p) => p.id !== id).map((p) => p.id);
    const dailyEntries = {};
    dayKeys.forEach((key) => {
      const entry = generateTestDailyEntry(otherIds);
      entry.computed = computeDailyDerived(entry);
      dailyEntries[key] = entry;
    });

    const movements = [];

    // Ganancias (0 a 2), solo si corresponde ese día.
    let incomeTotal = 0;
    const incomeCount = tdRandInt(0, 2);
    for (let i = 0; i < incomeCount; i++) {
      const amount = tdRandInt(5000, 30000);
      incomeTotal += amount;
      movements.push({
        id: genId(),
        type: "income",
        name: tdPick(TEST_INCOME_NAMES),
        amount,
        date: tdTripDayKeyToIso(tdPick(dayKeys)),
      });
    }

    // Gastos: todas las categorías vigentes (nunca Transporte),
    // dejando entre 0% y 20% del saldo inicial sin gastar, sin
    // superar nunca el saldo disponible (inicial + ganancias).
    const spendableFraction = 0.8 + Math.random() * 0.2; // 80%-100%
    const targetSpend = initialBalance * spendableFraction;
    const weights = EXPENSE_CATEGORIES.map(() => 0.5 + Math.random());
    const weightSum = weights.reduce((a, b) => a + b, 0);

    EXPENSE_CATEGORIES.forEach((category, idx) => {
      const categoryBudget = targetSpend * (weights[idx] / weightSum);
      const purchaseCount = tdRandInt(1, 4);
      const purchaseWeights = Array.from({ length: purchaseCount }, () => 0.4 + Math.random());
      const pWeightSum = purchaseWeights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < purchaseCount; i++) {
        const rawAmount = categoryBudget * (purchaseWeights[i] / pWeightSum);
        const amount = Math.max(500, Math.round(rawAmount / 100) * 100);
        movements.push({
          id: genId(),
          type: "expense",
          name: tdPick(TEST_EXPENSE_DESCRIPTIONS[category]),
          category,
          amount,
          date: tdTripDayKeyToIso(tdPick(dayKeys)),
        });
      }
    });

    // Nunca superar el saldo disponible: si por redondeos el total de
    // gastos se pasara del máximo permitido, se escala todo hacia abajo.
    const maxAllowed = initialBalance + incomeTotal;
    const expenseTotal = movements.filter((m) => m.type === "expense").reduce((sum, m) => sum + m.amount, 0);
    if (expenseTotal > maxAllowed) {
      const scale = (maxAllowed * 0.95) / expenseTotal;
      movements.forEach((m) => {
        if (m.type === "expense") m.amount = Math.max(500, Math.round((m.amount * scale) / 100) * 100);
      });
    }

    // 1) userData:<id> — para que la vista del propio usuario (Dinero,
    //    Registro diario, Envío de datos) funcione con datos de prueba.
    const userData = {
      id,
      createdAt: new Date().toISOString(),
      [TEST_DATA_MARKER]: true,
      money: { initialBalance, movements: JSON.parse(JSON.stringify(movements)) },
      dailyLog: { entries: JSON.parse(JSON.stringify(dailyEntries)) },
    };
    saveUserData(id, userData);

    // 2) adminPlayers[id] — Estadísticas/Títulos/Rachas siempre leen de
    //    acá (nunca de userData:<id> directamente).
    adminPlayers[id] = {
      id,
      name: participant.name,
      data: { initialBalance, movements, dailyEntries },
      sourceVersion: EXPORT_CODE_VERSION,
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      [TEST_DATA_MARKER]: true,
    };
  });

  saveAdminPlayers(adminPlayers);
  localStorage.setItem(TEST_BACKUP_KEY, JSON.stringify(backup));
  console.log(
    `[testData] Datos ficticios generados para ${PARTICIPANTS.length} jugadores (${NUM_DAYS} días cada uno). Usá clearTestData() para revertir.`
  );
  refreshCurrentScreenForDaySim();
}

function clearTestData() {
  const raw = localStorage.getItem(TEST_BACKUP_KEY);
  if (!raw) {
    console.log("[clearTestData] No hay datos de prueba activos (no se encontró ningún backup de testData()).");
    return;
  }
  let backup;
  try {
    backup = JSON.parse(raw);
  } catch (e) {
    backup = null;
  }
  if (!backup) {
    localStorage.removeItem(TEST_BACKUP_KEY);
    return;
  }

  Object.keys(backup.userData).forEach((id) => {
    const key = STORAGE_KEYS.userData(id);
    const original = backup.userData[id];
    if (original === null || original === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, original);
    }
  });

  const players = getAdminPlayers();
  Object.keys(backup.adminPlayers).forEach((id) => {
    const original = backup.adminPlayers[id];
    if (original) {
      players[id] = original;
    } else {
      delete players[id];
    }
  });
  saveAdminPlayers(players);

  localStorage.removeItem(TEST_BACKUP_KEY);
  console.log("[clearTestData] Datos de prueba eliminados. Datos reales (si había) restaurados tal cual estaban.");
  refreshCurrentScreenForDaySim();
}

if (typeof window !== "undefined") {
  window.testData = testData;
  window.clearTestData = clearTestData;
}

/* -----------------------------------------------------------
   Init
   ----------------------------------------------------------- */

function init() {
  renderParticipantGrid();
  initLoginParallax();
  schedulePendingApiSync(1000);
  refreshParticipantsFromApi();

  const user = getCurrentUser();
  if (user) {
    navigate(routeFromHash());
  } else {
    navigate("select");
  }
}

window.addEventListener("online", () => {
  resetApiReadFailures();
  schedulePendingApiSync();
  if (getCurrentUser()) navigate(routeFromHash());
});

init();
