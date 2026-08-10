/**
 * B4.18 — Usernames secuenciales 001–083 (string), independientes del número de empleado.
 * Nunca Number/parseInt/+ sobre el username.
 */

export class B418PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "B418PolicyError";
  }
}

/** "001"…"083" como string; sin coerción numérica. */
export function sequenceUsername(index1Based: number): string {
  if (!Number.isInteger(index1Based) || index1Based < 1 || index1Based > 83) {
    throw new B418PolicyError(`índice fuera de 1–83: ${index1Based}`);
  }
  const s = String(index1Based);
  return s.length >= 3 ? s : s.padStart(3, "0");
}

export function assertUsernameIsPaddedSequence(username: string): void {
  if (typeof username !== "string") {
    throw new B418PolicyError("username debe ser string");
  }
  if (username !== username.trim()) {
    throw new B418PolicyError("username con espacios");
  }
  if (!/^[0-9]{3}$/.test(username)) {
    throw new B418PolicyError(`username no es ###: ${username}`);
  }
  if (username !== sequenceUsername(Number(username))) {
    // Number() solo para validar rango 1–83 del literal de 3 dígitos; el valor almacenado sigue siendo string.
    throw new B418PolicyError(`username fuera de secuencia canónica: ${username}`);
  }
  const n = Number(username);
  if (n < 1 || n > 83) {
    throw new B418PolicyError(`username fuera de 001–083: ${username}`);
  }
  // Regresión crítica: "001" no debe colapsar a "1"
  if (String(n) === username && username.startsWith("0")) {
    throw new B418PolicyError("username perdió ceros iniciales");
  }
  if (username === "1" || username === "01") {
    throw new B418PolicyError("forma inválida (faltan ceros)");
  }
}

export function isLegacyEmpleadoUsername(username: string): boolean {
  return /^empleado\.[0-9a-z]+$/i.test(username.trim());
}

export type B418MappingRow = {
  index1Based: number;
  oldUsername: string;
  newUsername: string;
  employeeNumberRaw: string;
  workerId?: string;
  authUserId?: string;
  accountId?: string;
};

/**
 * Construye mapping 001–083 a partir de filas YA ORDENADAS
 * (mismo orden que la lista original / B4.14: sort numérico de external_reference).
 * No reordena.
 */
export function buildSequenceMapping(
  orderedRows: Array<{ oldUsername: string; employeeNumberRaw: string }>
): B418MappingRow[] {
  if (orderedRows.length !== 83) {
    throw new B418PolicyError(`se esperaban 83 filas, hay ${orderedRows.length}`);
  }
  const seenOld = new Set<string>();
  const seenNew = new Set<string>();
  const mapping: B418MappingRow[] = [];

  for (let i = 0; i < orderedRows.length; i += 1) {
    const row = orderedRows[i]!;
    const oldUsername = row.oldUsername.trim().toLowerCase();
    const newUsername = sequenceUsername(i + 1);
    assertUsernameIsPaddedSequence(newUsername);

    if (!isLegacyEmpleadoUsername(oldUsername) && !/^[0-9]{3}$/.test(oldUsername)) {
      throw new B418PolicyError(`username actual inesperado: ${oldUsername}`);
    }
    if (seenOld.has(oldUsername)) {
      throw new B418PolicyError(`old username duplicado: ${oldUsername}`);
    }
    if (seenNew.has(newUsername)) {
      throw new B418PolicyError(`new username duplicado: ${newUsername}`);
    }
    seenOld.add(oldUsername);
    seenNew.add(newUsername);
    mapping.push({
      index1Based: i + 1,
      oldUsername,
      newUsername,
      employeeNumberRaw: row.employeeNumberRaw,
    });
  }

  if (mapping[0]?.newUsername !== "001") {
    throw new B418PolicyError("primer username ≠ 001");
  }
  if (mapping[82]?.newUsername !== "083") {
    throw new B418PolicyError("último username ≠ 083");
  }
  return mapping;
}

/** Orden canónico B4.14 / lista original: external_reference numérico, sin reorder por nombre. */
export function sortWorkersLikeB414Creation<T extends { externalReference: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) =>
    String(a.externalReference).localeCompare(String(b.externalReference), undefined, {
      numeric: true,
    })
  );
}

export function redactMapping(rows: B418MappingRow[]): Array<{
  index1Based: number;
  oldUsername: string;
  newUsername: string;
  employeeNumberLen: number;
}> {
  return rows.map((r) => ({
    index1Based: r.index1Based,
    oldUsername: r.oldUsername,
    newUsername: r.newUsername,
    employeeNumberLen: r.employeeNumberRaw.length,
  }));
}
