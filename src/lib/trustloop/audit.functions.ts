import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listAuditEvents = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(300).default(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("audit_events")
      .select(
        "id, stage, actor, actor_name, summary, payload, created_at, return_id, return_requests(reference)",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      stage: r.stage,
      actor: r.actor,
      actorName: r.actor_name,
      summary: r.summary,
      payload: r.payload,
      createdAt: r.created_at,
      returnId: r.return_id,
      reference: (r.return_requests as { reference: string } | null)?.reference ?? "—",
    }));
  });
