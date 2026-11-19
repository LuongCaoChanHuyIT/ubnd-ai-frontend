# Bộ Trợ lý AI UBND Xã, Phường — Frontend (`ubnd-ai-frontend`)

Ứng dụng giao diện 7 phân hệ nghiệp vụ UBND cấp xã, phường xây dựng trên **React Router v8.5 SSR**, **React 19**, **TypeScript** và **Tailwind CSS v4**.

## Yêu cầu môi trường

- Node.js `22+`
- Kết nối tới dịch vụ Backend FastAPI (`ubnd-ai-backend`)

## Cài đặt & Chạy môi trường phát triển

```bash
cp .env.example .env
npm ci
npm run dev
```

Mặc định trình duyệt chạy tại `http://localhost:5173` và proxy `/api` về `http://127.0.0.1:8000`.

## Biến môi trường khi Deploy

| Biến | Vai trò | Ví dụ |
| :--- | :--- | :--- |
| `PORT` | Cổng lắng nghe của tiến trình SSR | `3000` |
| `API_BASE_URL` | Địa chỉ Backend để SSR server gọi trực tiếp | `http://127.0.0.1:8000` hoặc `https://api.tenmien.vn` |
| `VITE_API_BASE_URL` | Địa chỉ Backend để trình duyệt gọi khi Frontend & Backend **khác domain/port** (cài lúc `npm run build`). Để rỗng nếu chạy chung sau Nginx cùng domain | `https://api.tenmien.vn` hoặc `""` |

## Build & Chạy Production (Node.js trực tiếp)

```bash
VITE_API_BASE_URL=https://api.tenmien.vn npm ci
VITE_API_BASE_URL=https://api.tenmien.vn npm run build

NODE_ENV=production PORT=3000 API_BASE_URL=https://api.tenmien.vn npm run start
```

## Deploy bằng Docker

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.tenmien.vn \
  -t ubnd-ai-frontend .

docker run -d \
  --name ubnd-ai-frontend \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e API_BASE_URL=https://api.tenmien.vn \
  ubnd-ai-frontend
```

## Kiểm thử

```bash
npm test
npm run typecheck
```
