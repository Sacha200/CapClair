import type { Metadata } from "next";
import { ImportForm } from "@/components/documents/import-form";

export const metadata: Metadata = { title: "Importer un courrier — CapClair" };

/** Écran 03 (US-2.1) — la garde de session est héritée de `(app)/layout.tsx`. */
export default function ImporterPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold text-text-strong">Importer un courrier</h1>
      <p className="mt-2 text-sm text-text-muted">
        Déposez un courrier fictif (PDF, PNG ou JPEG) : CapClair le lit puis vous aidera à le
        comprendre.
      </p>
      <ImportForm />
    </section>
  );
}
