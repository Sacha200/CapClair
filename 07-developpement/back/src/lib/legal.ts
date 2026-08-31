/**
 * Versions des documents légaux (CGU + politique de confidentialité).
 *
 * ADR-004 : une seule ligne `ConsentLog` de type `CGU` est écrite à l'inscription,
 * portant `LEGAL_BUNDLE_VERSION`. Toute modification de l'un ou l'autre document
 * incrémente la version du bundle. Le contenu réel des pages est traité en US-8.3.
 */
export const LEGAL_CGU_VERSION = "cgu-2026-08-31";
export const LEGAL_PRIVACY_VERSION = "confidentialite-2026-08-31";

/** Version du couple (CGU, politique) enregistrée dans ConsentLog.policyVersion. */
export const LEGAL_BUNDLE_VERSION = `${LEGAL_CGU_VERSION}+${LEGAL_PRIVACY_VERSION}`;
