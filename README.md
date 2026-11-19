# Bộ Trợ lý AI UBND Xã, Phường — Frontend (`ubnd-ai-frontend`)

Ứng dụng giao diện 7 phân hệ nghiệp vụ UBND cấp xã, phường xây dựng trên **React Router v8.5 SSR**, **React 19**, **TypeScript** và **Tailwind CSS v4**.

## Deploy miễn phí trên Vercel (`congtytnhhdaututh79-s-projects`) + Backend Render

Repo đã tích hợp sẵn [`vercel.json`](./vercel.json), [`api/ssr.js`](./api/ssr.js) và route proxy dự phòng `/api/*` (`app/routes/api-proxy.ts`):
1. Truy cập `https://vercel.com/congtytnhhdaututh79-s-projects` → **Add New... → Project**.
2. Chọn GitHub repository `LuongCaoChanHuyIT/ubnd-ai-frontend` (nhánh `main`, Framework Preset để **Other** theo `vercel.json`).
3. Thêm biến môi trường:
   - `API_BASE_URL=https://<service-backend>.onrender.com`
   - `VITE_API_BASE_URL=https://<service-backend>.onrender.com` *(hỗ trợ upload trực tiếp tệp PDF/DOCX tới 10 MB lên Render; nếu để trống hệ thống vẫn tự động chuyển tiếp qua `/api/*` SSR proxy).*
4. Bấm **Deploy**.

## Deploy bằng Docker trên Render.com (`render.yaml`) hoặc VPS

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://ubnd-ai-backend.onrender.com \
  -t ubnd-ai-frontend .

docker run -d \
  --name ubnd-ai-frontend \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e API_BASE_URL=https://ubnd-ai-backend.onrender.com \
  ubnd-ai-frontend
```

## Cài đặt & Kiểm thử Local

```bash
cp .env.example .env
npm ci
npm test
npm run typecheck
npm run dev
```
