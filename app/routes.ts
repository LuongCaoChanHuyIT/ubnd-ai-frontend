import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/workspace-layout.tsx", [
    index("routes/m01-assistant.tsx"),
    route("kien-thuc-mo-rong", "routes/m02-extended.tsx"),
    route("soan-thao-kiem-tra", "routes/m03-drafting.tsx"),
    route("nguon-van-ban", "routes/m04-official-docs.tsx"),
    route("xu-ly-tai-lieu", "routes/m05-doc-session.tsx"),
    route("dieu-hanh-cong-viec", "routes/m06-tasks.tsx"),
    route("quan-tri-he-thong", "routes/m07-admin.tsx"),
  ]),
  route("hello-check", "routes/home.tsx"),
  route("api/*", "routes/api-proxy.ts"),
] satisfies RouteConfig;
