
export type TransactionCategoryType = "income" | "expense";

export interface TransactionCategory {
  id: string;
  name: string;
  type: TransactionCategoryType;
}

export const transactionCategories: TransactionCategory[] = [
  // Gastos
  { id: "food", name: "Alimentación", type: "expense" },
  { id: "transport", name: "Transporte", type: "expense" },
  { id: "housing", name: "Vivienda", type: "expense" },
  { id: "services", name: "Servicios", type: "expense" },
  { id: "health", name: "Salud", type: "expense" },
  { id: "entertainment", name: "Entretenimiento", type: "expense" },
  { id: "shopping", name: "Compras", type: "expense" },
  { id: "education", name: "Educación", type: "expense" },
  { id: "other-expense", name: "Otros", type: "expense" },

  // Ingresos
  { id: "salary", name: "Nómina", type: "income" },
  { id: "freelance", name: "Trabajo independiente", type: "income" },
  { id: "sales", name: "Ventas", type: "income" },
  { id: "investments", name: "Inversiones", type: "income" },
  { id: "refunds", name: "Reembolsos", type: "income" },
  { id: "other-income", name: "Otros", type: "income" },
];

export function getTransactionCategories(
  type: TransactionCategoryType
): TransactionCategory[] {
  return transactionCategories.filter(
    (category) => category.type === type
  );
}

export function getTransactionCategoryNames(
  type: TransactionCategoryType
): string[] {
  return getTransactionCategories(type).map(
    (category) => category.name
  );
}
