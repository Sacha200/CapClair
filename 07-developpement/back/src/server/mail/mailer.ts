/**
 * Envoi d'e-mails. En dev (`MAIL_TRANSPORT=console`) on journalise le message au
 * lieu de l'envoyer — suffisant pour E1 (le lien de réinitialisation apparaît
 * dans les logs). Le transport SMTP réel est branché plus tard.
 */
import { env } from "../../env.js";
import { logger } from "../../lib/logger.js";

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
}

class ConsoleMailer implements Mailer {
  async send(mail: OutgoingMail): Promise<void> {
    logger.info(
      { to: mail.to, subject: mail.subject, from: env.MAIL_FROM },
      `[mail:console] ${mail.subject}\n${mail.text}`,
    );
  }
}

class SmtpMailer implements Mailer {
  async send(_mail: OutgoingMail): Promise<void> {
    // TODO(US-7.2) : brancher un vrai transport SMTP via le worker.
    throw new Error("Transport SMTP non encore implémenté (MAIL_TRANSPORT=smtp).");
  }
}

export const mailer: Mailer = env.MAIL_TRANSPORT === "smtp" ? new SmtpMailer() : new ConsoleMailer();
