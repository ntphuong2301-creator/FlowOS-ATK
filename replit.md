# FlowOS Workspace

## Overview

FlowOS - Ứng dụng quản lý dự án và công việc fullstack với giao diện tiếng Việt.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **State management**: Zustand
- **Data fetching**: TanStack React Query
- **Charts**: Recharts
- **Flow editor**: ReactFlow
- **Drag & drop**: @hello-pangea/dnd
- **Auth**: JWT (bcryptjs + jsonwebtoken)
- **Real-time**: Socket.IO
- **AI**: Anthropic Claude

## Color Theme

Primary color: **#008264** (green)

## Structure

```text
workspace/
├── artifacts/
│   ├── api-server/         # Express 5 API server
│   └── flowos/             # React + Vite frontend (serves at /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- **users** - người dùng (id, name, email, passwordHash, avatar, role)
- **projects** - dự án (id, name, description, color, status, ownerId)
- **project_members** - thành viên dự án
- **tasks** - công việc (id, title, description, status, priority, projectId, assigneeId, dueDate, tags)
- **flows** - sơ đồ quy trình (id, name, description, projectId, ownerId, nodes, edges)
- **ai_messages** - lịch sử chat AI
- **notifications** - thông báo

## Tài khoản ATK

- Admin: `admin@atk.com` / `admin123`
- Thành viên: `<lark-slug>@atk.com` / `Atk@2026`
- JWT_SECRET: `flowos-atk-secret-key-2026` (lưu trong localStorage key `auth-token`)

## API Routes — ATK Prisma (port 8080)

### Sản phẩm (13 SKU)
- `GET /api/san-pham` - Danh sách + % tiến độ realtime (query: kenh=HT|TT)
- `GET /api/san-pham/tong-quan` - CEO dashboard summary
- `GET /api/san-pham/:id/tien-do` - Chi tiết 5 nhóm (RD/Nắp/BaoBi/PhápChế/SXCN)
- `GET /api/san-pham/:id/buoc-chi-tiet` - Danh sách Buoc theo nhóm (cho panel)
- `POST /api/san-pham/:id/goi-y-buoc-tiep` - AI gợi ý bước tiếp (Anthropic + fallback)

### Tiến độ (TiendoService — KHÔNG lưu vào DB)
- Trọng số: R&D 30% | Nắp 25% | Bao bì 20% | Pháp chế 15% | SXCN 10%
- Tính realtime từ TrangThaiBuoc (XONG/DANG_LAM/BI_CHAN/CHUA_LAM)
- Prefix mã bước: RD* | NAP* | BBC* | BBNH* | PCSPB* | SXCN*

### Dự án / Bước / Công việc
- `GET /api/du-an` / `GET /api/du-an/:id`
- `GET /api/cong-viec` / `PATCH /api/cong-viec/:id`
- `GET /api/cong-viec/:id` - Chi tiết task + upstream/downstream links
- `GET /api/cong-viec/:id/dependency` - Upstream + Downstream + cột mốc bị ảnh hưởng (soNgayTreHienTai)
- `POST /api/cong-viec/:id/cap-nhat-timeline` - Cập nhật hạn mới + tính impact toàn chuỗi
- `POST /api/cong-viec/:id/confirm-impact` - Batch update downstream + gửi Lark notification
- `GET /api/dong-chay` - Gantt swimlane (filter kenh/sanPhamId)
- `GET /api/dong-chay/buoc/:id` - Chi tiết bước + congViec.phuThuocVao (cross-buoc deps)
- `GET /api/buoc/dependencies` - Lấy tất cả liên kết giữa các bước (PhuThuocBuoc, map fromBuocId/toBuocId)
- `POST /api/buoc/dependencies` - Tạo liên kết mới (cycle check trực tiếp), yêu cầu đăng nhập
- `DELETE /api/buoc/dependencies/:depId` - Xóa liên kết theo id
- `GET /api/ban-do-nut-chan` - CPM full critical path (ES/EF/LS/LF/float)
- `POST /api/ban-do-nut-chan/:id/goi-y` - AI gợi ý giải quyết nút chặn (Anthropic + fallback)
- `GET/POST/PUT /api/can-tro` - Quản lý cản trở
- `GET /api/nguoi-dung` - Danh sách người dùng

### Auth
- `POST /api/xac-thuc/dang-nhap` - Login → JWT
- `GET /api/xac-thuc/toi` - Thông tin user hiện tại

## Frontend Pages (artifacts/flowos)

- `/` → redirect sau login
- `/san-pham` - 13 SKU grid, 3 tab kênh, filter trạng thái, search, panel chi tiết + AI
- `/dong-chay-du-an` - Gantt view theo Buoc (drag-resize), filter Kênh/Sản phẩm; click task → PanelChiTietCongViec
- `/ban-do-nut-chan` - ReactFlow CPM blocker tree (admin only), AI gợi ý + forecast unblock
- Sidebar: icon 56px → 220px hover, Zapier-style

## Frontend Components mới

- `PanelChiTietCongViec.tsx` — Panel trượt từ phải (520px), 2 tab:
  - Tab "Chi tiết": info block, cản trở
  - Tab "Liên kết & Tác động": upstream/downstream, cột mốc, flow cập nhật hạn 5-bước, Lark notification

## Services Backend

- `dependency.service.ts` — DependencyService: đệ quy upstream/downstream, tính timeline impact
- `lark.service.ts` — guiThongBaoTimeline: DM Lark khi task ảnh hưởng, gửi SOS group nếu launch bị ảnh hưởng

## Schema Mới (migration 20260326)

- `PhuThuocCongViec`: thêm `loai LoaiPhuThuocCongViec` (FINISH_TO_START | START_TO_START) + `soNgayBuffer Int`
- `CongViec`: thêm `ngayKetThucThucTe DateTime?`
- Enum mới: `LoaiPhuThuocCongViec`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

- Run codegen: `pnpm --filter @workspace/api-spec run codegen`
- Push DB schema: `pnpm --filter @workspace/db run push`
- Build API: `pnpm --filter @workspace/api-server run build`
