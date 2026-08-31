-- Alignement du schéma sur la doc d'architecture + prérequis US-1.1 (ADR-004, ADR-006).
-- Base sans données à ce stade : le renommage de valeur d'enum est direct.

-- ReminderType : J_MOINS_1 -> J_MOINS_3 (doc + US-7.1 : rappels J-7 / J-3 / J-0)
ALTER TYPE "ReminderType" RENAME VALUE 'J_MOINS_1' TO 'J_MOINS_3';

-- ConsentLog : version du document accepté (US-1.1 AC7).
-- Défaut = filet ; l'application passe toujours LEGAL_BUNDLE_VERSION explicitement.
ALTER TABLE "ConsentLog" ADD COLUMN "policyVersion" TEXT NOT NULL DEFAULT 'v1';

-- ExtractedInformation : la correction manuelle prime, protège la ligne (US-4.4).
ALTER TABLE "ExtractedInformation" ADD COLUMN "isUserCorrected" BOOLEAN NOT NULL DEFAULT false;
