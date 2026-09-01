import { describe, expect, it } from "vitest";
import { safeName } from "./filename.js";

describe("safeName", () => {
  it("retire le chemin (traversal Unix et Windows)", () => {
    expect(safeName("../../etc/passwd")).toBe("passwd");
    expect(safeName("C:\\Users\\alice\\courrier.pdf")).toBe("courrier.pdf");
  });

  it("retire les caractères de contrôle et les guillemets", () => {
    const result = safeName('a"b\r\nc.pdf');
    expect(result).not.toMatch(/["\r\n]/);
    expect(result).toBe("abc.pdf");
  });

  it("retombe sur un libellé non vide si le nom est vide ou absent", () => {
    expect(safeName("")).toBe("Document importé");
    expect(safeName(undefined)).toBe("Document importé");
    expect(safeName(null)).toBe("Document importé");
    // Ne laisse rien après nettoyage (que des caractères de contrôle).
    expect(safeName("\x00\x01\x02")).toBe("Document importé");
  });

  it("borne la longueur à 120 caractères", () => {
    const long = "é".repeat(500);
    const result = safeName(long);
    expect(result.length).toBeLessThanOrEqual(120);
  });
});
