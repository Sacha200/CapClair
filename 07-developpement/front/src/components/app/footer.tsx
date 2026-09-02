import Link from "next/link";

/**
 * Pied de page partagé (maquette Figma, composant « Footer » — présent sur
 * tous les écrans connectés). Sert US-8.3 AC1 (liens légaux accessibles
 * depuis toutes les pages) pour les deux documents déjà publiés.
 *
 * Écart documenté vs maquette : « Mentions légales » et « Contact » n'ont pas
 * encore de page (US-8.3 en cours, KAN-52) — omis plutôt que de pointer vers
 * une route inexistante ; à ajouter quand ces pages existeront.
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-subtle">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-5 text-xs text-text-muted sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>CapClair n&apos;est pas un conseiller juridique. Documents fictifs uniquement.</p>
          <nav className="flex gap-4 font-semibold text-primary">
            <Link href="/cgu" className="hover:underline">
              CGU
            </Link>
            <Link href="/confidentialite" className="hover:underline">
              Confidentialité
            </Link>
          </nav>
        </div>
        <p>© 2026 CapClair — projet de démonstration, aucune donnée réelle.</p>
      </div>
    </footer>
  );
}
