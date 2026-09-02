import { describe, expect, it } from "vitest";
import { isReadable, UNREADABLE_TEXT_THRESHOLD, usefulLength } from "./useful-text.js";

describe("usefulLength", () => {
  it("compacte les suites de blancs en un seul espace", () => {
    expect(usefulLength("a   b\t\tc")).toBe(5); // "a b c"
  });

  it("traite les sauts de ligne comme des blancs", () => {
    expect(usefulLength("ligne 1\n\nligne 2\r\nligne 3")).toBe(23);
  });

  it("ignore les blancs de tête et de queue", () => {
    expect(usefulLength("   abc   ")).toBe(3);
    expect(usefulLength("\n\n \t ")).toBe(0);
  });
});

describe("isReadable — barrière US-2.6 AC1", () => {
  it("99 caractères utiles → illisible ; 100 → lisible (borne exacte)", () => {
    expect(UNREADABLE_TEXT_THRESHOLD).toBe(100);
    expect(isReadable("x".repeat(99))).toBe(false);
    expect(isReadable("x".repeat(100))).toBe(true);
  });

  it("les blancs ne comptent pas pour franchir le seuil", () => {
    // 50 caractères + une avalanche d'espaces : toujours illisible.
    expect(isReadable(`${"x".repeat(50)}${" ".repeat(200)}`)).toBe(false);
  });
});
