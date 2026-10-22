# Fullstack Menu Tree System

Aplikasi untuk mengelola menu hierarkis dengan kedalaman tanpa batas. Backend menggunakan Go, Gin, GORM, PostgreSQL, dan golang-migrate. Frontend menggunakan Next.js App Router, TypeScript, Tailwind CSS, Zustand, dan Lucide.

## Fitur

- Tree menu tersarang dan pengurutan posisi saudara.
- CRUD menu; menghapus menu turut menghapus seluruh keturunannya.
- Endpoint untuk memindahkan menu dan mengubah urutan saudara.
- Drag-and-drop untuk mengurutkan menu atau menjadikannya child dari menu lain.
- Validasi request, format error konsisten, dan dokumentasi Swagger.
- Frontend responsif dengan pencarian, expand/collapse, dialog konfirmasi, loading, dan error state.

## Persyaratan

- Go 1.22 atau lebih baru.
- Node.js 20.9 atau lebih baru dan npm.
- Docker Desktop/Docker Compose untuk database lokal, atau PostgreSQL yang sudah tersedia.

## Development

### Jalankan seluruh stack dengan Docker

```sh
docker compose -f docker-compose.dev.yml up --build
```

Perintah tersebut menjalankan PostgreSQL, backend Go dengan hot reload (Air), dan frontend Next.js dengan hot reload. Buka `http://localhost:3000`; API ada di `http://localhost:8080`. Data PostgreSQL disimpan di volume Docker.

```sh
docker compose -f docker-compose.dev.yml down
```

Tambahkan `-v` hanya jika ingin menghapus volume database development.

### Jalankan service secara lokal

### 1. Jalankan PostgreSQL

Dari root repo:

```sh
docker compose -f docker-compose.dev.yml up -d postgres
```

Compose menerbitkan PostgreSQL pada `localhost:5433` dan menyimpan data di volume `postgres_data`.

### 2. Jalankan backend

```sh
cp backend/.env.example backend/.env
cd backend
go run ./cmd/server
```

Backend menjalankan migrasi SQL dari `backend/migrations` ketika mulai. Salin template env sebelum menjalankan; nilainya memakai port host `5433` dari Compose.

### 3. Jalankan frontend

Di terminal lain:

```sh
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Buka `http://localhost:3000`. `NEXT_PUBLIC_API_URL` mengarah ke `http://localhost:8080/api` secara default.

Daftar origin backend diatur melalui `CORS_ALLOWED_ORIGINS` sebagai daftar origin dipisahkan koma. Default lokal adalah `http://localhost:3000`; wildcard tidak diterima.

## Production build lokal

Siapkan PostgreSQL production dan isi environment backend dengan kredensial serta host database yang sesuai. Jangan gunakan kredensial development di deployment.

Backend, dari folder `backend` agar direktori migrasi ditemukan:

```sh
go build -o menu-tree-server ./cmd/server
./menu-tree-server
```

Frontend:

```sh
cd frontend
npm ci
npm run build
npm run start
```

Atur `NEXT_PUBLIC_API_URL` sebelum build frontend dan arahkan ke URL API yang dapat diakses browser.

## API dan dokumentasi

Swagger UI tersedia saat backend berjalan di `http://localhost:8080/swagger/index.html`. Health check tersedia di `/health`.

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/menus` | Daftar seluruh menu sebagai tree |
| GET | `/api/menus/:id` | Menu beserta keturunannya |
| POST | `/api/menus` | Membuat menu (`name`, opsional `parent_id`) |
| PUT | `/api/menus/:id` | Mengubah nama menu |
| DELETE | `/api/menus/:id` | Menghapus menu dan keturunannya |
| PATCH | `/api/menus/:id/move` | Memindahkan menu ke parent/posisi lain |
| PATCH | `/api/menus/:id/reorder` | Mengubah posisi dalam tingkat yang sama |

Error API berbentuk `{ "error": { "code", "message", "details" } }`. Status yang umum: 400 untuk request/UUID tidak valid, 404 untuk menu tidak ditemukan, 409 untuk pemindahan yang membuat siklus, 422 untuk validasi, dan 500 untuk kesalahan internal.

Contoh membuat menu root:

```sh
curl -X POST http://localhost:8080/api/menus \
  -H 'Content-Type: application/json' \
  -d '{"name":"Products"}'
```

## Pengujian dan pemeriksaan

```sh
cd backend
go test ./...
go vet ./...

cd ../frontend
npm run lint
npm exec -- tsc --noEmit
npm run build
```

Repository integration test untuk move/reorder membutuhkan PostgreSQL dan `MENU_TEST_DATABASE_URL`; tanpa variabel tersebut tes integrasi dilewati. Tes frontend E2E menggunakan Playwright dan API mock:

```sh
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

Screenshot UI hasil E2E: [desktop](docs/screenshots/menu-tree-desktop.png) dan [mobile](docs/screenshots/menu-tree-mobile.png).

## Database dan migrasi

Schema didefinisikan pada `backend/migrations`. Migrasi dijalankan otomatis oleh backend saat startup. Database menggunakan UUID, foreign key parent dengan cascade delete, dan posisi saudara.

## Docker production

Salin `deploy/production.env.example` ke `.env` di root repo, lalu ganti password dan domain contoh. `NEXT_PUBLIC_API_URL` harus berupa URL API yang dapat diakses browser pengguna; `CORS_ALLOWED_ORIGINS` harus memuat origin frontend yang persis. Setelah itu:

```sh
docker compose up --build -d
```

Compose production membangun image multi-stage untuk backend/frontend dan mempertahankan data PostgreSQL dalam volume. TLS dan routing domain perlu disediakan oleh reverse proxy atau platform deployment.
