import { describe, expect, it } from "vitest";
import { assertLocalSupabaseOnly } from "../../../../scripts/lib/assert-local-supabase-only";

describe("B4.11 · guardas localhost", () => {
  it("acepta localhost y 127.0.0.1", () => {
    expect(() => assertLocalSupabaseOnly("http://127.0.0.1:54321")).not.toThrow();
    expect(() => assertLocalSupabaseOnly("http://localhost:54321")).not.toThrow();
  });

  it("rechaza supabase.co, ConCasa, Production y Vercel", () => {
    expect(() => assertLocalSupabaseOnly("https://agblxxxx.supabase.co")).toThrow(/ABORT/);
    expect(() => assertLocalSupabaseOnly("https://fvtqxxxx.supabase.co")).toThrow(/ABORT/);
    expect(() => assertLocalSupabaseOnly("https://xxx.supabase.co")).toThrow(/ABORT/);
    expect(() => assertLocalSupabaseOnly("https://nom035-production.vercel.app")).toThrow(/ABORT/);
    expect(() => assertLocalSupabaseOnly("https://concasa.example")).toThrow(/ABORT/);
  });
});
