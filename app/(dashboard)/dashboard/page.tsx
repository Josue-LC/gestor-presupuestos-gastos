
import SummaryCards from "@/components/dashboard/SummaryCards";
import ActiveBudgets from "@/components/dashboard/ActiveBudgets";
import CashFlowChart from "@/components/charts/CashFlowChart";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import SavingsGoals from "@/components/dashboard/SavingGoals";

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* Encabezado */}
      <section className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Tablero personal
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Tu dinero, en perspectiva.
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Consulta tus saldos y entiende cómo se distribuyen tus ingresos
            y gastos.
          </p>
        </div>

        <span className="w-fit rounded-full bg-surface-card px-4 py-2 text-xs font-medium text-muted">
          Vista de demostración
        </span>
      </section>

      {/* Resumen financiero */}
      <SummaryCards />

      {/* Flujo de efectivo y presupuestos */}
      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <CashFlowChart />
        </div>

        <div className="min-w-0">
          <ActiveBudgets />
        </div>
      </section>

      {/* Movimientos recientes y metas de ahorro */}
      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <RecentTransactions />
        </div>

        <div className="min-w-0">
          <SavingsGoals />
        </div>
      </section>
    </div>
  );
}
