Quiero actualizar por completo el sistema de generación de datos de prueba para que use la lógica ACTUAL de la aplicación.

Contexto:

Al ejecutar el generador actualmente recibo:

`500 Internal Server Error`

y en Render aparece:

`Error: daily_surveys_not_found`

La app cambió bastante desde que se creó originalmente el generador:
- cambiaron estadísticas;
- cambiaron títulos/logros;
- existen nuevas encuestas;
- existen rachas;
- existen múltiples Reyes;
- existen usuarios dinámicos;
- cambió la lógica de 8 noches / 9 días;
- el sistema de Stats API es ahora más completo.

Mi sospecha es que el generador sigue intentando crear datos según una estructura antigua.

NO quiero simplemente atrapar `daily_surveys_not_found`.

Quiero que revises cómo funciona HOY la app real y adaptes la generación de datos de prueba a esa arquitectura.

# 1. PRIMERO: AUDITAR

Antes de modificar nada, inspeccioná:

- Daily Entries actuales;
- Surveys actuales;
- Money;
- Previas;
- Stats Día;
- Stats Total;
- Rachas;
- títulos;
- Rey de Bariloche;
- usuarios activos/dinámicos;
- generador actual;
- endpoints de simulación;
- helpers de fechas;
- offline/sync si aplica;
- migrations actuales.

Identificar exactamente:

1. qué datos genera hoy el simulador;
2. qué estructura antigua sigue esperando;
3. de dónde sale exactamente `daily_surveys_not_found`;
4. qué partes del generador ya no coinciden con el modelo real.

No asumir que el problema es solamente Surveys.

# 2. PRINCIPIO FUNDAMENTAL

El generador NO debe tener una segunda implementación manual de:

- estadísticas;
- títulos;
- rachas;
- Rey;
- encuestas.

Debe generar DATA BASE válida y dejar que las funciones reales de producción calculen:

- Stats Día;
- Stats Total;
- títulos;
- rachas;
- Rey de Bariloche;
- Casi Reyes.

La simulación debe comportarse como si los usuarios reales hubieran usado la aplicación.

NO hardcodear resultados finales.

Ejemplo incorrecto:

`Gio es El más dormilón`

Ejemplo correcto:

generar daily entries coherentes y dejar que el sistema real determine quién es El más dormilón.

# 3. ENCUESTAS ACTUALES

Revisar el sistema REAL de encuestas.

Actualmente deben existir como mínimo:

- `destroyed_vote`
- encuesta de `El más chamullero`
- encuesta de `El mejor outfit`

No asumir que existe una entidad antigua llamada `daily_surveys` si la arquitectura nueva ya no trabaja así.

El generador debe usar exactamente el mismo formato/modelo/endpoints que usa un usuario real al votar.

Para cada fecha simulada:
- usuarios activos;
- un voto por usuario por encuesta;
- no self-vote;
- candidatos válidos;
- votos variados;
- algunos empates posibles;
- sin duplicados.

Corregir la causa real de:

`daily_surveys_not_found`

No ocultar el error con try/catch si la simulación está generando datos incorrectamente.

# 4. GENERAR DATOS DE ENTRADA, NO ESTADÍSTICAS

Muy importante:

El generador debe crear únicamente los datos fuente necesarios:

- daily entries;
- money movements;
- previas;
- survey votes;
- cualquier otro input real necesario.

Después:
Stats debe leer esos datos mediante la lógica normal.

NO insertar:
- rankings precalculados;
- títulos manuales;
- Rey manual;
- rachas manuales;
- stats artificiales.

# 5. DAILY ENTRIES

Generar Daily Entries usando la estructura actual exacta.

Respetar:

- sueño;
- no dormir, si existe actualmente;
- siesta;
- quinta comida;
- baño;
- boliche;
- computed derivados;
- validaciones horarias;
- fecha correspondiente.

No guardar campos `computed` si producción normalmente los deriva.

Usar los mismos contratos que las rutas reales.

# 6. DINERO

Usar el modelo actual de Money.

Generar variedad por usuario y fecha.

Usar únicamente categorías actuales:

- Chocolates
- Alcohol
- Boliche
- Comida
- Bebida
- Actividades
- Otros

No usar categorías eliminadas.

Respetar:
- expense/income;
- legacy_id/idempotencia;
- ownership por usuario;
- fechas.

# 7. PREVIAS

Generar previas compatibles con el modelo actual.

Usar:
- usuarios activos;
- participantIds válidos;
- creador válido;
- cantidades/precios coherentes;
- fechas correctas;
- permisos si la ruta real los exige.

No inventar usuarios.

# 8. USUARIOS

No hardcodear solamente los 11 usuarios originales.

Obtener usuarios activos desde la fuente actual.

Debe incluir automáticamente usuarios dinámicos activos.

Excluir:
- inactivos;
- eliminados.

# 9. 8 NOCHES

`Simular 8 noches` debe producir exactamente:

8 fechas cerradas consecutivas.

Es un viaje de:
- 9 días;
- 8 noches;
- 8 registros diarios evaluables.

No generar 9 registros.

Usar los helpers actuales de fechas.

No inventar una segunda regla para detectar que el viaje terminó.

Después de simular 8 noches, la app debe reconocer naturalmente que existen 8 días cerrados.

# 10. SIMULAR AYER

`Simular el día de ayer` debe:

- generar solamente ayer;
- usar las estructuras actuales;
- no generar otras fechas;
- poder ejecutarse nuevamente sin crear duplicados inconsistentes.

Daily debe respetar reemplazo/idempotencia.

Survey votes también.

# 11. DATOS INTERESANTES

La simulación debe producir variedad suficiente para probar la app.

No quiero puro random sin control.

Generar perfiles distintos entre usuarios para que existan:

- distintos ganadores de sueño;
- menos sueño;
- siestas;
- quinta comida;
- baño;
- boliche;
- gasto;
- previas;
- encuestas;
- rachas.

Generar también:
- algunas rachas de 2;
- algunas de 3+;
- rachas que después se corten;
- algunos empates naturales;
- distintos líderes conforme avanzan los días.

No hacer que siempre gane Gio.
No hacer que todos tengan prácticamente lo mismo.

# 12. TÍTULOS DINÁMICOS

El generador NO debe asignar títulos.

Pero los datos generados deben permitir que el sistema actual calcule correctamente los títulos dinámicos existentes.

Incluyendo como mínimo:

- El más dormilón
- El más zombi
- El rey de la siesta
- La panza más grande
- Minigun de mierdas
- El que más se la bancó en el baile
- Billetera sin fondo
- El más manija
- El más destruido
- El más chamullero
- El mejor outfit
- todas las rachas actuales.

Revisar el código y agregar cualquier otro título actual que falte en esta lista.

# 13. EMPATES

No fabricar manualmente ganadores.

Si los datos generan empate:
usar exactamente las reglas actuales del sistema.

No introducir desempates especiales desde el simulador.

# 14. REY DE BARILOCHE

NO calcular ni guardar Rey desde el generador.

Después de insertar los datos:
`buildTotalAchievementProfiles()` o la lógica actual equivalente debe determinarlo.

El generador solo debe dejar un dataset válido.

Debe soportar naturalmente:
- Rey único;
- múltiples Reyes;
- Casi Reyes.

# 15. FRASE DEL REY

Con 8 noches completas:

si un Rey tiene configurada `Frase del Rey`,
debe mostrarse por la lógica normal.

No crear ni modificar frases desde el generador.

# 16. PUSH

Revisar cuidadosamente cómo interactúa la simulación con:

`¡Ya están disponibles las estadisticas de ayer!`

No quiero que `Simular 8 noches` envíe 8 notificaciones reales consecutivas a los usuarios.

La simulación masiva debe evitar spam.

Pero no romper la lógica real de stats-ready para registros normales.

Para `Simular el día de ayer`, revisar el comportamiento actual y decidir la forma más coherente:
- si usa el mismo cierre real del día, puede disparar una sola stats-ready;
- nunca duplicarla si ya fue enviada.

Preservar la idempotencia existente.

# 17. DATOS DE PRUEBA VS REALES

MUY IMPORTANTE.

No borrar ni sobrescribir accidentalmente datos reales.

Revisar cómo se identifican actualmente datos simulados.

Reutilizar la estrategia segura existente.

Si el sistema actual no distingue suficientemente bien datos simulados:
hacer el cambio mínimo necesario para que reejecutar la simulación pueda limpiar/reemplazar SOLO sus propios datos.

NO:
- TRUNCATE global;
- reset general;
- borrar usuarios;
- borrar appearances;
- borrar push subscriptions;
- borrar auth;
- borrar frases;
- borrar configuraciones.

# 18. API REAL

Siempre que sea razonable, reutilizar services/repositories/helpers reales.

Evitar lógica duplicada del tipo:

`simulateStats()`

si producción ya tiene:

`calculateStats()`

La simulación debe estar lo más cerca posible de ejecutar el mismo flujo real.

# 19. ERROR HANDLING

Si falla una parte de la simulación:

- devolver información útil;
- loguear causa real;
- no convertir errores específicos en un `500` opaco innecesariamente;
- no mostrar éxito si hubo fallo parcial.

Corregir específicamente el flujo que hoy termina en:

`daily_surveys_not_found`

# 20. UI

Mantener únicamente las dos opciones actuales:

- `Simular 8 noches`
- `Simular el día de ayer`

No volver a 6/7.

Mantener diseño actual.

No agregar más controles salvo que sean estrictamente necesarios.

# 21. TESTS IMPORTANTES

Agregar/actualizar tests que validen:

## Simular 8 noches

- exactamente 8 fechas;
- usuarios activos;
- daily entries válidos;
- money válido;
- previas válidas;
- destroyed_vote válido;
- chamullero válido;
- outfit válido;
- no self-votes;
- no duplicados;
- Stats Día funciona;
- Stats Total funciona;
- títulos funcionan;
- rachas funcionan;
- Rey funciona;
- frase Rey puede desbloquearse;
- no aparece `daily_surveys_not_found`;
- no envía spam de push.

## Simular ayer

- solamente ayer;
- reejecución segura;
- no daily duplicado;
- votos sin duplicados;
- stats funcionan;
- no rompe otros días.

# 22. VALIDACIÓN EN PRODUCCIÓN

Si aparece una migración nueva:

- revisarla;
- ejecutar migración contra Supabase real;
- verificar que no sea destructiva;
- ejecutar `db:health`.

Después probar contra el backend real de Render si la arquitectura actual lo permite.

# 23. COMANDOS

Ejecutar:

- node --check script.js
- npm test
- npm run typecheck
- npm run build
- npm run db:health

# 24. NO TOCAR

No hacer todavía la remodelación futura de:

- DINÁMICOS;
- GENERALES;
- ÚNICOS;
- SECRETOS;
- DUPLICADO;
- popup de secreto;
- catálogo Admin de logros.

Eso todavía no se implementa.

Esta tarea es EXCLUSIVAMENTE modernizar el generador para que produzca datos compatibles con el sistema ACTUAL.

No hacer commit.

# 25. REPORTE FINAL

Al terminar, explicame:

1. causa exacta de `daily_surveys_not_found`;
2. qué parte del generador estaba desactualizada;
3. cómo generaba encuestas antes;
4. cómo las genera ahora;
5. si había otras estructuras antiguas además de Surveys;
6. cómo se generan ahora las 8 noches;
7. cómo evitás alterar datos reales;
8. cómo evitás spam de notificaciones;
9. tests realizados.