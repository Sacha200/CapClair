"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SessionUser } from "@capclair/contract";
import { logout } from "@/lib/api/auth";

export function AppHeader({ user }: { user: SessionUser }) {
  const router = useRouter();

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
        <Link href="/dashboard" className="font-extrabold tracking-tight text-text-strong">
          CapClair
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-text-muted">{user.name ?? user.email}</span>
          <button
            type="button"
            onClick={onLogout}
            className="min-h-11 rounded-[var(--radius-button)] border border-border-strong px-3 font-medium text-text hover:bg-bg-subtle"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </header>
  );
}
