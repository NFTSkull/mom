import {
  type AppPermission,
  permissionIsSensitive,
  permissionRequiresAal2,
} from "@/lib/nom035/auth/permissions";

export type EndpointPermissionRule = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  pathPattern: string;
  permission: AppPermission;
  requiresAal2: boolean;
  sensitive: boolean;
};

function rule(
  method: EndpointPermissionRule["method"],
  pathPattern: string,
  permission: AppPermission,
  overrides?: Partial<Pick<EndpointPermissionRule, "requiresAal2" | "sensitive">>
): EndpointPermissionRule {
  return {
    method,
    pathPattern,
    permission,
    requiresAal2: overrides?.requiresAal2 ?? permissionRequiresAal2(permission),
    sensitive: overrides?.sensitive ?? permissionIsSensitive(permission),
  };
}

/**
 * Manifiesto obligatorio: cada Route Handler /api/admin/nom035/* debe figurar aquí.
 * Una prueba estática falla si falta algún endpoint.
 */
export const ADMIN_ENDPOINT_PERMISSIONS: EndpointPermissionRule[] = [
  rule("GET", "/api/admin/nom035/dashboard", "dashboard.view"),
  rule("GET", "/api/admin/nom035/company", "company.read"),
  rule("PUT", "/api/admin/nom035/company", "company.write"),
  rule("POST", "/api/admin/nom035/company", "company.write"),

  rule("GET", "/api/admin/nom035/workers", "workers.read"),
  rule("POST", "/api/admin/nom035/workers", "workers.write"),
  rule("GET", "/api/admin/nom035/workers/[id]", "workers.read"),
  rule("PUT", "/api/admin/nom035/workers/[id]", "workers.write"),
  rule("DELETE", "/api/admin/nom035/workers/[id]", "workers.write"),
  rule("POST", "/api/admin/nom035/workers/[id]/deactivate", "workers.write"),
  rule("POST", "/api/admin/nom035/workers/[id]/reactivate", "workers.write"),
  rule("POST", "/api/admin/nom035/workers/import/validate", "workers.import"),
  rule("POST", "/api/admin/nom035/workers/import/commit", "workers.import"),

  rule("GET", "/api/admin/nom035/campaigns", "campaigns.read"),
  rule("POST", "/api/admin/nom035/campaigns", "campaigns.write"),
  rule("GET", "/api/admin/nom035/campaigns/[id]", "campaigns.read"),
  rule("PUT", "/api/admin/nom035/campaigns/[id]", "campaigns.write"),
  rule("POST", "/api/admin/nom035/campaigns/[id]/activate", "campaigns.write"),
  rule("POST", "/api/admin/nom035/campaigns/[id]/close", "campaigns.write"),
  rule("GET", "/api/admin/nom035/campaigns/[id]/assignments", "campaigns.read"),
  rule("POST", "/api/admin/nom035/campaigns/[id]/assignments/issue", "assignments.issue"),
  rule("POST", "/api/admin/nom035/campaigns/[id]/assignments/issue-missing", "assignments.issue"),

  rule("POST", "/api/admin/nom035/assignments/[id]/rotate-token", "assignments.rotate"),
  rule("POST", "/api/admin/nom035/assignments/[id]/revoke", "assignments.revoke"),

  rule("GET", "/api/admin/nom035/results", "results.aggregate.read"),
  rule("GET", "/api/admin/nom035/results/[id]", "results.individual.read"),
  rule("GET", "/api/admin/nom035/reports/summary", "reports.generate"),

  rule("GET", "/api/admin/nom035/action-plans", "action_plans.read"),
  rule("POST", "/api/admin/nom035/action-plans", "action_plans.write"),
  rule("GET", "/api/admin/nom035/action-plans/summary", "action_plans.read"),
  rule("POST", "/api/admin/nom035/action-plans/generate", "action_plans.write"),
  rule("GET", "/api/admin/nom035/action-plans/[id]", "action_plans.read"),
  rule("PUT", "/api/admin/nom035/action-plans/[id]", "action_plans.write"),
  rule("POST", "/api/admin/nom035/action-plans/[id]/status", "action_plans.write"),
  rule("POST", "/api/admin/nom035/action-plans/[id]/archive", "action_plans.write"),

  rule("GET", "/api/admin/nom035/evidence", "evidence.read"),
  rule("POST", "/api/admin/nom035/evidence", "evidence.write"),
  rule("GET", "/api/admin/nom035/evidence/summary", "evidence.read"),
  rule("POST", "/api/admin/nom035/evidence/upload", "evidence.write"),
  rule("POST", "/api/admin/nom035/evidence/external", "evidence.write"),
  rule("GET", "/api/admin/nom035/evidence/[id]", "evidence.read"),
  rule("PUT", "/api/admin/nom035/evidence/[id]", "evidence.write"),
  rule("DELETE", "/api/admin/nom035/evidence/[id]", "evidence.write"),
  rule("GET", "/api/admin/nom035/evidence/[id]/download", "evidence.download"),
  rule("POST", "/api/admin/nom035/evidence/[id]/replace", "evidence.write"),
  rule("POST", "/api/admin/nom035/evidence/[id]/retry-cleanup", "evidence.write"),

  rule("GET", "/api/admin/nom035/complaints", "complaints.list"),
  rule("GET", "/api/admin/nom035/complaints/summary", "complaints.list"),
  rule("GET", "/api/admin/nom035/complaints/[id]", "complaints.detail"),
  rule("POST", "/api/admin/nom035/complaints/[id]/assign", "complaints.manage"),
  rule("POST", "/api/admin/nom035/complaints/[id]/status", "complaints.manage"),
  rule("POST", "/api/admin/nom035/complaints/[id]/resolve", "complaints.manage"),
  rule("POST", "/api/admin/nom035/complaints/[id]/close", "complaints.manage"),

  rule("GET", "/api/admin/nom035/policies", "policies.read"),
  rule("POST", "/api/admin/nom035/policies", "policies.write"),
  rule("GET", "/api/admin/nom035/policies/summary", "policies.read"),
  rule("GET", "/api/admin/nom035/policies/[id]", "policies.read"),
  rule("PUT", "/api/admin/nom035/policies/[id]", "policies.write"),
  rule("POST", "/api/admin/nom035/policies/[id]/publish", "policies.publish"),
  rule("POST", "/api/admin/nom035/policies/[id]/archive", "policies.write"),
  rule("POST", "/api/admin/nom035/policies/[id]/duplicate", "policies.write"),

  rule("GET", "/api/admin/nom035/users", "users.read"),
  rule("POST", "/api/admin/nom035/users", "users.manage"),
  rule("PUT", "/api/admin/nom035/users/[id]", "users.manage"),
  rule("DELETE", "/api/admin/nom035/users/[id]", "users.manage"),
  rule("POST", "/api/admin/nom035/users/[id]/deactivate", "users.manage"),
  rule("POST", "/api/admin/nom035/users/[id]/reactivate", "users.manage"),
  rule("POST", "/api/admin/nom035/users/[id]/reset-mfa", "users.manage"),
  rule("POST", "/api/admin/nom035/users/[id]/send-reset", "users.manage"),

  rule("GET", "/api/admin/nom035/audit", "audit.read"),
];

/** Convierte pathname real a patrón con [id]. */
export function normalizeAdminApiPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const prev = parts[i - 1];
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        part
      ) ||
      (/^[0-9a-f-]{36}$/i.test(part) &&
        prev &&
        [
          "workers",
          "campaigns",
          "assignments",
          "results",
          "action-plans",
          "evidence",
          "complaints",
          "policies",
          "users",
        ].includes(prev))
    ) {
      out.push("[id]");
    } else {
      out.push(part);
    }
  }
  return `/${out.join("/")}`;
}

export function findEndpointPermission(
  method: string,
  pathname: string
): EndpointPermissionRule | undefined {
  const normalized = normalizeAdminApiPath(pathname);
  const m = method.toUpperCase();
  return ADMIN_ENDPOINT_PERMISSIONS.find(
    (r) => r.method === m && r.pathPattern === normalized
  );
}
