/**
 * B4.15.4B — Password = "NOM" + numero_empleado_canonico (string).
 * Sin `!`, espacios, guiones u otros símbolos. Nunca coerción numérica.
 */

export class B4154PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "B4154PolicyError";
  }
}

/** Normaliza el número de empleado como string (sin Number/parseInt/+). */
export function normalizeEmployeeNumber(raw: string): string {
  if (typeof raw !== "string") {
    throw new B4154PolicyError("número de empleado debe ser string");
  }
  const digits = raw.replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
  if (!digits) {
    throw new B4154PolicyError("número de empleado vacío");
  }
  return digits.padStart(4, "0").slice(-8);
}

export function proposedUsername(externalRef: string): string {
  return `empleado.${normalizeEmployeeNumber(externalRef)}`;
}

/**
 * Password = NOM + número canónico (ya con ceros iniciales).
 * Exactamente la regla de producto B4.15.4B — sin `!`.
 */
export function buildWorkerPassword(employeeNumber: string): string {
  const canonical = employeeNumber.trim();
  if (!canonical) {
    throw new Error("Número de empleado inválido");
  }
  return `NOM${canonical}`;
}

/** Desde raw de DB: normaliza → NOM+canónico. */
export function passwordFromEmployeeNumber(raw: string): string {
  return buildWorkerPassword(normalizeEmployeeNumber(raw));
}

export function assertPasswordEqualsNomCanonical(
  password: string,
  employeeNumberRaw: string
): void {
  const expected = passwordFromEmployeeNumber(employeeNumberRaw);
  if (password !== expected) {
    throw new B4154PolicyError("password ≠ NOM+número canónico");
  }
  if (typeof password !== "string") {
    throw new B4154PolicyError("tipos no string");
  }
  if (password.includes("!")) {
    throw new B4154PolicyError("password contiene !");
  }
}

/** Compat */
export function assertPasswordEqualsCanonical(
  password: string,
  employeeNumberRaw: string
): void {
  assertPasswordEqualsNomCanonical(password, employeeNumberRaw);
}

export type PasswordPlanRow = {
  workerId: string;
  authUserId: string;
  username: string;
  employeeNumberCanonical: string;
  passwordCandidate: string;
};

export function buildPasswordPlan(rows: Array<{
  workerId: string;
  authUserId: string;
  username: string;
  externalReference: string;
}>): {
  plan: PasswordPlanRow[];
  uniquePasswords: number;
  uniqueNumbers: number;
  usernameMismatches: number;
  emptyNumbers: number;
  duplicates: string[];
  policyFailingUnder6: number;
  hasExclamation: number;
} {
  const plan: PasswordPlanRow[] = [];
  let emptyNumbers = 0;
  let usernameMismatches = 0;
  let policyFailingUnder6 = 0;
  let hasExclamation = 0;
  const seenPwd = new Map<string, number>();

  for (const r of rows) {
    const raw = r.externalReference;
    if (typeof raw !== "string" || !raw.trim()) {
      emptyNumbers += 1;
      continue;
    }
    const canonical = normalizeEmployeeNumber(raw);
    const expectedUsername = proposedUsername(raw);
    if (r.username !== expectedUsername) {
      usernameMismatches += 1;
    }
    const passwordCandidate = buildWorkerPassword(canonical);
    assertPasswordEqualsNomCanonical(passwordCandidate, raw);
    if (passwordCandidate.length < 6) policyFailingUnder6 += 1;
    if (passwordCandidate.includes("!")) hasExclamation += 1;
    seenPwd.set(passwordCandidate, (seenPwd.get(passwordCandidate) ?? 0) + 1);
    plan.push({
      workerId: r.workerId,
      authUserId: r.authUserId,
      username: r.username,
      employeeNumberCanonical: canonical,
      passwordCandidate,
    });
  }

  const duplicates = [...seenPwd.entries()]
    .filter(([, n]) => n > 1)
    .map(([p]) => `len=${p.length}`);

  return {
    plan,
    uniquePasswords: seenPwd.size,
    uniqueNumbers: new Set(plan.map((p) => p.employeeNumberCanonical)).size,
    usernameMismatches,
    emptyNumbers,
    duplicates,
    policyFailingUnder6,
    hasExclamation,
  };
}

/** Política local: min 6, patrón NOM+digits, sin ! ni whitespace. */
export function assertLocalPasswordPolicy(passwords: string[]): {
  ok: true;
} | {
  ok: false;
  failing: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let failing = 0;
  for (const p of passwords) {
    if (typeof p !== "string") {
      failing += 1;
      reasons.push("not_string");
      continue;
    }
    if (p.length < 6) {
      failing += 1;
      reasons.push("under_min_6");
      continue;
    }
    if (p.includes("!")) {
      failing += 1;
      reasons.push("exclamation");
      continue;
    }
    if (/\s/.test(p)) {
      failing += 1;
      reasons.push("whitespace");
      continue;
    }
    if (!/^NOM[0-9]+$/.test(p)) {
      failing += 1;
      reasons.push("pattern");
    }
  }
  if (failing > 0) {
    return { ok: false, failing, reasons: [...new Set(reasons)] };
  }
  return { ok: true };
}

export function redactPlanForLog(plan: PasswordPlanRow[]): Array<{
  workerIdPrefix: string;
  usernameSuffixLen: number;
  passwordLen: number;
}> {
  return plan.map((p) => ({
    workerIdPrefix: p.workerId.slice(0, 8),
    usernameSuffixLen: p.username.length,
    passwordLen: p.passwordCandidate.length,
  }));
}
