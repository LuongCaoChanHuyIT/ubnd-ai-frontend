import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  MinusCircle,
  Sparkles,
} from "lucide-react";
import type { Route } from "./+types/m02-extended";
import {
  apiRequest,
  normalizeDepartmentId,
  type DepartmentId,
  type ExtendedAnalyzeResponse,
  type WorkspaceOutletContext,
} from "~/lib/api";
import { buildM03HandoffUrl } from "~/lib/m01-m02-helpers";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
import { FormattedMarkdown } from "~/components/ui/formatted-markdown";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Mô-đun 02 · AI kiến thức mở rộng — UBND Xã, Phường" }];
}

const SAMPLE_TOPICS: Record<DepartmentId, string> = {
  VP: "Nâng cao tỷ lệ hồ sơ trực tuyến toàn trình tại Bộ phận Một cửa UBND xã, phường năm 2026",
  KT: "Giải pháp tăng cường hiệu quả quản lý thu - chi ngân sách và hỗ trợ hộ kinh doanh chuyển đổi số",
  VHXH: "Mô hình phối hợp chi trả an sinh xã hội không dùng tiền mặt cho người cao tuổi và đối tượng bảo trợ",
  NNMT: "Giải pháp giám sát trật tự xây dựng và phân loại rác thải sinh hoạt tại nguồn cấp xã, phường",
};

export default function Module02ExtendedRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const outlet = useOutletContext<WorkspaceOutletContext | undefined>();
  const rawDept = normalizeDepartmentId(searchParams.get("dept"));
  const deptId =
    outlet?.currentUser?.role === "officer"
      ? outlet.currentUser.department_id
      : rawDept;

  const [topic, setTopic] = useState(SAMPLE_TOPICS[deptId]);
  const [context, setContext] = useState(
    "Địa bàn đông dân cư, khối lượng hồ sơ hành chính phát sinh hàng ngày lớn, cần phương án thiết thực.",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ExtendedAnalyzeResponse | null>(null);

  useEffect(() => {
    setTopic(SAMPLE_TOPICS[deptId]);
    setAnalysis(null);
  }, [deptId]);

  async function handleAnalyze(ev?: React.FormEvent) {
    ev?.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<ExtendedAnalyzeResponse>("/api/m02/analyze", {
        method: "POST",
        body: {
          department_id: deptId,
          topic: topic.trim(),
          context: context.trim(),
        },
      });
      setAnalysis(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể phân tích phương án");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Alert className="border-indigo-200 bg-indigo-50/80 text-indigo-950">
        <Compass className="h-4 w-4 text-indigo-600" />
        <AlertTitle className="text-sm font-bold">
          Mô-đun 02 · AI hỗ trợ kiến thức mở rộng (Ngoài kho văn bản nội bộ)
        </AlertTitle>
        <AlertDescription className="text-xs text-indigo-900/90">
          Dùng để tham khảo kinh nghiệm thực tiễn, phân tích nhiều phương án gợi mở
          phục vụ nghiên cứu tham mưu. Khi chuyển sang văn bản chính thức, vui lòng
          kiểm tra lại căn cứ tại Mô-đun 03 & Mô-đun 04.
        </AlertDescription>
      </Alert>

      <Card className="border-slate-200 shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg">
            Đặt chủ đề nghiên cứu & gợi mở đa phương án ({deptId})
          </CardTitle>
          <CardDescription>
            AI sẽ phân tích 03 phương án độc lập (Ưu điểm, Hạn chế, Tính khả thi cấp
            xã/phường) để cán bộ so sánh trước khi lập Kế hoạch hoặc Báo cáo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Chủ đề / Bài toán quản lý cần tham mưu
              </label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Nhập chủ đề cần phân tích phương án..."
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(Object.keys(SAMPLE_TOPICS) as DepartmentId[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTopic(SAMPLE_TOPICS[k])}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    Mẫu {k}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Đặc thù địa phương / Ràng buộc nguồn lực (tùy chọn)
              </label>
              <Textarea
                rows={2}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Ví dụ: Biên chế mỏng, ưu tiên phương án ít tốn kinh phí đầu tư mới..."
              />
            </div>

            {error && (
              <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !topic.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Đang phân tích 3 phương án..." : "Phân tích đa phương án"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {analysis && (
        <div className="space-y-4">
          {analysis.scope_notice && (
            <div className="rounded-lg border border-indigo-200 bg-white px-4 py-2.5">
              <FormattedMarkdown
                content={analysis.scope_notice}
                className="text-xs text-slate-700"
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {analysis.options.map((opt, idx) => (
              <Card
                key={opt.code}
                className={
                  idx === 2
                    ? "border-indigo-400 ring-1 ring-indigo-400/30 flex flex-col min-w-0"
                    : "border-slate-200 flex flex-col min-w-0"
                }
              >
                <CardHeader className="pb-3 space-y-2 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-1.5 min-w-0">
                    <Badge className="bg-indigo-600 text-white shrink-0">{opt.code}</Badge>
                    <Badge
                      variant="outline"
                      className="text-[11px] border-emerald-300 text-emerald-700 bg-emerald-50 whitespace-normal break-words text-left leading-snug h-auto py-0.5 max-w-full"
                    >
                      {opt.feasibility}
                    </Badge>
                  </div>
                  <CardTitle className="text-base leading-snug break-words">
                    {opt.title}
                  </CardTitle>
                  <div className="text-xs text-slate-600 min-w-0">
                    <FormattedMarkdown
                      content={opt.summary}
                      className="text-xs text-slate-600"
                    />
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3 text-xs">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-emerald-700">Ưu điểm nổi bật:</p>
                    {opt.pros.map((pro) => (
                      <div key={pro} className="flex items-start gap-1.5 text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <FormattedMarkdown content={pro} className="text-xs" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <p className="font-semibold text-amber-700">Lưu ý / Hạn chế:</p>
                    {opt.cons.map((con) => (
                      <div key={con} className="flex items-start gap-1.5 text-slate-700">
                        <MinusCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <FormattedMarkdown content={con} className="text-xs" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(buildM03HandoffUrl(deptId, analysis.topic, opt))
                    }
                    className="w-full gap-1.5 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  >
                    Chuyển sang dự thảo Kế hoạch
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
