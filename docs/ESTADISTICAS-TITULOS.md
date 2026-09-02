Quiero hacer una revisión definitiva de nombres/descripciones de Estadísticas, Títulos y Rachas, además de implementar nuevas rachas negativas.

IMPORTANTE:
- respetar LITERALMENTE todos los textos que indico;
- no corregir ortografía;
- no reformular frases;
- no cambiar mayúsculas, signos ni expresiones;
- no inventar textos nuevos;
- mantener intacta toda lógica que no esté explícitamente pedida;
- no hacer commit todavía.

# 1. ESTADÍSTICAS

Una misma estadística puede mostrar texto distinto en vista Día y en vista Total.

Cuando indico:

Texto Día / Texto Total

usar exactamente cada lado en su contexto correspondiente.

## Quien durmió más

Día:
Nombre: `¿Quién durmió más?`
Descripción: `Horas dormidas`

Total:
Nombre: `¿Quién durmió más?`
Descripción: `Horas dormidas`

No cambiar su lógica actual en esta tarea.

## Fanatico de la siesta

Día:
Nombre: `¿Quién tiró siesta?`
Descripción: `Hubo siestita? y pajita?`

Total:
Nombre: `¿Quién tiró más siestas?`
Descripción: `Cantidad de siestas`

## La quinta comida

Día:
Nombre: `¿Jugó 5ta comida?`
Descripción: `Quinta comida`

Total:
Nombre: `¿Quién fue el más bajonero?`
Descripción: `Cantidad de 5ta comidas realizadas`

## Maratón de baño

Día:
Nombre: `¿Detonaron el retrete?`
Descripción: `No requiere explicación. Ger no participa, anunciado el 1/09.`

Total:
Nombre: `¿Quién fue el minigun de mierdas?`
Descripción: `No requiere explicación. Ger no participa, anunciado el 1/09.`

IMPORTANTE:
La frase `Ger no participa, anunciado el 1/09.` es SOLO texto visible.

NO excluir a Ger funcionalmente del ranking.
No modificar la lógica de participantes.

## Resistencia en el boliche

Día:
Nombre: `Resistencia en el baile`
Descripción: `Horas en el baile`

Total:
Nombre: `Resistencia en el baile`
Descripción: `Horas en el baile (trolazo el último)`

## El más gastador

Día:
Nombre: `¿Quién tuvo más ganas de gastar?`
Descripción: `Gasto total por persona`

Total:
Nombre: `¿Quién tuvo más ganas de gastar?`
Descripción: `Gasto total por persona`

## ¿En qué se fue más la plata?

Día:
Nombre: `¿En qué categoría se derrochó más billete?`
Descripción: `Gastos por categoría`

Total:
Nombre: `¿En qué categoría se derrochó más billete?`
Descripción: `Gastos por categoría totales`

# 2. GASTOS POR CATEGORÍA

No cambiar ningún nombre existente salvo la categoría `Otros`.

## Otros

Día y Total:
Nombre: `Quién gastó más en cosas secundarias`
Descripción: `Gasto en Otros`

# 3. PREVIAS

## Rey/Reyna de las previas

Día y Total:
Nombre: `Rey/Reyna de las previas`
Descripción: `Previas realizadas`

# 4. TÍTULOS

Eliminar COMPLETAMENTE el texto/estado `PROVISIONAL` o `Provisional` de donde aparezca en títulos/logros.

No reemplazarlo por otro texto.

## El más dormilón

Nombre: `El más dormilón`
Descripción: `Horas dormidas`

## El más zombi

Nombre: `El más zombi`
Descripción: `El que menos durmió`

## Siesta

Nombre: `El rey de la siesta`
Descripción: `Siestitas`

## Quinta comida

Renombrar el título actual correspondiente a:

Nombre: `La panza más grande`
Descripción: `Quinta comida`

## Baño

Renombrar el título actual correspondiente a:

Nombre: `Minigun de mierdas`
Descripción: `Veces que metió detonadita de báter`

## Boliche

Renombrar el título actual correspondiente a:

Nombre: `El que más se la bancó en el baile`
Descripción: `Tiempo en el baile`

## Gastos

Renombrar el título actual correspondiente a:

Nombre: `Billetera sin fondo`
Descripción: `Dinero gastado`

## Previas

Renombrar el título actual correspondiente a:

Nombre: `El más manija`
Descripción: `Previas realizadas`

# 5. ENCUESTA

NO cambiar absolutamente nada de la encuesta/título actual `El más destruido`.

# 6. RACHAS POSITIVAS

Cambio funcional importante:

Las rachas ya NO deben existir ni mostrarse como una categoría de Día.

Las rachas son acumulativas/históricas y deben existir únicamente en la vista TOTAL.

No calcular ni repartir títulos de racha al navegar una fecha individual.

El apartado de rachas debe trabajar siempre con todos los días cerrados disponibles.

## Rey de la noche

Nombre: `Rey de la noche`
Descripción: `Mayor racha de días yendo al boliche`

## Quinta comida

Nombre: `Racha de putogor`
Descripción: `Mayor racha de días comiendo quinta comida`

## Baño

Nombre: `Intestino saludable`
Descripción: `Mayor racha de días yendo al baño`

## Chocolates

Nombre: `Racha dulce`
Descripción: `Mayor racha de días gastando en chocolates`

## Alcohol

Nombre: `Racha alcohólica`
Descripción: `Mayor racha de días gastando en alcohol`

Mantener para estas rachas la lógica de mayor secuencia histórica de días consecutivos cumpliendo la condición.

# 7. NUEVAS RACHAS NEGATIVAS

Implementar una nueva sección/categoría de rachas negativas.

Estas rachas:
- existen SOLO en Total;
- jamás en Día;
- se calculan sobre días cerrados;
- se basan en GANAR una estadística diaria durante días consecutivos;
- guardan/calculan la MEJOR RACHA HISTÓRICA alcanzada por cada jugador.

MUY IMPORTANTE:

No importa si la racha activa terminó.

Ejemplo:

- Marto gana una métrica lunes, martes y miércoles.
- El jueves deja de ganarla.
- Su racha histórica queda en 3.
- Si nadie supera 3 durante el resto del viaje, Marto sigue siendo ganador del título.
- Si otro jugador llega también a 3, quedan empatados.
- Si otro llega a 4, ese jugador lo supera.

Por lo tanto:
NO usar solamente la racha actual.
Calcular el máximo histórico de secuencias consecutivas por usuario.

Si varias personas tienen la misma mejor racha máxima:
- repartir el título entre todos los empatados, siguiendo el comportamiento actual de títulos por racha.

Un día en el que el jugador no gane esa métrica corta su secuencia activa, pero NO borra su récord histórico.

## Racha zombi

Nombre: `Racha zombi`
Descripción: `Mayor racha siendo el que menos duerme`

Condición diaria:
el jugador debe ganar la estadística diaria `Quién durmió menos`.

Calcular cuántos días cerrados consecutivos fue el ganador de esa estadística.

## Rendimiento de hígado

Nombre: `Racha de realizar análisis de estadísticas del rendimiento del hígado`
Descripción: `Mayor racha siendo el que más gasta en alcohol`

Condición diaria:
el jugador debe ganar `Quién se la patinó más en alcohol` en ese día.

Es decir:
ser quien más dinero gastó en categoría Alcohol durante ese día.

## Registro Nacional de Hidratación Alternativa

Nombre: `Racha de ser el Registro Nacional de Hidratación Alternativa`
Descripción: `Mayor racha en ganar "Quién te pareció el más destruido"`

Condición diaria:
el jugador debe ganar la encuesta diaria del más destruido.

Usar los votos reales de cada fecha cerrada.

Si en un día hay empate ganador de la encuesta:
considerar que TODOS los ganadores empatados cumplieron la condición de ese día para su propia racha.

## Billetera sin fondo

Nombre: `Racha de billetera sin fondo`
Descripción: `Mayor racha de ser el más gastador`

Condición diaria:
el jugador debe ganar la estadística diaria de gasto total por persona.

Es decir:
ser quien más dinero gastó ese día.

Si existe empate real en una estadística diaria usada para una racha negativa:
todos los jugadores empatados en el mejor valor deben contar como ganadores de ese día para su propia racha.

NO elegir aleatoriamente uno para el cálculo de rachas.

La aleatoriedad visual de trofeo/medallas no debe afectar estos cálculos.

# 8. PRESENTACIÓN DE RACHAS NEGATIVAS

Agregar las rachas negativas al final del apartado de rachas existentes.

Ya existen mini carteles/separadores seccionarios con transición.

Quiero reutilizar exactamente ese lenguaje visual para crear un mini separador de:

`Rachas negativas`

No rediseñar ese componente.
No crear un estilo diferente.

Debajo deben aparecer las cuatro nuevas rachas.

Mantener compatibilidad:
- light mode;
- dark mode;
- mobile;
- transiciones existentes.

# 9. REY DE BARILOCHE

Las nuevas rachas negativas son títulos/logros reales.

Por lo tanto deben integrarse al sistema de Logros igual que las demás rachas y contar para el cálculo del Rey de Bariloche, salvo que la arquitectura actual requiera explícitamente otra cosa.

Reutilizar el sistema existente de títulos por racha.

También deben poder aparecer entre los títulos/logros del perfil del Rey si esa persona los ganó.

No duplicar la lógica de Rey.

# 10. CÁLCULO Y EMPATES

Para todas las nuevas rachas negativas:

1. obtener días cerrados ordenados cronológicamente;
2. determinar ganadores reales de la métrica en cada día;
3. marcar para cada usuario si ganó o no ese día;
4. calcular secuencias de días consecutivos;
5. conservar el máximo histórico de cada usuario;
6. comparar máximos;
7. otorgar el título a quien/quienes tengan la mayor racha.

Un salto de fecha o día cerrado donde no ganó corta la secuencia.

No usar el orden visual del ranking como criterio lógico.

No usar el ganador aleatorio del trofeo.

# 11. CONSISTENCIA DÍA / TOTAL

Revisar toda la implementación para asegurar:

ESTADÍSTICAS:
- pueden tener texto diferente en Día y Total según lo indicado.

TÍTULOS POR ESTADÍSTICA:
- mantienen su funcionamiento actual Día/Total salvo cambios de nombre.

TÍTULO POR ENCUESTA:
- sin cambios.

RACHAS POSITIVAS:
- SOLO Total.

RACHAS NEGATIVAS:
- SOLO Total.

No deben aparecer cards, secciones vacías o placeholders de rachas en la vista Día.

# 12. NO TOCAR

No modificar:
- auth;
- API salvo que realmente haga falta para disponer de datos;
- offline queue;
- sync;
- dinero;
- registro diario;
- previas;
- dark mode;
- navegación;
- ranking visual;
- sistema de trofeo/plata/bronce;
- perfil del Rey salvo para mostrar correctamente los nuevos títulos;
- Casi Reyes salvo que automáticamente cambie por el nuevo conteo de títulos.

No hacer refactors generales.

# 13. AUDITORÍA

Antes de editar:
- localizar todas las definiciones de nombres/descripciones actuales;
- detectar si existen duplicadas en frontend/backend/tests;
- localizar `Provisional`;
- entender cómo se generan títulos por racha;
- reutilizar helpers actuales siempre que sea razonable.

Después de implementar, buscar globalmente textos antiguos para evitar que queden versiones viejas visibles.

Especialmente buscar:
- `Fanático de la siesta`
- `La quinta comida`
- `Maratón de baño`
- `Resistencia en el boliche`
- `El más comilón`
- `El más urgente`
- `El más aguante del boliche`
- `El más gastador`
- `El más previero`
- `Racha comilona`
- `Intestino de hierro`
- `Provisional`

No eliminar textos antiguos si siguen siendo necesarios como claves internas. Cambiar solo lo que corresponda a presentación.

# 14. TESTS

Agregar/actualizar tests para cubrir especialmente:

- textos diferentes Día vs Total;
- rachas ausentes en Día;
- rachas positivas presentes en Total;
- cada una de las 4 rachas negativas;
- racha histórica que sigue ganando aunque haya terminado;
- otro jugador superando una racha histórica;
- empate de mejor racha;
- empate diario contando para todos;
- salto de fecha corta secuencia;
- día perdido corta secuencia;
- títulos negativos integrados a Logros;
- títulos negativos contando para Rey de Bariloche;
- ausencia de `Provisional`.

Ejemplo obligatorio de lógica:

Marto:
Lunes gana menos sueño
Martes gana menos sueño
Miércoles gana menos sueño
Jueves pierde

=> mejor racha histórica de Marto = 3

Si nadie alcanza 4:
=> Marto sigue siendo ganador de `Racha zombi`.

# 15. VALIDACIÓN FINAL

Ejecutar:

- node --check script.js
- npm test
- npm run typecheck
- npm run build

Además:
- revisar light mode;
- revisar dark mode;
- revisar Estadísticas Día;
- revisar Estadísticas Total;
- revisar Logros;
- revisar Perfil del Rey;
- revisar nombres/descripciones literalmente;
- revisar que no aparezca `Provisional`;
- revisar git diff/status;
- revisar que no haya secretos.

No hacer commit.

Al finalizar reportar:

1. archivos modificados;
2. cómo implementaste textos Día/Total;
3. cómo eliminaste `Provisional`;
4. cómo cambiaste rachas para que sean solo Total;
5. cómo calculaste el máximo histórico de rachas negativas;
6. cómo trataste empates;
7. tests agregados/modificados;
8. cualquier punto que convenga revisar manualmente.