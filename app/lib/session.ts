export type SessionAssistantMode = "soan_thao" | "nghiep_vu" | "tham_dinh";

export interface SessionManager {
  getOrInitSessionId(deptId?: string): string;
  rotateSessionId(deptId?: string): string;
  getActiveActorEmail(): string;
  setActiveActorEmail(email: string): void;
  getActiveTenantSlug(): string;
  setActiveTenantSlug(slug: string): void;
}

export const DEFAULT_ACTOR_EMAIL = "tsh.co@tshorg.vn";
export const DEFAULT_TENANT_SLUG = "default";
export const ACTOR_COOKIE_NAME = "ubnd_actor_email";
export const TENANT_COOKIE_NAME = "ubnd_tenant_slug";

const COOKIE_ATTRS = "path=/; max-age=2592000; SameSite=Lax";
const SESSION_KEY_PREFIX = "ubnd_ai_session_id";
const ACTOR_KEY = "ubnd_ai_actor_email";
const TENANT_KEY = "ubnd_ai_tenant_slug";
const M01_MODE_KEY = "ubnd_ai_m01_mode";

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ubnd-${crypto.randomUUID().slice(0, 12)}`;
  }
  return `ubnd-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function parseCookieMap(
  cookieHeader: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const rawPart of cookieHeader.split(";")) {
    const trimmed = rawPart.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed.slice(eqIdx + 1).trim();
    try {
      out[key] = decodeURIComponent(rawVal);
    } catch {
      out[key] = rawVal;
    }
  }
  return out;
}

export function parseServerCookies(cookieHeader: string | null | undefined): {
  actorEmail: string;
  tenantSlug: string;
} {
  const map = parseCookieMap(cookieHeader);
  const actorEmail = (map[ACTOR_COOKIE_NAME] ?? "").trim().toLowerCase() || DEFAULT_ACTOR_EMAIL;
  const tenantSlug = (map[TENANT_COOKIE_NAME] ?? "").trim().toLowerCase() || DEFAULT_TENANT_SLUG;
  return { actorEmail, tenantSlug };
}

function writeBrowserCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; ${COOKIE_ATTRS}`;
}

export function buildScopedSessionKey(
  deptId = "VP",
  actorEmail = DEFAULT_ACTOR_EMAIL,
  tenantSlug = DEFAULT_TENANT_SLUG,
): string {
  const safeTenant = (tenantSlug || DEFAULT_TENANT_SLUG).trim().toLowerCase();
  const safeActor = (actorEmail || DEFAULT_ACTOR_EMAIL).trim().toLowerCase();
  const safeDept = (deptId || "VP").trim().toUpperCase();
  return `${SESSION_KEY_PREFIX}::${safeTenant}::${safeActor}::${safeDept}`;
}

export function createMemorySessionManager(
  defaultEmail = DEFAULT_ACTOR_EMAIL,
  defaultTenant = DEFAULT_TENANT_SLUG,
): SessionManager {
  const sessionByScope = new Map<string, string>();
  let currentActorEmail = defaultEmail;
  let currentTenantSlug = defaultTenant;

  return {
    getOrInitSessionId(deptId = "VP") {
      const key = buildScopedSessionKey(deptId, currentActorEmail, currentTenantSlug);
      let existing = sessionByScope.get(key);
      if (!existing) {
        existing = generateId();
        sessionByScope.set(key, existing);
      }
      return existing;
    },
    rotateSessionId(deptId = "VP") {
      const key = buildScopedSessionKey(deptId, currentActorEmail, currentTenantSlug);
      const next = generateId();
      sessionByScope.set(key, next);
      return next;
    },
    getActiveActorEmail() {
      return currentActorEmail;
    },
    setActiveActorEmail(email: string) {
      currentActorEmail = email.trim().toLowerCase() || defaultEmail;
    },
    getActiveTenantSlug() {
      return currentTenantSlug;
    },
    setActiveTenantSlug(slug: string) {
      currentTenantSlug = slug.trim().toLowerCase() || defaultTenant;
    },
  };
}

const fallbackMgr = createMemorySessionManager();

export function ensureBrowserIdentityCookies(): {
  actorEmail: string;
  tenantSlug: string;
} {
  if (typeof window === "undefined") {
    return {
      actorEmail: fallbackMgr.getActiveActorEmail(),
      tenantSlug: fallbackMgr.getActiveTenantSlug(),
    };
  }
  const cookieMap =
    typeof document !== "undefined" ? parseCookieMap(document.cookie) : {};
  const cookieEmail = (cookieMap[ACTOR_COOKIE_NAME] ?? "").trim().toLowerCase();
  const storedEmail = (window.localStorage.getItem(ACTOR_KEY) ?? "")
    .trim()
    .toLowerCase();
  const actorEmail = cookieEmail || storedEmail || DEFAULT_ACTOR_EMAIL;

  if (cookieEmail !== actorEmail) {
    writeBrowserCookie(ACTOR_COOKIE_NAME, actorEmail);
  }
  if (storedEmail !== actorEmail) {
    window.localStorage.setItem(ACTOR_KEY, actorEmail);
  }

  const cookieTenant = (cookieMap[TENANT_COOKIE_NAME] ?? "").trim().toLowerCase();
  const storedTenant = (window.localStorage.getItem(TENANT_KEY) ?? "")
    .trim()
    .toLowerCase();
  const tenantSlug = cookieTenant || storedTenant || DEFAULT_TENANT_SLUG;

  if (cookieTenant !== tenantSlug) {
    writeBrowserCookie(TENANT_COOKIE_NAME, tenantSlug);
  }
  if (storedTenant !== tenantSlug) {
    window.localStorage.setItem(TENANT_KEY, tenantSlug);
  }

  return { actorEmail, tenantSlug };
}

export function getActiveActorEmail(): string {
  if (typeof window === "undefined") {
    return fallbackMgr.getActiveActorEmail();
  }
  return ensureBrowserIdentityCookies().actorEmail;
}

export function setActiveActorEmail(email: string): void {
  const cleaned = email.trim().toLowerCase() || DEFAULT_ACTOR_EMAIL;
  if (typeof window === "undefined") {
    fallbackMgr.setActiveActorEmail(cleaned);
    return;
  }
  window.localStorage.setItem(ACTOR_KEY, cleaned);
  writeBrowserCookie(ACTOR_COOKIE_NAME, cleaned);
  window.dispatchEvent(new CustomEvent("ubnd-actor-changed", { detail: cleaned }));
}

export function getActiveTenantSlug(): string {
  if (typeof window === "undefined") {
    return fallbackMgr.getActiveTenantSlug();
  }
  return ensureBrowserIdentityCookies().tenantSlug;
}

export function setActiveTenantSlug(slug: string): void {
  const cleaned = slug.trim().toLowerCase() || DEFAULT_TENANT_SLUG;
  if (typeof window === "undefined") {
    fallbackMgr.setActiveTenantSlug(cleaned);
    return;
  }
  window.localStorage.setItem(TENANT_KEY, cleaned);
  writeBrowserCookie(TENANT_COOKIE_NAME, cleaned);
  window.dispatchEvent(new CustomEvent("ubnd-tenant-changed", { detail: cleaned }));
}

export function getOrInitSessionId(
  deptId = "VP",
  actorEmail?: string,
  tenantSlug?: string,
): string {
  if (typeof window === "undefined") {
    return fallbackMgr.getOrInitSessionId(deptId);
  }
  const resolvedActor = actorEmail ?? getActiveActorEmail();
  const resolvedTenant = tenantSlug ?? getActiveTenantSlug();
  const scopedKey = buildScopedSessionKey(deptId, resolvedActor, resolvedTenant);
  let existing = window.sessionStorage.getItem(scopedKey);
  if (!existing) {
    existing = generateId();
    window.sessionStorage.setItem(scopedKey, existing);
  }
  return existing;
}

export function rotateSessionId(
  deptId = "VP",
  actorEmail?: string,
  tenantSlug?: string,
): string {
  if (typeof window === "undefined") {
    return fallbackMgr.rotateSessionId(deptId);
  }
  const resolvedActor = actorEmail ?? getActiveActorEmail();
  const resolvedTenant = tenantSlug ?? getActiveTenantSlug();
  const scopedKey = buildScopedSessionKey(deptId, resolvedActor, resolvedTenant);
  const next = generateId();
  window.sessionStorage.setItem(scopedKey, next);
  window.dispatchEvent(new CustomEvent("ubnd-session-changed", { detail: next }));
  return next;
}

export function getSavedAssistantMode(): SessionAssistantMode {
  if (typeof window === "undefined") {
    return "nghiep_vu";
  }
  const raw = window.sessionStorage.getItem(M01_MODE_KEY);
  if (raw === "soan_thao" || raw === "nghiep_vu" || raw === "tham_dinh") {
    return raw;
  }
  return "nghiep_vu";
}

export function setSavedAssistantMode(mode: SessionAssistantMode): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(M01_MODE_KEY, mode);
}
