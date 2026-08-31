import type { OutgoingMail } from "../mailer.js";
import { env } from "../../../env.js";

/** E-mail de réinitialisation (US-1.3). Le lien pointe vers l'écran front. */
export function passwordResetMail(params: { to: string; rawToken: string }): OutgoingMail {
  const url = `${env.APP_BASE_URL}/reinitialiser?token=${encodeURIComponent(params.rawToken)}`;
  return {
    to: params.to,
    subject: "Réinitialisation de votre mot de passe CapClair",
    text: [
      "Bonjour,",
      "",
      "Vous avez demandé à réinitialiser votre mot de passe CapClair.",
      "Ce lien est valable une heure et ne fonctionne qu'une fois :",
      "",
      url,
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.",
      "",
      "— CapClair",
    ].join("\n"),
  };
}
