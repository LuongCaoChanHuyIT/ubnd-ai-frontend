import type { AssistantMode, DepartmentId, ExtendedOption } from "./api.ts";

export interface ModeCardMeta {
  id: AssistantMode;
  title: string;
  badge: string;
  description: string;
}

export const ASSISTANT_MODES: readonly ModeCardMeta[] = [
  {
    id: "soan_thao",
    title: "Soạn thảo nhanh",
    badge: "SOẠN THẢO",
    description:
      "Soạn mới, chỉnh sửa văn bản và xử lý công việc thông thường không cần viện dẫn pháp lý.",
  },
  {
    id: "nghiep_vu",
    title: "Tư vấn nghiệp vụ",
    badge: "NGHIỆP VỤ",
    description:
      "Kiểm tra nguồn pháp lý hiện hành và đề xuất hướng xử lý công việc.",
  },
  {
    id: "tham_dinh",
    title: "Thẩm định chuyên sâu",
    badge: "THẨM ĐỊNH",
    description:
      "Đối chiếu căn cứ, thẩm quyền, logic và rủi ro của hồ sơ, dự thảo.",
  },
] as const;

export const DEPARTMENT_STARTERS: Record<
  DepartmentId,
  readonly { label: string; mode: AssistantMode; prompt: string }[]
> = {
  VP: [
    {
      label: "Xử lý hồ sơ",
      mode: "nghiep_vu",
      prompt:
        "Hướng dẫn quy trình tiếp nhận, số hóa hồ sơ hộ tịch và tái sử dụng dữ liệu theo Nghị định 399/2026/NĐ-CP.",
    },
    {
      label: "Soạn văn bản",
      mode: "soan_thao",
      prompt:
        "Soạn thông báo lịch tiếp công dân định kỳ của Chủ tịch UBND phường trong tháng 11/2026.",
    },
    {
      label: "Kiểm tra thẩm quyền",
      mode: "tham_dinh",
      prompt:
        "Phân biệt thẩm quyền ban hành văn bản giữa tập thể UBND cấp xã và Chủ tịch UBND cấp xã theo Luật Tổ chức chính quyền địa phương.",
    },
  ],
  KT: [
    {
      label: "Xử lý hồ sơ",
      mode: "nghiep_vu",
      prompt:
        "Quy trình rà soát chứng từ đề nghị thanh toán chi thường xuyên ngân sách cấp xã cần đối chiếu những tài liệu nào?",
    },
    {
      label: "Soạn văn bản",
      mode: "soan_thao",
      prompt:
        "Soạn công văn đôn đốc các bộ phận gửi dự toán kinh phí hoạt động năm 2027.",
    },
    {
      label: "Kiểm tra thẩm quyền",
      mode: "tham_dinh",
      prompt:
        "Thẩm định thẩm quyền quyết định điều chỉnh dự toán ngân sách cấp xã trình HĐND cùng cấp.",
    },
  ],
  VHXH: [
    {
      label: "Xử lý hồ sơ",
      mode: "nghiep_vu",
      prompt:
        "Hướng dẫn rà soát điều kiện, hồ sơ đề nghị hưởng trợ cấp bảo trợ xã hội hàng tháng tại cấp xã.",
    },
    {
      label: "Soạn văn bản",
      mode: "soan_thao",
      prompt:
        "Soạn kế hoạch tuyên truyền xây dựng đời sống văn hóa khu dân cư cuối năm 2026.",
    },
    {
      label: "Kiểm tra thẩm quyền",
      mode: "tham_dinh",
      prompt:
        "Thẩm định danh sách rà soát hộ cận nghèo và quy trình niêm yết công khai tại trụ sở UBND.",
    },
  ],
  NNMT: [
    {
      label: "Xử lý hồ sơ",
      mode: "nghiep_vu",
      prompt:
        "Quy định thời hạn và thành phần hội đồng hòa giải tranh chấp đất đai tại UBND cấp xã theo Luật Đất đai 2024.",
    },
    {
      label: "Soạn văn bản",
      mode: "soan_thao",
      prompt:
        "Soạn thông báo mời các hộ liền kề tham gia buổi xác minh thực địa ranh giới thửa đất.",
    },
    {
      label: "Kiểm tra thẩm quyền",
      mode: "tham_dinh",
      prompt:
        "Thẩm định quy trình xác nhận nguồn gốc sử dụng đất và hiện trạng không có tranh chấp tại cấp xã.",
    },
  ],
};

export function buildM03HandoffUrl(
  departmentId: DepartmentId,
  topic: string,
  option: ExtendedOption,
): string {
  const params = new URLSearchParams();
  params.set("dept", departmentId);
  params.set("docType", "Kế hoạch");
  params.set("title", `${topic.trim()} (${option.code})`);
  const points = [option.summary, ...option.pros].join("; ");
  params.set("points", points);
  return `/soan-thao-kiem-tra?${params.toString()}`;
}

