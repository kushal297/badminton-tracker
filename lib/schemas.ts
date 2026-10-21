import { z } from "zod";
import { todayISO } from "@/lib/format";

/** Validation for adding or editing a 2v2 game. Shared by the client form and the Server Action. */
export const gameInputSchema = z
  .object({
    playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    teamA: z.tuple([z.uuid(), z.uuid()]),
    teamB: z.tuple([z.uuid(), z.uuid()]),
    satOut: z.uuid().nullable(),
    scoreA: z.number().int().min(0).max(99),
    scoreB: z.number().int().min(0).max(99),
    gameTarget: z.number().int().positive().max(99),
    editorName: z.string().max(40).optional(),
  })
  .superRefine((val, ctx) => {
    // Computed per parse (not at module load) so a long-lived server never goes stale.
    if (val.playedOn > todayISO()) {
      ctx.addIssue({ code: "custom", message: "A game can't be dated in the future", path: ["playedOn"] });
    }
    const onCourt = [...val.teamA, ...val.teamB];
    if (new Set(onCourt).size !== 4) {
      ctx.addIssue({ code: "custom", message: "Pick four different players", path: ["teamA"] });
    }
    if (val.satOut && onCourt.includes(val.satOut)) {
      ctx.addIssue({ code: "custom", message: "The resting player can't also be on court", path: ["satOut"] });
    }
    if (val.scoreA === val.scoreB) {
      ctx.addIssue({ code: "custom", message: "A game can't end level — there's always a winner", path: ["scoreB"] });
    }
  });

export type GameInput = z.infer<typeof gameInputSchema>;

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(30, "Keep it under 30 characters");
