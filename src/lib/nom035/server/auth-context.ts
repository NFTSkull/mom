import "server-only";

import type { AppPermission, AdminRole } from "@/lib/nom035/auth/permissions";

export type AdminAuthContext = {
  userId: string;
  email: string;
  nombre: string;
  role: AdminRole;
  permissions: AppPermission[];
  canViewSensitiveCases: boolean;
  mfaRequired: boolean;
  mustChangePassword: boolean;
  active: boolean;
  aal: "aal1" | "aal2";
  version: number;
};

export type AuthDenialCode =
  | "unauthorized"
  | "profile_missing"
  | "account_disabled"
  | "forbidden"
  | "aal2_required"
  | "mfa_required"
  | "mfa_enrollment_required";
