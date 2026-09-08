Quiero implementar una nueva personalización llamada:

`Frase del Rey`

Es una frase personal que cada usuario puede configurar anticipadamente y que SOLO se mostrará en su perfil si termina siendo Rey de Bariloche una vez completadas las 8 noches del viaje.

IMPORTANTE:
- el viaje tiene 9 días y 8 noches;
- la frase NO debe aparecer antes de completar las 8 noches;
- no modificar todavía la función de Simular datos;
- eso se hará en otro cambio.

# 1. CAMPO EN PERSONALIZACIÓN

En la sección actual de `Personalización`, agregar AL FINAL ABSOLUTO un nuevo bloque:

`Frase del Rey`

Debe estar después de todas las opciones visuales actuales.

Agregar una explicación breve:

`Se mostrará en tu perfil si terminás siendo Rey de Bariloche.`

Debajo, un campo de texto.

Ejemplo de lo que puede escribir el usuario:

`Ja, pedazos de bots`

IMPORTANTE:
el usuario escribe SOLO la frase.

NO debe escribir comillas manualmente.
Las comillas se agregan únicamente al renderizarla en el perfil del Rey.

# 2. LÍMITES

La frase debe:

- tener mínimo 3 caracteres;
- tener máximo 80 caracteres;
- aplicar trim al inicio/final;
- no aceptar únicamente espacios;
- permitir:
  - letras;
  - números;
  - signos;
  - emojis;
  - acentos;
- no interpretar HTML.

Si supera el máximo:
- impedir guardar o mostrar validación elegante dentro de la app;
- no usar alert().

Agregar contador discreto:

`23 / 80`

No debe sentirse como un formulario pesado.

# 3. DISEÑO DEL CAMPO

Mantener exactamente el lenguaje visual actual de Personalización:

- light mode;
- dark mode;
- colores personalizados;
- glass;
- mobile-first;
- bordes suaves;
- transiciones actuales.

El campo debe sentirse moderno y coherente con el selector de personalización.

No usar un textarea enorme.

Como son máximo 80 caracteres, puede ser:
- input;
o
- textarea compacto de 2 líneas si mejora UX.

# 4. PREVIEW

Si la Personalización ya tiene preview en vivo, agregar también la frase a esa preview.

Debe verse como después aparecerá en el perfil:

`“Ja, pedazos de bots”`

En cursiva.

La preview sí puede mostrarla inmediatamente mientras se edita.

Esto NO significa que sea visible públicamente antes de terminar el viaje.

# 5. PERSISTENCIA API

La frase es parte del perfil público del usuario.

Debe guardarse por API/PostgreSQL, igual que su appearance.

No usar solamente localStorage.

Puede:
- extender la configuración/perfil actual;
- o almacenarse de la forma más coherente con la arquitectura existente.

No crear una arquitectura enorme solo por un string.

Cada usuario únicamente puede modificar SU propia frase.

# 6. VISIBILIDAD PÚBLICA

La frase NO debe mostrarse:

- en Home;
- en rankings;
- en Logros normales;
- en Rachas;
- en Casi Reyes;
- en cards normales de usuario;
- durante las primeras 7 noches del viaje.

Su único destino público es:

`Perfil del Rey de Bariloche`

# 7. CUÁNDO SE DESBLOQUEA

Regla fundamental:

La frase del Rey solamente aparece cuando estén completadas las 8 noches del viaje.

Antes de eso:

aunque exista un Rey provisional,
NO mostrar su frase.

No mostrar:
- placeholder;
- frase oculta gris;
- `Próximamente`;
- espacio vacío reservado.

Simplemente no existe visualmente todavía.

Una vez que el viaje tenga las 8 noches cerradas/registradas y se determine el Rey final:

=> mostrar la frase.

# 8. PERFIL DEL REY

Actualmente el perfil muestra aproximadamente:

[FOTO]

[NOMBRE]

[SU FUERTE]

Quiero agregar inmediatamente DEBAJO de `Su fuerte`:

`“Frase configurada por esa persona”`

Ejemplo:

[FOTO]

Gio

Su fuerte: Boliche

“Ja, pedazos de bots”

# 9. ESTILO DE LA FRASE

Debe sentirse como una pequeña nota/declaración personal del Rey.

Usar:

- comillas visuales;
- cursiva;
- centrada;
- tamaño ligeramente menor que el nombre;
- color de texto legible del tema;
- opacidad un poco más suave que el texto principal;
- espacio agradable respecto a `Su fuerte`.

NO usar el color personalizado como color principal del texto si compromete legibilidad.

El entorno/accent puede seguir usando los colores personales del Rey.

No agregar:
- icono de comentario;
- globito de chat;
- card extra;
- encabezado `Frase del Rey`.

Debe sentirse integrada naturalmente al perfil.

# 10. MÚLTIPLES REYES

La app soporta múltiples Reyes por empate.

Si hay dos o más Reyes finales:

cada Rey muestra SU propia frase en SU perfil.

Ejemplo:

Gio:
`“Ja, pedazos de bots”`

Marto:
`“Les dije que iba a pasar”`

No compartir frases ni usar la del primer Rey.

# 11. USUARIO SIN FRASE

Si un Rey no configuró frase:

NO mostrar nada.

No usar:
- `Sin frase`
- `No configurada`
- placeholder.

El perfil simplemente continúa normalmente.

# 12. CAMBIOS POSTERIORES

Si después de las 8 noches el usuario modifica su frase desde Personalización:

la nueva frase debe persistir y reflejarse en su perfil de Rey.

No congelar permanentemente el texto salvo que la arquitectura actual requiera otra cosa.

# 13. NO TOCAR

No modificar:

- cálculo del Rey;
- múltiples Reyes;
- Casi Reyes;
- estadísticas;
- títulos;
- rachas;
- encuestas;
- notificaciones;
- auth;
- sync;
- dark mode;
- sistema de colores;
- fotos;
- navegación;
- Simular datos.

IMPORTANTE:
NO tocar todavía `Simular datos`.

Más adelante se modificará para tener:
- `Simular 8 noches`
- `Simular el día de ayer`

Eso pertenece a otro prompt.

# 14. VALIDACIÓN

Probar:

1. frase de menos de 3 caracteres -> rechazada;
2. frase de 3 caracteres -> válida;
3. frase de 80 -> válida;
4. más de 80 -> rechazada;
5. emojis -> válidos;
6. espacios solamente -> inválido;
7. guardar y recargar -> persiste;
8. otro usuario puede recibir la frase pública pero no editarla;
9. antes de completar 8 noches -> NO aparece en perfil Rey;
10. después de completar 8 noches -> aparece;
11. Rey sin frase -> no aparece nada;
12. dos Reyes -> cada uno muestra su propia frase;
13. light mode;
14. dark mode;
15. mobile;
16. texto largo no genera overflow.

Ejecutar:

- node --check script.js
- npm test
- npm run typecheck
- npm run build
- npm run db:health

Si hace falta una nueva migración:
- revisarla;
- aplicarla también a Supabase real;
- no dejar producción esperando una migración pendiente.

No hacer commit.

Al final reportar:
1. dónde guardaste la frase;
2. endpoints/cambios API;
3. cómo determinás que ya terminaron las 8 noches;
4. cómo evitás mostrarla antes;
5. comportamiento con múltiples Reyes;
6. tests realizados.