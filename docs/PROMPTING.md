Quiero implementar WEB PUSH NOTIFICATIONS completas en la app.

Esta feature debe sentirse como parte nativa de la aplicación y funcionar con la arquitectura actual:

- Frontend: Vercel
- Backend: Node + TypeScript + Express en Render
- PostgreSQL: Supabase
- Auth: Bearer token
- Mobile-first / acceso directo tipo app
- Usuarios dinámicos y originales
- Zona horaria del viaje: America/Argentina/Buenos_Aires

IMPORTANTE:
- no romper auth;
- no romper offline queue;
- no romper daily entries;
- no romper stats;
- no hacer commit todavía;
- no agregar servicios pagos innecesarios;
- usar Web Push estándar.

# 1. OBJETIVO

Quiero implementar inicialmente SOLO dos notificaciones automáticas:

1. Recordatorio de registro:
`¡No olvides de hacer tu registro!`

2. Estadísticas disponibles:
`¡Ya están disponibles las estadisticas de ayer!`

Además quiero una notificación manual de prueba desde mis Ajustes.

# 2. FUNCIONAMIENTO DEL REGISTRO

Recordar el concepto actual de la aplicación:

El Registro diario se realiza al día siguiente.

Ejemplo:

Hoy es 21/09.
El registro que completa el usuario corresponde al 20/09.

Un mismo usuario puede enviar/modificar ese registro varias veces.
Eso actualiza el registro de esa fecha y NO crea duplicados.

Por lo tanto, para notificaciones:
“registro pendiente” significa que el usuario todavía NO tiene daily entry correspondiente a AYER.

Usar siempre zona horaria:

America/Argentina/Buenos_Aires

No depender de UTC de forma que pueda cambiar de fecha incorrectamente.

# 3. RECORDATORIO DE LAS 10:00

Todos los días a las 10:00 AM hora Argentina:

comprobar qué usuarios activos todavía NO tienen un registro del día anterior.

Enviar push SOLO a esos usuarios:

Título:
`¡No olvides de hacer tu registro!`

Texto secundario:
puede ser breve y coherente con la app, por ejemplo:
`Completá lo de ayer cuando puedas.`

No mandar nada a quienes ya hicieron su registro.

IMPORTANTE:
- no duplicar el recordatorio varias veces el mismo día;
- un usuario con varios dispositivos puede recibirlo en sus dispositivos suscritos;
- usuarios sin suscripción simplemente se ignoran.

# 4. PROGRAMACIÓN DE LAS 10:00

Auditar primero qué mecanismo de scheduling encaja con la infraestructura actual.

El backend Render puede dormir, por lo que NO asumir que un setInterval dentro del servidor es suficiente.

Elegir una solución confiable y simple compatible con el proyecto.

Preferir una opción gratuita/existente si es posible.

Puede ser:
- scheduler externo que invoque un endpoint protegido;
- cron compatible con la infraestructura;
- mecanismo equivalente seguro.

NO implementar un timer en memoria que dependa de que Render permanezca despierto.

El endpoint de cron, si existe:
- debe estar protegido;
- no debe ser accesible libremente;
- debe ser idempotente.

Al final explicarme qué configuración externa necesito hacer yo.

# 5. ESTADÍSTICAS DE AYER DISPONIBLES

Cada vez que se guarda correctamente un daily entry:

después del PUT exitoso, comprobar si TODOS los usuarios activos que deben participar ya tienen registro para esa fecha.

Ejemplo:

Faltaba únicamente Marto.
Marto envía el registro del 20/09.
Ahora todos tienen el 20/09 completo.

=> mandar a todos los usuarios suscritos:

Título:
`¡Ya están disponibles las estadisticas de ayer!`

IMPORTANTE:
esta push debe salir UNA SOLA VEZ por fecha.

Si después Marto edita nuevamente su registro:
NO volver a notificar.

Persistir en DB que la notificación de stats-ready de esa fecha ya fue enviada.

Debe ser idempotente incluso con requests simultáneas.

# 6. QUÉ USUARIOS CUENTAN PARA “TODOS”

Usar participantes/usuarios activos reales de la app.

No contar:
- usuarios desactivados;
- usuarios eliminados;
- elementos locales que no representen usuarios API reales.

Reutilizar la misma fuente de participantes válida que ya usa el backend.

No hardcodear los 11 originales.

Lara, Mati y cualquier jugador dinámico futuro deben entrar automáticamente si están activos.

# 7. WEB PUSH

Implementar Web Push estándar mediante Service Worker.

Necesidades:

- service worker;
- Push API;
- Notification API;
- claves VAPID;
- almacenamiento de PushSubscription;
- backend capaz de enviar pushes.

Usar una librería backend liviana y estándar si corresponde.

NO meter frameworks PWA pesados.

# 8. VAPID

Preparar soporte VAPID correctamente.

Las claves:
- nunca deben hardcodearse;
- nunca deben entrar al repo;
- privadas solo backend;
- public key puede llegar al frontend.

Usar variables de entorno apropiadas.

Al finalizar decirme:
- qué variables debo crear en Render;
- cómo generar las claves;
- cuáles son secretas;
- cuáles pueden ser públicas.

NO imprimir secretos reales.

# 9. BASE DE DATOS

Crear migración nueva.

Guardar suscripciones push asociadas a:

- user_id
- endpoint
- keys necesarias
- dispositivo/subscription identifier si corresponde
- created_at
- updated_at

Un usuario puede tener MÁS DE UNA suscripción porque puede usar:
- celular;
- otro celular;
- PC.

No modelarlo como una sola subscription por user.

También guardar el estado necesario para evitar duplicados de:

`stats ready`

por fecha.

Si hace falta otra tabla para delivery/eventos, mantenerla simple.

# 10. ENDPOINTS

Diseñar endpoints autenticados coherentes.

Ejemplo conceptual:

GET /push/status
POST /push/subscribe
DELETE /push/unsubscribe
POST /push/test

No tienen que llamarse exactamente así si la arquitectura existente pide otra cosa.

Reglas:
- subscribe asocia subscription al usuario autenticado;
- unsubscribe elimina únicamente esa suscripción/dispositivo;
- test envía únicamente al usuario/dispositivo correspondiente;
- un usuario normal no puede enviar pushes a otros.

# 11. ACTIVACIÓN INICIAL

Todos los usuarios están avisados de que deben activar las notificaciones.

La primera vez que un usuario entra a Home en un dispositivo compatible y todavía no existe decisión/suscripción:

mostrar inmediatamente un modal propio de la app.

Texto aproximado:

`Activá las notificaciones`

`Recibí el recordatorio del registro y enterate cuando estén listas las estadísticas.`

Botón:

`Activar notificaciones`

Al pulsarlo:
=> recién ahí llamar Notification.requestPermission().

No intentar pedir el permiso del sistema automáticamente sin interacción.

# 12. SI ACEPTA

Si permission === granted:

- registrar service worker;
- obtener PushSubscription;
- enviarla al backend;
- asociarla al usuario;
- cerrar modal;
- mostrar confirmación sutil.

No volver a mostrar modal en ese dispositivo mientras siga correctamente configurado.

# 13. SI RECHAZA

Si permission === denied:

- cerrar el modal;
- no acosar al usuario cada vez que abre Home;
- no mostrar repetidamente requestPermission.

Debe poder consultar posteriormente el estado desde configuración/control correspondiente.

# 14. IPHONE / IOS

Implementar detección razonable para iOS.

Web Push en iPhone debe contemplar que la web se use como aplicación agregada a pantalla de inicio.

Si un usuario iPhone intenta activar notificaciones desde un contexto donde Web Push no está disponible correctamente:

mostrar dentro de la app instrucciones breves y claras para:

1. compartir;
2. Agregar a pantalla de inicio;
3. abrir la app desde el icono;
4. volver a activar notificaciones.

No mostrar instrucciones Android a iPhone.

No intentar hacks para saltarse restricciones de iOS.

# 15. ANDROID

En Android/Chrome compatible:

el proceso debe funcionar normalmente desde la web/PWA.

Las notificaciones deben integrarse con el sistema operativo de forma normal.

# 16. CLICK EN NOTIFICACIÓN

El service worker debe manejar notificationclick.

Recordatorio:

`¡No olvides de hacer tu registro!`

=> abrir/enfocar la aplicación y llevar directamente a Registro diario.

Stats:

`¡Ya están disponibles las estadisticas de ayer!`

=> abrir/enfocar aplicación y navegar a:
Estadísticas > Día > ayer

Si ya existe una ventana abierta:
preferir enfocarla/navegarla antes que abrir copias innecesarias.

Mantener navegación/hash routing actual.

# 17. AJUSTES DE GIO

En MIS Ajustes actuales de Admin/Gio agregar una sección:

`Notificaciones`

IMPORTANTE:
esto es un panel de control para mi dispositivo/usuario, NO una herramienta para manipular las notificaciones de otros usuarios.

Mostrar:

Estado actual, por ejemplo:
- Activadas
- Desactivadas
- Bloqueadas por navegador
- No compatibles

Acciones:

`Activar notificaciones`
`Desactivar notificaciones`
`Enviar notificación de prueba`

Mostrar únicamente las acciones que tengan sentido según estado.

# 18. ACTIVAR DESDE AJUSTES

Al tocar Activar:

- pedir permiso si corresponde;
- registrar subscription;
- persistir backend;
- actualizar estado.

# 19. DESACTIVAR DESDE AJUSTES

Al tocar Desactivar:

- unsubscribe() en navegador;
- eliminar esa subscription del backend;
- actualizar UI.

No pretender modificar el permiso global del navegador, porque eso pertenece al SO/browser.

Si el navegador sigue diciendo permission=granted pero no existe subscription:
mostrar estado real correctamente.

# 20. NOTIFICACIÓN DE PRUEBA

Agregar botón:

`Enviar notificación de prueba`

Debe mandar una push REAL a mi dispositivo mediante el mismo pipeline de producción.

Ejemplo:

Título:
`Notificaciones funcionando`

Texto:
`Bariloche ya puede mandarte notificaciones.`

No simularla con un toast.
Quiero probar service worker + backend + Web Push realmente.

Debe estar limitado al usuario/dispositivo autenticado.

# 21. SUSCRIPCIONES INVÁLIDAS

Cuando el proveedor Web Push responda que una subscription ya no existe / expiró:

- eliminarla automáticamente de PostgreSQL;
- no seguir intentando enviarla para siempre.

Una subscription rota no debe impedir mandar al resto.

# 22. FALLOS

Las notificaciones son una feature secundaria.

Si Web Push falla:
- NO romper daily entry;
- NO romper login;
- NO romper stats;
- NO devolver error al guardado diario solo porque no pudo enviarse una push.

Ejemplo:

daily entry se guardó OK
push falló

=> daily entry sigue devolviendo éxito.

Registrar/loguear el fallo push de forma segura.

# 23. IDEMPOTENCIA / CONCURRENCIA

Muy importante con stats-ready.

Dos usuarios podrían mandar su registro casi simultáneamente.

Evitar:
- dos pushes globales;
- race conditions;
- marcar dos veces el mismo día.

Resolver mediante DB/constraint/transacción/upsert o mecanismo robusto equivalente.

# 24. SEGURIDAD

- validar PushSubscription;
- limitar payload;
- auth obligatoria para suscribirse;
- test únicamente propio;
- endpoint scheduler protegido;
- secrets fuera del repo;
- no exponer private VAPID key;
- no permitir envío arbitrario de texto desde cliente.

# 25. SERVICE WORKER Y CACHE

La app actualmente tiene comportamiento offline/cache.

Auditar cuidadosamente antes de agregar service worker.

NO romper:
- carga de nuevas versiones;
- script.js/styles.css actualizados;
- offline queue existente.

Evitar crear caching agresivo que vuelva a provocar versiones viejas de la web.

Si ya existe service worker, extenderlo en vez de registrar otro que compita.

Web Push es la prioridad; NO necesitamos convertir toda la app en una PWA offline avanzada.

# 26. UX

Mantener estética actual:
- light mode;
- dark mode;
- glass;
- mobile-first;
- transiciones suaves.

El modal inicial y la sección de Ajustes deben parecer partes reales de la app.

No usar:
- alert()
- confirm()
- prompt()

Usar UI interna existente.

# 27. NO HACER

No agregar todavía:
- push por cambio de Rey;
- push por logros;
- push por rachas;
- marketing;
- mensajes manuales a otros usuarios;
- chat;
- notificaciones constantes.

Solo:
1. recordatorio 10:00;
2. estadísticas disponibles;
3. prueba manual propia.

# 28. TESTS

Cubrir al menos:

SUBSCRIPTIONS
- subscribe;
- unsubscribe;
- múltiples dispositivos por usuario;
- usuario A no modifica subscription de B;
- subscription inválida.

RECORDATORIO
- usuario sin registro de ayer => recibe;
- usuario con registro => no recibe;
- usuario inactivo => no cuenta/recibe;
- no duplicar recordatorio.

STATS READY
- falta una persona => no enviar;
- entra último registro => enviar;
- editar después => no repetir;
- requests concurrentes => una sola notificación global;
- usuarios dinámicos activos cuentan.

PUSH FAILURE
- subscription muerta se limpia;
- fallo push no rompe daily entry.

FRONTEND
- permission default;
- granted;
- denied;
- unsupported;
- subscribe/unsubscribe;
- iOS instructions;
- notificationclick routing.

# 29. VALIDACIÓN

Ejecutar:

- migraciones
- npm test
- npm run typecheck
- npm run build
- node --check script.js
- npm run db:health

Revisar manualmente:
- Android;
- Home modal;
- activar;
- desactivar;
- test push;
- click en push;
- dark/light;
- Ajustes Gio;
- reload;
- logout/login;
- múltiples usuarios.

IMPORTANTE:
si creás una nueva migración, APLICARLA también a la base de datos real utilizada por producción antes de considerar terminada la implementación.

No repetir el problema anterior donde backend esperaba una tabla cuya migración todavía no estaba aplicada.

Antes de ejecutar una migración:
- revisar que sea segura;
- no borrar datos;
- no truncar;
- no resetear usuarios.

No hacer commit.

# 30. INFORME FINAL

Quiero que me devuelvas:

1. arquitectura Web Push elegida;
2. migraciones creadas Y si fueron aplicadas;
3. endpoints;
4. variables de entorno necesarias;
5. mecanismo usado para ejecutar las 10:00;
6. lógica exacta para detectar “todos registraron ayer”;
7. cómo evitaste duplicados;
8. cómo funciona Android;
9. cómo se maneja iPhone/iOS;
10. cómo funcionan activar/desactivar/test desde Ajustes;
11. tests;
12. pasos manuales que tengo que hacer en Render/Vercel/Supabase u otro servicio.