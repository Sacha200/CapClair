/**
 * Client IA (US-3.2) — LA SEULE frontière du back avec le SDK Anthropic.
 * Aucun autre module n'importe `@anthropic-ai/sdk` (comme `server/pdf` est le
 * seul point de dépendance à `unpdf`, plan E2 ADR-016).
 *
 * Écart vs plan E3 §2 décision #2 : `zodOutputFormat()` du SDK importe
 * `zod/v4` en interne, incompatible avec les schémas `zod` v3 du reste du
 * contrat (`AnalysisResultSchema` inclus) — les deux ne sont pas le même
 * type malgré le même paquet `zod` (3.25+ expose les deux API en parallèle).
 * Reconvertir tout `@capclair/contract` en zod v4 pour ce seul appel aurait
 * un risque de régression disproportionné sur E1/E2. À la place :
 * `zod-to-json-schema` convertit `AnalysisResultSchema` en JSON Schema brut
 * pour contraindre la sortie (`output_config.format`, type `json_schema`),
 * et c'est **notre propre** `AnalysisResultSchema.safeParse()` qui fait foi
 * pour la validation (US-3.2 AC2 : réponse invalide jamais persistée) — pas
 * un mécanisme de parsing interne au SDK.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AnalysisResultSchema, type AnalysisResult } from "@capclair/contract";
import { env } from "../../env.js";
import { buildSystemPrompt, type HeuristicOrganisme } from "./prompts.js";

let client: Anthropic | undefined;

function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

// Calculé une fois : la conversion est pure et le schéma ne change jamais en cours de run.
const RESPONSE_JSON_SCHEMA = zodToJsonSchema(AnalysisResultSchema, "AnalysisResult");

export interface AnalyzeLetterResult {
  /** `null` si la réponse n'a pas validé `AnalysisResultSchema` — l'appelant décide de la relance. */
  result: AnalysisResult | null;
}

/**
 * Un seul appel — pas de tool use, pas de boucle agentique : l'analyse d'un
 * courrier est une extraction, pas une tâche ouverte (cf. skill claude-api,
 * « Which surface should I use ? »).
 */
export async function analyzeLetter(
  extractedText: string,
  organisme: HeuristicOrganisme | null,
): Promise<AnalyzeLetterResult> {
  const response = await getClient().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(organisme),
    output_config: { format: { type: "json_schema", schema: RESPONSE_JSON_SCHEMA } },
    messages: [{ role: "user", content: extractedText }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) return { result: null };

  let candidate: unknown;
  try {
    candidate = JSON.parse(textBlock.text);
  } catch {
    return { result: null };
  }

  const parsed = AnalysisResultSchema.safeParse(candidate);
  return { result: parsed.success ? parsed.data : null };
}
