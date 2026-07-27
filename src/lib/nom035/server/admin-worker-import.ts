import "server-only";

/**
 * Parser CSV RFC4180 mínimo (comillas, comas escapadas, CRLF).
 * No usa split(",") ingenuo.
 */

export type CsvParseResult = {
  headers: string[];
  rows: string[][];
  errors: Array<{ row: number; message: string }>;
};

export function parseCsv(text: string): CsvParseResult {
  const rows: string[][] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const input = text.replace(/^\uFEFF/, "");

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    // Ignorar filas totalmente vacías
    if (row.length === 1 && row[0] === "" && !inQuotes) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  while (i < input.length) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      pushField();
      pushRow();
      i += 1;
      if (input[i] === "\n") i += 1;
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (inQuotes) {
    errors.push({ row: rows.length + 1, message: "Comillas sin cerrar." });
  }
  pushField();
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
    pushRow();
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], errors: [{ row: 0, message: "Archivo vacío." }] };
  }

  const headers = rows[0]!.map((h) => h.trim().toLowerCase());
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows, errors };
}

export const WORKER_CSV_HEADERS = [
  "nombre",
  "email",
  "telefono",
  "departamento",
  "puesto",
  "turno",
  "sucursal",
  "jefe_directo",
  "antiguedad",
  "referencia_externa",
  "activo",
] as const;

export type WorkerCsvRow = {
  nombre: string;
  email?: string;
  telefono?: string;
  departamento?: string;
  puesto?: string;
  turno?: string;
  sucursal?: string;
  jefe_directo?: string;
  antiguedad?: string;
  referencia_externa?: string;
  activo?: boolean;
};

export type WorkerCsvPreview = {
  ok: boolean;
  rows: WorkerCsvRow[];
  errors: Array<{ row: number; code: string; message: string }>;
  duplicatesInFile: number[];
};

function parseActivo(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "si", "sí", "yes", "activo"].includes(v)) return true;
  if (["0", "false", "no", "inactivo"].includes(v)) return false;
  return undefined;
}

export function mapWorkerCsv(text: string, maxRows = 500): WorkerCsvPreview {
  const parsed = parseCsv(text);
  const errors: WorkerCsvPreview["errors"] = parsed.errors.map((e) => ({
    row: e.row,
    code: "parse_error",
    message: e.message,
  }));

  if (!parsed.headers.includes("nombre")) {
    errors.push({
      row: 0,
      code: "missing_header",
      message: "Falta el encabezado obligatorio 'nombre'.",
    });
    return { ok: false, rows: [], errors, duplicatesInFile: [] };
  }

  if (parsed.rows.length > maxRows) {
    errors.push({
      row: 0,
      code: "batch_too_large",
      message: `Máximo ${maxRows} filas.`,
    });
    return { ok: false, rows: [], errors, duplicatesInFile: [] };
  }

  const rows: WorkerCsvRow[] = [];
  const emailIndex = new Map<string, number>();
  const extIndex = new Map<string, number>();
  const duplicatesInFile: number[] = [];

  parsed.rows.forEach((cols, idx) => {
    const rowNum = idx + 2; // 1-based + header
    const get = (name: string) => {
      const i = parsed.headers.indexOf(name);
      return i >= 0 ? (cols[i] ?? "").trim() : "";
    };

    const nombre = get("nombre");
    if (!nombre) {
      // Fila vacía: saltar sin error si todos vacíos
      if (cols.every((c) => !c.trim())) return;
      errors.push({ row: rowNum, code: "nombre_required", message: "Nombre vacío." });
      return;
    }

    const email = get("email");
    const ext = get("referencia_externa");
    const activoRaw = get("activo");
    const activo = parseActivo(activoRaw);
    if (activoRaw && activo === undefined) {
      errors.push({ row: rowNum, code: "activo_invalid", message: "Valor de activo inválido." });
      return;
    }

    if (email) {
      const key = email.toLowerCase();
      if (emailIndex.has(key)) {
        duplicatesInFile.push(rowNum);
        errors.push({
          row: rowNum,
          code: "duplicate_email_in_file",
          message: "Correo duplicado en el archivo.",
        });
        return;
      }
      emailIndex.set(key, rowNum);
    }
    if (ext) {
      if (extIndex.has(ext)) {
        duplicatesInFile.push(rowNum);
        errors.push({
          row: rowNum,
          code: "duplicate_external_reference_in_file",
          message: "Referencia externa duplicada en el archivo.",
        });
        return;
      }
      extIndex.set(ext, rowNum);
    }

    rows.push({
      nombre,
      email: email || undefined,
      telefono: get("telefono") || undefined,
      departamento: get("departamento") || undefined,
      puesto: get("puesto") || undefined,
      turno: get("turno") || undefined,
      sucursal: get("sucursal") || undefined,
      jefe_directo: get("jefe_directo") || undefined,
      antiguedad: get("antiguedad") || undefined,
      referencia_externa: ext || undefined,
      activo,
    });
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ row: 0, code: "no_valid_rows", message: "Cero filas válidas." });
  }

  return {
    ok: errors.length === 0 && rows.length > 0,
    rows,
    errors,
    duplicatesInFile,
  };
}
