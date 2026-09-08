Quiero modificar la herramienta actual de `Simular datos`.

Contexto real del viaje:

- El viaje dura 9 días.
- Hay 8 noches.
- El Registro diario siempre corresponde al día anterior.
- Si hoy es 21/09, el registro que se carga corresponde al 20/09.
- Las estadísticas por día deben trabajar solamente con días cerrados/pasados.
- El objetivo de esta simulación es poder probar la app completa antes del viaje.

Actualmente la herramienta permite elegir algo equivalente a simular 6 o 7 días/noches.

Quiero reemplazar eso por SOLO estas dos opciones:

1. `Simular 8 noches`
2. `Simular el día de ayer`

No quiero mantener las opciones antiguas de 6/7.

# 1. SIMULAR 8 NOCHES

Esta opción debe generar un escenario completo equivalente al viaje terminado.

Debe crear datos coherentes para las 8 noches del viaje.

Como son 9 días de viaje:
- Día 1 ocurre.
- A partir del Día 2 se registra lo ocurrido el Día 1.
- ...
- En el Día 9 se registra lo ocurrido en la noche/día anterior.
- Resultado final: 8 registros diarios cerrados disponibles.

La simulación debe generar exactamente 8 fechas válidas consecutivas de registro/estadística.

No generar 9 registros.
No generar solamente 7.
No incluir hoy/futuro como día cerrado si la lógica real no lo permite.

# 2. FECHAS

Usar la lógica temporal REAL que ya tiene la app.

No hardcodear fechas si ya existen helpers de viaje.

La simulación debe crear 8 días consecutivos válidos inmediatamente anteriores al día actual o según el rango de viaje que ya tenga configurado el proyecto.

Lo importante es que al terminar:

- Estadísticas Día permita navegar 8 días.
- Total acumule esas 8 noches.
- las rachas puedan alcanzar hasta 8.
- títulos/logros puedan calcularse sobre las 8 noches.
- la frase final del Rey se considere desbloqueada porque ya existen las 8 noches completas.

No inventar una segunda definición de “viaje terminado”.

Reutilizar la misma condición que usa la app para saber si ya están completas las 8 noches.

# 3. DATOS GENERADOS

La simulación de 8 noches debe generar datos suficientemente variados para probar:

- sueño;
- no dormir si existe esa opción;
- siestas;
- quinta comida;
- baño;
- boliche;
- gastos;
- ingresos si la simulación actual los contempla;
- categorías de gastos;
- previas;
- encuesta de destruido;
- rankings;
- títulos;
- rachas positivas;
- rachas negativas;
- Rey de Bariloche;
- múltiples Reyes cuando ocurra naturalmente;
- Casi Reyes;
- perfil del Rey;
- frase del Rey al haberse completado 8 noches.

No hace falta forzar artificialmente TODOS los edge cases en una sola simulación si eso vuelve incoherentes los datos.

Pero sí generar un dataset rico y creíble que permita recorrer toda la app.

# 4. COHERENCIA

Los datos simulados deben respetar validaciones reales.

Ejemplos:

SUEÑO
- horarios válidos;
- wake posterior a bedtime según la lógica nocturna;
- si `did_not_sleep`, no generar horarios contradictorios.

SIESTA
- inicio y fin válidos;
- fin posterior al inicio.

BOLICHE
- respetar horarios permitidos;
- no generar salida inválida;
- si no fue, no generar minutos de boliche.

DINERO
- categorías válidas actuales;
- montos válidos;
- no usar categorías antiguas/eliminadas.

PREVIAS
- participantes reales/activos;
- valores compatibles con cálculo actual.

ENCUESTAS
- no votar por usuarios inexistentes;
- respetar reglas actuales, incluyendo self-vote si está prohibido.

No saltarse validaciones solo porque sean datos simulados.

# 5. VARIEDAD ENTRE USUARIOS

No generar los mismos datos para todos.

Quiero que la simulación produzca rankings interesantes.

Por ejemplo:
- alguien duerme claramente poco;
- alguien hace muchas siestas;
- alguien tiene más quintas comidas;
- alguien va más al boliche;
- alguien gasta más;
- distintos usuarios ganan encuestas;
- algunas rachas se mantienen varios días;
- otras se cortan.

Evitar que todo termine empatado.

Pero permitir algunos empates naturales para verificar la lógica actual.

# 6. RACHAS

Muy importante:

Las rachas deben poder probarse correctamente sobre los 8 días.

Generar condiciones que permitan al menos algunas rachas de:
- 2 días;
- 3+ días;
- alguna racha que se corte y conserve su máximo histórico.

Recordar que las nuevas rachas negativas se basan en ganar determinadas estadísticas diarias consecutivamente.

La simulación debe ser compatible con ellas.

No cambiar la lógica de cálculo de rachas.

Solo generar datos que puedan alimentarlas.

# 7. FRASE DEL REY

Al utilizar `Simular 8 noches`, la app debe quedar en estado de viaje completo.

Por lo tanto:
- si el Rey tiene una Frase del Rey configurada;
- y existen las 8 noches completas;

su frase debe poder aparecer normalmente en su perfil.

No hardcodear una frase.
Usar la que tenga guardada el usuario.

# 8. SIMULAR EL DÍA DE AYER

La segunda opción debe ser mucho más acotada:

`Simular el día de ayer`

Debe generar datos únicamente para AYER.

Ejemplo:
hoy 21/09
=> simular 20/09.

No generar más fechas.

Debe permitir probar rápidamente:
- Registro diario;
- Estadísticas Día;
- títulos de ese día;
- dinero/previas/encuesta asociados si la simulación actual los incluye.

No tocar otros días ya existentes salvo que la herramienta actual tenga una política explícita de reemplazo.

# 9. REEJECUTAR SIMULACIÓN DE AYER

Si se ejecuta nuevamente `Simular el día de ayer`:

evitar duplicados.

Debe respetar la filosofía real de Daily:
- una persona/fecha;
- actualizar/reemplazar si corresponde.

Para money/previas/encuestas usar IDs/idempotencia o limpieza controlada de datos simulados según la arquitectura actual.

No acumular basura cada vez que se toca el botón.

# 10. DATOS REALES

Esta herramienta es de desarrollo/Admin.

No quiero que destruya accidentalmente datos reales.

Revisar cómo distingue actualmente datos simulados.

Si ya existe un prefijo/marcador/cleanup seguro:
reutilizarlo.

No hacer:
- reset global;
- truncate;
- borrar usuarios;
- borrar datos reales del viaje.

Si la implementación actual de `Simular datos` reemplaza datos de prueba de manera controlada, conservar ese mecanismo.

# 11. UI

En la sección actual de Simular datos reemplazar el selector/opciones existentes por:

`Simular 8 noches`

`Simular el día de ayer`

Diseño:
- mantener estética actual;
- dark/light;
- mobile;
- no agregar UI innecesaria.

Puede ser:
- dos botones;
o
- selector + botón ejecutar;

elegir lo más coherente con la UI existente.

# 12. CONFIRMACIÓN

Como `Simular 8 noches` genera bastante información, mantener/crear confirmación in-app clara antes de ejecutar.

No usar confirm() nativo.

Texto breve indicando que se generarán datos simulados.

Para `Simular el día de ayer` puede mantenerse una confirmación más simple.

# 13. FEEDBACK

Al finalizar:

Para 8 noches:
`8 noches simuladas correctamente`

Para ayer:
`Datos de ayer simulados correctamente`

Si falla:
mostrar error real y no éxito simultáneamente.

No repetir el bug anterior de mostrar éxito + error al mismo tiempo.

# 14. API / DB

Revisar si la simulación escribe:
- localmente;
- por API;
- directamente en backend.

Mantener la estrategia actual correcta.

Si la app real depende de API para estadísticas compartidas, la simulación debe generar datos donde corresponda para que la prueba sea representativa.

No crear datos únicamente locales si eso hace que Stats API no los vea.

# 15. USUARIOS

Usar usuarios activos actuales.

No hardcodear solamente los usuarios originales.

Incluir dinámicos activos como Lara/Mati si forman parte de la lista actual.

No incluir inactivos.

# 16. NO TOCAR

No modificar:
- reglas reales de Registro diario;
- auth;
- sync/offline;
- cálculo de estadísticas;
- títulos;
- rachas;
- Rey/múltiples Reyes;
- Casi Reyes;
- appearance;
- Web Push;
- navegación.

La tarea es adaptar la herramienta de simulación al escenario real de 8 noches / 9 días.

# 17. TESTS

Cubrir al menos:

- `Simular 8 noches` genera exactamente 8 fechas;
- fechas consecutivas válidas;
- no genera hoy/futuro incorrectamente;
- Stats Día ve 8 días;
- Total acumula los 8;
- frase del Rey puede desbloquearse al completar las 8 noches;
- rachas pueden calcularse sobre los 8 días;
- usuarios activos incluidos;
- usuarios inactivos excluidos;
- `Simular ayer` genera solo ayer;
- reejecutar ayer no duplica daily;
- no borrar datos reales;
- no aparecen opciones antiguas 6/7;
- feedback éxito/error correcto.

# 18. VALIDACIÓN FINAL

Ejecutar:

- node --check script.js
- npm test
- npm run typecheck
- npm run build
- npm run db:health

Revisar visualmente:
- Admin > Simular datos;
- Simular 8 noches;
- navegación de Estadísticas Día con 8 fechas;
- Total;
- Logros;
- Rachas;
- Rey;
- múltiples Reyes;
- perfil Rey;
- frase Rey;
- Casi Reyes;
- Simular ayer;
- dark/light.

No hacer commit.

Al final reportar:
1. cómo quedó definida la ventana de 8 noches;
2. qué fechas genera;
3. cómo evitás duplicados;
4. cómo protegés datos reales;
5. qué datos genera;
6. cómo se relaciona con la condición de viaje completado;
7. tests realizados.