import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { SESSION_COOKIE_NAME } from "@/lib/config";

function request(path: string, withCookie: boolean) {
  const req = new NextRequest(new URL(`http://localhost:3000${path}`));
  if (withCookie) req.cookies.set(SESSION_COOKIE_NAME, "opaque-token");
  return req;
}

describe("middleware — protection des routes (US-1.4)", () => {
  it("redirige vers /connexion?next=… quand le cookie de session est absent", () => {
    const res = middleware(request("/dashboard/foo?a=1", false));
    expect(res.status).toBe(307);
    const location = res.headers.get("location")!;
    expect(location).toContain("/connexion");
    expect(location).toContain(`next=${encodeURIComponent("/dashboard/foo?a=1")}`);
  });

  it("/importer sans cookie → /connexion?next=/importer (E2)", () => {
    const res = middleware(request("/importer", false));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain(`next=${encodeURIComponent("/importer")}`);
  });

  it("laisse passer quand le cookie de session est présent", () => {
    const res = middleware(request("/dossiers/abc", true));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });
});
