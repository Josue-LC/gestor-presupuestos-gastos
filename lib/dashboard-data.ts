
export const dashboardSummary = {
  availableBalance: 28450.75,
  monthlyIncome: 18500,
  monthlyExpenses: 7620.5,
  currency: "MXN",
};

export const weeklyCashFlow = [
  { label: "Sem. 1", income: 4200, expenses: 1850 },
  { label: "Sem. 2", income: 5100, expenses: 2200 },
  { label: "Sem. 3", income: 3200, expenses: 1970.5 },
  { label: "Sem. 4", income: 6000, expenses: 1600 },
];

export const recentTransactions = [
  {
    id: "demo-1",
    description: "Nómina",
    category: "Ingreso de trabajo",
    date: "28 oct. 2026",
    amount: 15000,
    type: "income",
    account: "Cuenta principal",
  },
  {
    id: "demo-2",
    description: "Supermercado",
    category: "Alimentación",
    date: "27 oct. 2026",
    amount: -1250.5,
    type: "expense",
    account: "Tarjeta de débito",
  },
  {
    id: "demo-3",
    description: "Internet",
    category: "Servicios",
    date: "26 oct. 2026",
    amount: -599,
    type: "expense",
    account: "Cuenta principal",
  },
  {
    id: "demo-4",
    description: "Transporte",
    category: "Movilidad",
    date: "25 oct. 2026",
    amount: -320,
    type: "expense",
    account: "Efectivo",
  },
] as const;

export const activeBudgets = [
  {
    id: "demo-budget-1",
    name: "Vivienda y servicios",
    spent: 4200,
    limit: 6000,
    color: "lavender",
  },
  {
    id: "demo-budget-2",
    name: "Alimentación",
    spent: 2800,
    limit: 3500,
    color: "peach",
  },
  {
    id: "demo-budget-3",
    name: "Transporte",
    spent: 900,
    limit: 1500,
    color: "ochre",
  },
  {
    id: "demo-budget-4",
    name: "Ocio",
    spent: 1450,
    limit: 1500,
    color: "pink",
  },
] as const;

export const savingsGoals = [
  {
    id: "demo-goal-1",
    name: "Fondo de emergencia",
    saved: 12000,
    target: 20000,
    color: "mint",
  },
  {
    id: "demo-goal-2",
    name: "Viaje",
    saved: 4500,
    target: 15000,
    color: "pink",
  },
] as const;
