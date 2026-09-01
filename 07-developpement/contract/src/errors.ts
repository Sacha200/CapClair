import { z } from "zod";

/** Forme unique des réponses d'erreur de l'API. */
export const ErrorEnvelopeSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  /** Erreurs par champ, pour les formulaires (clé = nom du champ). */
  fields: z.record(z.string(), z.string()).optional(),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
