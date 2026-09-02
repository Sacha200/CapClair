import { describe, expect, it } from "vitest";
import { CANONICAL_MIME, EXT, detectKind } from "./magic-bytes.js";

const PDF = Buffer.from("%PDF-1.7\n%some content", "binary");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

describe("detectKind", () => {
  it("reconnaît un PDF à sa signature", () => {
    expect(detectKind(PDF)).toBe("pdf");
  });

  it("reconnaît un PNG à sa signature", () => {
    expect(detectKind(PNG)).toBe("png");
  });

  it("reconnaît un JPEG à sa signature", () => {
    expect(detectKind(JPEG)).toBe("jpeg");
  });

  it("démasque une extension usurpée : octets PNG malgré un nom .pdf", () => {
    // Le détecteur ne regarde que les octets — l'appelant décide du nom/extension.
    expect(detectKind(PNG)).toBe("png");
    expect(detectKind(PNG)).not.toBe("pdf");
  });

  it("renvoie null pour une signature inconnue", () => {
    expect(detectKind(Buffer.from("ceci n'est pas un document"))).toBeNull();
  });

  it("renvoie null pour un buffer vide ou trop court", () => {
    expect(detectKind(Buffer.alloc(0))).toBeNull();
    expect(detectKind(Buffer.from([0x25, 0x50]))).toBeNull();
  });
});

describe("CANONICAL_MIME / EXT", () => {
  it("couvrent les trois types détectables", () => {
    for (const kind of ["pdf", "png", "jpeg"] as const) {
      expect(CANONICAL_MIME[kind]).toMatch(/^(application|image)\//);
      expect(EXT[kind]).toBe(kind);
    }
  });
});
