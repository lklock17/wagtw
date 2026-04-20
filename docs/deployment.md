# Deployment Guide

Projek ini didesain untuk dideploy di platform Cloud seperti Heroku dan Vercel/GitHub Pages.

## 📦 API & Worker (Heroku)

1. **Persiapan**:
   - Create 2 apps di Heroku (satu untuk `api`, satu untuk `worker`).
   - Add **Heroku Postgres** (atau gunakan Neon DB).
   - Add **Redis** (jika menggunakan antrian pesan).

2. **Buildpacks**:
   - Tambahkan buildpack `heroku/nodejs`.
   - Untuk **Worker**, Anda memerlukan `jontewks/puppeteer` buildpack karena WPPConnect menggunakan Chromium.

3. **Environment Variables**:
   - `DATABASE_URL`: Neon/Postgres Connection String.
   - `GEMINI_API_KEY`: API Key dari Google AI Studio.
   - `PORT`: (Otomatis oleh Heroku).

4. **Procfile**:
   ```text
   web: npm run start --workspace=apps/api
   worker: npm run start --workspace=apps/worker
   ```

## 💻 Admin Panel (GitHub Pages)

1. Update `VITE_API_URL` di `.env` aplikasi admin.
2. Build project: `npm run build --workspace=apps/admin`.
3. Deploy folder `dist` ke GitHub Pages.
