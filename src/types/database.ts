// Alias controlados sobre los tipos autogenerados de la base local.
// No copiar el esquema manualmente: solo derivar de `database.generated.ts`.
import type { Database } from "./database.generated";

export type { Database } from "./database.generated";

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export type WorkerRow = Tables<"workers">;
export type EvaluationAssignmentRow = Tables<"evaluation_assignments">;
export type EvaluationResultRow = Tables<"evaluation_results">;
export type ConfidentialComplaintRow = Tables<"confidential_complaints">;
