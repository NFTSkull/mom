import Link from "next/link";

export default function TrabajadorCompletadoPage() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Evaluación enviada</h1>
      <p className="mt-2 text-sm text-slate-700">
        Tu evaluación fue enviada correctamente. Gracias por participar.
      </p>
      <p className="mt-4">
        <Link href="/trabajador" className="text-sm underline">
          Volver al portal
        </Link>
      </p>
    </section>
  );
}
