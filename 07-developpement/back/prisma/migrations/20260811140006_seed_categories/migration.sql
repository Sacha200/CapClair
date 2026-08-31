-- Référentiel des catégories d'information (décision D14).
--
-- Migration de données et non script `db seed` : 02-schema-base-de-donnees.md
-- spécifie « seedée à la migration (valeurs figées) ». La conséquence pratique
-- est qu'un `migrate deploy` suffit à garantir le référentiel en production,
-- sans étape séparée — ce qui compte, ExtractedInformation.categoryId étant
-- non nullable et en onDelete: Restrict.
--
-- Valeurs reprises de 03-architecture/02-schema-base-de-donnees.md § Données de
-- référence, et de 04-maquettes/design-system.md § Iconographie. Les noms
-- d'icônes sont ceux de Remix Icon (@remixicon/react), variantes -line.
--
-- id et updatedAt sont fournis explicitement : Prisma les alimente côté client
-- (@default(uuid()) et @updatedAt), la base n'a pas de valeur par défaut.
--
-- ON CONFLICT plutôt qu'un INSERT sec : la migration reste rejouable, et une
-- reprise ne change pas les id — un DELETE/INSERT casserait les
-- ExtractedInformation existantes, que Restrict bloquerait de toute façon.

INSERT INTO "Category" ("id", "code", "label", "icon", "color", "displayOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'REFERENCE', 'Référence', 'ri-hashtag',                '#1F5F8B', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MONTANT',   'Montant',   'ri-money-euro-circle-line', '#1F5F8B', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'DATE',      'Date',      'ri-calendar-line',          '#1F5F8B', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'IDENTITE',  'Identité',  'ri-user-line',              '#1F5F8B', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONTACT',   'Contact',   'ri-phone-line',             '#1F5F8B', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'AUTRE',     'Autre',     'ri-information-line',       '#5A6472', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "label"        = EXCLUDED."label",
  "icon"         = EXCLUDED."icon",
  "color"        = EXCLUDED."color",
  "displayOrder" = EXCLUDED."displayOrder",
  "isActive"     = EXCLUDED."isActive",
  "updatedAt"    = CURRENT_TIMESTAMP;
