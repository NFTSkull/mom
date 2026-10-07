"use client";

type BarChartProps = {
  title: string;
  items: Array<{ label: string; value: number }>;
  testId?: string;
};

function formatLabel(value: string): string {
  if (value.length <= 36) return value;
  return `${value.slice(0, 35)}…`;
}

export function AdminSimpleBarChart({ title, items, testId }: BarChartProps) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rounded border border-slate-200 bg-white p-4" data-testid={testId}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-slate-500">Sin datos</li>
        ) : (
          items.map((item) => (
            <li key={item.label} className="text-xs">
              <div className="mb-1 flex justify-between gap-2 text-slate-700">
                <span title={item.label}>{formatLabel(item.label)}</span>
                <span className="font-medium">{item.value}</span>
              </div>
              <div className="h-2 rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-slate-700"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function AdminReportChartsPanel({
  riskLevels,
  categoryAverages,
  domainAverages,
  completion,
}: {
  riskLevels: Record<string, number>;
  categoryAverages: Record<string, number>;
  domainAverages: Record<string, number>;
  completion: { completed: number; pending: number; inProgress: number };
}) {
  const riskItems = [
    { label: "Nulo/despreciable", value: riskLevels.nulo ?? 0 },
    { label: "Bajo", value: riskLevels.bajo ?? 0 },
    { label: "Medio", value: riskLevels.medio ?? 0 },
    { label: "Alto", value: riskLevels.alto ?? 0 },
    { label: "Muy alto", value: riskLevels.muy_alto ?? 0 },
  ];
  const categoryItems = Object.entries(categoryAverages).map(([label, value]) => ({
    label,
    value,
  }));
  const domainItems = Object.entries(domainAverages).map(([label, value]) => ({
    label,
    value,
  }));
  const completionItems = [
    { label: "Completados", value: completion.completed },
    { label: "Pendientes", value: completion.pending },
    { label: "En progreso", value: completion.inProgress },
  ];

  return (
    <section className="grid gap-3 lg:grid-cols-2" data-testid="admin-report-charts">
      <AdminSimpleBarChart title="Distribución por nivel de riesgo" items={riskItems} testId="chart-risk" />
      <AdminSimpleBarChart title="Avance de evaluación" items={completionItems} testId="chart-completion" />
      <AdminSimpleBarChart title="Promedio por categoría" items={categoryItems} testId="chart-categories" />
      <AdminSimpleBarChart title="Promedio por dominio" items={domainItems} testId="chart-domains" />
    </section>
  );
}
