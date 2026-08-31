import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashPassword, needsRehash, verifyPassword } from "./password.js";

describe("hashPassword / verifyPassword", () => {
  it("produit un hash argon2id qui ne contient pas le mot de passe en clair", async () => {
    const plain = "un-mot-de-passe-tres-long";
    const hash = await hashPassword(plain);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain(plain);
  });

  it("vérifie correctement un mot de passe juste et rejette un faux", async () => {
    const hash = await hashPassword("bon-mot-de-passe-123");
    expect(await verifyPassword(hash, "bon-mot-de-passe-123")).toBe(true);
    expect(await verifyPassword(hash, "mauvais-mot-de-passe")).toBe(false);
  });

  it("verifyPassword renvoie false (sans lever) sur un hash invalide", async () => {
    expect(await verifyPassword("pas-un-hash", "x")).toBe(false);
  });
});

describe("needsRehash", () => {
  it("est faux pour un hash produit avec les paramètres courants", async () => {
    const hash = await hashPassword("peu-importe-mais-long");
    expect(needsRehash(hash)).toBe(false);
  });

  it("réclame un rehash pour un hash aux paramètres plus faibles", () => {
    const weak =
      "$argon2id$v=19$m=4096,t=1,p=1$YWJjZGVmZ2hpamtsbW5vcA$3Vd0mHhVYQ0aV8h0m2c3d4e5f6g7h8i9j0k1l2m3n4o";
    expect(needsRehash(weak)).toBe(true);
  });
});

describe("DUMMY_HASH", () => {
  it("est un hash argon2id valide, calculé une fois", async () => {
    expect((await DUMMY_HASH).startsWith("$argon2id$")).toBe(true);
  });
});
