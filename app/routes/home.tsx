import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, CheckCircle2, RefreshCw, Send, ServerCrash } from "lucide-react";
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
import { CivicCrest } from "~/components/workspace/civic-crest";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chẩn đoán kết nối hệ thống — Bộ Trợ lý AI UBND Xã, Phường" },
    {
      name: "description",
      content: "Kiểm tra kết nối trực tiếp giữa giao diện SSR và dịch vụ FastAPI Backend",
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
    <main className="min-h-screen bg-[#F6F7F9] flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-xs border-slate-200 border-t-4 border-t-[#B45309]">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <CivicCrest />
              <div>
                <p className="text-xs font-semibold text-[#1B4D89]">
                  Chẩn đoán hạ tầng kết nối
                </p>
                <CardTitle className="text-xl font-bold text-slate-900">
                  Bộ Trợ lý AI UBND Xã, Phường
                </CardTitle>
              </div>
            </div>

            {result.connected ? (
              <Badge className="bg-emerald-700 hover:bg-emerald-700 text-white gap-1.5 tabular-nums">
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                Đã kết nối FastAPI ({result.latencyMs}&nbsp;ms)
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1.5">
                <ServerCrash aria-hidden="true" className="h-3.5 w-3.5" />
                Chưa kết nối Backend
              </Badge>
            )}
          </div>
          <CardDescription className="text-slate-600">
            Kiểm tra đường truyền trực tiếp giữa giao diện điều hành và dịch vụ
            FastAPI qua điểm cuối <code translate="no">/api/hello</code>.
          </CardDescription>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6 space-y-5">
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-slate-800 bg-[#0C1E35] text-slate-50 p-4 font-mono text-sm space-y-2"
          >
            {result.connected ? (
              <>
                <p className="text-emerald-300 font-semibold">
                  {result.data.message}
                </p>
                <div className="text-xs text-slate-300 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                  <span translate="no">service: {result.data.service}</span>
                  <span translate="no">version: {result.data.version}</span>
                  <span translate="no">time: {result.data.timestamp}</span>
                </div>
              </>
            ) : (
              <p className="text-rose-300">
                Không kết nối được tới {loaderData.apiBase}/api/hello: {result.error}
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
            <label htmlFor="hello-unit-input" className="sr-only">
              Tên đơn vị hành chính cần kiểm tra phản hồi
            </label>
            <Input
              id="hello-unit-input"
              name="unitName"
              autoComplete="off"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="Nhập tên xã, phường hoặc phòng chuyên môn…"
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#1B4D89] hover:bg-[#153E70] text-white gap-2"
            >
              <Send aria-hidden="true" className="h-4 w-4" />
              {loading ? "Đang gửi…" : "Gửi chào Backend"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void handlePingBackend("")}
              className="gap-2 border-slate-300"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Mặc định
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 flex-wrap text-xs text-slate-600 border-t pt-4">
          <Link
            to="/"
            viewTransition
            className="inline-flex items-center gap-1.5 font-medium text-[#1B4D89] hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            Mở không gian làm việc 7 phân hệ
          </Link>
          <span className="text-slate-500 tabular-nums" translate="no">
            API: {loaderData.apiBase}
          </span>
        </CardFooter>
      </Card>
    </main>
  );
}
