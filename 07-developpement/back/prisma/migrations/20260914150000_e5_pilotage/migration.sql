-- E5 — Pilotage du dossier.
-- Aucune donnée réelle en jeu (dépôt de démonstration) : le mapping de repli ci-dessous est un choix
-- pragmatique, pas une reconstruction fidèle de l'état métier de chaque dossier existant.
CREATE TYPE "CaseStatus_new" AS ENUM (
  'A_ANALYSER', 'ACTION_REQUISE', 'DOCUMENTS_A_PREPARER', 'REPONSE_PRETE', 'EN_ATTENTE', 'TERMINE'
);
ALTER TABLE "CaseFile" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CaseFile" ALTER COLUMN "status" TYPE "CaseStatus_new" USING (
  CASE "status"::text
    WHEN 'A_FAIRE' THEN 'ACTION_REQUISE'
    WHEN 'EN_ATTENTE_REPONSE' THEN 'EN_ATTENTE'
    ELSE "status"::text
  END
)::"CaseStatus_new";
ALTER TABLE "CaseFile" ALTER COLUMN "status" SET DEFAULT 'A_ANALYSER';
DROP TYPE "CaseStatus";
ALTER TYPE "CaseStatus_new" RENAME TO "CaseStatus";

CREATE TYPE "ActionOrigin" AS ENUM ('ANALYSE', 'MANUEL');
ALTER TABLE "ActionItem"
  ADD COLUMN "origin" "ActionOrigin" NOT NULL DEFAULT 'ANALYSE',
  ADD COLUMN "description" TEXT,
  ALTER COLUMN "sourceExcerpt" DROP NOT NULL;
ALTER TABLE "RequiredDocument" ADD COLUMN "userNote" TEXT;

ALTER TABLE "Notification" DROP CONSTRAINT "Notification_caseFileId_fkey";
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_caseFileId_fkey"
  FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
