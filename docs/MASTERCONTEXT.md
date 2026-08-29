CONTEXTO MAESTRO — PROYECTO BARILOCHE / ETAPA API

Quiero continuar este proyecto enfocándonos exclusivamente en diseñar e integrar progresivamente una API para la aplicación web existente.

IMPORTANTE: ESTA ETAPA ES SOLO DE ANÁLISIS Y PLANIFICACIÓN.

NO debes:

* escribir código;
* crear archivos;
* modificar archivos existentes;
* instalar dependencias;
* cambiar configuración;
* refactorizar;
* tocar el frontend;
* crear la API todavía;
* ejecutar migraciones;
* hacer commits.

Tu tarea inicial es únicamente analizar profundamente el repositorio real y devolver un plan técnico.

La aplicación frontend ya está prácticamente terminada y funciona localmente. No queremos rehacerla ni modificarla masivamente.

Actualmente los datos viven principalmente en localStorage y queremos migrar progresivamente hacia una arquitectura:

Frontend existente
→ API REST
→ PostgreSQL

Durante la transición debe poder coexistir:

Frontend
→ localStorage
→ API

localStorage puede seguir funcionando como cache, respaldo u offline. No debe eliminarse de golpe.

STACK PROPUESTO

Backend:

* Node.js
* TypeScript
* Express

Base de datos:

* PostgreSQL

Frontend:

* aplicación existente

Deploy esperado:

* frontend en Vercel
* backend en un hosting independiente
* PostgreSQL en Supabase u otro servicio similar

No cambies este stack salvo que encuentres una razón técnica clara. Si proponés una alternativa, explicá ventajas, desventajas y riesgo de migración.

USUARIOS

Actualmente existen:

Gio
Marto
Sebas
Ger
Nerea
Simon
Agus
Nata
Barua
Jere
Tobi

Gio:

* admin

Jere:

* usuario normal
* permiso especial create_previa

Los permisos deben ser independientes del rol.

Debe ser posible agregar nuevos jugadores en el futuro.

Los usuarios deben tener un ID interno único. No usar el nombre como identificador principal.

DATOS PRIVADOS

Existe saldoInicial.

Debe guardarse en la base de datos, pero es privado.

Un usuario puede consultar su propio saldoInicial.

Otros usuarios no deben poder consultar el saldoInicial ajeno.

La API puede utilizarlo internamente para estadísticas derivadas, pero nunca debe exponer el valor privado sin autorización.

La seguridad debe implementarse en backend, no solamente ocultando datos en el frontend.

GASTOS

Historial completo por usuario.

Datos conceptuales:

* usuario
* fecha
* descripción
* categoría
* monto

Categorías actuales:

* Chocolates
* Alcohol
* Boliche
* Comida
* Bebida
* Actividades
* Otros

Transporte ya no es una categoría válida.

No guardar solamente totales derivados. Mantener todos los movimientos originales.

INGRESOS

Historial completo:

* usuario
* fecha
* descripción
* monto

REGISTRO DIARIO

El registro corresponde al día anterior.

Incluye actualmente:

* horas de sueño
* hora de dormir
* hora de despertarse
* siesta
* duración de siesta
* quinta comida
* cantidad de veces que fue al baño
* hora de salida del boliche

Existe una lógica de simulación de fechas con funciones similares a:

day(14, 9)
day(15, 9)

Debes localizar exactamente cómo funciona esta lógica en el código.

ESTADÍSTICAS

Las estadísticas deben calcularse a partir de los datos históricos.

No almacenar como fuente principal:

* totales
* rankings
* rachas
* títulos

Debe existir soporte conceptual para estadísticas:

DÍA

* solamente un día anterior
* nunca día actual ni futuro

TOTAL

* acumulado histórico

Existen rankings por categorías de gastos.

Si una categoría no tiene registros, no debe mostrarse.

RACHAS

Las rachas se calculan desde registros históricos.

No deben persistirse como fuente principal.

TÍTULOS

Existen títulos derivados de:

* estadísticas
* encuestas
* rachas

No deben almacenarse como fuente principal salvo que el análisis del código actual demuestre una necesidad especial.

ENCUESTAS

Las respuestas deben conservarse históricamente.

Conceptualmente:

* fecha
* encuesta
* votante
* persona votada

Un usuario no puede votarse a sí mismo.

Más adelante existirán más encuestas.

PREVIAS

Una previa incluye conceptualmente:

* creador
* productos
* precio
* cantidad
* participantes
* total
* costo por participante
* fecha
* código único

Cada participante debe quedar registrado individualmente.

Gio puede:

* registrar una previa directamente;
* ingresar el código de una previa creada por otra persona.

Ambos métodos deben terminar representando la misma entidad de previa.

El permiso para crear previas debe ser configurable:

create_previa

No codificar condiciones específicas como:

if user === "Jere"

BACKUPS

La aplicación ya tiene:

* Exportar backup
* Importar backup

El backup contiene datos históricos.

Debe seguir existiendo.

A futuro puede utilizarse para:

* respaldo local
* migración localStorage → API
* recuperación

OBJETIVO GENERAL

La API debe desarrollarse progresivamente.

Orden conceptual:

FASE 1
API independiente

FASE 2
PostgreSQL

FASE 3
usuarios y autenticación

FASE 4
endpoints principales

FASE 5
tests

FASE 6
integración de un módulo del frontend

FASE 7
sincronización localStorage + API

FASE 8
migración progresiva

No implementar tiempo real inicialmente.

Actualizar datos al consultar/refrescar es suficiente.

WebSockets o SSE pueden evaluarse mucho más adelante.

FORMA DE TRABAJO

Después de esta auditoría, cada futura etapa debe seguir:

1. analizar;
2. explicar qué se cambiará;
3. implementar;
4. ejecutar tests;
5. verificar regresiones;
6. documentar;
7. recién avanzar.

Git debe utilizarse para poder volver atrás si una etapa falla.

DOCUMENTACIÓN EXISTENTE

El repositorio contiene archivos .md mantenidos durante el desarrollo anterior.

Leelos y utilizalos como contexto, pero no confíes ciegamente en ellos.

El código real es la fuente principal de verdad.

Si existe una contradicción entre documentación y código:

* señalala;
* indicá qué comportamiento implementa realmente el código.

TAREA ACTUAL

Analizá el repositorio completo SIN MODIFICARLO.

Quiero un informe técnico en "plan mode".

El informe debe incluir como mínimo:

1. Stack actual del proyecto.
2. Estructura relevante de carpetas y archivos.
3. Cómo se representan actualmente los usuarios.
4. Inventario completo de claves localStorage.
5. Estructura real de cada dato almacenado.
6. Gastos.
7. Ingresos.
8. Registro diario.
9. Encuestas.
10. Previas.
11. Backups.
12. Estadísticas.
13. Rachas.
14. Títulos.
15. Lógica de fechas y simulación day().
16. Relaciones y dependencias entre módulos.
17. Qué código depende de nombres de jugadores fijos.
18. Qué datos actualmente se consideran privados.
19. Riesgos al agregar la API.
20. Posibles incompatibilidades con PostgreSQL.
21. Propuesta inicial de modelo de datos relacional.
22. Propuesta de autenticación.
23. Propuesta de roles y permisos.
24. Estrategia para proteger saldoInicial.
25. Estrategia para coexistencia localStorage + API.
26. Estrategia para evitar duplicados al sincronizar.
27. Estrategia de migración de datos locales existentes.
28. Qué archivos del frontend eventualmente necesitarán cambios.
29. Orden recomendado de implementación del backend.
30. Plan de tests.
31. Estrategia Git por etapas.
32. Decisiones que deberían tomarse antes de escribir código.

IMPORTANTE:

No quiero todavía código.

Al final del informe agregá una sección:

"DECISIONES QUE NECESITAN APROBACIÓN"

Ahí listá únicamente las decisiones arquitectónicas que consideres que debemos definir antes de implementar.

No empieces ninguna implementación hasta recibir una orden explícita posterior.
