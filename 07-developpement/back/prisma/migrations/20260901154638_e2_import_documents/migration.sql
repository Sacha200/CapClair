-- E2 — Import et lecture du document (ADR-011, ADR-012, ADR-015).
-- Aucune ligne n'utilise INDETERMINE / FICTIONAL_DOCUMENT ici : ADD VALUE sûr
-- en transaction (PG >= 12). Ne pas ajouter d'INSERT utilisant ces valeurs
-- dans ce fichier (voir doc archi §10.4 du plan E2).

-- AlterEnum
-- Dossier créé à l'import (E2) ; l'organisme n'est déterminé qu'à l'analyse (E3, US-3.3).
ALTER TYPE "Organisme" ADD VALUE 'INDETERMINE';

-- AlterEnum
-- Confirmation « ce document est fictif » (US-2.3 AC2). Renommage éventuel
-- ANALYSE_IA -> AI_PROCESSING reporté à E3/US-3.1 (ADR-006, ADR-015).
ALTER TYPE "ConsentType" ADD VALUE 'FICTIONAL_DOCUMENT';

-- AlterTable
-- Le nom d'origine ne vit qu'en base ; le fichier sur disque porte un UUID
-- (US-2.1 AC4). Base sans données à ce stade : RENAME direct, pas de perte.
ALTER TABLE "Document" RENAME COLUMN "filename" TO "originalName";
-- Hash du texte extrait, pour le cache d'analyse IA (E3).
ALTER TABLE "Document" ADD COLUMN "extractedTextHash" TEXT;
