import type {
  AuditCriterion,
  AuthorityMode,
  DepartmentId,
  DocTier,
  SessionProcessAction,
} from "./api.ts";

export const ADMIN_DOC_TYPES = [
  "Công văn",
  "Kế hoạch",
  "Báo cáo",
  "Quyết định",
  "Thông báo",
  "Tờ trình",
] as const;

export const AUTHORITY_MODES: readonly {
  id: AuthorityMode;
  label: string;
  hint: string;
}[] = [
  {
    id: "auto",
    label: "Tự động theo loại văn bản",
    hint: "AI tự chọn thể thức ký theo loại văn bản hành chính",
  },
  {
    id: "ubnd",
    label: "Tập thể UBND (TM. ỦY BAN NHÂN DÂN)",
    hint: "Thẩm quyền chung của Ủy ban nhân dân cấp xã, phường",
  },
  {
    id: "chu_tich",
    label: "Cá nhân Chủ tịch UBND",
    hint: "Thẩm quyền riêng của Chủ tịch UBND cấp xã, phường",
  },
] as const;

export interface SampleDossierFile {
  filename: string;
  content: string;
}

export interface DepartmentSampleDossier {
  departmentId: DepartmentId;
  label: string;
  summary: string;
  files: readonly [SampleDossierFile, SampleDossierFile];
}

export const DEPARTMENT_SAMPLE_DOSSIERS: Record<
  DepartmentId,
  DepartmentSampleDossier
> = {
  VP: {
    departmentId: "VP",
    label: "Hồ sơ hộ tịch (Tờ khai vs Giấy tờ tùy thân)",
    summary: "Chênh lệch năm sinh, số CCCD và ngày đăng ký hộ tịch",
    files: [
      {
        filename: "01_To_khai_dang_ky_ho_tich_VP.txt",
        content: [
          "TỜ KHAI ĐĂNG KÝ KHAI SINH / HỘ TỊCH",
          "Họ và tên: Lê Văn Bình.",
          "Ngày tháng năm sinh: 15/06/1991.",
          "Số CCCD: 001091012345.",
          "Nơi thường trú: Tổ dân phố số 04, phường Trung Tâm.",
          "Ngày nộp tờ khai: 12/11/2026.",
        ].join("\n"),
      },
      {
        filename: "02_Ban_sao_giay_to_tuy_than_VP.txt",
        content: [
          "BẢN SAO TRÍCH LỤC CĂN CƯỚC CÔNG DÂN & GIẤY TỜ TÙY THÂN",
          "Họ và tên: Lê Văn Bình.",
          "Ngày tháng năm sinh: 15/06/1992.",
          "Số CCCD: 001092012349.",
          "Nơi thường trú: Tổ dân phố số 04, phường Trung Tâm.",
          "Ngày đối chiếu bản chính: 15/11/2026.",
        ].join("\n"),
      },
    ],
  },
  KT: {
    departmentId: "KT",
    label: "Hồ sơ quyết toán sửa chữa nhà văn hóa thôn",
    summary: "Chênh lệch kinh phí 85.000.000 đồng vs 92.500.000 đồng và ngày nghiệm thu",
    files: [
      {
        filename: "01_Du_toan_sua_chua_nha_van_hoa_KT.txt",
        content: [
          "BẢNG DỰ TOÁN KINH PHÍ SỬA CHỮA NHÀ VĂN HÓA THÔN ĐÔNG",
          "Họ và tên: Trần Quốc Hưng.",
          "Địa chỉ: Nhà văn hóa thôn Đông.",
          "Số lượng hạng mục phê duyệt: 03 hạng mục.",
          "Tổng dự toán được duyệt: 85.000.000 đồng.",
          "Ngày phê duyệt dự toán: 10/11/2026.",
        ].join("\n"),
      },
      {
        filename: "02_Bien_ban_nghiem_thu_thanh_toan_KT.txt",
        content: [
          "BIÊN BẢN NGHIỆM THU KHỐI LƯỢNG & ĐỀ NGHỊ THANH TOÁN",
          "Họ và tên: Trần Quốc Hưng.",
          "Địa chỉ: Nhà văn hóa thôn Đông.",
          "Số lượng hạng mục kê khai quyết toán: 04 hạng mục.",
          "Tổng giá trị đề nghị thanh toán: 92.500.000 đồng.",
          "Ngày lập biên bản nghiệm thu: 17/11/2026.",
        ].join("\n"),
      },
    ],
  },
  VHXH: {
    departmentId: "VHXH",
    label: "Hồ sơ xét hưởng trợ cấp bảo trợ xã hội",
    summary: "Chênh lệch số CCCD, mức trợ cấp hàng tháng và ngày sinh đối tượng",
    files: [
      {
        filename: "01_Don_de_nghi_huong_tro_cap_BTXH_VHXH.txt",
        content: [
          "ĐƠN ĐỀ NGHỊ HƯỞNG TRỢ CẤP BẢO TRỢ XÃ HỘI HÀNG THÁNG",
          "Người đề nghị: Nguyễn Thị Hoa.",
          "Ngày tháng năm sinh: 14/05/1944.",
          "Số CCCD: 038144005678.",
          "Nơi thường trú: Thôn Bắc Sơn.",
          "Hệ số trợ cấp đề nghị: 1.5 — mức hưởng 750.000 đồng.",
          "Ngày viết đơn: 05/11/2026.",
        ].join("\n"),
      },
      {
        filename: "02_Bien_ban_hop_xet_duyet_thon_VHXH.txt",
        content: [
          "BIÊN BẢN HỌP BÌNH XÉT ĐỐI TƯỢNG BẢO TRỢ XÃ HỘI CẤP THÔN",
          "Họ và tên: Nguyễn Thị Hoa.",
          "Ngày tháng năm sinh: 14/08/1945.",
          "Số CCCD: 038145005679.",
          "Nơi thường trú: Thôn Bắc Sơn.",
          "Hệ số trợ cấp đề xuất: 2.0 — mức hưởng 1.000.000 đồng.",
          "Ngày họp xét duyệt: 11/11/2026.",
        ].join("\n"),
      },
    ],
  },
  NNMT: {
    departmentId: "NNMT",
    label: "Hồ sơ xác nhận nguồn gốc đất & đo đạc thực địa",
    summary: "Chênh lệch diện tích 120 m2 vs 145 m2, số thửa và ngày đo đạc",
    files: [
      {
        filename: "01_Don_xac_nhan_nguon_goc_dat_NNMT.txt",
        content: [
          "ĐƠN ĐỀ NGHỊ XÁC NHẬN NGUỒN GỐC ĐẤT & HÒA GIẢI RANH GIỚI",
          "Chủ sử dụng đất: Nguyễn Văn An.",
          "Số CCCD: 001085009876.",
          "Địa chỉ: Thôn Nam Tiến.",
          "Tờ bản đồ số: 08 — Thửa đất số: 42.",
          "Diện tích kê khai trong đơn: 120 m2.",
          "Ngày viết đơn đề nghị: 10/11/2026.",
        ].join("\n"),
      },
      {
        filename: "02_Bien_ban_do_dac_hien_trang_NNMT.txt",
        content: [
          "BIÊN BẢN ĐO ĐẠC HIỆN TRẠNG SỬ DỤNG ĐẤT THỰC ĐỊA",
          "Chủ sử dụng đất: Nguyễn Văn An.",
          "Số CCCD: 001085009876.",
          "Địa chỉ: Thôn Nam Tiến.",
          "Tờ bản đồ số: 08 — Thửa đất số: 45.",
          "Diện tích đo đạc thực địa: 145 m2.",
          "Ngày đo đạc lập biên bản: 16/11/2026.",
        ].join("\n"),
      },
    ],
  },
};

export const SESSION_PROCESS_TABS: readonly {
  id: SessionProcessAction;
  label: string;
  description: string;
}[] = [
  {
    id: "tom_tat",
    label: "Tóm tắt hồ sơ",
    description: "Tóm tắt nội dung cốt lõi của từng tài liệu trong phiên",
  },
  {
    id: "trich_xuat",
    label: "Trích xuất dữ liệu",
    description: "Trích xuất mốc ngày tháng, số liệu định lượng và thông tin chính",
  },
  {
    id: "doi_chieu",
    label: "Đối chiếu mâu thuẫn",
    description: "Phát hiện chênh lệch số liệu, diện tích, ngày tháng giữa các tệp",
  },
  {
    id: "tong_hop",
    label: "Tổng hợp phiếu trình",
    description: "Hình thành phiếu tổng hợp hồ sơ trình Lãnh đạo UBND",
  },
] as const;

export function applyAuthoritySignerOverride(
  draftText: string,
  authorityMode: AuthorityMode,
): string {
  if (!draftText || authorityMode === "auto") {
    return draftText;
  }
  if (authorityMode === "ubnd") {
    let updated = draftText.replace(
      /\nCHỦ TỊCH ỦY BAN NHÂN DÂN ([^\n]+)\n\nCăn cứ /g,
      "\nỦY BAN NHÂN DÂN $1\n\nCăn cứ ",
    );
    if (/TM\.\s*ỦY BAN NHÂN DÂN/.test(updated)) {
      return updated;
    }
    if (/KT\.\s*CHỦ TỊCH/.test(updated)) {
      return updated
        .replace(/KT\.\s*CHỦ TỊCH/g, "TM. ỦY BAN NHÂN DÂN")
        .replace(/(^|\n)(\s*)PHÓ CHỦ TỊCH(\s*(?:\n|$))/g, "$1$2CHỦ TỊCH$3");
    }
    return updated.replace(
      /(Nơi nhận:\s+)(CHỦ TỊCH)/g,
      "$1TM. ỦY BAN NHÂN DÂN\n                                       CHỦ TỊCH",
    );
  }
  // authorityMode === "chu_tich"
  let updated = draftText.replace(
    /\nỦY BAN NHÂN DÂN ([^\n]+)\n\nCăn cứ /g,
    "\nCHỦ TỊCH ỦY BAN NHÂN DÂN $1\n\nCăn cứ ",
  );
  return updated
    .replace(
      /TM\.\s*ỦY BAN NHÂN DÂN\s*\r?\n\s*CHỦ TỊCH/g,
      "CHỦ TỊCH",
    )
    .replace(/TM\.\s*ỦY BAN NHÂN DÂN\s*/g, "")
    .replace(
      /KT\.\s*CHỦ TỊCH\s*\r?\n\s*PHÓ CHỦ TỊCH/g,
      "CHỦ TỊCH",
    )
    .replace(/KT\.\s*CHỦ TỊCH/g, "CHỦ TỊCH")
    .replace(/\r?\n[ \t]*PHÓ CHỦ TỊCH(?=\s*(?:\r?\n|$))/g, "");
}

export function buildM06TaskHandoffUrl(opts: {
  deptId: DepartmentId;
  title: string;
  desc?: string;
  ref?: string;
}): string {
  const params = new URLSearchParams();
  params.set("dept", opts.deptId);
  params.set("newTask", "1");
  params.set("title", opts.title.trim().slice(0, 220));
  if (opts.desc?.trim()) {
    params.set("desc", opts.desc.trim().slice(0, 600));
  }
  if (opts.ref?.trim()) {
    params.set("ref", opts.ref.trim().slice(0, 120));
  }
  return `/dieu-hanh-cong-viec?${params.toString()}`;
}

export function formatTierLabel(tier: DocTier | string): string {
  if (tier === "trung_uong") return "Văn bản Trung ương";
  if (tier === "dia_phuong") return "Văn bản Địa phương";
  if (tier === "kho_rieng") return "Kho dữ liệu riêng";
  return tier;
}

export function formatAuditStatusLabel(
  status: AuditCriterion["status"],
): string {
  if (status === "dat") return "Đạt chuẩn";
  if (status === "can_ra_soat") return "Cần rà soát";
  return "Không đạt";
}
