/**
 * Permisos del portal administrativo NOM-035 (B4.6).
 * La autoridad final está en PostgreSQL (role_permissions); este módulo
 * tipa y documenta la matriz para UI y Route Handlers.
 */

export const APP_PERMISSIONS = [
  "dashboard.view",
  "company.read",
  "company.write",
  "workers.read",
  "workers.write",
  "workers.import",
  "campaigns.read",
  "campaigns.write",
  "assignments.issue",
  "assignments.rotate",
  "assignments.revoke",
  "results.aggregate.read",
  "results.individual.read",
  "results.answers.read",
  "results.clinical.read",
  "reports.generate",
  "action_plans.read",
  "action_plans.write",
  "evidence.read",
  "evidence.write",
  "evidence.download",
  "complaints.list",
  "complaints.detail",
  "complaints.contact.read",
  "complaints.manage",
  "policies.read",
  "policies.write",
  "policies.publish",
  "users.read",
  "users.manage",
  "audit.read",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

export const SENSITIVE_PERMISSIONS = new Set<AppPermission>([
  "results.individual.read",
  "results.answers.read",
  "results.clinical.read",
  "complaints.list",
  "complaints.detail",
  "complaints.contact.read",
  "complaints.manage",
]);

/** Permisos que siempre exigen AAL2 aunque no sean clínicos. */
export const AAL2_ALWAYS_PERMISSIONS = new Set<AppPermission>([
  "users.manage",
  "evidence.download",
  "assignments.rotate",
  "assignments.revoke",
  "policies.publish",
]);

export function permissionRequiresAal2(permission: AppPermission): boolean {
  return SENSITIVE_PERMISSIONS.has(permission) || AAL2_ALWAYS_PERMISSIONS.has(permission);
}

export function permissionIsSensitive(permission: AppPermission): boolean {
  return SENSITIVE_PERMISSIONS.has(permission);
}

export type AdminRole = "admin" | "rh" | "psicologo" | "direccion";

export function isAppPermission(value: string): value is AppPermission {
  return (APP_PERMISSIONS as readonly string[]).includes(value);
}
