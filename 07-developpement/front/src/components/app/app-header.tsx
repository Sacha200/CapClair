"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import type { SessionUser } from "@capclair/contract";
import { cn } from "@/lib/cn";
import { logout } from "@/lib/api/auth";

/** Ordre et libellés fidèles à la maquette Hi-Fi (« Header / App · hi-fi »). */
const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/importer", label: "Importer un courrier" },
] as const;

function initials(user: SessionUser): string {
  const source = (user.name?.trim() || user.email).trim();
  const words = source.split(/\s+/).filter(Boolean);
  const pair = words.length >= 2 ? words[0][0] + words[1][0] : source.slice(0, 2);
  return pair.toUpperCase();
}

export function AppHeader({ user }: { user: SessionUser }) {
  const router = useRouter();
  const pathname = usePathname();

  async function onLogout() {
    // Un échec de l'appel réseau ne doit pas bloquer l'utilisateur : on le
    // renvoie vers /connexion dans tous les cas. Le cookie est effacé côté
    // serveur ; s'il subsiste, la garde de /dashboard s'en chargera.
    try {
      await logout();
    } catch {
      // ignoré volontairement
    }
    router.push("/connexion");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-10">
        <div className="flex items-center gap-9">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-[6px] bg-primary text-sm font-extrabold text-text-on-primary">
              C
            </span>
            <span className="text-lg font-extrabold text-text-strong">CapClair</span>
          </Link>
          <nav className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const active = pathname?.startsWith(item.href) ?? false;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1.5 pt-1 text-sm",
                    active ? "font-semibold text-primary" : "font-medium text-text-muted hover:text-text",
                  )}
                >
                  {item.label}
                  <span className={cn("h-0.5 w-full rounded-full", active && "bg-primary")} />
                </Link>
              );
            })}
          </nav>
        </div>
        {/* Pill avatar + nom (maquette) : pas encore de menu déroulant — le clic
            déclenche directement la déconnexion, seule action disponible ici. */}
        <button
          type="button"
          onClick={onLogout}
          title="Se déconnecter"
          className="flex items-center gap-2 rounded-full border border-border bg-bg-subtle py-1 pl-1.5 pr-3 text-sm hover:bg-bg-page"
        >
          <span className="flex size-[26px] items-center justify-center rounded-full bg-primary text-xs font-semibold text-text-on-primary">
            {initials(user)}
          </span>
          <span className="font-semibold text-text-strong">{user.name ?? user.email}</span>
        </button>
      </div>
    </header>
  );
}
