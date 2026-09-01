# Dark mode — segunda pasada y pulido visual

La primera implementación de dark mode quedó excelente. No quiero rediseñarla ni cambiar su dirección estética.

Quiero completar tres cosas.

## 1. Terminar dark mode en todos los apartados restantes

Extender el dark mode ya existente a todo lo que quedó afuera, especialmente:

- Admin de Gio
- Ajustes de Admin
- Agregar jugador
- Actualizar código
- Zona peligrosa
- formularios, modales, sheets, inputs y confirmaciones relacionados
- cualquier pantalla/componente restante que todavía conserve colores claros hardcodeados

IMPORTANTE:
- reutilizar exactamente la arquitectura de variables/tema ya implementada;
- no crear un segundo sistema de dark mode;
- mantener la misma estética nocturna actual;
- negro azulado, azul noche, gris frío, blanco hielo;
- adaptar también bordes, inputs, placeholders, overlays, mensajes y estados;
- no usar naranja para textos;
- rojo solamente donde tenga sentido funcional/destructivo;
- no cambiar lógica de Admin, permisos, API ni navegación;
- no rediseñar layouts.

Al terminar, toda la app debe sentirse parte del mismo sistema visual en ambos temas.

## 2. Microanimación del icono al cambiar de tema

Quiero agregar un detalle visual MUY sutil al botón de tema de Home.

Actualmente:
- tema claro → botón muestra copo de nieve
- tema oscuro → botón muestra luna

Cuando el usuario cambia de tema manualmente, quiero que el icono ANTERIOR tenga una pequeña animación de despedida.

Ejemplos:

Dark → Light:
- aparece el copo como nuevo icono;
- al mismo tiempo, una copia visual de la luna anterior cae suavemente hacia abajo;
- debe terminar desapareciendo POR DETRÁS de las montañas de Home.

Light → Dark:
- aparece la luna;
- el copo anterior cae suavemente por detrás de las montañas.

Dirección visual:
- movimiento corto y natural;
- descenso suave;
- puede tener una desviación/rotación mínima si queda elegante;
- bajar opacidad durante la caída;
- la copia debe ser más transparente que el icono normal;
- no debe llamar demasiado la atención;
- sensación de pequeño “easter egg” visual, no de animación protagonista.

MUY IMPORTANTE:
- las montañas deben realmente quedar visualmente delante del icono que cae mediante capas/z-index/clipping apropiado;
- no alterar la posición real del botón;
- animar un elemento temporal/clonado, no mover el botón;
- eliminar el elemento temporal al finalizar;
- no dejar nodos acumulados en DOM;
- no generar lag;
- no usar librerías;
- no usar canvas;
- no aumentar partículas;
- respetar prefers-reduced-motion: en ese caso simplemente cambiar icono sin caída;
- solo ejecutar esta animación cuando el usuario pulsa manualmente el botón, no al cargar/restaurar el tema.

Duración orientativa: aproximadamente 500–900 ms, elegida según se vea más natural.

No modificar la animación especial del saludo que ya implementamos.

## 3. Mejorar colores de las barras de rankings

Hay un problema visual en Estadísticas:

Actualmente jugadores que quedan 4º, 5º, etc. pueden terminar teniendo una barra prácticamente del mismo color que el ganador.

Eso hace que visualmente todos parezcan igual de importantes.

Quiero una jerarquía clara.

### Podio

1º:
- barra con el color/acento principal del ganador;
- debe ser claramente la más destacada.

2º:
- variante visual asociada a plata, pero elegante y compatible con light/dark.

3º:
- variante asociada a bronce.

### Puesto 4 en adelante

- usar un color secundario/neutro;
- azul grisáceo / gris frío;
- claramente menos saturado que el ganador;
- mantener buena legibilidad;
- NO hacer que parezcan deshabilitados;
- mantener suficiente contraste contra el fondo.

Debe funcionar tanto en light como en dark mode.

IMPORTANTE:
La lógica existente de empates NO debe cambiar.

Si existen varios ganadores empatados en primer lugar:
- todos pertenecen visualmente al grupo ganador;
- conservar la lógica actual de trofeo/medallas;
- no romper el sistema especial de empates.

Luego plata/bronce deben seguir respetando exactamente la lógica de ranking que ya existe.

El cambio pedido es principalmente VISUAL, no recalcular posiciones.

Revisar todos los rankings donde se reutilice este componente de barras para que la jerarquía sea consistente.

## Validación final

Revisar visualmente:

- Home light
- Home dark
- animación copo → luna
- animación luna → copo
- que el icono caiga realmente detrás de las montañas
- cambios rápidos repetidos de tema sin glitches/nodos acumulados
- prefers-reduced-motion
- Admin completo en light/dark
- formularios de Admin
- Zona peligrosa
- estadísticas light/dark
- ranking normal
- empates en primer lugar
- segundo y tercero
- puestos 4+

Luego ejecutar:
- node --check script.js
- npm test
- npm run typecheck
- npm run build

No hacer commit todavía.

Al finalizar, reportar brevemente qué archivos tocaste y cualquier detalle que convenga revisar manualmente.