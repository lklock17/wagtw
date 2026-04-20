# WAGTW - Multi-Device WhatsApp API Gateway

WAGTW adalah solusi API Gateway WhatsApp Multi-Device tingkat produksi yang dibangun dengan Node.js, WPPConnect, dan Gemini AI.

## 🚀 Fitur Utama
- **Multi-Device Support**: Kelola banyak nomor WhatsApp dalam satu dashboard.
- **AI Auto Reply**: Integrasi Google Gemini AI untuk balasan otomatis yang cerdas.
- **Powerful API**: Endpoint RESTful untuk mengirim pesan (Text, Media, File, Bulk).
- **Inbox Management**: Pantau pesan masuk secara real-time dengan thread conversation.
- **Webhook System**: Terima notifikasi pesan masuk ke server Anda sendiri.
- **Admin Dashboard**: Panel modern berbasis React untuk manajemen perangkat, logs, dan template.

## 🛠️ Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **API**: Node.js + Express + TypeScript
- **Worker**: Node.js + WPPConnect
- **Database**: Neon Postgres (via Prisma)
- **AI**: Google Gemini API
- **Deployment**: Heroku (Backend/Worker), GitHub Pages (Admin)

## 📁 Struktur Folder
```text
wagtw/
├── apps/
│   ├── admin/      # Dashboard Admin (React)
│   ├── api/        # API Management (Express)
│   └── worker/      # WhatsApp Engine (WPPConnect)
├── packages/
│   └── database/   # Prisma Client & Shared Schema
└── docs/           # Dokumentasi API & Deployment
```

## 🚦 Memulai

1. **Clone & Install**:
   ```bash
   npm install
   ```

2. **Database Setup**:
   Copy `.env.example` ke `.env` di folder `packages/database` dan isi `DATABASE_URL`.
   ```bash
   npm run db:push
   ```

3. **Run Services**:
   ```bash
   # Jalankan semua secara paralel (membutuhkan turbo)
   npx turbo dev
   
   # Atau jalankan satu per satu
   npm run dev:api
   npm run dev:worker
   npm run dev:admin
   ```

## 📄 Dokumentasi
- [API Reference](docs/api.md)
- [Webhook Configuration](docs/webhook.md)
- [Deployment Guide](docs/deployment.md)
