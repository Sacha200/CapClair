import { describe, expect, it } from "vitest";
import {
  AUTH_MESSAGES,
  LoginInputSchema,
  RegisterInputSchema,
  ResetInputSchema,
} from "@capclair/contract";

const validRegister = {
  name: "Nadia K.",
  email: "Nadia@Exemple.fr",
  password: "motdepasse-long-1",
  passwordConfirm: "motdepasse-long-1",
  acceptCgu: true,
  acceptPrivacy: true,
};

function fieldErrors(result: { success: false; error: { issues: { path: (string | number)[]; message: string }[] } }) {
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("RegisterInputSchema", () => {
  it("accepte une entrée valide et normalise l'e-mail", () => {
    const parsed = RegisterInputSchema.parse(validRegister);
    expect(parsed.email).toBe("nadia@exemple.fr");
  });

  it("refuse un mot de passe de moins de 12 caractères avec le message exact", () => {
    const result = RegisterInputSchema.safeParse({ ...validRegister, password: "court", passwordConfirm: "court" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result).password).toBe(AUTH_MESSAGES.passwordTooShort);
    }
  });

  it("refuse quand la confirmation ne correspond pas, sur le champ passwordConfirm", () => {
    const result = RegisterInputSchema.safeParse({ ...validRegister, passwordConfirm: "autre-chose-12c" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result).passwordConfirm).toBe(AUTH_MESSAGES.passwordMismatch);
    }
  });

  it("refuse quand une case n'est pas cochée, avec un message par case", () => {
    const noCgu = RegisterInputSchema.safeParse({ ...validRegister, acceptCgu: false });
    const noPrivacy = RegisterInputSchema.safeParse({ ...validRegister, acceptPrivacy: false });
    expect(noCgu.success).toBe(false);
    expect(noPrivacy.success).toBe(false);
    if (!noCgu.success) expect(fieldErrors(noCgu).acceptCgu).toBe(AUTH_MESSAGES.cguRequired);
    if (!noPrivacy.success) {
      expect(fieldErrors(noPrivacy).acceptPrivacy).toBe(AUTH_MESSAGES.privacyRequired);
    }
  });

  it("refuse un e-mail invalide", () => {
    const result = RegisterInputSchema.safeParse({ ...validRegister, email: "pas-un-email" });
    expect(result.success).toBe(false);
  });
});

describe("LoginInputSchema", () => {
  it("normalise l'e-mail et exige un mot de passe non vide", () => {
    const parsed = LoginInputSchema.parse({ email: "  A@B.fr ", password: "x" });
    expect(parsed.email).toBe("a@b.fr");
    expect(LoginInputSchema.safeParse({ email: "a@b.fr", password: "" }).success).toBe(false);
  });
});

describe("ResetInputSchema", () => {
  it("applique la longueur minimale et la correspondance", () => {
    expect(
      ResetInputSchema.safeParse({ token: "t", password: "court", passwordConfirm: "court" }).success,
    ).toBe(false);
    expect(
      ResetInputSchema.safeParse({
        token: "t",
        password: "assez-long-de-12",
        passwordConfirm: "assez-long-de-12",
      }).success,
    ).toBe(true);
  });
});
