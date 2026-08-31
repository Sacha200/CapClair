import type { ErrorEnvelope } from "@capclair/contract";

/** Erreur normalisée renvoyée par le client API (voir client.ts). */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, envelope: Partial<ErrorEnvelope>) {
    super(envelope.error ?? "Une erreur est survenue.");
    this.name = "ApiError";
    this.status = status;
    this.code = envelope.code;
    this.fields = envelope.fields;
  }

  get isRateLimited(): boolean {
    return this.status === 429 || this.code === "rate_limited";
  }
}
