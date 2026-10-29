import Image from "next/image";
import Link from "next/link";

const PUBLIC_URL = "https://nom035-production.vercel.app/cuestionario-anonimo";

export default function AdminCuestionarioAnonimoPage() {
  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Cuestionario anónimo</h1>
        <p className="mt-2 text-slate-700">
          Comparte este QR con el personal. El formulario no solicita nombre, correo,
          usuario, NSS ni número de empleado.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <Image
            src="/nom035-cuestionario-anonimo-qr.png"
            width={410}
            height={410}
            alt="Código QR para abrir el cuestionario anónimo NOM-035"
            className="mx-auto h-auto w-full max-w-[320px]"
            priority
          />
          <p className="mt-3 break-all text-xs text-slate-500">{PUBLIC_URL}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <a
              href="/nom035-cuestionario-anonimo-qr.png"
              download="qr-cuestionario-anonimo-nom035.png"
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
            <li><strong>2.</strong> Responde cinco preguntas de percepción y, si desea, agrega comentarios abiertos.</li>
            <li><strong>3.</strong> No se solicitan datos de identidad. Los campos abiertos advierten que no escriban nombres.</li>
            <li><strong>4.</strong> La respuesta entra al canal confidencial con rate limit y protección anti-bots ya existente.</li>
            <li><strong>5.</strong> El personal autorizado la revisa en Admin → Quejas.</li>
          </ol>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Las respuestas aparecen con el tipo visible <strong>Cuestionario anónimo</strong>.
            El cuestionario no sustituye la evaluación oficial NOM-035.
          </div>

          <Link
            href="/admin/quejas"
            className="mt-5 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Ver respuestas en Quejas
          </Link>
        </article>
      </div>
    </section>
  );
}
