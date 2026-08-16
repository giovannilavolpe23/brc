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

Categorías futuras podrán incluir:

- chocolates
- alcohol
- tragos
- comida
- actividades
- otros

El sistema podrá mostrar posteriormente saldo, gráficos y estadísticas.

## Registro diario

Cada día el usuario podrá registrar datos como:

- horas dormidas
- hora de salida del boliche
- cantidad de veces que fue al baño
- quinta comida
- otros datos humorísticos o estadísticos

Los datos pertenecen al día correspondiente del viaje.

La fecha de inicio del viaje permitirá determinar automáticamente el día del viaje.

## Previas

Las previas serán administradas únicamente desde /admin.

No se registran individualmente desde cada usuario para evitar duplicaciones.

El administrador podrá:

- seleccionar participantes
- agregar bebidas/productos
- establecer precio y cantidad
- calcular total
- dividir el gasto
- guardar la previa
- consultar historial

Las previas también servirán para estadísticas futuras.

## Administración

/admin será exclusivo de Gio.

Futuras funciones:

- agregar/importar jugador
- editar jugador
- gestionar previas
- estadísticas
- rankings
- títulos/premios
- backups
- importar códigos de datos

## Código de intercambio

Cada usuario podrá generar posteriormente un código que represente sus datos.

El código podrá copiarse y enviarse a Gio.

Gio podrá pegarlo en /admin para importar o actualizar los datos correspondientes.

No es necesario que sea criptográficamente seguro. Su objetivo principal es que el contenido no sea legible a simple vista.

## Estadísticas futuras

Se podrán generar:

- gasto total
- gasto por categoría
- gasto diario
- participación en previas
- horas promedio de sueño
- hora promedio de salida del boliche
- rankings
- títulos humorísticos
- comparaciones entre participantes

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