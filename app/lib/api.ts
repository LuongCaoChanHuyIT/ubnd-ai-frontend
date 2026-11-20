import {
  clearAuthSession,
  getActiveActorEmail,
  getActiveAuthToken,
  getActiveTenantSlug,
  parseServerCookies,
  setAuthSession,
} from "./session.ts";

export interface HelloPayload {
  message: string;
  service: string;
  version: string;
  timestamp: string;
}

export type HelloResult =
  | {
    connected: true;
    data: HelloPayload;
    latencyMs: number;
  }
  | {
    connected: false;
    error: string;
    latencyMs: number;
  };

export type DepartmentId = "VP" | "KT" | "VHXH" | "NNMT";
export type AssistantMode = "soan_thao" | "nghiep_vu" | "tham_dinh";
export type DocTier = "trung_uong" | "dia_phuong" | "kho_rieng";
export type SessionProcessAction = "tom_tat" | "trich_xuat" | "doi_chieu" | "tong_hop";
export type TaskStatus = "cho_xu_ly" | "dang_thuc_hien" | "sap_den_han" | "hoan_thanh";
export type AuthorityMode = "auto" | "ubnd" | "chu_tich";

export interface Department {
  id: DepartmentId;
  code: string;
  name: string;
  scope_summary: string;
  instruction?: string;
  updated_at: string;
}

export interface TenantSummary {
  slug: string;
  commune_name: string;
}

export interface DemoAccount {
  id?: number;
  email: string;
  full_name: string;
  position: string;
  role: "owner" | "officer";
  department_id: DepartmentId;
  private_repo_access: boolean;
  can_manage_docs?: boolean;
  can_approve_doc_requests?: boolean;
  can_manage_tasks?: boolean;
}

export interface BootstrapPayload {
  commune_name: string;
  active_tenant_slug: string;
  available_tenants: TenantSummary[];
  departments: Department[];
  demo_accounts: DemoAccount[];
}

export interface AuthAccountsPayload {
  commune_name: string;
  active_tenant_slug: string;
  available_tenants: TenantSummary[];
  demo_accounts: RbacUser[];
}

export interface AuthLoginResponse {
  token: string;
  tenant_slug: string;
  commune_name: string;
  user: RbacUser;
}

export interface CitationItem {
  id?: number | null;
  doc_number: string;
  title: string;
  tier: DocTier | string;
  source_url?: string;
  has_attachment?: boolean;
}

export interface SessionFileItem {
  file_id: string;
  filename: string;
  size_bytes: number;
  ext: string;
  extracted_text: string;
  parse_note: string;
  uploaded_at: string;
  mime_type?: string;
  has_raw?: boolean;
}

export interface SessionMessageItem {
  role: "user" | "assistant";
  mode: AssistantMode | string;
  content: string;
  citations: CitationItem[];
  model_used?: string | null;
  created_at: string;
}

export interface SessionState {
  session_id: string;
  created_at: string;
  files: SessionFileItem[];
  messages: SessionMessageItem[];
}

export interface ChatTurnResponse {
  session_id: string;
  department: Department;
  reply: SessionMessageItem;
  session: SessionState;
}

export interface ExtendedOption {
  code: string;
  title: string;
  summary: string;
  pros: string[];
  cons: string[];
  feasibility: string;
}

export interface ExtendedAnalyzeResponse {
  department: Department;
  topic: string;
  context: string;
  scope_notice: string;
  options: ExtendedOption[];
  model_used?: string | null;
}

export interface AuditCriterion {
  id: string;
  name: string;
  status: "dat" | "can_ra_soat" | "khong_dat";
  detail: string;
}

export interface AuditReport {
  score: number;
  doc_type: string;
  department_id: DepartmentId;
  criteria: AuditCriterion[];
  summary: string;
  model_used?: string | null;
}

export interface OfficialDoc {
  id: number;
  doc_number: string;
  title: string;
  doc_type: string;
  tier: DocTier;
  department_id: string;
  issuer: string;
  issued_date: string;
  status: string;
  summary: string;
  content: string;
  source_url?: string;
  attachment_filename?: string;
  attachment_mime?: string;
  attachment_size?: number;
  has_attachment?: boolean;
  created_at: string;
}

export interface DocUpdateRequest {
  id: number;
  doc_number: string;
  title: string;
  tier: DocTier;
  department_id: DepartmentId;
  reason: string;
  requested_by: string;
  status: string;
  created_at: string;
}

export interface DocUpdateReviewResponse {
  request: DocUpdateRequest;
  inserted_document: OfficialDoc | null;
}

export interface SessionProcessResult {
  action: SessionProcessAction;
  file_count: number;
  result_markdown: string;
  highlights: string[];
  model_used?: string | null;
}

export interface TaskItem {
  id: number;
  title: string;
  description: string;
  department_id: DepartmentId;
  assignee: string;
  due_date: string;
  priority: "thap" | "trung_binh" | "cao" | "khan";
  status: TaskStatus;
  progress: number;
  ref_doc_number: string;
  reminder_count: number;
  created_at: string;
  updated_at: string;
}

export interface TasksOverview {
  kpis: {
    total: number;
    in_progress: number;
    due_soon: number;
    completed: number;
  };
  tasks: TaskItem[];
  effective_department?: DepartmentId | "ALL";
}

export interface RbacUser {
  id: number;
  email: string;
  full_name: string;
  position: string;
  role: "owner" | "officer";
  department_id: DepartmentId;
  private_repo_access: boolean;
  can_manage_docs?: boolean;
  can_approve_doc_requests?: boolean;
  can_manage_tasks?: boolean;
  active: boolean;
  created_at: string;
}

export interface ApiConnector {
  id: number;
  name: string;
  provider: string;
  base_url: string;
  model_name: string;
  has_key: boolean;
  api_key_masked: string;
  active: boolean;
  updated_at: string;
}

export interface GeminiModelPreset {
  id: string;
  label: string;
  tier: string;
  description: string;
}

export const GEMINI_MODEL_PRESETS: readonly GeminiModelPreset[] = [
  {
    id: "gemini-4-carbon",
    label: "Gemini 4 Carbon — Suy luận chuyên sâu (1M tokens)",
    tier: "Frontier",
    description:
      "Mạnh nhất cho thẩm định pháp lý phức tạp, đối chiếu hồ sơ nhiều tài liệu và dự thảo quan trọng.",
  },
  {
    id: "gemini-4-argon",
    label: "Gemini 4 Argon — Suy luận hiệu suất cao (1M tokens)",
    tier: "Reasoning",
    description:
      "Cân bằng tối ưu giữa chiều sâu phân tích nghiệp vụ công vụ và tốc độ phản hồi.",
  },
  {
    id: "gemini-4-hydrogen",
    label: "Gemini 4 Hydrogen — Mặc định đa năng tốc độ cao (1M tokens)",
    tier: "Recommended",
    description:
      "Mô hình mặc định tốc độ nhanh, ổn định, tương thích rộng với mọi hạn mức khóa Google AI Studio.",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite — Siêu tốc, tiết kiệm hạn mức (1M tokens)",
    tier: "Fast",
    description:
      "Phản hồi siêu nhanh với hạn mức thấp nhất cho tác vụ tra cứu và tóm tắt thường xuyên.",
  },
] as const;

export interface ConnectorProbeResponse {
  ok: boolean;
  provider: string;
  resolved_model: string;
  latency_ms: number;
  sample_reply: string;
  detail: string;
}

export function formatModelBadgeLabel(modelUsed: string | null | undefined): string {
  const cleaned = (modelUsed ?? "").trim();
  switch (cleaned) {
    case "gemini-4-carbon":
      return "Gemini 4 Carbon";
    case "gemini-4-argon":
      return "Gemini 4 Argon";
    case "gemini-4-hydrogen":
      return "Gemini 4 Hydrogen";
    case "gemini-3.5-flash-lite":
      return "Gemini 3.5 Flash-Lite";
    default:
      return cleaned;
  }
}

export interface AuditLogEntry {
  id: number;
  actor_email: string;
  department_id: string;
  module_code: string;
  action: string;
  detail: string;
  created_at: string;
}

export interface ClonedTenant {
  id: number;
  slug: string;
  commune_name: string;
  admin_email: string;
  storage_label: string;
  status?: string;
  created_at: string;
}

export interface WorkspaceOutletContext {
  communeName: string;
  activeTenantSlug: string;
  availableTenants: TenantSummary[];
  departments: Department[];
  currentUser: RbacUser;
  switchTenant: (nextSlug: string, preferredAdminEmail?: string) => void;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const LEGAL_DISCLAIMER_TEXT =
  "AI là công cụ hỗ trợ nghiệp vụ; cán bộ, công chức và người có thẩm quyền vẫn trực tiếp kiểm tra, quyết định và chịu trách nhiệm đối với nội dung sử dụng.";

export function resolveClientApiBase(): string {
  const viteBase = (
    import.meta as { env?: Record<string, string | undefined> }
  )?.env?.VITE_API_BASE_URL;
  const raw =
    viteBase ??
    (typeof process !== "undefined" ? process.env?.VITE_API_BASE_URL : undefined) ??
    "";
  return raw.trim().replace(/\/+$/, "");
}

export function resolveServerApiBase(): string {
  if (typeof process !== "undefined") {
    const raw = process.env?.API_BASE_URL || process.env?.VITE_API_BASE_URL;
    if (raw && raw.trim()) {
      return raw.trim().replace(/\/+$/, "");
    }
  }
  return "http://127.0.0.1:8000";
}

export function normalizeDepartmentId(raw: string | null | undefined): DepartmentId {
  const upper = (raw ?? "VP").toUpperCase();
  if (upper === "KT" || upper === "VHXH" || upper === "NNMT") {
    return upper;
  }
  return "VP";
}

export function extractServerAuthHeaders(request: Request): Record<string, string> {
  const { actorEmail, tenantSlug, authToken } = parseServerCookies(
    request.headers.get("cookie"),
  );
  const out: Record<string, string> = {
    "X-Actor-Email": actorEmail,
    "X-Tenant-Slug": tenantSlug,
  };
  if (authToken) {
    out.Authorization = `Bearer ${authToken}`;
  }
  return out;
}

export function formatHttpErrorMessage(
  status: number,
  rawDetail?: unknown,
): string {
  if (typeof rawDetail === "string" && rawDetail.trim()) {
    return rawDetail.trim();
  }
  if (Array.isArray(rawDetail) && rawDetail.length > 0) {
    const msgs = rawDetail
      .map((item) =>
        typeof item === "object" && item !== null && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : JSON.stringify(item),
      )
      .join("; ");
    return `Dữ liệu gửi lên chưa hợp lệ: ${msgs}`;
  }
  switch (status) {
    case 400:
      return "Yêu cầu không hợp lệ hoặc thiếu thông tin bắt buộc (HTTP 400).";
    case 401:
      return "Chưa xác thực danh tính cán bộ (HTTP 401). Vui lòng chọn lại tài khoản làm việc.";
    case 403:
      return "Bạn không có quyền truy cập chức năng hoặc dữ liệu của bộ phận này (HTTP 403).";
    case 404:
      return "Không tìm thấy tài nguyên hoặc đơn vị được yêu cầu (HTTP 404).";
    case 409:
      return "Dữ liệu bị trùng lặp hoặc xung đột trạng thái trên hệ thống (HTTP 409).";
    case 413:
      return "Kích thước tệp tải lên vượt quá giới hạn cho phép 10 MB (HTTP 413).";
    default:
      return `Lỗi kết nối dịch vụ nội bộ (HTTP ${status}).`;
  }
}

export async function apiRequest<T>(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    baseUrl?: string;
    actorEmail?: string;
    tenantSlug?: string;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const baseUrl = (options?.baseUrl ?? resolveClientApiBase())
    .trim()
    .replace(/\/+$/, "");
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options?.headers ?? {}),
  };

  if (options?.actorEmail) {
    headers["X-Actor-Email"] = options.actorEmail;
  } else if (typeof window !== "undefined" && !headers["X-Actor-Email"]) {
    headers["X-Actor-Email"] = getActiveActorEmail();
  }

  if (options?.tenantSlug) {
    headers["X-Tenant-Slug"] = options.tenantSlug;
  } else if (typeof window !== "undefined" && !headers["X-Tenant-Slug"]) {
    headers["X-Tenant-Slug"] = getActiveTenantSlug();
  }

  if (typeof window !== "undefined" && !headers.Authorization) {
    const activeToken = getActiveAuthToken();
    if (activeToken) {
      headers.Authorization = `Bearer ${activeToken}`;
    }
  }

  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let rawDetail: unknown;
    try {
      const errJson = (await response.json()) as { detail?: unknown };
      rawDetail = errJson?.detail;
    } catch {
      // ignore json parse error
    }
    throw new ApiError(
      response.status,
      formatHttpErrorMessage(response.status, rawDetail),
    );
  }

  return (await response.json()) as T;
}

export async function uploadSessionFile(
  sessionId: string,
  file: File,
  departmentId: DepartmentId = "VP",
  actorEmail?: string,
  tenantSlug?: string,
  baseUrl?: string,
): Promise<SessionState> {
  const form = new FormData();
  form.append("file", file);

  const resolvedBase = (baseUrl ?? resolveClientApiBase())
    .trim()
    .replace(/\/+$/, "");
  const resolvedActor =
    actorEmail ??
    (typeof window !== "undefined" ? getActiveActorEmail() : "tsh.co@tshorg.vn");
  const resolvedTenant =
    tenantSlug ??
    (typeof window !== "undefined" ? getActiveTenantSlug() : "default");

  const reqHeaders: Record<string, string> = {
    "X-Actor-Email": resolvedActor,
    "X-Tenant-Slug": resolvedTenant,
  };
  if (typeof window !== "undefined") {
    const activeToken = getActiveAuthToken();
    if (activeToken) {
      reqHeaders.Authorization = `Bearer ${activeToken}`;
    }
  }

  const response = await fetch(
    `${resolvedBase}/api/m05/sessions/${encodeURIComponent(sessionId)}/upload?department_id=${encodeURIComponent(departmentId)}`,
    {
      method: "POST",
      headers: reqHeaders,
      body: form,
    },
  );

  if (!response.ok) {
    let rawDetail: unknown;
    try {
      const errJson = (await response.json()) as { detail?: unknown };
      rawDetail = errJson?.detail;
    } catch {
      // ignore
    }
    throw new ApiError(
      response.status,
      formatHttpErrorMessage(response.status, rawDetail),
    );
  }

  return (await response.json()) as SessionState;
}

export async function getSessionState(
  sessionId: string,
  departmentId: DepartmentId,
): Promise<SessionState> {
  return apiRequest<SessionState>(
    `/api/sessions/${encodeURIComponent(sessionId)}?department_id=${encodeURIComponent(departmentId)}`,
  );
}

export async function wipeSessionState(
  sessionId: string,
  moduleCode: "M01" | "M05",
  departmentId: DepartmentId,
): Promise<{ wiped: boolean; session_id: string }> {
  return apiRequest<{ wiped: boolean; session_id: string }>(
    `/api/sessions/${encodeURIComponent(sessionId)}?department_id=${encodeURIComponent(departmentId)}&module_code=${encodeURIComponent(moduleCode)}`,
    { method: "DELETE" },
  );
}

export async function loginWithPassword(params: {
  email: string;
  password: string;
  tenantSlug?: string;
  baseUrl?: string;
}): Promise<AuthLoginResponse> {
  const res = await apiRequest<AuthLoginResponse>("/api/auth/login", {
    method: "POST",
    baseUrl: params.baseUrl,
    tenantSlug: params.tenantSlug ?? "default",
    body: {
      email: params.email.trim().toLowerCase(),
      password: params.password,
      tenant_slug: params.tenantSlug ?? "default",
    },
  });
  setAuthSession({
    token: res.token,
    actorEmail: res.user.email,
    tenantSlug: res.tenant_slug,
  });
  return res;
}

export async function logoutSession(baseUrl?: string): Promise<void> {
  try {
    await apiRequest<{ logged_out: boolean }>("/api/auth/logout", {
      method: "POST",
      baseUrl,
    });
  } catch {
    // Always clear client token even if network fails
  } finally {
    clearAuthSession();
  }
}

export async function uploadOfficialDocAttachment(
  docId: number,
  file: File,
  baseUrl?: string,
): Promise<OfficialDoc> {
  const form = new FormData();
  form.append("file", file);
  const resolvedBase = (baseUrl ?? resolveClientApiBase())
    .trim()
    .replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "X-Actor-Email":
      typeof window !== "undefined" ? getActiveActorEmail() : "tsh.co@tshorg.vn",
    "X-Tenant-Slug":
      typeof window !== "undefined" ? getActiveTenantSlug() : "default",
  };
  if (typeof window !== "undefined") {
    const tok = getActiveAuthToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
  }
  const response = await fetch(
    `${resolvedBase}/api/m04/documents/${encodeURIComponent(String(docId))}/attachment`,
    {
      method: "POST",
      headers,
      body: form,
    },
  );
  if (!response.ok) {
    let rawDetail: unknown;
    try {
      const errJson = (await response.json()) as { detail?: unknown };
      rawDetail = errJson?.detail;
    } catch {
      // ignore
    }
    throw new ApiError(
      response.status,
      formatHttpErrorMessage(response.status, rawDetail),
    );
  }
  return (await response.json()) as OfficialDoc;
}

export async function fetchBinaryBlob(
  path: string,
  options?: { baseUrl?: string },
): Promise<{ blob: Blob; contentType: string }> {
  const resolvedBase = (options?.baseUrl ?? resolveClientApiBase())
    .trim()
    .replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "X-Actor-Email":
      typeof window !== "undefined" ? getActiveActorEmail() : "tsh.co@tshorg.vn",
    "X-Tenant-Slug":
      typeof window !== "undefined" ? getActiveTenantSlug() : "default",
  };
  if (typeof window !== "undefined") {
    const tok = getActiveAuthToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
  }
  const response = await fetch(`${resolvedBase}${path}`, {
    method: "GET",
    headers,
  });
  if (!response.ok) {
    let rawDetail: unknown;
    try {
      const errJson = (await response.json()) as { detail?: unknown };
      rawDetail = errJson?.detail;
    } catch {
      // ignore
    }
    throw new ApiError(
      response.status,
      formatHttpErrorMessage(response.status, rawDetail),
    );
  }
  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const blob = await response.blob();
  return { blob, contentType };
}

export async function probeApiConnector(
  connectorId: number,
  payload: {
    provider: string;
    base_url: string;
    model_name: string;
    api_key?: string | null;
  },
  baseUrl?: string,
): Promise<ConnectorProbeResponse> {
  return apiRequest<ConnectorProbeResponse>(
    `/api/m07/api-connectors/${encodeURIComponent(String(connectorId))}/test`,
    {
      method: "POST",
      baseUrl,
      body: payload,
    },
  );
}

export async function fetchBackendHello(options?: {
  baseUrl?: string;
  name?: string;
  timeoutMs?: number;
}): Promise<HelloResult> {
  const baseUrl = (options?.baseUrl ?? resolveClientApiBase())
    .trim()
    .replace(/\/+$/, "");
  const query = options?.name?.trim()
    ? `?name=${encodeURIComponent(options.name.trim())}`
    : "";
  const endpoint = `${baseUrl}/api/hello${query}`;
  const timeoutMs = options?.timeoutMs ?? 35000;
  const startedAt = performance.now();

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      return {
        connected: false,
        error: `HTTP ${response.status} ${response.statusText}`,
        latencyMs,
      };
    }

    const data = (await response.json()) as HelloPayload;
    return {
      connected: true,
      data,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    return {
      connected: false,
      error: err instanceof Error ? err.message : "Không thể kết nối tới Backend",
      latencyMs,
    };
  }
}
