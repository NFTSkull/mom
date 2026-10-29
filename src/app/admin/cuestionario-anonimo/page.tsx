import Image from "next/image";
import Link from "next/link";

const PUBLIC_URL = "https://nom035-production.vercel.app/reporte-anonimo";

export default function AdminCuestionarioAnonimoPage() {
  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Canal anónimo para trabajadores</h1>
        <p className="mt-2 text-slate-700">
          Comparte este código QR con el personal para que puedan reportar situaciones laborales de
          forma anónima, sin iniciar sesión ni proporcionar datos personales.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <Image
            src="/nom035-cuestionario-anonimo-qr.png"
            width={410}
            height={410}
            alt="Código QR para abrir el canal anónimo NOM-035"
            className="mx-auto h-auto w-full max-w-[320px]"
            priority
          />
          <p className="mt-3 break-all text-xs text-slate-500">{PUBLIC_URL}</p>
          <p className="mt-2 text-xs text-slate-500">
            El QR existente sigue siendo válido: la ruta anterior redirige automáticamente a este
            nuevo formulario.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <a
              href="/nom035-cuestionario-anonimo-qr.png"
              download="qr-canal-anonimo-nom035.png"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Descargar QR
            </a>
            <a
              href={PUBLIC_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Abrir formulario
            </a>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Cómo funciona</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-700">
            <li><strong>1.</strong> La persona escanea el QR y abre el formulario público sin iniciar sesión.</li>
            <li><strong>2.</strong> Escribe libremente la situación laboral que desea reportar.</li>
            <li><strong>3.</strong> No se solicitan nombre, correo, NSS, número de empleado ni datos de contacto.</li>
            <li><strong>4.</strong> El reporte entra al canal confidencial protegido con rate limit y anti-spam.</li>
            <li><strong>5.</strong> El personal autorizado lo revisa y gestiona en Admin → Quejas.</li>
          </ol>

          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            Los nuevos envíos aparecerán identificados como <strong>Reporte anónimo</strong> en el
            módulo de Quejas.
          </div>

          <Link
            href="/admin/quejas"
            className="mt-5 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Ver reportes en Quejas
          </Link>
        </article>
      </div>
    </section>
  );
}
