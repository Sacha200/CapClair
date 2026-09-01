/**
 * Polices.
 *
 * - Lecture : Spectral (résumés, contenu de courrier, mentions légales).
 * - Interface : Marianne en production. Marianne n'étant pas sur Google Fonts et
 *   sa licence pour un service privé restant à valider, on utilise **Mulish**
 *   comme substitut en attendant les fichiers officiels (cf. plan, « à confirmer »).
 *   La variable CSS reste `--font-marianne` pour ne rien changer au jour où on
 *   bascule sur la vraie police.
 */
import { Mulish, Spectral } from "next/font/google";

export const fontSans = Mulish({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-marianne",
  display: "swap",
});

export const fontReading = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-spectral",
  display: "swap",
});
