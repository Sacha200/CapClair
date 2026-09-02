-- E3 — Consentement et appel à l'IA (ADR-017, complète ADR-006/ADR-015).
--
-- RENAME VALUE (et non ADD VALUE + suppression) : aucune ligne ConsentLog
-- n'utilise ANALYSE_IA à ce jour (grep vérifié) — le renommage préserve
-- l'historique si de futures données existaient, et contrairement à
-- ADD VALUE il ne nécessite aucune précaution transactionnelle particulière.
ALTER TYPE "ConsentType" RENAME VALUE 'ANALYSE_IA' TO 'AI_PROCESSING';

-- Ancre du calcul des délais relatifs (D7) + traçabilité de l'origine.
ALTER TABLE "CaseFile" ADD COLUMN "documentDate" TIMESTAMP(3);
ALTER TABLE "CaseFile" ADD COLUMN "documentDateSourceExcerpt" TEXT;

-- US-3.2 champ 13/13 — avertissements spécifiques au courrier.
ALTER TABLE "CaseFile" ADD COLUMN "warnings" TEXT[] NOT NULL DEFAULT '{}';
