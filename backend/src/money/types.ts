export const expenseCategories = [
  "Chocolates",
  "Alcohol",
  "Boliche",
  "Comida",
  "Bebida",
  "Actividades",
  "Otros",
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];
export type MovementType = "expense" | "income";

export type MoneyMovement = {
  id: string;
  userId: string;
  type: MovementType;
  amount: number;
  category: ExpenseCategory | null;
  description: string | null;
  movementDate: string;
  createdAt: string;
  updatedAt: string;
};

export type UserMoney = {
  initialBalance: number | null;
  movements: MoneyMovement[];
};

export type MovementInput = {
  type: MovementType;
  amount: number;
  category: ExpenseCategory | null;
  description: string | null;
  movementDate: string;
};
