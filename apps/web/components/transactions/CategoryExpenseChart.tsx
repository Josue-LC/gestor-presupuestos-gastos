
"use client";

import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { Transaction } from "@/components/transactions/TransactionList";

interface CategoryExpenseChartProps {
  transactions: Transaction[];
}

interface CategoryExpense {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

const categoryColors: Record<string, string> = {
  Alimentación: "#F59E0B",
  Transporte: "#3B82F6",
  Vivienda: "#8B5CF6",
  Servicios: "#14B8A6",
  Salud: "#EC4899",
  Entretenimiento: "#A855F7",
  Compras: "#F97316",
  Educación: "#06B6D4",
  Otros: "#94A3B8",
};

const fallbackColors = [
  "#64748B",
  "#0D9488",
  "#D946EF",
  "#CA8A04",
  "#2563EB",
];

function formatCurrency(amount: number) {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  });
}

export default function CategoryExpenseChart({
  transactions,
}: CategoryExpenseChartProps) {
  const categoryExpenses = useMemo(() => {
    const expenses = transactions.filter(
      (transaction) =>
        transaction.type === "expense" &&
        transaction.status !== "cancelled",
    );

    const totals = expenses.reduce<Record<string, number>>(
      (accumulator, transaction) => {
        const category = transaction.category.trim() || "Otros";

        accumulator[category] =
          (accumulator[category] ?? 0) + Math.abs(transaction.amount);

        return accumulator;
      },
      {},
    );

    const totalExpenses = Object.values(totals).reduce(
      (total, amount) => total + amount,
      0,
    );

    if (totalExpenses === 0) {
      return [];
    }

    return Object.entries(totals)
      .map(([category, amount], index) => ({
        category,
        amount,
        percentage: (amount / totalExpenses) * 100,
        color:
          categoryColors[category] ??
          fallbackColors[index % fallbackColors.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const totalExpenses = categoryExpenses.reduce(
    (total, category) => total + category.amount,
    0,
  );

  return (
    <section className="rounded-2xl bg-surface-card p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Gastos por categoría
        </h2>
        <p className="mt-1 text-xs text-muted">
          Distribución de tus gastos registrados
        </p>
      </div>

      {categoryExpenses.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-foreground">
            Sin gastos registrados
          </p>
          <p className="mt-1 max-w-[220px] text-xs leading-5 text-muted">
            Cuando registres gastos activos, aparecerá aquí su distribución
            por categoría.
          </p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto mt-3 h-[220px] w-full max-w-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryExpenses}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  stroke="none"
                >
                  {categoryExpenses.map((category) => (
                    <Cell
                      key={category.category}
                      fill={category.color}
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    String(name),
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--color-hairline)",
                    backgroundColor: "var(--color-surface-card)",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-muted">Total gastado</span>
              <span className="mt-1 text-xl font-bold tracking-tight text-foreground">
                {formatCurrency(totalExpenses)}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {categoryExpenses.map((category) => (
              <div
                key={category.category}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="truncate text-xs font-medium text-body">
                    {category.category}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {formatCurrency(category.amount)}
                  </span>
                  <span className="w-11 text-right text-xs tabular-nums text-muted">
                    {category.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
