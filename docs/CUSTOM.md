Quiero implementar un nuevo sistema de PERSONALIZACIÓN VISUAL DE PERFIL.

Debe ser una feature real, persistida por API/PostgreSQL, para que la personalización de cada usuario sea visible para TODOS los demás usuarios.

IMPORTANTE:
- no cambiar foto/avatar;
- no cambiar el color del nombre;
- no cambiar tipografías;
- no cambiar layout general;
- no romper light/dark mode;
- no meter librerías pesadas;
- mantener rendimiento mobile;
- no hacer commit todavía.

# 1. NUEVO BOTÓN EN HOME

Debajo del botón actual de cambiar tema (modo claro/oscuro), agregar un nuevo botón de personalización.

Debe:
- ser pequeño;
- mantener la estética actual;
- tener área táctil cómoda;
- no romper alineaciones;
- usar un icono coherente con personalización/paleta;
- no llevar texto visible si no hace falta.

Al tocarlo debe abrir un nuevo apartado:

`Personalización`

# 2. NAVEGACIÓN Y ANIMACIÓN

La entrada al menú de Personalización debe usar una transición MUY fluida y coherente con las demás pantallas.

Quiero:
- fade suave;
- ligero desplazamiento;
- sin tirones;
- sin cambios bruscos de layout;
- misma sensación premium al entrar y al salir.

La salida/volver debe tener una animación equivalente y suave.

IMPORTANTE:
- no recargar la página;
- no reconstruir toda Home;
- no dejar estados visuales colgados;
- respetar prefers-reduced-motion;
- no usar animaciones pesadas.

# 3. OBJETIVO DE PERSONALIZACIÓN

Cada usuario tendrá una identidad visual propia basada en:
- color primario;
- color secundario;
- gradiente;
- dirección;
- intensidad;
- estilo visual;
- borde/avatar;
- accents.

Esa personalización debe ser pública.

Si Marto configura un gradiente violeta/cian:
- Marto lo ve;
- Gio lo ve;
- Jere lo ve;
- cualquier usuario autenticado lo ve.

No guardar esto solo en localStorage.

Persistirlo en backend/PostgreSQL.

# 4. NOMBRE SIEMPRE NORMAL

MUY IMPORTANTE:

El color del nombre del usuario NO cambia.

El nombre debe seguir usando el color normal del tema actual:

Light:
- color de texto normal oscuro.

Dark:
- color de texto normal claro/blanco frío.

No teñir el nombre con el color personal.

La personalización vive alrededor del usuario, no sobre la legibilidad del nombre.

# 5. PRESETS

Crear al menos estos 12 presets.

## Aurora
Primario: `#4CC9F0`
Secundario: `#7B61FF`

## Glaciar
Primario: `#38BDF8`
Secundario: `#A5F3FC`

## Medianoche
Primario: `#2563EB`
Secundario: `#1E1B4B`

## Neón frío
Primario: `#22D3EE`
Secundario: `#6366F1`

## Violeta Polar
Primario: `#8B5CF6`
Secundario: `#C084FC`

## Rosa Hielo
Primario: `#EC4899`
Secundario: `#A78BFA`

## Aurora Verde
Primario: `#2DD4BF`
Secundario: `#22C55E`

## Océano
Primario: `#0EA5E9`
Secundario: `#14B8A6`

## Royal
Primario: `#4F46E5`
Secundario: `#9333EA`

## Fuego Frío
Primario: `#EF4444`
Secundario: `#8B5CF6`

## Cyber Ice
Primario: `#06B6D4`
Secundario: `#3B82F6`

## Esmeralda Nocturna
Primario: `#10B981`
Secundario: `#0F766E`

# 6. PERSONALIZADO

Además de presets, agregar opción:

`Personalizado`

Permitir elegir:
- Color 1
- Color 2

Usar controles de color simples y mobile-friendly.

No permitir valores inválidos.

# 7. DIRECCIÓN DEL GRADIENTE

Permitir elegir entre:

- diagonal izquierda
- diagonal derecha
- vertical
- horizontal

Mapear internamente a valores CSS razonables.

Ejemplo:
- 135deg
- 45deg
- 180deg
- 90deg

# 8. INTENSIDAD

Permitir:

- Suave
- Normal
- Fuerte

Esto debe controlar cuánto invade el color personal.

Ejemplo conceptual:
- Suave: más transparente
- Normal: equilibrio
- Fuerte: color más presente

No debe volver ilegible la interfaz.

# 9. ESTILO VISUAL

Permitir elegir:

- Gradiente limpio
- Glass tintado
- Glow sutil

IMPORTANTE:
No hacer glow exagerado.
No hacer estética gamer/neón excesiva.
Debe seguir sintiéndose premium y compatible con Bariloche.

# 10. BORDE DE AVATAR

Opciones:

- Sólido
- Gradiente
- Sin borde

No cambiar tamaño ni forma del avatar salvo necesidad mínima.

# 11. PREVIEW EN VIVO

Dentro de Personalización quiero una PREVIEW en vivo.

Arriba del menú mostrar una tarjeta/demo con:

- avatar/foto actual del usuario;
- nombre;
- mini card;
- una línea/separador;
- badge/título de ejemplo.

A medida que el usuario cambia:
- preset;
- colores;
- dirección;
- intensidad;
- estilo;
- borde;

la preview debe actualizarse INSTANTÁNEAMENTE.

Pero esos cambios todavía no deben persistirse hasta tocar Guardar.

# 12. BOTONES

Agregar:

`Guardar`

y opcionalmente:

`Restablecer`

Guardar:
- persiste en API;
- actualiza inmediatamente la UI local;
- muestra feedback sutil de éxito.

Restablecer:
- vuelve al preset visual por defecto de la app;
- requiere guardado para persistir, salvo que la UX actual tenga una mejor convención.

No usar alert() nativo.

# 13. API / BACKEND

Crear soporte backend para guardar la apariencia de cada usuario.

Usar una estructura equivalente a:

{
  "preset": "aurora",
  "primaryColor": "#4CC9F0",
  "secondaryColor": "#7B61FF",
  "gradientDirection": "135deg",
  "intensity": "normal",
  "visualStyle": "gradient",
  "avatarBorderStyle": "gradient"
}

No tiene que ser exactamente este schema si el proyecto actual pide otra arquitectura mejor.

Pero debe soportar esos campos.

Crear endpoint autenticado del estilo:

GET /users/me/appearance
PUT /users/me/appearance

o reutilizar una ruta de usuario existente si tiene más sentido.

El usuario solo puede modificar SU propia apariencia.

No permitir modificar apariencia de otro usuario.

# 14. APARIENCIA EN RESPUESTAS DE USUARIOS

Cuando la app necesita mostrar jugadores, debe poder conocer su apariencia pública.

No quiero hacer N requests separados por usuario.

Preferir:
- incluir appearance en la respuesta/listado de usuarios;
- o cargar un mapa de apariencias en una sola request.

Evitar arquitectura ineficiente.

# 15. DÓNDE APLICAR LA PERSONALIZACIÓN

Quiero que la web se vea más viva.

Aplicar la identidad visual del usuario, de forma controlada, en:

- perfil del Rey;
- cards personales;
- líneas/separadores de rachas;
- badges/logros;
- borde del avatar;
- fondo/acento de card de perfil;
- detalles visuales de sus títulos;
- columnas/fotos de Casi Reyes;
- barras asociadas a esa persona en rankings, cuando sea visualmente compatible.

IMPORTANTE:
No convertir TODA la app al color del usuario.

La identidad personal debe aparecer donde ESE usuario está representado.

# 16. RANKINGS

Cuando una persona aparece en una barra de estadísticas:
- se puede usar su color/gradiente personal como accent;
- mantener contraste;
- mantener jerarquía del podio;
- no romper oro/plata/bronce;
- si el gradiente personal compite demasiado con medallas/podio, priorizar la legibilidad del ranking.

No cambiar la lógica de ranking.

# 17. RACHAS

Dentro de cards de rachas:
- líneas;
- separadores;
- pequeños detalles;
- fondo/accent;

pueden usar la personalización del dueño de esa card.

Los mini separadores:
- `Rachas positivas`
- `Rachas negativas`

deben integrarse con su color personal.

No cambiar los textos.

# 18. PERFIL DEL REY

Esta es una de las áreas donde más quiero que se note.

El perfil del Rey debe adoptar visualmente la identidad de esa persona:

- fondo tintado/gradiente muy controlado;
- líneas;
- badges;
- avatar;
- pequeños accents;
- Casi Reyes.

Si hay múltiples Reyes:
cada perfil usa SU propia apariencia.

No mezclar estilos entre Reyes.

# 19. CASI REYES

Cada participante del ranking Casi Reyes debe conservar su propia identidad.

Ejemplo:
- foto de Marto con borde/color de Marto;
- foto de Sebas con borde/color de Sebas;
- pedestal/accent asociado a su apariencia.

Pero mantener coherencia general del gráfico.

# 20. LIGHT / DARK MODE

La personalización debe convivir perfectamente con ambos temas.

El tema global sigue siendo:
- light/dark por dispositivo.

La apariencia personal se aplica ENCIMA de ese tema.

No guardar light/dark por API.

En dark:
- bajar luminosidad/opacidad si hace falta;
- evitar gradientes quemados;
- mantener texto legible.

En light:
- evitar fondos demasiado saturados;
- mantener la estética nevada.

# 21. VALIDACIÓN DE COLORES

Si el usuario elige colores personalizados muy claros, muy oscuros o agresivos:

NO cambiar el color del texto principal.

Adaptar:
- opacidad;
- mezcla;
- overlays;
- borders;

para mantener contraste.

No hace falta implementar un algoritmo enorme, pero evitar combinaciones que rompan legibilidad.

# 22. DEFAULT

Usuarios que nunca personalizaron nada deben conservar exactamente la estética actual.

No forzarles un preset aleatorio.

Debe existir una apariencia default/null que produzca el diseño actual.

# 23. MIGRACIÓN

Agregar migración PostgreSQL limpia para esta nueva configuración.

Preferir:
- tabla específica de appearance/preferences;
- o columnas JSON/JSONB si encaja mejor con la arquitectura actual.

Elegir la opción más coherente con el proyecto.

No tocar datos históricos.

# 24. OFFLINE / FALLBACK

La personalización no es crítica.

Si la API no responde:
- usar apariencia cacheada si existe;
- o fallback default.

No bloquear Home ni perfiles porque appearance falle.

No meter esta feature en la offline queue principal salvo que realmente sea necesario.

Si guardar falla:
- informar de forma sutil;
- no fingir que quedó persistido.

# 25. SEGURIDAD

Validar backend:
- colores HEX válidos;
- enums válidos;
- tamaños de payload;
- solo usuario autenticado modifica su propia configuración.

No confiar únicamente en frontend.

# 26. RENDIMIENTO

Muy importante:

- no crear estilos inline gigantes repetidos;
- usar CSS custom properties por card/perfil cuando sea razonable;
- no recalcular gradientes continuamente;
- no meter listeners duplicados;
- no agregar librerías;
- no usar canvas;
- no usar filtros pesados;
- glow solo estático/sutil;
- mobile-first.

# 27. ANIMACIONES

Personalización debe sentirse premium.

Entrada al menú:
- fade;
- leve desplazamiento;
- suave.

Salida:
- animación equivalente;
- no desaparecer de golpe.

Preview:
- cambios de color pueden transicionar suavemente entre 150–250 ms.

Guardar:
- feedback breve y discreto.

No animar continuamente ningún gradiente.

Respetar prefers-reduced-motion.

# 28. NO TOCAR

No modificar:
- auth salvo nueva ruta autenticada;
- sistema de títulos;
- Rey de Bariloche;
- múltiples Reyes;
- estadísticas;
- rachas;
- encuestas;
- dinero;
- previas;
- sync/offline existente;
- dark mode;
- fotos;
- nombres;
- navegación principal.

Solo integrar appearance donde corresponda.

# 29. TESTS

Cubrir al menos:

- GET appearance propio;
- PUT appearance válido;
- usuario no puede modificar a otro;
- valores HEX inválidos rechazados;
- enum inválido rechazado;
- usuario sin appearance usa default;
- guardar preset;
- guardar custom;
- persistencia tras reload;
- appearance pública visible para otros;
- múltiples usuarios con apariencias distintas;
- light/dark;
- Rey con apariencia;
- múltiples Reyes con apariencias diferentes;
- Casi Reyes;
- rachas;
- fallback si appearance API falla.

# 30. VALIDACIÓN FINAL

Ejecutar:

- migraciones necesarias;
- npm test
- npm run typecheck
- npm run build
- node --check script.js
- npm run db:health

Revisar visualmente:
- entrada al menú;
- salida del menú;
- preview;
- presets;
- custom;
- Guardar;
- Restablecer;
- Home;
- rankings;
- rachas;
- Logros;
- Rey;
- múltiples Reyes;
- Casi Reyes;
- light;
- dark;
- mobile 320px–430px;
- overflow;
- performance.

No hacer commit todavía.

Al final reportar:
1. arquitectura usada para appearance;
2. migración creada;
3. endpoints;
4. cómo se cargan las apariencias públicas sin N requests;
5. dónde se aplican visualmente;
6. cómo convive con light/dark;
7. tests;
8. detalles que convenga revisar manualmente.