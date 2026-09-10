Quiero rehacer la personalización premium de Gio.

La implementación actual cambia colores, pero visualmente no sobresale lo suficiente.
Quiero que el perfil/card/badges de Gio tengan MOVIMIENTO REAL y brillo visible.

Objetivo:
que cuando aparezca Gio entre otras personas, se note inmediatamente que su estilo es especial.

IMPORTANTE:
- no quiero solo colores distintos;
- quiero animación visual;
- debe seguir siendo elegante;
- no debe romper rendimiento;
- no debe generar lag;
- mobile-first;
- respetar prefers-reduced-motion.

# 1. PRINCIPIO

La personalización premium de Gio debe poder usar:

- gradientes animados;
- bordes animados;
- glow dinámico;
- reflejos suaves;
- sombras luminosas;
- líneas/accentos con movimiento.

Preferir CSS puro.

NO usar:
- requestAnimationFrame;
- loops JS;
- canvas;
- WebGL;
- filtros pesados constantes.

# 2. GRADIENTE ANIMADO

Agregar una opción premium para Gio donde el fondo use un gradiente con movimiento lento.

Ejemplo conceptual:

background:
linear-gradient(
  120deg,
  gold,
  deep navy,
  violet,
  gold
);

background-size:
300% 300%;

animation:
gradientShift 8s ease infinite;

Debe sentirse:
- fluido;
- lento;
- premium;
- no “RGB gamer”.

# 3. BORDE ANIMADO

Quiero que el borde pueda tener color en movimiento.

Ejemplo:
- dorado;
- blanco brillante;
- azul;
- violeta;
- dorado nuevamente.

El color debe desplazarse alrededor del borde.

Preferir técnicas como:
- pseudo-elemento;
- background gradient;
- mask;
- background-position animado.

No reconstruir DOM.

# 4. GLOW

Agregar glow visible pero controlado.

Opciones:
- suave;
- fuerte;
- royal.

El glow puede:
- pulsar lentamente;
- variar levemente de intensidad;
- reflejar los colores del gradiente.

No hacer parpadeo.

Animaciones lentas, por ejemplo 4–8 segundos.

# 5. REFLEJO / SHIMMER

Agregar un shimmer muy sutil que atraviese la card ocasionalmente.

Ejemplo:
una franja luminosa translúcida que cruza de izquierda a derecha.

No debe estar pasando cada segundo.

Puede durar:
1–2 segundos

y repetirse cada:
8–12 segundos.

# 6. BADGES DE GIO

Quiero que TODO elemento asociado específicamente a Gio pueda usar esta identidad premium:

- badges;
- títulos;
- rachas;
- ranking;
- Casi Reyes;
- perfil del Rey;
- cards personales.

En sus badges:

- borde animado;
- glow sutil;
- pequeño gradiente en movimiento;
- líneas/accentos vivos.

NO aplicar animaciones a texto.

Mantener texto estable y legible.

# 7. NO AFECTAR A OTROS

Esto es exclusivo de Gio.

Otros usuarios:
- mantienen su sistema actual;
- no reciben animaciones premium;
- no ven estas opciones.

No hardcodear estilos globales.

Usar una clase/atributo claro, por ejemplo:
`.appearance-premium-gio`
o equivalente.

# 8. PRESETS PREMIUM

Agregar presets especiales más fuertes:

### Royal Motion
- negro/navy;
- dorado vivo;
- borde dorado animado;
- glow;
- shimmer.

### Aurora Power
- azul brillante;
- violeta;
- cian;
- movimiento suave;
- glow frío.

### Golden Crown
- negro;
- dorado intenso;
- blanco brillante;
- shimmer;
- sombra profunda.

### Energy
- usa los colores custom actuales;
- pero los convierte en gradiente animado;
- borde vivo;
- glow fuerte.

# 9. OPCIONES

Para Gio permitir configurar:

Movimiento:
- apagado
- suave
- intenso

Glow:
- apagado
- suave
- fuerte

Borde:
- sólido
- gradiente
- animado

Shimmer:
- apagado
- sutil

# 10. RENDIMIENTO

MUY IMPORTANTE.

Optimizar para mobile.

Preferir animar:
- background-position;
- opacity;
- transform.

Evitar animar continuamente:
- box-shadow muy grande;
- filter blur pesado;
- width/height;
- layout properties.

Usar:
`will-change`
solo donde realmente ayude.

No poner animaciones innecesarias en decenas de elementos simultáneamente.

Si Gio aparece muchas veces en pantalla:
reducir complejidad visual en elementos pequeños.

Por ejemplo:
- card principal => full premium animation;
- badges pequeños => borde/gradiente simple;
- ranking => glow ligero.

# 11. REDUCED MOTION

Si:

`prefers-reduced-motion: reduce`

entonces:
- detener animaciones;
- mantener versión estática premium;
- conservar colores/glow sin movimiento.

# 12. LIGHT / DARK

Debe funcionar en ambos.

No perder contraste.

Nombre/texto:
- color estable;
- no animado;
- siempre legible.

# 13. PERSISTENCIA

Reutilizar el sistema actual de appearance.

No crear una arquitectura paralela si puede extenderse.

Si hace falta agregar campos como:
- premium_motion
- premium_border_animation
- premium_shimmer

hacer migración segura.

Si hay migración:
- aplicarla también en Supabase real;
- ejecutar db:health;
- evitar repetir el problema de columnas inexistentes.

# 14. VALIDAR

Probar:

- Gio con Royal Motion;
- Gio con Aurora Power;
- Gio con Golden Crown;
- Gio con Energy;
- light;
- dark;
- mobile;
- ranking con Gio;
- Logros con Gio;
- Rey;
- Casi Reyes;
- varias cards visibles a la vez;
- scroll fluido;
- teclado/forms no afectados;
- no errores 500;
- no unauthorized derivados.

# 15. NO TOCAR

No modificar:
- lógica de Logros;
- Rey;
- Stats;
- Daily;
- Push;
- auth;
- encuestas;
- navegación.

Esta tarea es SOLO visual/performance del appearance premium de Gio.

No hacer commit.

Al final reportar:
1. qué animaciones agregaste;
2. qué elementos las usan;
3. cómo limitaste consumo;
4. cómo funciona reduced-motion;
5. qué campos nuevos agregaste si los hubo;
6. tests realizados.