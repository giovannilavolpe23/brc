Quiero cambiar la lógica de `Rey de Bariloche` para soportar MÚLTIPLES REYES cuando existe empate real en cantidad total de títulos.

IMPORTANTE:
No quiero elegir aleatoriamente un Rey entre empatados.

La regla nueva es:

Si varias personas tienen exactamente la mayor cantidad de títulos/logros:
TODAS son `Rey de Bariloche`.

Ejemplo:

Gio: 8 títulos
Marto: 8 títulos
Sebas: 7 títulos
Jere: 6 títulos

Resultado:

Gio = Rey de Bariloche
Marto = Rey de Bariloche

Sebas y Jere NO son Reyes.

# 1. ELIMINAR SORTEO DEL REY

Actualmente, si varias personas empatan con la cantidad máxima de títulos, el sistema puede elegir aleatoriamente un Rey principal y considerar a los demás como empatados.

Eliminar ese comportamiento.

NO elegir aleatoriamente.

Todos los usuarios con:

count === maxTitleCount

deben considerarse Reyes reales.

La identidad del Rey debe ser determinista a partir de los títulos actuales.

# 2. HUB DE LOGROS

Actualmente existe el cartel/card:

`REY DE BARILOCHE`

Si hay un solo Rey:
mantener exactamente el comportamiento actual.

Si hay varios Reyes empatados:

mostrar UNA card completa de `REY DE BARILOCHE` POR CADA REY.

Deben aparecer verticalmente:

[REY DE BARILOCHE]
Gio
8 títulos

[REY DE BARILOCHE]
Marto
8 títulos

No colocarlos horizontalmente.

No crear una card especial de “empate”.

Cada uno ES Rey de Bariloche.

Mantener exactamente el diseño actual de la card de Rey.

No rediseñarla.

# 3. ORDEN DE LOS REYES

Cuando haya varios Reyes, usar un orden estable.

NO cambiar aleatoriamente entre renders/recargas.

Usar un criterio estable existente del proyecto.

Por ejemplo:
- orden actual de participantes;
- participant key;
- legacy id;
- o el criterio estable más coherente ya disponible.

El número de títulos sigue siendo igual entre ellos.

# 4. CADA CARD ABRE SU PROPIO PERFIL

Cada card de `REY DE BARILOCHE` debe seguir siendo clickeable como actualmente.

Pero ahora debe abrir el perfil DEL REY SELECCIONADO.

Ejemplo:

Toco card de Gio
=> Perfil Rey de Gio

Toco card de Marto
=> Perfil Rey de Marto

No usar una variable global que siempre abra al primer Rey.

La navegación/perfil debe recibir o resolver correctamente qué Rey fue seleccionado.

# 5. PERFIL DE CADA REY

El perfil conserva exactamente la estructura actual:

- foto;
- nombre;
- cantidad de títulos;
- estadística dominante;
- títulos obtenidos;
- Casi Reyes.

Todo debe calcularse para el Rey cuyo perfil estoy viendo.

No crear diferencias visuales entre “Rey 1” y “Rey 2”.

Ambos tienen exactamente el mismo rango.

NO mostrar:
- Rey principal
- Rey secundario
- Primer Rey
- Segundo Rey

Son simplemente Reyes de Bariloche empatados.

# 6. CASI REYES

Cambio MUY IMPORTANTE.

`Casi Reyes` debe excluir a TODOS los Reyes actuales.

No solamente al Rey cuyo perfil estoy viendo.

Ejemplo:

Gio = 8 -> Rey
Marto = 8 -> Rey
Sebas = 7
Jere = 6
Tobi = 5
Nerea = 4
Simon = 3

En el perfil de Gio:

Casi Reyes:
Sebas
Jere
Tobi
Nerea
Simon

Marto NO debe aparecer porque también es Rey.

En el perfil de Marto:

exactamente lo mismo.

Gio NO debe aparecer porque también es Rey.

Por lo tanto:

antes de construir Casi Reyes:
1. obtener todos los usuarios con la cantidad máxima de títulos;
2. crear conjunto/lista de IDs de Reyes;
3. excluir todos esos IDs del ranking.

Después ordenar los restantes normalmente por cantidad de títulos.

# 7. PUESTOS DE CASI REYES

Conceptualmente el ranking representa a quienes están POR DEBAJO de los Reyes.

Si existen 2 Reyes empatados, no quiero que visualmente aparezca el otro Rey como “puesto 2”.

La escalera debe comenzar con la mejor persona que NO sea Rey.

Mantener hasta 5 jugadores como actualmente.

No hace falta mostrar número ordinal explícito si el diseño actual no lo hace.

Mantener:
- columnas;
- fotos;
- alturas;
- cantidad de títulos;
- diseño actual.

Solo corregir quiénes pueden entrar.

# 8. EMPATE DE MÁS DE DOS PERSONAS

La implementación debe soportar naturalmente:

2 Reyes
3 Reyes
4 Reyes
etc.

Ejemplo:

Gio 8
Marto 8
Jere 8
Sebas 7

=> Gio, Marto y Jere son Reyes.

Se muestran tres cards de Rey.

Los tres perfiles excluyen a los otros dos Reyes de Casi Reyes.

Sebas pasa a ser el primer Casi Rey.

No hardcodear límite de dos.

# 9. CONTEO DE TÍTULOS

Mantener exactamente el criterio actual de qué títulos cuentan para Rey de Bariloche.

Incluye los títulos/logros válidos actuales, incluyendo rachas válidas.

Los títulos bloqueados/anulados, como la regla especial de la racha de encuesta cuando corresponda, NO deben contar.

No cambiar esa lógica con esta tarea.

Este cambio empieza únicamente DESPUÉS de obtener el conteo correcto de títulos por jugador.

# 10. ESTADÍSTICA DOMINANTE

Cada Rey mantiene su propia estadística dominante.

No compartir la dominante entre Reyes.

Ejemplo:

Gio:
`Su fuerte: Boliche`

Marto:
`Su fuerte: Sueño`

Ambas deben calcularse independientemente con sus propios títulos.

# 11. DARK / LIGHT / TRANSICIONES

Debe funcionar correctamente:
- light mode;
- dark mode;
- mobile;
- fade/transición existente;
- botón volver;
- navegación desde cada card.

No crear nuevas animaciones innecesarias.

Si aparecen dos o tres cards de Rey, deben mantener separación vertical coherente y no sentirse pegadas.

# 12. ELIMINAR TEXTOS DE EMPATE ANTIGUOS

Revisar si actualmente existen textos/comportamientos como:

`También empatado`
`También empatados`

Si pertenecían al sistema anterior donde solo uno era Rey principal, ya no tienen sentido.

Eliminar esos textos visuales cuando corresponda.

No reemplazarlos por:
`Co-Rey`
`Rey compartido`
etc.

Todos simplemente son:

`REY DE BARILOCHE`

# 13. NO TOCAR

No modificar:
- cálculo individual de títulos;
- estadísticas;
- rachas;
- nuevas rachas negativas;
- títulos bloqueados;
- encuestas;
- auth;
- API salvo necesidad real;
- offline/sync;
- dark mode;
- diseño de Casi Reyes;
- diseño del perfil;
- diseño de la card de Rey.

Cambiar solamente la lógica necesaria para soportar múltiples Reyes.

# 14. TESTS OBLIGATORIOS

CASO A
Gio 8
Marto 7

=> solo Gio Rey.

CASO B
Gio 8
Marto 8
Sebas 7

=> Gio y Marto Reyes.
=> dos cards.
=> cada card abre su perfil correcto.
=> Sebas es primer Casi Rey.
=> Gio no aparece en Casi Reyes de Marto.
=> Marto no aparece en Casi Reyes de Gio.

CASO C
Gio 8
Marto 8
Jere 8
Sebas 7

=> tres Reyes.
=> tres cards.
=> ningún Rey aparece en Casi Reyes de otro.
=> Sebas inicia Casi Reyes.

CASO D
Empate desaparece porque Gio consigue un título nuevo:

Gio 9
Marto 8

=> vuelve automáticamente a existir un solo Rey.
=> Gio.
=> Marto puede aparecer normalmente como primer Casi Rey.

CASO E
Recargar varias veces con empate.

=> mismos Reyes.
=> mismo orden estable.
=> NO sorteo.

CASO F
Entrar al perfil de cada Rey y volver.

=> siempre abre el usuario correcto.
=> navegación correcta.
=> perfil y dominante correctos.

# 15. VALIDACIÓN FINAL

Ejecutar:

- node --check script.js
- npm test
- npm run typecheck
- npm run build

Revisar:
- un Rey;
- dos Reyes;
- tres Reyes;
- Casi Reyes;
- navegación a cada perfil;
- light;
- dark;
- mobile;
- ausencia de textos antiguos de empate;
- git diff/status.

No hacer commit.

Al final reportar:
1. dónde estaba el sorteo anterior;
2. cómo representás ahora múltiples Reyes;
3. cómo resolvés qué perfil abrir;
4. cómo excluís todos los Reyes de Casi Reyes;
5. criterio de orden estable;
6. tests realizados.