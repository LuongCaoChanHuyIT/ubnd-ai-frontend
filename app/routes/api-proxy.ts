import { resolveServerApiBase } from "../lib/api.ts";

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "x-auth-token",
  "x-actor-email",
  "x-tenant-slug",
  "cf-access-authenticated-user-email",
] as const;

export async function proxyApiRequest(request: Request): Promise<Response> {
  if (request.headers.get("x-ubnd-proxy-hop")) {
    return Response.json(
      {
        detail:
          "Vòng lặp proxy: API_BASE_URL đang trỏ nhầm vào chính Frontend thay vì Backend.",
      },
      { status: 502 },
    );
  }

  const incomingUrl = new URL(request.url);
  const targetUrl = `${resolveServerApiBase()}${incomingUrl.pathname}${incomingUrl.search}`;

  const outboundHeaders = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const val = request.headers.get(name);
    if (val) {
      outboundHeaders.set(name, val);
    }
  }
  outboundHeaders.set("x-ubnd-proxy-hop", "1");

  const method = request.method.toUpperCase();
  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 0) {
      body = buf;
    }
  }

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: outboundHeaders,
      body,
    });

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      responseHeaders.set("content-type", contentType);
    }
    const contentDisposition = upstream.headers.get("content-disposition");
    if (contentDisposition) {
      responseHeaders.set("content-disposition", contentDisposition);
    }
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) {
      responseHeaders.set("set-cookie", setCookie);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      {
        detail:
          "Không thể kết nối tới dịch vụ Backend từ máy chủ Frontend (HTTP 502).",
      },
      { status: 502 },
    );
  }
}

export async function loader({ request }: { request: Request }) {
  return proxyApiRequest(request);
}

export async function action({ request }: { request: Request }) {
  return proxyApiRequest(request);
}
