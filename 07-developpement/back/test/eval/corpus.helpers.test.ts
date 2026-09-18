import { describe, expect, it } from "vitest";
import {
  compareByExcerpt,
  compareByExcerptThenTitle,
  excerptsOverlap,
  isGrounded,
  normalize,
  titlesOverlap,
} from "./corpus.helpers.js";

describe("normalize", () => {
  it("retire accents, apostrophes typographiques et espaces insécables", () => {
    expect(normalize("Délai de 30 jours à compter")).toBe("delai de 30 jours a compter");
    expect(normalize("l’avis d’imposition")).toBe("l'avis d'imposition");
    expect(normalize("30\u00a0jours\u202fouvrés")).toBe("30 jours ouvres");
  });
});

describe("excerptsOverlap", () => {
  it("apparie un extrait plus large et un extrait plus serré", () => {
    expect(excerptsOverlap("un justificatif de domicile", "justificatif de domicile")).toBe(true);
  });
  it("refuse deux extraits sans recouvrement", () => {
    expect(excerptsOverlap("avis d'imposition", "carte vitale")).toBe(false);
  });
  it("refuse une chaîne vide", () => {
    expect(excerptsOverlap("", "quoi que ce soit")).toBe(false);
  });
});

describe("isGrounded", () => {
  const source = "Merci de nous transmettre un justificatif de domicile de moins de trois mois.";
  it("accepte un extrait littéral", () => {
    expect(isGrounded("justificatif de domicile", source)).toBe(true);
  });
  it("rejette un extrait absent du texte", () => {
    expect(isGrounded("votre relevé d'identité bancaire", source)).toBe(false);
  });
});

describe("titlesOverlap", () => {
  it("apparie deux formulations de la même action", () => {
    expect(
      titlesOverlap(
        "Envoyer le justificatif de domicile et l'avis d'imposition",
        "Transmettre votre justificatif de domicile et votre avis d'imposition",
      ),
    ).toBe(true);
  });

  it("refuse deux actions différentes", () => {
    expect(titlesOverlap("Envoyer le justificatif de domicile", "Contester la décision")).toBe(
      false,
    );
  });

  it("refuse un appariement fondé sur un seul mot significatif", () => {
    expect(titlesOverlap("Envoyer le justificatif", "Envoyer la contestation")).toBe(false);
  });

  it("ignore les mots vides : « de », « votre » ne suffisent pas", () => {
    expect(titlesOverlap("Payer de votre part", "Répondre de votre côté")).toBe(false);
  });

  it("refuse un titre vide", () => {
    expect(titlesOverlap("", "Envoyer le justificatif de domicile")).toBe(false);
  });
});

describe("compareByExcerpt", () => {
  const source = "Fournir un justificatif de domicile et votre avis d'imposition 2025.";

  it("compte un attendu retrouvé et un attendu manqué", () => {
    const r = compareByExcerpt(
      ["justificatif de domicile", "avis d'imposition 2025"],
      ["un justificatif de domicile"],
      source,
    );
    expect(r).toEqual({
      expectedCount: 2,
      producedCount: 1,
      matched: 1,
      matchedLenient: 1,
      missed: 1,
      extraGrounded: 0,
      ungrounded: 0,
    });
  });

  it("distingue un produit ancré hors référentiel d'un produit non ancré", () => {
    const r = compareByExcerpt(
      ["justificatif de domicile"],
      ["justificatif de domicile", "avis d'imposition 2025", "votre relevé bancaire"],
      source,
    );
    expect(r.matched).toBe(1);
    expect(r.extraGrounded).toBe(1);
    expect(r.ungrounded).toBe(1);
  });

  it("n'apparie jamais deux fois le même produit", () => {
    const r = compareByExcerpt(
      ["justificatif de domicile", "justificatif de domicile"],
      ["justificatif de domicile"],
      source,
    );
    expect(r.matched).toBe(1);
    expect(r.missed).toBe(1);
  });

  it("ne tente jamais le repli par titre : matchedLenient suit matched", () => {
    const r = compareByExcerpt(["carte vitale"], ["justificatif de domicile"], source);
    expect(r.matched).toBe(0);
    expect(r.matchedLenient).toBe(0);
  });
});

describe("compareByExcerptThenTitle", () => {
  // Cas réel CAF-01 (étape 8) : le dataset ancre l'action sur la phrase qui
  // liste les documents, le modèle sur celle qui donne le délai. Les deux
  // extraits sont ancrés et désignent la même et unique action.
  const source =
    "Nous vous demandons un justificatif de domicile de moins de trois mois et votre avis " +
    "d'imposition 2025. Nous vous invitons à nous faire parvenir ces documents dans un délai " +
    "de 30 jours à compter de la réception du présent courrier.";

  it("récupère par le titre une action que l'extrait manque", () => {
    const r = compareByExcerptThenTitle(
      [
        {
          excerpt:
            "un justificatif de domicile de moins de trois mois et votre avis d'imposition 2025",
          title: "Envoyer le justificatif de domicile et l'avis d'imposition",
        },
      ],
      [
        {
          excerpt: "nous faire parvenir ces documents dans un délai de 30 jours",
          title: "Transmettre le justificatif de domicile et l'avis d'imposition",
        },
      ],
      source,
    );
    expect(r.matched).toBe(0);
    expect(r.matchedLenient).toBe(1);
    expect(r.missed).toBe(0);
    // Le produit a servi au repli : il n'est pas compté « hors référentiel ».
    expect(r.extraGrounded).toBe(0);
    expect(r.ungrounded).toBe(0);
  });

  it("laisse le rappel strict intact quand l'extrait suffit", () => {
    const r = compareByExcerptThenTitle(
      [{ excerpt: "un justificatif de domicile", title: "Envoyer le justificatif de domicile" }],
      [
        {
          excerpt: "un justificatif de domicile de moins de trois mois",
          title: "Fournir un justificatif de domicile récent",
        },
      ],
      source,
    );
    expect(r.matched).toBe(1);
    expect(r.matchedLenient).toBe(1);
  });

  it("ne récupère pas une action réellement absente", () => {
    const r = compareByExcerptThenTitle(
      [{ excerpt: "contester la décision sous deux mois", title: "Contester la décision" }],
      [
        {
          excerpt: "un justificatif de domicile de moins de trois mois",
          title: "Envoyer le justificatif de domicile",
        },
      ],
      source,
    );
    expect(r.matchedLenient).toBe(0);
    expect(r.missed).toBe(1);
    expect(r.extraGrounded).toBe(1);
  });

  it("compte non ancré un produit dont l'extrait est absent du courrier", () => {
    const r = compareByExcerptThenTitle(
      [],
      [{ excerpt: "votre relevé d'identité bancaire", title: "Envoyer le RIB" }],
      source,
    );
    expect(r.ungrounded).toBe(1);
    expect(r.extraGrounded).toBe(0);
  });

  it("n'apparie jamais deux fois le même produit, même au repli par titre", () => {
    const action = {
      excerpt: "une action absente du courrier",
      title: "Envoyer le justificatif de domicile",
    };
    const r = compareByExcerptThenTitle(
      [action, action],
      [
        {
          excerpt: "un justificatif de domicile de moins de trois mois",
          title: "Transmettre le justificatif de domicile",
        },
      ],
      source,
    );
    expect(r.matchedLenient).toBe(1);
    expect(r.missed).toBe(1);
  });
});
