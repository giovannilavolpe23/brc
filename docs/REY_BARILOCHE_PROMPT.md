Quiero ampliar el perfil especial del “Rey de Bariloche”.

IMPORTANTE:
No convertir esto en un sistema general de perfiles.
Este perfil sigue existiendo únicamente para el Rey actual.

No modificar la lógica que determina quién es el Rey.
No romper dark mode, light mode, navegación, rankings, logros, auth, API ni sync.

## ESTRUCTURA DEL PERFIL

### 1. Encabezado del Rey

Mantener una presentación especial/coronativa.

Mostrar:

- foto grande y centrada del Rey actual;
- nombre debajo;
- estadística dominante debajo del nombre.

La “estadística dominante” debe derivarse de las estadísticas reales existentes del jugador.

Ejemplos conceptuales:
- “Su fuerte: Boliche”
- “Domina en: Quinta comida”
- “Su fuerte: Menos sueño”

No hardcodear una frase para una persona específica.

Debe utilizar la métrica/categoría en la que ese jugador más destaque según los datos actuales.

Si no hay datos suficientes para determinar una dominante con sentido, mostrar una alternativa neutra o simplemente ocultar esa línea.

No inventar datos.

## 2. TÍTULOS GANADOS

Debajo del encabezado mostrar todos los títulos/logros obtenidos por el Rey.

Reutilizar la lógica y datos existentes de Logros/Títulos.

NO crear títulos nuevos.

Quiero que estén agrupados visualmente según las categorías que ya existen en la aplicación.

PERO:

- NO poner títulos de sección;
- NO escribir nombres de categorías;
- NO agregar textos explicativos entre ellas.

Solo debe existir una pequeña separación visual entre cada grupo.

Ejemplo conceptual:

[título] [título] [título]

   pequeño espacio

[título] [título]

   pequeño espacio

[título] [título] [título]

La separación debe ser sutil y entenderse por composición, no mediante texto.

Mantener el estilo actual de los títulos/logros tanto como sea posible.

## 3. CASI REYES

Al FINAL del perfil quiero agregar una sección especial llamada:

“Casi Reyes”

Debe ser visual, dinámica, divertida y ceremonial.

No quiero que parezca simplemente un gráfico estadístico tradicional.

### Qué representa

Mostrar a los jugadores que están inmediatamente detrás del Rey actual según la cantidad de títulos conseguidos.

Excluir completamente al Rey actual.

Mostrar hasta 5 jugadores:

- puesto 2
- puesto 3
- puesto 4
- puesto 5
- puesto 6

Si no existen 5 jugadores válidos, mostrar solamente los disponibles.

## VISUAL DE CASI REYES

Quiero 5 columnas verticales colocadas horizontalmente.

Conceptualmente debe verse como una escalera descendente:

puesto 2 -> columna más alta
puesto 3 -> ligeramente más baja
puesto 4 -> más baja
puesto 5 -> más baja
puesto 6 -> la más baja

IMPORTANTE:

Las diferencias de altura deben ser claras pero elegantes.

No quiero una diferencia exagerada donde el último quede diminuto.

Debe sentirse como una progresión visual suave.

### FOTOS

Encima de cada columna debe aparecer la foto/avatar del jugador correspondiente.

NO quiero usar el nombre como elemento principal.

La foto es la identidad visual del puesto.

Tamaños:

- puesto 2: foto más grande;
- puesto 3: ligeramente menor;
- puesto 4: ligeramente menor;
- puesto 5: ligeramente menor;
- puesto 6: ligeramente menor.

La disminución de tamaño debe ser MUY sutil.

No hacer que los últimos jugadores parezcan irrelevantes.

Si un jugador no tiene foto:
- usar exactamente el fallback/avatar/inicial que ya utiliza la app.

No crear otro sistema de avatares.

### DATOS

Debajo o dentro de cada columna mostrar discretamente la cantidad de títulos.

Ejemplos:

8 títulos
6 títulos
5 títulos

Usar singular correctamente cuando corresponda:

1 título
2 títulos

No sobrecargar con estadísticas adicionales.

El foco debe seguir siendo:
foto + posición visual + cantidad de títulos.

## ORDEN

Ordenar por cantidad de títulos de mayor a menor, excluyendo al Rey.

La primera columna corresponde al jugador más cercano al Rey.

## EMPATES

Definir una lógica estable para empates.

Si dos jugadores tienen exactamente la misma cantidad de títulos:

- no cambiar el orden aleatoriamente cada vez que se renderiza;
- usar un criterio estable basado en datos existentes, por ejemplo el orden/ranking que ya utilice la aplicación;
- si no existe un criterio adecuado, utilizar un desempate estable como legacy_id/id/nombre.

No modificar la lógica general de títulos para solucionar esto.

## DISEÑO DE LAS COLUMNAS

No quiero barras genéricas tipo Excel.

Las columnas deben integrarse con la estética de Bariloche.

Pueden utilizar:

- superficies glass;
- azul hielo;
- azul noche;
- gradientes suaves;
- bordes sutiles;
- pequeñas diferencias de opacidad.

Pero deben seguir siendo muy legibles.

En dark mode:
- adaptar las columnas a la paleta nocturna;
- evitar colores excesivamente brillantes/neón.

En light mode:
- mantener la estética nevada existente.

No usar naranja para textos.

## POSICIÓN

“Casi Reyes” debe estar al FINAL absoluto del perfil.

Orden general:

1. Foto
2. Nombre
3. Estadística dominante
4. Títulos ganados
5. Casi Reyes

No agregar más secciones por ahora.

## ANIMACIÓN

La sección Casi Reyes puede tener una entrada suave cuando aparece el perfil.

Usar el mismo lenguaje de animaciones que ya tiene la app.

Por ejemplo:
- pequeño fade;
- leve subida;
- aparición progresiva muy rápida de las columnas.

NO hacer animaciones exageradas.

No animar continuamente las barras.

No usar librerías nuevas.

Respetar prefers-reduced-motion.

## MOBILE FIRST

Esta sección está pensada principalmente para celular.

Las 5 columnas deben entrar correctamente en el ancho disponible.

IMPORTANTE:
- no generar scroll horizontal de toda la página;
- no comprimir tanto las fotos que pierdan sentido;
- usar gaps pequeños y tamaños responsivos;
- revisar especialmente 320px–430px;
- usar min-width: 0 donde sea necesario.

Si en pantallas extremadamente pequeñas hace falta reducir ligeramente columnas/fotos, hacerlo proporcionalmente.

## INTERACCIÓN

La sección debe ser principalmente visual.

No hace falta convertir cada jugador en un perfil clickeable.

No crear perfiles para esos usuarios.

Opcionalmente, si mejora mucho la claridad, se puede mostrar el nombre del jugador al tocar su foto mediante un detalle mínimo, pero NO implementar esto si añade complejidad innecesaria.

Priorizar simplicidad.

## DATOS Y ARQUITECTURA

Reutilizar datos que la app ya tiene.

Antes de implementar:
- revisar cómo se calculan los títulos;
- revisar cómo se determina el Rey;
- revisar cómo se obtienen las fotos/avatar;
- reutilizar helpers existentes.

Evitar duplicar lógica de ranking/logros.

No agregar endpoints backend si la información necesaria ya está disponible en los datos actuales.

Si realmente falta algún dato imprescindible, primero analizar la alternativa de derivarlo en frontend antes de cambiar API.

## LIGHT / DARK

Todo el perfil, incluida esta nueva sección, debe funcionar perfectamente en ambos temas.

Reutilizar las variables CSS existentes.

No crear paletas paralelas ni hardcodear una segunda versión completa.

## NO MODIFICAR

- cartel original “Rey de Bariloche”;
- cálculo del Rey;
- lógica de títulos;
- stats generales;
- rankings existentes;
- empates existentes;
- auth;
- permisos;
- API salvo necesidad real;
- sync/offline;
- navegación principal;
- bottom nav.

## VALIDACIÓN

Probar:

1. Rey correcto.
2. Foto correcta.
3. Nombre correcto.
4. Estadística dominante coherente con datos reales.
5. Títulos correctos.
6. Separaciones entre categorías sin textos.
7. Rey excluido de Casi Reyes.
8. Puestos 2–6 ordenados correctamente.
9. Cantidades de títulos correctas.
10. Empates estables.
11. Fotos correctas.
12. Fallback para jugador sin foto.
13. Light mode.
14. Dark mode.
15. 320px de ancho.
16. Sin overflow horizontal.
17. Fade/transición consistente.
18. prefers-reduced-motion.

Al terminar ejecutar:

- node --check script.js
- npm test
- npm run typecheck
- npm run build

No hacer commit todavía.

Reportar brevemente:
- archivos modificados;
- cómo calculaste la estadística dominante;
- cómo reutilizaste títulos existentes;
- criterio usado para Casi Reyes;
- tratamiento de empates;
- cualquier detalle que convenga revisar visualmente.