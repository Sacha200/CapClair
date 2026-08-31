import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES, RegisterInputSchema } from "./auth";

describe("RegisterInputSchema (front)", () => {
  const base = {
    name: "Test",
    email: "a@b.fr",
    password: "azerty-1234567",
    passwordConfirm: "azerty-1234567",
    acceptCgu: true,
    acceptPrivacy: true,
  };

  it("message exact pour un mot de passe trop court", () => {
    const r = RegisterInputSchema.safeParse({ ...base, password: "x", passwordConfirm: "x" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.find((i) => i.path[0] === "password")?.message).toBe(
        AUTH_MESSAGES.passwordTooShort,
      );
    }
  });

  it("chaque case non cochée a son message", () => {
    const noCgu = RegisterInputSchema.safeParse({ ...base, acceptCgu: false });
    expect(noCgu.success).toBe(false);
  });
});
