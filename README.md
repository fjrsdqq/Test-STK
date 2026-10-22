# Menu Tree System

Monorepo untuk sistem menu hierarkis. Backend menggunakan Go, Gin, GORM, PostgreSQL, golang-migrate, dan Swagger. Frontend disiapkan sebagai placeholder untuk tahap berikutnya.

## Setup Backend

Persyaratan: Go 1.22+ dan Docker Compose.

1. Jalankan PostgreSQL: `docker compose -f docker-compose.dev.yml up -d`
2. Salin `backend/.env.example` ke `backend/.env`, lalu sesuaikan nilainya bila perlu.
3. Dari folder `backend`, jalankan `go mod tidy` lalu `go run ./cmd/server`. Migrasi SQL dijalankan otomatis saat aplikasi mulai.
4. Buka Swagger di `http://localhost:8080/swagger/index.html`.

Konfigurasi database dibaca dari `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; port HTTP dan mode aplikasi memakai `APP_PORT` dan `APP_ENV`. Environment proses memiliki prioritas atas file `.env`. Migrasi tersedia di `backend/migrations` dan dijalankan otomatis oleh server menggunakan golang-migrate.

Jalankan pemeriksaan dari folder `backend` dengan `go test ./...` dan `go vet ./...`.

## API

Semua endpoint diawali `/api`. Menu memiliki UUID, nama, parent opsional, posisi saudara, serta children nested. Contoh:

```sh
curl http://localhost:8080/api/menus
curl http://localhost:8080/api/menus/00000000-0000-0000-0000-000000000001
curl -X POST http://localhost:8080/api/menus -H 'Content-Type: application/json' -d '{"name":"Products"}'
curl -X PUT http://localhost:8080/api/menus/00000000-0000-0000-0000-000000000001 -H 'Content-Type: application/json' -d '{"name":"Catalog"}'
curl -X DELETE http://localhost:8080/api/menus/00000000-0000-0000-0000-000000000001
```

