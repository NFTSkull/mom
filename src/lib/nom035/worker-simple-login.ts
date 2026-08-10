/**
 * B4.19.1 — Login trabajador = solo username+password (sin MFA).
 */
export function workerLoginRequiresOnlyUsernamePassword(payloadKeys: string[]): boolean {
  const forbidden = ["mfa", "factorId", "totp", "otp", "aal", "challengeId"];
  return !payloadKeys.some((k) =>
    forbidden.some((f) => k.toLowerCase().includes(f.toLowerCase()))
  );
}

export const WORKER_MFA_REQUIRED = false as const;
export const ADMIN_MFA_IS_SEPARATE = true as const;

/** Permisos admin que exigen AAL2 (espejo de permissions.ts). */
export const ADMIN_AAL2_PERMISSIONS = [
  "results.individual.read",
  "results.answers.read",
  "results.clinical.read",
  "complaints.list",
  "complaints.detail",
  "complaints.contact.read",
  "complaints.manage",
  "users.manage",
  "evidence.download",
  "assignments.rotate",
  "assignments.revoke",
  "policies.publish",
] as const;

export const ADMIN_AAL1_OK_EXAMPLES = [
  "dashboard.view",
  "results.aggregate.read",
  "campaigns.read",
  "workers.read",
] as const;
