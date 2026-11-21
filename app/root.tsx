import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { TooltipProvider } from "~/components/ui/tooltip";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0C1E35" />
        <Meta />
        <Links />
      </head>
      <body>
        <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let statusCode = "Lỗi hệ thống";
  let title = "Không thể hiển thị trang được yêu cầu";
  let details =
    "Phiên làm việc gặp sự cố ngoài dự kiến. Vui lòng tải lại trang hoặc quay về không gian làm việc chính.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    statusCode = `HTTP ${error.status}`;
    title =
      error.status === 404
        ? "Không tìm thấy đường dẫn chức năng"
        : "Yêu cầu không thể thực hiện";
    details =
      error.status === 404
        ? "Trang hoặc phân hệ bạn vừa truy cập không tồn tại trên hệ thống Bộ Trợ lý AI UBND xã, phường."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen bg-[#F6F7F9] flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 border-t-4 border-t-[#B45309]">
        <p className="text-xs font-semibold tracking-wide text-[#B45309] tabular-nums">
          {statusCode}
        </p>
        <h1 className="text-xl font-bold text-slate-900 text-balance">{title}</h1>
        <p className="text-sm leading-relaxed text-slate-600">{details}</p>
        <div className="pt-1">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1B4D89] px-4 text-sm font-medium text-white hover:bg-[#153E70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4D89] focus-visible:ring-offset-2"
          >
            Quay về trang làm việc chính
          </Link>
        </div>
        {stack && (
          <pre className="w-full rounded-lg bg-slate-900 p-4 text-xs text-slate-100 overflow-x-auto">
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
