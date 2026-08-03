/**
 * Política pura del piloto B4.12 (sin I/O Cloud).
 * Solo TST-PROD-PILOT-001 / CAMPANA_TST_PROD_PILOT.
 */
import {
  B412_PILOT_CAMPAIGN,
  B412_PILOT_EMAIL,
  B412_PILOT_MARKER,
  B412_PILOT_REF,
  B412_PILOT_USERNAME,
} from "./b412-pilot-constants";

export function assertExactPilotWorkerRef(ref: string): void {
  if (ref !== B412_PILOT_REF) {
    throw new Error("ABORT: worker ref no es el piloto sintético exacto");
  }
  if (!ref.startsWith("TST-")) {
    throw new Error("ABORT: worker no sintético");
  }
}

export function assertExactPilotCampaign(nombre: string): void {
  if (nombre !== B412_PILOT_CAMPAIGN) {
    throw new Error("ABORT: campaña no es la campaña piloto sintética");
  }
}

export function assertPilotEmail(email: string): void {
  if (email.toLowerCase() !== B412_PILOT_EMAIL) {
    throw new Error("ABORT: email no pertenece al piloto sintético");
  }
}

export function assertPilotUsername(username: string): void {
  if (username !== B412_PILOT_USERNAME) {
    throw new Error("ABORT: username no pertenece al piloto sintético");
  }
}

export function assertNoCsvImport(env: Record<string, string | undefined>): void {
  if (env.WORKERS_CSV) {
    throw new Error("ABORT: CSV / importación masiva prohibida en piloto");
  }
}

export function assertSinglePilotCount(existingPilotRefs: string[]): void {
  const others = existingPilotRefs.filter((r) => r !== B412_PILOT_REF && r.startsWith("TST-PROD-PILOT"));
  if (others.length > 0) {
    throw new Error("ABORT: más de un piloto / marcador piloto extra");
  }
  const realLike = existingPilotRefs.filter((r) => !r.startsWith("TST-"));
  if (realLike.length > 0) {
    throw new Error("ABORT: operación sobre trabajador no sintético");
  }
}

export function assertNotMassOperation(count: number, max = 1): void {
  if (count > max) {
    throw new Error("ABORT: operación masiva rechazada");
  }
}

export function assertCleanupTarget(opts: {
  workerRef?: string | null;
  campaignName?: string | null;
  authEmail?: string | null;
}): void {
  if (opts.workerRef != null && opts.workerRef !== B412_PILOT_REF) {
    throw new Error("ABORT: cleanup rechazado — worker ref ajeno");
  }
  if (opts.campaignName != null && opts.campaignName !== B412_PILOT_CAMPAIGN) {
    throw new Error("ABORT: cleanup rechazado — campaña ajena");
  }
  if (opts.authEmail != null && opts.authEmail.toLowerCase() !== B412_PILOT_EMAIL) {
    throw new Error("ABORT: cleanup rechazado — auth ajeno");
  }
}

export function isPilotDryRun(env: Record<string, string | undefined>): boolean {
  return env.B412_PILOT_DRY_RUN === "1";
}

export function redactSecretsFromText(text: string): string {
  return text
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/sb_secret_[A-Za-z0-9]+/g, "[REDACTED_KEY]")
    .replace(/ghp_[A-Za-z0-9]+/g, "[REDACTED_TOKEN]");
}

export function assertLogHasNoSecrets(stdout: string, stderr = ""): void {
  const blob = `${stdout}\n${stderr}`;
  if (/eyJ[a-zA-Z0-9_-]{10,}\./.test(blob)) {
    throw new Error("ABORT: posible JWT en logs");
  }
  if (/ghp_[A-Za-z0-9]{20,}/.test(blob)) {
    throw new Error("ABORT: posible token en logs");
  }
  if (/Nom035-Pilot#|password["']?\s*[:=]/i.test(blob)) {
    throw new Error("ABORT: posible password en logs");
  }
  if (new RegExp(B412_PILOT_EMAIL.replace(".", "\\."), "i").test(blob) === false) {
    // email piloto en logs sanitizados está OK solo si no se exige ocultarlo;
    // no fallar aquí.
  }
  void B412_PILOT_MARKER;
}

export function assertTempCredsAbsent(exists: boolean): void {
  if (exists) throw new Error("ABORT: credenciales temporales aún presentes");
}
