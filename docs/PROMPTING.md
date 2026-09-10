Quiero hacer DOS cambios puntuales.

No hacer commit todavía.

# 1. BUG EN REGISTRO: `NO DORMÍ`

Actualmente, en Registro diario, si marco:

`No dormí`

se deshabilita o bloquea la carga de la hora de salida del boliche y aparece un mensaje del estilo:

`Elegí una hora de dormir posterior a la 01:00 para cargar salida.`

Esto no tiene sentido.

Si una persona marca `No dormí`, es perfectamente posible que igualmente haya ido al boliche y necesite registrar a qué hora se fue.

De hecho, en ese caso es incluso razonable que se haya quedado hasta muy tarde o hasta el cierre.

## COMPORTAMIENTO CORRECTO

Si la persona SÍ durmió:
- mantener la lógica actual;
- la hora de salida del boliche debe ser coherente con la hora de dormir;
- no permitir una salida posterior al horario de sueño si esa validación ya existe.

Si la persona marca `No dormí`:
- NO deshabilitar la hora de salida del boliche;
- permitir cargarla normalmente;
- NO exigir una hora de dormir;
- usar como límite máximo únicamente el horario máximo/cierre permitido por la lógica real de la app;
- eliminar el mensaje incorrecto que exige elegir hora de dormir en este caso.

No inventar un horario nuevo si ya existe un helper o límite máximo para salida del boliche.

Reutilizar la lógica actual de fechas/horarios.

Revisar frontend y backend para que ambos acepten este caso correctamente.

## VALIDAR

Probar:
- sí durmió + salida válida;
- sí durmió + salida posterior al sueño => inválido;
- no durmió + fue al boliche => puede cargar salida;
- no durmió + salida hasta el máximo permitido => válida;
- no durmió + salida fuera del máximo permitido => inválida;
- no fue al boliche => comportamiento actual;
- mobile;
- no romper Registro diario ni Stats.

# 2. PERSONALIZACIÓN ESPECIAL PARA GIO

Quiero ampliar la personalización visual disponible específicamente para el perfil/card de Gio.

La idea es que Gio pueda tener una apariencia más fuerte y llamativa que el resto, sin romper la estética de la app.

No quiero algo infantil ni exagerado.

Quiero sensación de:
- poder;
- jerarquía;
- brillo;
- perfil premium;
- presencia visual.

## OBJETIVO VISUAL

La card/perfil de Gio debe poder destacar frente a otras.

Quiero agregar opciones de personalización especiales como:

- colores más brillantes;
- gradientes más intensos;
- glow suave;
- sombra más marcada;
- borde luminoso;
- variante dorada;
- combinación negro + dorado;
- combinación azul profundo + dorado;
- combinación violeta brillante + dorado;
- efecto premium/royal.

No usar naranja fuerte.

## NUEVAS OPCIONES SOLO PARA GIO

En Personalización, si el usuario autenticado es Gio, agregar una sección especial:

`Estilos especiales`

Estas opciones NO deben aparecer para otros usuarios.

Agregar varios presets, por ejemplo:

### `Royal Gold`
- fondo oscuro;
- degradado negro / azul muy oscuro;
- detalles dorados;
- borde dorado;
- glow suave;
- sombra más profunda.

### `Golden Power`
- dorado más brillante;
- contraste oscuro;
- líneas/accent doradas;
- apariencia más intensa.

### `Imperial`
- azul profundo;
- violeta;
- dorado sutil;
- sensación elegante.

### `Ultra Glow`
- usar los colores personalizados actuales de Gio;
- aumentar brillo, glow y sombra;
- sin cambiar la paleta base.

### `Dark Crown`
- negro / navy;
- borde dorado tenue;
- reflejo brillante;
- card muy marcada frente al resto.

Podés ajustar nombres si hace falta, pero mantener la idea.

## EFECTOS DISPONIBLES

Para Gio permitir adicionalmente:

- glow:
  - apagado
  - suave
  - fuerte

- sombra:
  - normal
  - profunda

- borde premium:
  - ninguno
  - dorado
  - gradiente brillante

- intensidad:
  - normal
  - brillante
  - muy brillante

No hacer que el texto pierda legibilidad.

El nombre debe seguir usando color de texto correcto según light/dark.

## DÓNDE DEBE VERSE

La apariencia especial de Gio debe aplicarse donde ya se usa la personalización individual:

- su perfil;
- su card;
- sus logros;
- rachas;
- ranking;
- Casi Reyes;
- perfil del Rey;
- cualquier card asociada específicamente a Gio.

NO pintar toda la aplicación con el tema de Gio.

Solo elementos visuales que pertenezcan a Gio.

## DORADO

Quiero que exista al menos una opción claramente dorada.

Pero:
- no usar amarillo plano;
- no hacer aspecto barato;
- usar gradientes, bordes, sombras y glow;
- mantener sensación elegante/premium.

Pensar más en:
`gold / black / navy / glass`

que en amarillo fuerte.

## PERSISTENCIA

Estas opciones deben persistirse igual que el sistema actual de appearance.

No crear una arquitectura paralela si puede extenderse la existente.

Backend debe validar que estas opciones especiales solo puedan ser usadas por Gio.

No alcanza con ocultarlas en frontend.

Si otro usuario intenta enviar manualmente un preset exclusivo:
- rechazarlo o normalizarlo de forma segura.

## COMPATIBILIDAD

Mantener:
- light mode;
- dark mode;
- mobile;
- rendimiento;
- reduced motion;
- personalizaciones actuales de otros usuarios;
- presets existentes;
- custom colors actuales.

No romper usuarios que no usan estilos especiales.

## ANIMACIONES

Si se usa glow o brillo:
- debe ser mayormente estático;
- puede haber un shimmer MUY sutil;
- nada que esté moviéndose constantemente de forma molesta;
- no generar lag.

## TESTS

Revisar:
- Gio ve opciones especiales;
- otros usuarios no;
- backend bloquea presets exclusivos para otros;
- persistencia funciona;
- reload mantiene apariencia;
- cards de Gio resaltan;
- otros perfiles siguen iguales;
- light/dark;
- mobile;
- no overflow;
- no caída de FPS apreciable.

Ejecutar:
- node --check script.js
- npm test
- npm run typecheck
- npm run build
- npm run db:health

Al final reportar:
1. causa del bug de `No dormí`;
2. cómo quedó corregida la salida del boliche;
3. qué opciones especiales agregaste para Gio;
4. cómo se persisten;
5. cómo protegiste que solo Gio pueda usarlas;
6. dónde se aplican visualmente;
7. tests realizados.