
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { weeklyCashFlow } from "@/lib/dashboard-data";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export default function CashFlowChart() {
  return (
    <section className="rounded-2xl bg-surface-card p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Flujo de efectivo
          </p>
          <p className="mt-1 text-xs text-muted">
            Comparación de ingresos y gastos por semana
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-brand-mint" />
            <span className="text-xs text-muted">Ingresos</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-brand-peach" />
            <span className="text-xs text-muted">Gastos</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={weeklyCashFlow}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            barGap={8}
          >
            <CartesianGrid
              vertical={false}
              stroke="#e5e5e5"
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6a6a6a", fontSize: 11 }}
              dy={10}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6a6a6a", fontSize: 10 }}
              tickFormatter={(value) => `$${value / 1000}k`}
              width={48}
            />

            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.35)" }}
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                name === "income" ? "Ingresos" : "Gastos",
              ]}
              contentStyle={{
                border: "1px solid #e5e5e5",
                borderRadius: "12px",
                backgroundColor: "#fef9ef",
                fontSize: "12px",
              }}
            />

            <Bar
              dataKey="income"
              name="income"
              fill="#a4d4c5"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
            />

            <Bar
              dataKey="expenses"
              name="expenses"
              fill="#ffb084"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
        <p className="text-xs text-muted">
          Datos de demostración
        </p>

        <p className="text-xs font-medium text-foreground">
          Últimas 4 semanas
        </p>
      </div>
    </section>
  );
}
