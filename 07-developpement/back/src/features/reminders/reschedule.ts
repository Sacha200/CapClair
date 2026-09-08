/**
 * US-7.1 AC4 — reprogrammation des rappels après un changement d'échéance.
 *
 * L'epic E7 (rappels) n'est pas implémenté : aucune ligne `Reminder` n'est
 * jamais créée avant lui. Ce hook est donc un **no-op tracé**. L'`AuditEvent`
 * `deadline.corrected` écrit en amont (US-4.4 AC5) permettra à E7, à sa mise en
 * service, de rejouer les échéances déjà corrigées.
 */
import { logger } from "../../lib/logger.js";

export async function rescheduleForCaseFile(caseFileId: string): Promise<void> {
  logger.info({ caseFileId }, "rescheduleForCaseFile: différé (E7/US-7.1 non implémenté)");
}
