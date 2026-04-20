# PROJECT PLAN
# Aplikasi WhatsApp API Gateway Multi Nomor
## untuk Notifikasi Website, Integrasi Sistem, Inbox Masuk, dan Auto Reply AI

**Nama Proyek**  
WhatsApp API Gateway Multi Nomor

**Tujuan**  
Gateway pengiriman dan penerimaan pesan WhatsApp dari website / aplikasi lain menggunakan nomor biasa, lengkap dengan inbox pesan masuk, auto reply AI Gemini, dan dokumentasi integrasi untuk client eksternal.

**Stack Utama**  
GitHub Pages, Heroku, Node.js, React, TypeScript, Neon Postgres, Prisma, Redis opsional, WPPConnect, Gemini API

**Model Deploy**  
Admin panel di GitHub Pages, backend REST API di Heroku, worker WhatsApp di Heroku, database terpisah di Neon Postgres

**Status Dokumen**  
Siap dijadikan acuan implementasi, prompt pengembangan, dan dasar starter project

---

> **Catatan penting:** arsitektur ini menggunakan nomor WhatsApp biasa (non-resmi / session-based). Karena itu sistem harus dirancang tahan terhadap logout, QR scan ulang, reconnect, session invalid, dan perubahan dari WhatsApp Web. Session dan data penting **tidak boleh** bergantung pada filesystem lokal Heroku karena dyno Heroku bersifat ephemeral.

---

## 1. Ringkasan Eksekutif

Proyek ini bertujuan membangun aplikasi **WhatsApp API Gateway multi nomor** yang mampu menangani banyak nomor WhatsApp biasa untuk kebutuhan notifikasi website, pengiriman pesan otomatis, integrasi sistem eksternal, penerimaan pesan masuk, dan auto reply berbasis AI.

Solusi dirancang **modular** agar beban aplikasi tidak menumpuk pada satu layanan saja. Arsitektur dipisah menjadi tiga lapisan utama:

1. **Admin Panel**  
   Untuk login admin, monitoring device, scan QR, melihat inbox, mengirim pesan manual, mengelola template, API key, client, rule auto reply, dan log sistem.

2. **Public API Backend**  
   Untuk menerima request dari website eksternal, memvalidasi API key, mencatat request, menyimpan data ke database, menyediakan endpoint status, dan mengatur komunikasi ke worker.

3. **WhatsApp Engine Worker**  
   Untuk mengelola session tiap nomor, koneksi WhatsApp, QR login, reconnect, kirim pesan, menerima pesan masuk, update inbox, trigger webhook, dan menjalankan auto reply Gemini.

Pendekatan ini membuat pengembangan lebih rapi, lebih mudah di-scale, lebih aman, dan lebih mudah di-maintain dibanding menaruh seluruh proses di satu aplikasi monolitik.

### Stack yang dipilih

- **GitHub Pages** untuk admin panel berbasis React + Vite karena ringan, murah, dan cocok untuk static build
- **Heroku** untuk backend REST API dan worker engine yang membutuhkan proses server berjalan
- **Neon Postgres** untuk database utama: user, device, client, inbox, thread, template, log, API key, webhook log, dan histori auto reply
- **Prisma ORM** untuk schema, migration, dan akses database yang rapi
- **Redis opsional** untuk antrean pesan, retry job, cooldown auto reply, dan pembagian beban kirim
- **WPPConnect** sebagai engine WhatsApp multi-session
- **Gemini API** untuk auto reply AI

---

## 2. Tujuan Bisnis dan Teknis

| Area | Deskripsi |
|---|---|
| Tujuan bisnis | Menyediakan pusat notifikasi dan inbox WhatsApp yang bisa dipakai banyak website atau aplikasi secara konsisten |
| Tujuan teknis | Membangun API gateway yang stabil, mudah dikelola, mendukung multi nomor, inbox masuk, dan auto reply AI |
| Target operasional | Admin dapat menambah device, scan QR, memantau status, melihat inbox, membalas pesan, mengirim pesan manual, dan melihat log tanpa akses server langsung |
| Target integrasi | Client eksternal cukup memakai API key dan endpoint HTTP untuk mengirim notifikasi dan menerima webhook |
| Target pengembangan | Fondasi cukup rapi untuk dikembangkan menjadi SaaS internal / eksternal |
| Target stabilitas | Sistem harus tahan terhadap QR ulang, reconnect, dyno restart, retry pengiriman, dan kegagalan session |

---

## 3. Arsitektur Sistem yang Direkomendasikan

### 3.1 Komponen utama

#### 1. Admin Panel (React + Vite di GitHub Pages)
Digunakan untuk:
- login admin
- monitoring device
- melihat QR
- reconnect / logout device
- melihat inbox thread dan detail pesan
- membalas pesan manual
- melihat outbox / message logs
- mengelola templates
- mengelola clients & API keys
- mengelola rule auto reply Gemini
- melihat audit log dan system settings

#### 2. Public API Backend (Node.js + Express di Heroku)
Digunakan untuk:
- menerima request dari website eksternal
- memvalidasi API key
- menyimpan request dan log
- menyediakan endpoint admin dan client
- menyimpan data ke Neon Postgres
- mengirim job / instruksi ke worker
- menyediakan endpoint status, health, inbox, dan message tracking

#### 3. WhatsApp Engine Worker (Node.js + WPPConnect di Heroku)
Digunakan untuk:
- mengelola multi-session WhatsApp
- membuat dan menjaga koneksi tiap device
- generate QR login
- reconnect / logout
- mengirim text, image, video, audio, dokumen, dan link
- menerima pesan masuk
- menyimpan pesan masuk ke database
- update inbox thread
- trigger inbound webhook ke client
- menjalankan auto reply Gemini
- update delivery status

#### 4. Database (Neon Postgres)
Digunakan untuk menyimpan:
- user admin
- devices
- clients
- API keys hash
- inbox threads
- inbox messages
- message logs
- templates
- auto reply rules
- API logs
- webhook logs
- system settings
- AI reply logs (opsional tabel terpisah)

#### 5. Queue / Cache (Redis opsional)
Digunakan untuk:
- antrean pengiriman
- retry job
- cooldown auto reply
- rate limiting tambahan
- job scheduling
- webhook retry

---

### 3.2 Alur kerja singkat

#### Alur outbound message
1. Website client mengirim request ke `api.domain.com` menggunakan API key
2. Backend memvalidasi key dan payload
3. Backend menyimpan log request dan membuat job pengiriman
4. Worker memilih device aktif yang sesuai
5. Worker mencoba mengirim pesan ke WhatsApp
6. Status sukses / gagal disimpan ke database
7. Jika webhook delivery aktif, backend / worker mengirim callback ke client
8. Admin bisa memantau seluruh proses dari panel admin

#### Alur inbound message
1. Pesan masuk diterima oleh worker dari event WPPConnect
2. Worker memverifikasi source, direction, dan type pesan
3. Worker menyimpan pesan masuk ke database
4. Worker mengupdate inbox thread
5. Worker mengirim inbound webhook ke client jika diaktifkan
6. Worker mengecek rule auto reply
7. Jika rule lolos, worker memanggil Gemini API
8. Balasan AI dikirim ke user
9. Seluruh log sukses / gagal disimpan ke database

#### Alur auto reply Gemini
1. Pesan masuk diterima
2. Sistem cek apakah auto reply aktif secara global / client / device
3. Sistem cek ignore list, allow list, keyword trigger, blocklist, cooldown, dan max reply
4. Jika lolos, pesan disusun menjadi prompt untuk Gemini
5. Gemini menghasilkan reply
6. Output disanitasi
7. Worker mengirim balasan
8. Log prompt dan response disimpan

---

## 4. Struktur Domain dan Deployment

| Subdomain / Service | Fungsi | Platform | Catatan |
|---|---|---|---|
| `admin.domain.com` atau GitHub Pages path | Dashboard admin | GitHub Pages | Frontend React static build |
| `api.domain.com` | REST API publik dan admin API | Heroku | Dipakai website / client eksternal |
| worker internal | Engine WhatsApp | Heroku | Tidak perlu diekspos penuh ke publik |
| Neon Postgres | Database utama | Managed | Data user, device, inbox, template, log |
| Redis opsional | Queue / cache | Managed | Retry, scheduling, cooldown |

> Jika memakai GitHub Pages tanpa custom subdomain dulu, admin panel bisa sementara dipasang di URL Pages repository.

---

## 5. Fitur Utama

### 5.1 Manajemen Device / Nomor
- tambah device baru
- generate dan tampilkan QR login
- rename device
- enable / disable device
- reconnect / logout device
- deteksi status:
  - connected
  - disconnected
  - qr_required
  - syncing
  - error
  - reconnecting
- last seen / heartbeat device
- assign device ke client tertentu bila diperlukan

### 5.2 Pengiriman Pesan
Sistem harus mendukung pengiriman:
- text biasa
- text + link
- image + caption
- video + caption
- audio
- file / dokumen
- PDF
- template text
- template media
- bulk message

Fitur tambahan:
- kirim per nomor tujuan
- kirim massal dari daftar nomor
- kirim berdasarkan template
- retry otomatis jika gagal
- fallback ke device lain jika device utama offline
- scheduling sederhana
- status tracking message

### 5.3 Penerimaan Pesan (Inbox)
- semua pesan masuk tersimpan di database
- tampil di list inbox admin panel
- simpan nomor pengirim
- simpan nama kontak jika ada
- simpan isi pesan
- simpan tipe pesan
- simpan media metadata
- simpan device penerima
- simpan timestamp
- simpan status dibaca / belum
- support incoming webhook ke client bila diaktifkan
- support reply manual dari thread

### 5.4 Auto Reply AI Gemini
- auto reply untuk pesan masuk
- bisa aktif / nonaktif global
- bisa aktif / nonaktif per client
- bisa aktif / nonaktif per device
- configurable system prompt
- fallback reply jika AI gagal
- anti loop protection
- cooldown per nomor
- max reply per hari
- keyword ignore / whitelist / blacklist
- log prompt dan response
- opsi eskalasi ke admin jika pertanyaan kompleks

### 5.5 API Client
- API key per client
- generate / revoke API key
- rate limit dasar
- webhook callback:
  - delivery status
  - incoming message
- endpoint cek health dan status device
- endpoint riwayat pengiriman dan cek detail pesan
- endpoint inbox bila diizinkan
- endpoint template
- endpoint webhook test

### 5.6 Monitoring dan Log
- log request API
- log pesan sukses / gagal
- log reconnect dan perubahan status device
- audit aktivitas admin
- statistik dashboard harian dan bulanan
- inbound log
- outbound log
- AI usage log
- webhook log

---

## 6. Modul Admin Panel

| Halaman | Isi Utama | Aksi |
|---|---|---|
| Login | Email, password, session admin | Masuk ke dashboard |
| Dashboard | Ringkasan device, inbox, pesan, error, queue | Lihat statistik cepat |
| Devices | Daftar nomor, status, QR, reconnect | Tambah / kelola device |
| Device Detail | Info device, QR, last seen, status, reconnect log | Monitoring per device |
| Inbox | Daftar thread masuk | Filter, buka thread |
| Inbox Thread Detail | Riwayat pesan satu kontak | Read, reply, tandai selesai |
| Messages / Outbox | Riwayat pengiriman, filter status | Lihat detail, retry |
| Templates | Daftar template dan variable | Tambah / edit / test template |
| Clients & API Keys | Data client integrasi | Generate / nonaktifkan key |
| Auto Reply Settings | Rule global / client / device | Tambah / edit / test rule |
| Logs | API logs, webhook logs, error logs | Lihat detail log |
| Settings | Webhook, domain, batas rate, system prompt | Atur konfigurasi |

---

## 7. Rancangan Database (Neon Postgres)

### 7.1 Tabel utama

#### `users`
- id
- name
- email
- password_hash
- role
- status
- created_at
- updated_at

#### `devices`
- id
- name
- phone_number
- status
- session_key
- session_ref
- is_enabled
- last_seen
- reconnect_count
- owner_id
- created_at
- updated_at

#### `clients`
- id
- client_name
- api_key_hash
- webhook_url
- inbound_webhook_url
- rate_limit
- status
- created_at
- updated_at

#### `client_devices`
- id
- client_id
- device_id
- created_at

#### `inbox_threads`
- id
- device_id
- client_id
- sender
- contact_name
- last_message
- last_message_at
- unread_count
- tags
- created_at
- updated_at

#### `inbox_messages`
- id
- thread_id
- device_id
- direction
- sender
- destination
- contact_name
- content
- type
- media_url
- media_mime
- file_name
- caption
- is_read
- raw_payload
- created_at
- updated_at

#### `message_logs`
- id
- client_id
- device_id
- direction
- destination
- sender
- contact_name
- content
- type
- media_url
- media_mime
- caption
- status
- provider_ref
- error_message
- created_at
- updated_at

#### `message_templates`
- id
- name
- category
- content
- variables
- media_type
- media_url
- status
- created_at
- updated_at

#### `auto_reply_rules`
- id
- name
- scope
- scope_ref_id
- is_enabled
- system_prompt
- fallback_reply
- ignored_numbers
- allowed_numbers
- keyword_trigger
- keyword_blocklist
- max_reply_per_day
- created_at
- updated_at

#### `ai_reply_logs`
- id
- rule_id
- thread_id
- prompt_text
- response_text
- status
- error_message
- created_at

#### `api_logs`
- id
- client_id
- endpoint
- request_body
- response_code
- ip
- created_at

#### `webhook_logs`
- id
- client_id
- event_type
- payload
- response_status
- created_at

#### `system_settings`
- id
- key
- value
- updated_at

---

### 7.2 Catatan desain database
- Gunakan **foreign key** untuk menjaga relasi
- Gunakan **index** minimal untuk:
  - `devices.status`
  - `message_logs.client_id`
  - `message_logs.device_id`
  - `message_logs.destination`
  - `message_logs.created_at`
  - `inbox_threads.device_id`
  - `inbox_threads.sender`
  - `inbox_messages.thread_id`
  - `inbox_messages.created_at`
- Pisahkan `inbox_threads` dan `inbox_messages` agar thread list lebih ringan
- Simpan `raw_payload` seperlunya untuk debugging
- Log besar seperti `api_logs`, `webhook_logs`, `message_logs` perlu strategi retention jika volume tinggi

---

## 8. Endpoint API Awal

### 8.1 Auth Admin

| Method & Path | Fungsi | Auth |
|---|---|---|
| `POST /v1/admin/auth/login` | Login admin | Public |
| `POST /v1/admin/auth/logout` | Logout admin | Admin |
| `GET /v1/admin/me` | Profil admin aktif | Admin |

### 8.2 Devices

| Method & Path | Fungsi | Auth |
|---|---|---|
| `GET /v1/admin/devices` | Daftar device | Admin |
| `POST /v1/admin/devices` | Tambah device | Admin |
| `GET /v1/admin/devices/:id` | Detail device | Admin |
| `PATCH /v1/admin/devices/:id` | Edit device | Admin |
| `POST /v1/admin/devices/:id/connect` | Start connect / QR | Admin |
| `POST /v1/admin/devices/:id/reconnect` | Reconnect device | Admin |
| `POST /v1/admin/devices/:id/logout` | Logout device | Admin |
| `PATCH /v1/admin/devices/:id/toggle` | Enable / disable | Admin |

### 8.3 Messages / Outbox

| Method & Path | Fungsi | Auth |
|---|---|---|
| `POST /v1/messages/send` | Kirim satu pesan | API Key / Admin |
| `POST /v1/messages/bulk` | Kirim banyak pesan | API Key / Admin |
| `GET /v1/messages/:id` | Lihat status pesan | API Key / Admin |
| `GET /v1/admin/messages` | Riwayat outbox | Admin |
| `POST /v1/admin/messages/:id/retry` | Retry pesan gagal | Admin |

### 8.4 Inbox

| Method & Path | Fungsi | Auth |
|---|---|---|
| `GET /v1/admin/inbox` | Daftar inbox | Admin |
| `GET /v1/admin/inbox/threads` | Daftar thread | Admin |
| `GET /v1/admin/inbox/threads/:id` | Detail thread | Admin |
| `PATCH /v1/admin/inbox/threads/:id/read` | Tandai dibaca | Admin |
| `POST /v1/admin/inbox/threads/:id/reply` | Balas manual | Admin |

### 8.5 Templates

| Method & Path | Fungsi | Auth |
|---|---|---|
| `GET /v1/admin/templates` | Daftar template | Admin |
| `POST /v1/admin/templates` | Tambah template | Admin |
| `PATCH /v1/admin/templates/:id` | Edit template | Admin |
| `DELETE /v1/admin/templates/:id` | Hapus template | Admin |
| `POST /v1/admin/templates/test` | Test template | Admin |

### 8.6 Clients

| Method & Path | Fungsi | Auth |
|---|---|---|
| `GET /v1/admin/clients` | Daftar client | Admin |
| `POST /v1/admin/clients` | Tambah client | Admin |
| `PATCH /v1/admin/clients/:id` | Edit client | Admin |
| `POST /v1/admin/clients/:id/regenerate-key` | Regenerate API key | Admin |
| `PATCH /v1/admin/clients/:id/toggle` | Aktif / nonaktif client | Admin |

### 8.7 Auto Reply

| Method & Path | Fungsi | Auth |
|---|---|---|
| `GET /v1/admin/auto-reply/rules` | Daftar rules | Admin |
| `POST /v1/admin/auto-reply/rules` | Tambah rule | Admin |
| `PATCH /v1/admin/auto-reply/rules/:id` | Edit rule | Admin |
| `DELETE /v1/admin/auto-reply/rules/:id` | Hapus rule | Admin |
| `POST /v1/admin/auto-reply/test` | Test auto reply | Admin |

### 8.8 Dashboard

| Method & Path | Fungsi | Auth |
|---|---|---|
| `GET /v1/admin/dashboard/summary` | Ringkasan dashboard | Admin |

### 8.9 Public Client API

| Method & Path | Fungsi | Auth |
|---|---|---|
| `POST /v1/client/messages/send` | Kirim satu pesan | API Key |
| `POST /v1/client/messages/bulk` | Kirim banyak pesan | API Key |
| `GET /v1/client/messages/:id` | Status pesan | API Key |
| `GET /v1/client/devices` | Daftar device tersedia | API Key |
| `GET /v1/client/health` | Health check | API Key |

### 8.10 Webhook Test

| Method & Path | Fungsi | Auth |
|---|---|---|
| `POST /v1/admin/webhooks/test` | Test webhook | Admin |

---

## 9. Format Payload Pengiriman Pesan

### 9.1 Contoh payload umum

```json
{
  "deviceId": "device_001",
  "to": "6281234567890",
  "type": "image",
  "text": "Halo",
  "caption": "Ini gambar promo",
  "mediaUrl": "https://example.com/promo.jpg",
  "fileName": "promo.jpg"
}
```

### 9.2 Type yang didukung
- `text`
- `image`
- `video`
- `audio`
- `document`
- `pdf`
- `link`

### 9.3 Aturan validasi dasar
- `to` wajib untuk single send
- `type` wajib
- `mediaUrl` wajib untuk `image`, `video`, `audio`, `document`, `pdf`
- `caption` opsional untuk media tertentu
- `fileName` wajib untuk dokumen / PDF bila diperlukan
- `text` wajib untuk `text`
- `recipients[]` wajib untuk bulk send

---

## 10. Keamanan dan Stabilitas

- simpan API key dalam bentuk **hash**, bukan plain text
- gunakan JWT / session aman untuk admin panel
- pisahkan akses admin dan akses client API
- tambahkan rate limit, retry policy, dan backoff
- simpan session device secara aman dan **jangan bergantung pada disk lokal Heroku**
- siapkan health check, alert device offline, dan log error terpusat
- tambahkan anti loop untuk auto reply
- tambahkan cooldown per nomor
- tambahkan audit log untuk aksi admin
- validasi payload di setiap endpoint
- gunakan CORS dan env handling yang aman

---

## 11. Rencana Implementasi Bertahap

| Fase | Target | Output | Status Tujuan |
|---|---|---|---|
| 1 | Setup monorepo, auth admin, koneksi Neon, Prisma schema | Fondasi project siap dikembangkan | MVP internal |
| 2 | Modul devices, QR login, session manager, status monitoring | Multi device dasar berjalan | MVP device |
| 3 | Endpoint kirim pesan, queue, log pesan, template dasar | API notifikasi siap pakai | MVP API |
| 4 | Inbox masuk, thread list, detail thread, reply manual | Operasional inbound berjalan | MVP inbox |
| 5 | Auto reply Gemini, webhook inbound/outbound, retry, cooldown | Otomasi dasar aktif | Beta automation |
| 6 | Dashboard statistik, audit log, hardening, dokumentasi client | Siap dipakai lebih luas | Release production |

---

## 12. Struktur Repository yang Disarankan

```text
apps/
  admin/          -> React admin panel untuk GitHub Pages
  api/            -> Node.js REST API untuk Heroku
  worker/         -> Node.js WhatsApp engine / sender worker

packages/
  shared-types/   -> Shared TypeScript types
  shared-utils/   -> Shared helper, formatter, constants

docs/
  api.md
  deployment.md
  webhook.md
  integration-examples.md
  project-overview.md
```

---

## 13. Environment Variables Utama

### 13.1 Admin
- `VITE_API_BASE_URL`
- `VITE_APP_NAME`

### 13.2 API Backend
- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_APP_URL`
- `API_BASE_URL`
- `REDIS_URL`
- `WEBHOOK_SIGNING_SECRET`
- `NODE_ENV`
- `PORT`

### 13.3 Worker
- `DATABASE_URL`
- `REDIS_URL`
- `GEMINI_API_KEY`
- `WORKER_NAME`
- `NODE_ENV`
- `PORT`

---

## 14. Deployment Plan

### 14.1 Admin Panel → GitHub Pages
- build static dengan Vite
- sesuaikan `base` path bila memakai repository pages
- publish hasil build ke GitHub Pages
- jika nanti memakai custom domain, arahkan domain admin ke GitHub Pages

### 14.2 API Backend → Heroku
- deploy sebagai **web dyno**
- hubungkan ke Neon Postgres
- siapkan `Procfile`
- siapkan env vars
- aktifkan health endpoint

### 14.3 Worker → Heroku
- deploy sebagai **worker dyno**
- proses background untuk session WhatsApp
- handle reconnect dan event message
- siapkan env vars terpisah jika perlu

### 14.4 Catatan penting deployment
- filesystem Heroku bersifat **ephemeral**
- session penting tidak boleh hanya disimpan di local disk dyno
- worker harus punya strategi restore / reconnect
- jika nanti butuh storage file media, gunakan object storage terpisah

---

## 15. Dokumentasi yang Wajib Dibuat

### 15.1 `README.md`
Isi:
- overview project
- arsitektur
- stack
- fitur
- cara install
- cara run local
- cara build
- cara deploy

### 15.2 `docs/project-overview.md`
Isi:
- tujuan project
- modul utama
- alur sistem
- use case

### 15.3 `docs/api.md`
Isi:
- autentikasi admin
- autentikasi client API key
- seluruh endpoint
- contoh request / response
- format error
- status code
- contoh kirim text / gambar / link / file

### 15.4 `docs/webhook.md`
Isi:
- outbound delivery webhook
- inbound message webhook
- contoh payload
- retry webhook
- signature verification jika ada

### 15.5 `docs/integration-examples.md`
Isi:
- contoh integrasi JavaScript fetch
- contoh integrasi Axios
- contoh integrasi PHP
- contoh integrasi Laravel
- contoh integrasi Next.js API route
- contoh integrasi plain HTML form submit
- contoh cara pasang di website orang lain

### 15.6 `docs/deployment.md`
Isi:
- setup environment
- setup Neon Postgres
- setup Heroku API app
- setup Heroku Worker app
- setup GitHub Pages
- setup domain / subdomain bila nanti diperlukan

---

## 16. Rekomendasi Implementasi Teknis

### 16.1 ORM
Gunakan **Prisma** karena:
- schema terstruktur
- migration rapi
- enak untuk Neon/Postgres
- mudah dipahami untuk tim kecil

### 16.2 Queue
Awalnya bisa mulai tanpa queue berat, tetapi untuk produksi lebih aman menambahkan:
- Redis + BullMQ / queue ringan
- retry pengiriman
- retry webhook
- cooldown auto reply

### 16.3 Session Strategy
- jangan mengandalkan penyimpanan session di disk lokal Heroku
- simpan metadata session di database
- siapkan proses reconnect otomatis
- siapkan flow QR ulang jika session invalid

### 16.4 AI Strategy
- buat prompt singkat dan customer-service friendly
- batasi panjang response
- siapkan fallback text jika Gemini gagal
- simpan AI log untuk audit

---

## 17. Checklist MVP

- [ ] Admin login berhasil
- [ ] Tambah device dan scan QR
- [ ] Device tersimpan dan reconnect
- [ ] API key client aktif
- [ ] Endpoint kirim pesan berjalan
- [ ] Log pesan tercatat
- [ ] Inbox masuk tercatat
- [ ] Thread detail dapat dibuka
- [ ] Reply manual berjalan
- [ ] Auto reply Gemini berjalan
- [ ] Webhook inbound/outbound aktif
- [ ] Dashboard menampilkan statistik dasar
- [ ] Deploy admin ke GitHub Pages
- [ ] Deploy API + worker ke Heroku

---

## 18. Kesimpulan dan Rekomendasi

Rancangan terbaik untuk kebutuhan ini adalah:

- **Admin panel** dipisah ke **GitHub Pages**
- **Backend REST API** di **Heroku**
- **Worker WhatsApp** di **Heroku**
- **Database utama** di **Neon Postgres**
- **ORM** menggunakan **Prisma**
- **WhatsApp engine** menggunakan **WPPConnect**
- **Auto reply AI** menggunakan **Gemini API**

Dengan pola ini:
- panel tetap ringan
- deployment lebih mudah
- data lebih rapi karena relational database
- inbox dan message tracking lebih mudah dibuat
- worker WhatsApp lebih stabil karena tidak dipaksa masuk ke serverless frontend

Versi awal sebaiknya fokus pada fitur inti:
1. multi nomor
2. QR login
3. kirim pesan
4. log pesan
5. inbox masuk
6. API key client

Setelah itu baru ditambah:
1. auto reply Gemini
2. webhook callback
3. retry cerdas
4. analytics
5. hardening production

---

## 19. Lampiran - Prompt untuk Antigravity / Gemini 3 Flash

```text
Anda adalah senior software architect, senior fullstack TypeScript engineer, dan DevOps engineer.

Bangun project production-ready berdasarkan project plan saya.

Fokus utama:
Membangun aplikasi WhatsApp API Gateway Multi Nomor untuk notifikasi website, inbox pesan masuk, auto reply AI Gemini, dan dokumentasi integrasi API untuk client eksternal.

==================================================
ATURAN UMUM
==================================================

1. Gunakan arsitektur modular, scalable, dan mudah di-maintain.
2. Gunakan TypeScript fullstack.
3. Pisahkan project menjadi:
   - admin panel
   - public API backend
   - WhatsApp worker
   - shared packages bila diperlukan
   - dokumentasi API client
4. Buat hasil yang rapi, production-minded, dan realistis untuk deploy.
5. Jangan membuat monolith berat.
6. Gunakan best practice:
   - clean architecture ringan
   - service layer
   - validation layer
   - centralized error handler
   - logging
   - rate limit
   - env config
   - modular folder structure
7. Jangan buat implementasi setengah jadi. Buat fondasi yang benar.
8. Jika ada keputusan teknis yang belum saya tentukan, pilih yang paling stabil dan ringan.
9. Fokus utama kestabilan worker WhatsApp, manajemen banyak session, inbox masuk, dan integrasi API client.
10. Jangan gunakan Vercel untuk worker WhatsApp.
11. Admin panel harus static-friendly agar bisa di-deploy ke GitHub Pages.
12. Backend API dan WhatsApp worker harus siap deploy ke Heroku.
13. Tuliskan juga langkah instalasi, struktur folder, dan environment variables.
14. Gunakan WPPConnect sebagai engine WhatsApp utama.
15. Auto reply AI gunakan Gemini API.
16. Gunakan Neon Postgres untuk database utama.
17. Gunakan Prisma ORM.
18. Redis opsional, tetapi jika membantu antrean dan retry, siapkan strukturnya.
19. Semua endpoint API harus terdokumentasi.
20. Semua modul harus memiliki nama file dan struktur yang jelas.
21. Hasilkan kode, struktur, konfigurasi, dan dokumentasi secara bertahap sampai project siap dikembangkan.

==================================================
STACK YANG WAJIB DIGUNAKAN
==================================================

Frontend Admin:
- React
- Vite
- React Router
- TanStack Query
- Zustand atau context yang ringan
- Tailwind CSS
- Admin panel harus bisa build static untuk GitHub Pages

Backend API:
- Node.js
- Express.js
- TypeScript
- JWT auth untuk admin
- API key auth untuk client eksternal
- Prisma ORM
- Neon Postgres
- Zod untuk validasi
- Pino atau Winston untuk logging

WhatsApp Worker:
- Node.js
- TypeScript
- WPPConnect
- Queue job system opsional
- reconnect handling
- multi-session handling
- status monitoring
- media sending support

AI Auto Reply:
- Gemini API
- configurable prompt per client atau global
- bisa aktif/nonaktif per device atau per client
- simpan riwayat auto reply

Dokumentasi:
- Markdown docs
- docs/api.md
- docs/deployment.md
- docs/webhook.md
- docs/integration-examples.md

Deploy target:
- Admin panel -> GitHub Pages
- API backend -> Heroku
- Worker WhatsApp -> Heroku

==================================================
ARAH BISNIS DAN FITUR WAJIB
==================================================

Aplikasi ini harus bisa:

1. Multi nomor WhatsApp
   - tambah device
   - rename device
   - enable/disable
   - scan QR
   - reconnect
   - logout
   - status connected/disconnected/qr_required/error/syncing

2. Pengiriman pesan
   - kirim text
   - kirim gambar
   - kirim audio
   - kirim video
   - kirim file / dokumen
   - kirim link
   - kirim caption
   - kirim bulk message
   - kirim dari template
   - retry jika gagal
   - fallback device jika device utama offline

3. Penerimaan pesan
   - semua pesan masuk tersimpan di database
   - tampil di list inbox admin panel
   - simpan nomor pengirim
   - simpan nama kontak jika ada
   - simpan isi pesan
   - simpan tipe pesan
   - simpan media metadata
   - simpan device penerima
   - simpan timestamp
   - simpan status dibaca/belum
   - support incoming webhook ke client bila diaktifkan

4. Auto reply AI Gemini
   - auto reply untuk pesan masuk
   - bisa aktif/nonaktif global
   - bisa aktif/nonaktif per client
   - bisa aktif/nonaktif per device
   - bisa menggunakan prompt system
   - bisa menggunakan template fallback jika AI gagal
   - batasi auto reply agar tidak loop
   - simpan log prompt dan response
   - support keyword ignore / whitelist / blacklist

5. API client eksternal
   - API key per client
   - generate/revoke API key
   - rate limit
   - webhook callback
   - endpoint health
   - endpoint status device
   - endpoint kirim pesan
   - endpoint cek status pesan
   - endpoint riwayat pesan
   - endpoint inbox bila diperlukan
   - endpoint template
   - endpoint webhook test

6. Admin panel
   - login admin
   - dashboard statistik
   - halaman devices
   - halaman inbox
   - halaman outbox / messages
   - halaman templates
   - halaman clients & API keys
   - halaman auto reply settings
   - halaman logs
   - halaman system settings
   - halaman documentation viewer bila perlu

==================================================
STRUKTUR PROJECT YANG DIINGINKAN
==================================================

Gunakan monorepo ringan seperti ini:

apps/
  admin/
  api/
  worker/

packages/
  shared-types/
  shared-utils/

docs/
  api.md
  deployment.md
  webhook.md
  integration-examples.md
  project-overview.md

Buat struktur detail per app.

==================================================
RANCANGAN DATABASE YANG HARUS DITAMBAHKAN
==================================================

Buat dan sesuaikan tabel berikut:

users
- id
- name
- email
- password_hash
- role
- status
- created_at
- updated_at

devices
- id
- name
- phone_number
- status
- session_key
- session_ref
- is_enabled
- last_seen
- reconnect_count
- owner_id
- created_at
- updated_at

clients
- id
- client_name
- api_key_hash
- webhook_url
- inbound_webhook_url
- rate_limit
- status
- created_at
- updated_at

client_devices
- id
- client_id
- device_id
- created_at

inbox_threads
- id
- device_id
- client_id
- sender
- contact_name
- last_message
- last_message_at
- unread_count
- tags
- created_at
- updated_at

inbox_messages
- id
- thread_id
- device_id
- direction
- sender
- destination
- contact_name
- content
- type
- media_url
- media_mime
- file_name
- caption
- is_read
- raw_payload
- created_at
- updated_at

message_logs
- id
- client_id
- device_id
- direction
- destination
- sender
- contact_name
- content
- type
- media_url
- media_mime
- caption
- status
- provider_ref
- error_message
- created_at
- updated_at

message_templates
- id
- name
- category
- content
- variables
- media_type
- media_url
- status
- created_at
- updated_at

auto_reply_rules
- id
- name
- scope
- scope_ref_id
- is_enabled
- system_prompt
- fallback_reply
- ignored_numbers
- allowed_numbers
- keyword_trigger
- keyword_blocklist
- max_reply_per_day
- created_at
- updated_at

ai_reply_logs
- id
- rule_id
- thread_id
- prompt_text
- response_text
- status
- error_message
- created_at

api_logs
- id
- client_id
- endpoint
- request_body
- response_code
- ip
- created_at

webhook_logs
- id
- client_id
- event_type
- payload
- response_status
- created_at

system_settings
- id
- key
- value
- updated_at

==================================================
ENDPOINT API YANG WAJIB DISEDIAKAN
==================================================

Auth Admin:
- POST /v1/admin/auth/login
- POST /v1/admin/auth/logout
- GET /v1/admin/me

Devices:
- GET /v1/admin/devices
- POST /v1/admin/devices
- GET /v1/admin/devices/:id
- PATCH /v1/admin/devices/:id
- POST /v1/admin/devices/:id/connect
- POST /v1/admin/devices/:id/reconnect
- POST /v1/admin/devices/:id/logout
- PATCH /v1/admin/devices/:id/toggle

Messages:
- POST /v1/messages/send
- POST /v1/messages/bulk
- GET /v1/messages/:id
- GET /v1/admin/messages
- POST /v1/admin/messages/:id/retry

Inbox:
- GET /v1/admin/inbox
- GET /v1/admin/inbox/threads
- GET /v1/admin/inbox/threads/:id
- PATCH /v1/admin/inbox/threads/:id/read
- POST /v1/admin/inbox/threads/:id/reply

Templates:
- GET /v1/admin/templates
- POST /v1/admin/templates
- PATCH /v1/admin/templates/:id
- DELETE /v1/admin/templates/:id
- POST /v1/admin/templates/test

Clients:
- GET /v1/admin/clients
- POST /v1/admin/clients
- PATCH /v1/admin/clients/:id
- POST /v1/admin/clients/:id/regenerate-key
- PATCH /v1/admin/clients/:id/toggle

Auto Reply:
- GET /v1/admin/auto-reply/rules
- POST /v1/admin/auto-reply/rules
- PATCH /v1/admin/auto-reply/rules/:id
- DELETE /v1/admin/auto-reply/rules/:id
- POST /v1/admin/auto-reply/test

Dashboard:
- GET /v1/admin/dashboard/summary

Public Client API:
- POST /v1/client/messages/send
- POST /v1/client/messages/bulk
- GET /v1/client/messages/:id
- GET /v1/client/devices
- GET /v1/client/health

Webhook Admin Test:
- POST /v1/admin/webhooks/test

==================================================
FITUR SEND YANG WAJIB DIDUKUNG
==================================================

Pastikan worker dan API mendukung tipe pesan berikut:

1. Text biasa
2. Text + link
3. Image + caption
4. Video + caption
5. Audio
6. Document/file
7. PDF
8. Template text
9. Template media
10. Bulk messages

Desain payload API agar fleksibel, contoh format:

{
  "deviceId": "device_001",
  "to": "628xxxx",
  "type": "image",
  "text": "Halo",
  "caption": "Ini gambar promo",
  "mediaUrl": "https://...",
  "fileName": "promo.jpg"
}

Buat validasi per type.

==================================================
ALUR PESAN MASUK
==================================================

Saat ada pesan masuk:
1. Worker menerima event dari WPPConnect
2. Simpan ke database
3. Update inbox thread
4. Trigger webhook inbound jika client mengaktifkan
5. Cek rule auto reply
6. Jika lolos rule, kirim ke Gemini API
7. Simpan hasil AI response
8. Kirim balasan ke user
9. Catat semua log sukses/gagal

Tambahkan proteksi:
- jangan balas pesan sendiri
- jangan loop ke bot
- ignore group jika belum diaktifkan
- ignore spam sederhana
- cooldown per nomor
- batasi jumlah auto reply per periode tertentu

==================================================
INSTRUKSI KHUSUS AUTO REPLY GEMINI
==================================================

Buat modul AI service dengan fitur:
- system prompt configurable
- user prompt dari pesan masuk
- short context memory opsional
- fail-safe fallback
- timeout request
- retry ringan
- sanitize output
- log usage

Buat contoh system prompt default:
- ramah
- singkat
- cocok untuk customer service
- tidak terlalu panjang
- bisa diarahkan ke admin bila pertanyaan kompleks

==================================================
KEAMANAN DAN STABILITAS
==================================================

Terapkan:
- JWT auth admin
- hashed API keys
- role-based access untuk admin
- request validation
- rate limiting
- logging
- CORS config
- secure env handling
- reconnect strategy
- centralized error handling
- retry/backoff
- health checks
- worker heartbeat
- audit log admin action

Tambahkan catatan risiko:
Karena menggunakan nomor WhatsApp biasa dan non-official session-based integration, sistem harus dirancang tahan terhadap logout, QR ulang, session invalid, dan perubahan dari WhatsApp Web.

==================================================
DEPLOYMENT YANG WAJIB DIIKUTI
==================================================

Admin Panel:
- build static
- deploy ke GitHub Pages
- base path harus aman untuk GitHub Pages
- environment variable frontend disesuaikan

API Backend:
- deploy ke Heroku web dyno
- expose REST API publik
- hubungkan ke Neon Postgres
- siapkan Procfile
- siapkan env vars
- siapkan build/start script

WhatsApp Worker:
- deploy ke Heroku worker dyno
- proses background
- handle multi-session
- handle reconnect
- handle queue

Buat panduan deployment rinci untuk:
1. local development
2. GitHub Pages
3. Heroku API
4. Heroku Worker

==================================================
FILE DOKUMENTASI YANG HARUS DIBUAT
==================================================

Buat file berikut dengan isi lengkap:

1. README.md
Isi:
- overview project
- arsitektur
- stack
- fitur
- cara install
- cara run local
- cara build
- cara deploy

2. docs/project-overview.md
Isi:
- tujuan project
- modul utama
- alur sistem
- use case

3. docs/api.md
Isi:
- autentikasi admin
- autentikasi client API key
- seluruh endpoint
- contoh request response
- format error
- status code
- contoh kirim text/gambar/link/file

4. docs/webhook.md
Isi:
- outbound delivery webhook
- inbound message webhook
- contoh payload
- retry webhook
- signature verification jika ada

5. docs/integration-examples.md
Isi:
- contoh integrasi JavaScript fetch
- contoh integrasi Axios
- contoh integrasi PHP
- contoh integrasi Laravel
- contoh integrasi Next.js API route
- contoh integrasi plain HTML form submit
- contoh cara pasang di website orang lain

6. docs/deployment.md
Isi:
- setup environment
- setup Neon Postgres
- setup Heroku API app
- setup Heroku Worker app
- setup GitHub Pages
- setup domain/subdomain bila nanti diperlukan

==================================================
LANGKAH KERJA YANG SAYA MAU DARI ANDA
==================================================

Kerjakan bertahap dan lengkap:

Tahap 1:
- analisis kebutuhan
- simpulkan arsitektur final
- jelaskan keputusan teknis yang dipilih

Tahap 2:
- buat struktur folder final
- buat daftar dependency per app

Tahap 3:
- generate file konfigurasi utama
- package.json
- tsconfig
- vite config
- Procfile
- env example

Tahap 4:
- buat backend API boilerplate lengkap

Tahap 5:
- buat worker boilerplate lengkap dengan WPPConnect integration structure

Tahap 6:
- buat admin panel boilerplate lengkap

Tahap 7:
- buat dokumentasi markdown lengkap

Tahap 8:
- buat langkah install dan deploy

Tahap 9:
- review hasil dan tambahkan rekomendasi production hardening

==================================================
HASIL YANG SAYA INGINKAN
==================================================

Saya ingin hasil yang:
- rapi
- realistis
- modular
- bisa dikembangkan
- siap deploy
- siap dipakai sebagai dasar project asli

Jangan hanya memberi teori.
Berikan struktur file, isi file penting, contoh implementasi, dan dokumentasi yang lengkap.

Jika ada bagian yang terlalu panjang, pecah per file dengan jelas.

Mulai sekarang, bangun project ini sampai fondasinya selesai.
```