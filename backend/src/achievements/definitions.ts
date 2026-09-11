export type AchievementType = "unique" | "secret";

export type AchievementDefinition = {
  key: string;
  type: AchievementType;
  name: string;
  description: string;
  condition: string;
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    key: "first_bottom",
    type: "unique",
    name: "Primero en tocar fondo",
    description: "Primero en dormir menos de 3 horas",
    condition: "Sueño nocturno de una noche menor a 3 horas.",
  },
  {
    key: "first_extra_sleep",
    type: "unique",
    name: "Primero en dormir horas extra",
    description: "Primero en dormir más de 8 horas",
    condition: "Sueño nocturno de una noche mayor a 8 horas.",
  },
  {
    key: "first_broke_wallet",
    type: "unique",
    name: "Primero en romper la billetera",
    description: "Primero en superar los $350.000 gastados",
    condition: "Gasto acumulado total en movimientos de tipo expense mayor o igual a $350.000.",
  },
  {
    key: "first_three_closed_clubs",
    type: "unique",
    name: "Primero en cerrar 3 veces",
    description: "Primero en cerrar 3 noches",
    condition: "Llegar a 3 noches con cierre de boliche acumuladas durante el viaje.",
  },
  {
    key: "secret_no_sleep_required",
    type: "secret",
    name: "¿Dormir era obligatorio?",
    description: "Dormir menos de una hora en una noche",
    condition: "Sueño nocturno de una noche menor a 1 hora.",
  },
  {
    key: "secret_not_a_competition",
    type: "secret",
    name: "No era una competencia",
    description: "Ganar 4 estadísticas distintas en el mismo día",
    condition: "Ganar al menos 4 estadísticas dinámicas distintas durante el mismo día cerrado.",
  },
  {
    key: "secret_came_to_break",
    type: "secret",
    name: "Vino a quebrar",
    description: "Ser el más destruido y el que más gastó en alcohol el mismo día",
    condition: "Ganar destroyed_vote y el ranking diario de gasto en Alcohol durante el mismo día cerrado.",
  },
  {
    key: "secret_club_staff",
    type: "secret",
    name: "Parte del personal bolichero",
    description: "Cerrar 6 noches",
    condition: "Llegar a 6 noches con cierre de boliche acumuladas durante el viaje.",
  },
  {
    key: "secret_who_hurt_you",
    type: "secret",
    name: "¿Quién te hizo tanto daño?",
    description: "Ganar una condición negativa durante 4 noches consecutivas",
    condition: "Ser ganador de al menos una condición negativa durante 4 días cerrados consecutivos.",
  },
  {
    key: "secret_broke_economy",
    type: "secret",
    name: "Economía precaria",
    description: "Pasar un día completo sin gastar nada",
    condition: "Tener $0 en movimientos de tipo expense durante un día cerrado.",
  },
  {
    key: "secret_outfit_consequences",
    type: "secret",
    name: "Outfit con consecuencias",
    description: "Ganar El mejor outfit y El más destruido el mismo día",
    condition: "Ganar best_outfit y destroyed_vote durante el mismo día cerrado.",
  },
];

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENTS.map((achievement) => [achievement.key, achievement]));
