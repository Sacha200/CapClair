import { describe, expect, it } from "vitest";
import { randomToken, sha256hex, timingSafeEqualHex } from "./crypto.js";

describe("randomToken", () => {
  it("produit un jeton base64url de 32 octets (43 caractères) par défaut", () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("est différent à chaque appel", () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe("sha256hex", () => {
  it("renvoie 64 caractères hexadécimaux stables", () => {
    expect(sha256hex("capclair")).toBe(sha256hex("capclair"));
    expect(sha256hex("capclair")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("l'empreinte diffère de l'entrée", () => {
    const raw = randomToken();
    expect(sha256hex(raw)).not.toBe(raw);
  });
});

describe("timingSafeEqualHex", () => {
  it("vrai pour deux empreintes identiques", () => {
    const h = sha256hex("x");
    expect(timingSafeEqualHex(h, h)).toBe(true);
  });

  it("faux pour des empreintes différentes ou de longueurs différentes", () => {
    expect(timingSafeEqualHex(sha256hex("a"), sha256hex("b"))).toBe(false);
    expect(timingSafeEqualHex("ab", "abcd")).toBe(false);
  });
});
