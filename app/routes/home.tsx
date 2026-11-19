import { useState } from "react";
import { CheckCircle2, RefreshCw, Send, ServerCrash, Sparkles } from "lucide-react";
import type { Route } from "./+types/home";
import {
  fetchBackendHello,
  resolveServerApiBase,
  type HelloResult,
} from "~/lib/api";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bộ Trợ lý AI UBND Xã, Phường — Kết nối FE ↔ BE" },
    {
      name: "description",
      content: "Kiểm tra kết nối giữa React Router (shadcn/ui) và FastAPI Backend",
    },
  ];
}

export async function loader() {
  const apiBase = resolveServerApiBase();
  const initialResult = await fetchBackendHello({ baseUrl: apiBase });
  return { apiBase, initialResult };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [result, setResult] = useState<HelloResult>(loaderData.initialResult);
  const [unitName, setUnitName] = useState("UBND Phường Tân Bình");
  const [loading, setLoading] = useState(false);

  async function handlePingBackend(customName?: string) {
    setLoading(true);
    try {
      const next = await fetchBackendHello({
        name: customName,
      });
      setResult(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-sm border-slate-200">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  UBND CẤP XÃ · HỆ THỐNG NỘI BỘ
                </p>
                <CardTitle className="text-xl text-slate-900">
                  Bộ Trợ lý AI UBND Xã, Phường
                </CardTitle>
              </div>
            </div>

            {result.connected ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Đã kết nối FastAPI ({result.latencyMs} ms)
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1.5">
                <ServerCrash className="h-3.5 w-3.5" />
                Chưa kết nối Backend
              </Badge>
            )}
          </div>
          <CardDescription>
            Kiểm tra đường truyền trực tiếp giữa Frontend (React Router + shadcn/ui)
            và Backend (FastAPI Python) qua endpoint <code>/api/hello</code>.
          </CardDescription>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6 space-y-5">
          <div className="rounded-lg border bg-slate-900 text-slate-50 p-4 font-mono text-sm space-y-2">
            {result.connected ? (
              <>
                <p className="text-emerald-400 font-semibold">
                  {result.data.message}
                </p>
                <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                  <span>service: {result.data.service}</span>
                  <span>version: {result.data.version}</span>
                  <span>time: {result.data.timestamp}</span>
                </div>
              </>
            ) : (
              <p className="text-rose-400">
                Lỗi kết nối tới {loaderData.apiBase}/api/hello: {result.error}
              </p>
            )}
          </div>

          <form
            className="flex flex-col sm:flex-row gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void handlePingBackend(unitName);
            }}
          >
            <Input
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="Nhập tên xã/phường hoặc phòng chuyên môn..."
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Send className="h-4 w-4" />
              {loading ? "Đang gửi..." : "Gửi chào Backend"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void handlePingBackend("")}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Mặc định
            </Button>
          </form>
        </CardContent>

        <CardFooter className="text-xs text-slate-500 border-t pt-4">
          Frontend: http://localhost:5173 · Proxy /api → Backend FastAPI:
          http://127.0.0.1:8000
        </CardFooter>
      </Card>
    </main>
  );
}
