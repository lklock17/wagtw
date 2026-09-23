import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Play, 
  Send, 
  Key, 
  Server, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  RotateCw,
  Sparkles,
  Lock,
  ArrowRight,
  Globe,
  Code,
  Terminal,
  FileText,
  CheckCircle2,
  BookOpen,
  Smartphone,
  MessageSquare,
  KeyRound,
  Users,
  Search,
  Layers,
  Inbox
} from 'lucide-react';
import axios from 'axios';

interface ApiDocsProps {
  isPublic?: boolean;
}

interface EndpointDef {
  id: string;
  category: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  path: string;
  summary: string;
  description: string;
  requiresAuth: boolean;
  defaultPayload?: any;
  exampleResponse?: any;
  queryParams?: Array<{ name: string; type: string; required: boolean; description: string; defaultVal?: string }>;
  bodyParams?: Array<{ name: string; type: string; required: boolean; description: string }>;
}

const ENDPOINTS: EndpointDef[] = [
  // 1. Messages & Auto-Rotate Engine
  {
    id: 'msg-send',
    category: 'Messages & Auto-Rotate Engine',
    method: 'POST',
    path: '/api/messages/send',
    summary: 'Kirim Pesan WhatsApp (Dukungan Auto-Rotate & Auto-Failover)',
    description: 'Mengirim pesan teks ke satu nomor WhatsApp. Jika deviceId diisi "rotate" atau "auto", sistem secara otomatis membagi beban pesan ke semua nomor aktif secara merata (Round-Robin). Jika nomor pengirim mati atau terputus koneksinya, sistem secara otomatis mengalihkan (failover) ke nomor aktif lainnya.',
    requiresAuth: true,
    defaultPayload: {
      to: "081234567890",
      text: "Halo! Pesan ini dikirim otomatis via REST API WAGTW.",
      deviceId: "rotate",
      failover: true
    },
    exampleResponse: {
      success: true,
      messageId: "cmue987abc123",
      status: "SENT",
      usedDevice: {
        id: "cmuduqih30001wg0hjnl5dvc1",
        name: "CS Utama",
        phoneNumber: "628175013371"
      },
      to: "6281234567890",
      text: "Halo! Pesan ini dikirim otomatis via REST API WAGTW.",
      timestamp: "2026-09-23T11:45:00.000Z"
    },
    bodyParams: [
      { name: 'to', type: 'string', required: true, description: 'Nomor tujuan (format bebas: 08xxx, 628xxx, maupun +628xxx)' },
      { name: 'text', type: 'string', required: true, description: 'Isi teks pesan (atau gunakan alias "message")' },
      { name: 'deviceId', type: 'string', required: false, description: 'Isi "rotate" atau "auto" untuk round-robin, atau isi ID device tertentu' },
      { name: 'failover', type: 'boolean', required: false, description: 'Default: true. Jika nomor disconnect, otomatis ganti ke nomor sehat lainnya' },
      { name: 'type', type: 'string', required: false, description: 'Pilihan: TEXT (default), IMAGE, VIDEO, AUDIO, DOCUMENT' },
      { name: 'url', type: 'string', required: false, description: 'URL file media publik jika type bukan TEXT' }
    ]
  },
  {
    id: 'msg-media',
    category: 'Messages & Auto-Rotate Engine',
    method: 'POST',
    path: '/api/messages/send',
    summary: 'Kirim Gambar / Video dengan Caption',
    description: 'Mengirim media gambar atau video dari URL langsung ke penerima WhatsApp dengan teks caption pendukung.',
    requiresAuth: true,
    defaultPayload: {
      to: "081234567890",
      type: "IMAGE",
      url: "https://picsum.photos/600/400",
      caption: "Lihat katalog promo terbaru kami!",
      deviceId: "rotate"
    },
    exampleResponse: {
      success: true,
      messageId: "cmuemedia456",
      status: "SENT",
      usedDevice: {
        id: "cmuduqih30001wg0hjnl5dvc1",
        name: "CS Utama",
        phoneNumber: "628175013371"
      },
      to: "6281234567890",
      mediaUrl: "https://picsum.photos/600/400",
      caption: "Lihat katalog promo terbaru kami!"
    },
    bodyParams: [
      { name: 'to', type: 'string', required: true, description: 'Nomor WhatsApp tujuan' },
      { name: 'type', type: 'string', required: true, description: 'Nilai: IMAGE atau VIDEO' },
      { name: 'url', type: 'string', required: true, description: 'URL media yang dapat diakses publik via internet' },
      { name: 'caption', type: 'string', required: false, description: 'Teks keterangan gambar/video' },
      { name: 'deviceId', type: 'string', required: false, description: '"rotate" atau ID device' }
    ]
  },
  {
    id: 'msg-check-number',
    category: 'Messages & Auto-Rotate Engine',
    method: 'POST',
    path: '/api/messages/check-number',
    summary: 'Cek Status Nomor WhatsApp (Validasi Aktif / Tidak)',
    description: 'Memeriksa apakah suatu nomor telepon terdaftar dan aktif di WhatsApp tanpa mengirim pesan apapun. Mengetahui apakah akun berupa Personal atau WhatsApp Business. Mendukung format bebas: 08xxx, 628xxx, +62xxx.',
    requiresAuth: true,
    defaultPayload: {
      phone: "081234567890",
      deviceId: ""
    },
    exampleResponse: {
      success: true,
      phone: "6281234567890",
      jid: "6281234567890@c.us",
      numberExists: true,
      isBusiness: false,
      canReceiveMessage: true,
      checkedByDevice: "CS Utama"
    },
    bodyParams: [
      { name: 'phone', type: 'string', required: true, description: 'Nomor telepon yang ingin diverifikasi' },
      { name: 'deviceId', type: 'string', required: false, description: 'ID device aktif (otomatis memilih device online jika dikosongkan)' }
    ]
  },

  // 2. WhatsApp Devices Management
  {
    id: 'dev-list',
    category: 'WhatsApp Devices Management',
    method: 'GET',
    path: '/api/devices',
    summary: 'Ambil Semua Perangkat & Status Koneksi',
    description: 'Mengambil daftar seluruh nomor WhatsApp yang terdaftar di gateway beserta status koneksi real-time (CONNECTED, DISCONNECTED, QR_READY).',
    requiresAuth: true,
    exampleResponse: [
      {
        id: "cmuduqih30001wg0hjnl5dvc1",
        name: "CS Utama",
        phoneNumber: "628175013371",
        status: "CONNECTED",
        webhookUrl: "https://domain-anda.com/api/wa-webhook",
        autoReply: true,
        lastConnected: "2026-09-23T08:52:23.533Z"
      }
    ]
  },
  {
    id: 'dev-create',
    category: 'WhatsApp Devices Management',
    method: 'POST',
    path: '/api/devices',
    summary: 'Tambah Sesi Device Baru',
    description: 'Mendaftarkan nama identifikasi device baru ke dalam gateway untuk siap dihubungkan.',
    requiresAuth: true,
    defaultPayload: {
      name: "Device CS 02"
    },
    exampleResponse: {
      id: "cmue06kr10001k28fpj999wif",
      name: "Device CS 02",
      phoneNumber: null,
      status: "DISCONNECTED",
      createdAt: "2026-09-23T11:50:00.000Z"
    },
    bodyParams: [
      { name: 'name', type: 'string', required: true, description: 'Nama label perangkat' }
    ]
  },
  {
    id: 'dev-qr',
    category: 'WhatsApp Devices Management',
    method: 'GET',
    path: '/api/devices/{id}/qr',
    summary: 'Ambil QR Code Real-Time untuk Login',
    description: 'Mengambil string Base64 gambar QR Code dari sesi device untuk di-scan menggunakan aplikasi WhatsApp di ponsel.',
    requiresAuth: true,
    exampleResponse: {
      status: "QR_READY",
      qrCode: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      message: "Silakan scan QR Code ini menggunakan aplikasi WhatsApp di ponsel"
    },
    queryParams: [
      { name: 'id', type: 'string', required: true, description: 'ID device yang ingin di-scan' }
    ]
  },
  {
    id: 'dev-pairing-code',
    category: 'WhatsApp Devices Management',
    method: 'POST',
    path: '/api/devices/{id}/pairing-code',
    summary: 'Minta Kode Pairing 8-Digit (Login Tanpa QR)',
    description: 'Menghasilkan 8 karakter kode pairing WhatsApp untuk ditautkan via opsi "Tautkan dengan nomor telepon saja" pada aplikasi WhatsApp ponsel.',
    requiresAuth: true,
    defaultPayload: {
      phone: "081234567890"
    },
    exampleResponse: {
      success: true,
      pairingCode: "WAG7-4K9L",
      message: "Masukkan kode ini pada opsi Tautkan dengan nomor telepon saja di WhatsApp ponsel"
    },
    bodyParams: [
      { name: 'phone', type: 'string', required: true, description: 'Nomor telepon WhatsApp Anda yang akan ditautkan' }
    ]
  },
  {
    id: 'dev-webhook-update',
    category: 'WhatsApp Devices Management',
    method: 'PATCH',
    path: '/api/devices/{id}/webhook',
    summary: 'Atur Webhook URL Khusus Perangkat',
    description: 'Mengarahkan setiap event pesan masuk yang diterima oleh nomor WhatsApp tertentu ke URL server Anda sendiri.',
    requiresAuth: true,
    defaultPayload: {
      webhookUrl: "https://domain-anda.com/api/wa-webhook"
    },
    exampleResponse: {
      id: "cmuduqih30001wg0hjnl5dvc1",
      name: "CS Utama",
      webhookUrl: "https://domain-anda.com/api/wa-webhook",
      updatedAt: "2026-09-23T11:55:00.000Z"
    },
    bodyParams: [
      { name: 'webhookUrl', type: 'string', required: true, description: 'URL endpoint POST di server Anda' }
    ]
  },
  {
    id: 'dev-webhook-test',
    category: 'WhatsApp Devices Management',
    method: 'POST',
    path: '/api/devices/test-webhook',
    summary: 'Uji Endpoint Webhook (Ping & Latensi)',
    description: 'Mengirim request uji coba ke webhook URL untuk memastikan server tujuan aktif dan mengukur kecepatan latensinya (ms).',
    requiresAuth: true,
    defaultPayload: {
      url: "https://domain-anda.com/api/wa-webhook"
    },
    exampleResponse: {
      success: true,
      latency: 42,
      message: "Webhook aktif dan merespon dengan status HTTP 200 OK"
    },
    bodyParams: [
      { name: 'url', type: 'string', required: true, description: 'URL webhook yang ingin diuji' }
    ]
  },
  {
    id: 'dev-delete',
    category: 'WhatsApp Devices Management',
    method: 'DELETE',
    path: '/api/devices/{id}',
    summary: 'Hapus Sesi Perangkat WhatsApp',
    description: 'Mematikan browser sesi WhatsApp dan menghapus token autentikasi di server.',
    requiresAuth: true,
    exampleResponse: {
      success: true,
      message: "Device berhasil dihapus dan sesi dimatikan"
    }
  },

  // 3. Auto-Reply Rules & 9routes AI
  {
    id: 'autoreply-list',
    category: 'Auto-Reply Rules & 9routes AI',
    method: 'GET',
    path: '/api/autoreply',
    summary: 'Ambil Semua Aturan Balasan Otomatis',
    description: 'Mengambil daftar kata kunci, respon teks, cooldown, dan status aktif balasan bot.',
    requiresAuth: true,
    exampleResponse: [
      {
        id: "cmuerule001",
        keyword: "harga",
        response: "Harga paket langganan mulai dari Rp 99.000 / bulan.",
        isAi: false,
        cooldown: 30,
        isActive: true
      },
      {
        id: "cmuerule002",
        keyword: null,
        response: null,
        isAi: true,
        cooldown: 30,
        isActive: true
      }
    ]
  },
  {
    id: 'autoreply-create',
    category: 'Auto-Reply Rules & 9routes AI',
    method: 'POST',
    path: '/api/autoreply',
    summary: 'Tambah Aturan Auto-Reply Baru',
    description: 'Mendaftarkan pemicu kata kunci baru atau fallback cerdas 9routes AI.',
    requiresAuth: true,
    defaultPayload: {
      keyword: "info",
      response: "Halo! Terima kasih telah menghubungi kami. Kami buka setiap hari pkl 08.00 - 21.00 WIB.",
      isAi: false,
      cooldown: 30,
      isActive: true
    },
    exampleResponse: {
      id: "cmuerule003",
      keyword: "info",
      response: "Halo! Terima kasih...",
      isAi: false,
      cooldown: 30,
      isActive: true,
      createdAt: "2026-09-23T11:58:00.000Z"
    },
    bodyParams: [
      { name: 'keyword', type: 'string', required: false, description: 'Kata kunci (kosongkan jika ingin fallback AI untuk semua chat)' },
      { name: 'response', type: 'string', required: false, description: 'Teks balasan (wajib jika bukan AI)' },
      { name: 'isAi', type: 'boolean', required: false, description: 'true jika ingin dijawab otomatis oleh 9routes AI' },
      { name: 'cooldown', type: 'number', required: false, description: 'Jeda respon dalam detik per pengirim (default: 30)' }
    ]
  },

  // 4. Warmup AI Engine (9routes)
  {
    id: 'warmup-config',
    category: 'Warmup AI Engine (9routes)',
    method: 'GET',
    path: '/api/warmup/config',
    summary: 'Ambil Konfigurasi Warmup Nomor',
    description: 'Mengambil status pemanasan otomatis 24/7 (isEnabled), target chat harian, jeda delay menit, dan model 9routes AI aktif.',
    requiresAuth: true,
    exampleResponse: {
      isEnabled: true,
      dailyTarget: 25,
      minDelayMinutes: 3,
      aiBaseUrl: "http://103.89.2.102:20128/v1",
      aiModel: "mistral/mistral-large-latest",
      topicPrompt: "Ngobrol santai natural bahasa Indonesia gaul akrab..."
    }
  },
  {
    id: 'warmup-update',
    category: 'Warmup AI Engine (9routes)',
    method: 'POST',
    path: '/api/warmup/config',
    summary: 'Update Pengaturan Pemanasan AI',
    description: 'Mengubah master switch on/off, target obrolan harian, jeda delay, atau model 9routes AI.',
    requiresAuth: true,
    defaultPayload: {
      isEnabled: true,
      dailyTarget: 30,
      minDelayMinutes: 2,
      aiModel: "mistral/mistral-large-latest",
      topicPrompt: "Ngobrol santai natural bahasa Indonesia sehari-hari seperti teman akrab."
    },
    exampleResponse: {
      success: true,
      message: "Konfigurasi warmup berhasil disimpan",
      config: {
        isEnabled: true,
        dailyTarget: 30,
        minDelayMinutes: 2,
        aiModel: "mistral/mistral-large-latest"
      }
    },
    bodyParams: [
      { name: 'isEnabled', type: 'boolean', required: false, description: 'true untuk mengaktifkan pemanasan otomatis' },
      { name: 'dailyTarget', type: 'number', required: false, description: 'Jumlah target chat harian' },
      { name: 'minDelayMinutes', type: 'number', required: false, description: 'Jeda minimal sebelum lawan nomor membalas' },
      { name: 'aiModel', type: 'string', required: false, description: 'Nama model 9routes AI' }
    ]
  },
  {
    id: 'warmup-trigger',
    category: 'Warmup AI Engine (9routes)',
    method: 'POST',
    path: '/api/warmup/trigger',
    summary: 'Uji Coba Kirim Chat Warmup Instan',
    description: 'Memicu 1 percakapan AI antar nomor secara manual sekarang juga tanpa menunggu interval cron.',
    requiresAuth: true,
    exampleResponse: {
      success: true,
      message: "Pesan pemanasan terkirim dari CS Utama ke CS 02. Balasan otomatis dijadwalkan dalam ~2 menit."
    }
  },

  // 5. Broadcast Massal & Penjadwalan
  {
    id: 'bulk-create',
    category: 'Broadcast Massal & Penjadwalan',
    method: 'POST',
    path: '/api/bulk',
    summary: 'Mulai Kampanye Broadcast Massal',
    description: 'Mengirim pesan serentak ke ratusan atau ribuan nomor dengan jeda waktu aman acak per kontak.',
    requiresAuth: true,
    defaultPayload: {
      name: "Promo Spesial Gajian",
      deviceId: "rotate",
      contacts: ["081234567890", "085712345678"],
      body: "Halo! Dapatkan diskon 50% hari ini khusus untuk Anda.",
      delay: 5
    },
    exampleResponse: {
      success: true,
      jobId: "cmujob123456",
      name: "Promo Spesial Gajian",
      totalContacts: 2,
      status: "PROCESSING",
      message: "Kampanye broadcast berhasil dijadwalkan dan sedang berjalan di latar belakang."
    },
    bodyParams: [
      { name: 'name', type: 'string', required: true, description: 'Nama kampanye broadcast' },
      { name: 'contacts', type: 'array', required: true, description: 'Array nomor WhatsApp tujuan' },
      { name: 'body', type: 'string', required: true, description: 'Teks pesan yang dikirim' },
      { name: 'delay', type: 'number', required: false, description: 'Jeda aman dalam detik per pesan (default: 5)' }
    ]
  },
  {
    id: 'sched-create',
    category: 'Broadcast Massal & Penjadwalan',
    method: 'POST',
    path: '/api/schedules',
    summary: 'Jadwalkan Pesan Masa Depan',
    description: 'Menjadwalkan pesan otomatis yang akan dikirim pada tanggal dan jam tertentu (mendukung timezone lokal Asia/Jakarta).',
    requiresAuth: true,
    defaultPayload: {
      deviceId: "rotate",
      to: "081234567890",
      body: "Pengingat: Jadwal webinar besok pukul 10:00 WIB.",
      scheduledAt: new Date(Date.now() + 3600000).toISOString()
    },
    exampleResponse: {
      id: "cmuesched789",
      to: "6281234567890",
      body: "Pengingat: Jadwal webinar...",
      scheduledAt: "2026-09-24T03:00:00.000Z",
      status: "PENDING"
    },
    bodyParams: [
      { name: 'to', type: 'string', required: true, description: 'Nomor WhatsApp tujuan' },
      { name: 'body', type: 'string', required: true, description: 'Isi teks pesan' },
      { name: 'scheduledAt', type: 'string', required: true, description: 'Waktu eksekusi dalam format ISO-8601 UTC' },
      { name: 'deviceId', type: 'string', required: false, description: '"rotate" atau ID device' }
    ]
  },
  {
    id: 'sched-list',
    category: 'Broadcast Massal & Penjadwalan',
    method: 'GET',
    path: '/api/schedules',
    summary: 'Ambil Antrean Pesan Terjadwal',
    description: 'Mengambil daftar seluruh jadwal pesan yang berstatus PENDING, COMPLETED, atau FAILED.',
    requiresAuth: true,
    exampleResponse: [
      {
        id: "cmuesched789",
        to: "6281234567890",
        body: "Pengingat: Jadwal webinar...",
        scheduledAt: "2026-09-24T03:00:00.000Z",
        status: "PENDING"
      }
    ]
  },

  // 6. Media Library & Inbox
  {
    id: 'media-list',
    category: 'Media Library & Inbox',
    method: 'GET',
    path: '/api/media',
    summary: 'Daftar File Media yang Tersimpan',
    description: 'Mengambil semua file foto/video yang pernah diunggah ke server gateway.',
    requiresAuth: true,
    exampleResponse: [
      {
        id: "cmuemedia01",
        filename: "katalog-september.jpg",
        url: "/uploads/katalog-september.jpg",
        mimetype: "image/jpeg",
        size: 345000,
        createdAt: "2026-09-23T09:00:00.000Z"
      }
    ]
  },
  {
    id: 'inbox-threads',
    category: 'Media Library & Inbox',
    method: 'GET',
    path: '/api/inbox/threads',
    summary: 'Ambil Seluruh Percakapan Masuk',
    description: 'Mengambil daftar riwayat thread kontak percakapan masuk dari semua nomor WhatsApp.',
    requiresAuth: true,
    exampleResponse: [
      {
        id: "cmuethread123",
        contactPhone: "6281234567890",
        contactName: "Budi Santoso",
        lastMessage: "Halo, apakah ready stock?",
        unreadCount: 1,
        updatedAt: "2026-09-23T11:45:00.000Z"
      }
    ]
  },

  // 7. Autentikasi & Akun Pengguna
  {
    id: 'auth-login',
    category: 'Autentikasi & Akun Pengguna',
    method: 'POST',
    path: '/api/auth/login',
    summary: 'Login Akun Admin / Pegawai (Mendapatkan Token JWT)',
    description: 'Melakukan autentikasi menggunakan email dan password untuk mendapatkan token Bearer JWT yang berlaku 24 jam.',
    requiresAuth: false,
    defaultPayload: {
      email: "admin@wagtw.com",
      password: "password123"
    },
    exampleResponse: {
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      user: {
        id: "cmudedo9t000014axja7gz90k",
        email: "admin@wagtw.com",
        name: "Super Admin"
      }
    },
    bodyParams: [
      { name: 'email', type: 'string', required: true, description: 'Email akun terdaftar' },
      { name: 'password', type: 'string', required: true, description: 'Kata sandi akun' }
    ]
  },
  {
    id: 'auth-users-list',
    category: 'Autentikasi & Akun Pengguna',
    method: 'GET',
    path: '/api/auth/users',
    summary: 'Ambil Daftar Akun Pegawai / Pengguna',
    description: 'Melihat seluruh daftar akun staf atau pegawai yang memiliki akses ke gateway.',
    requiresAuth: true,
    exampleResponse: [
      {
        id: "cmudedo9t000014axja7gz90k",
        email: "admin@wagtw.com",
        name: "Super Admin",
        createdAt: "2026-09-23T01:01:33.000Z"
      }
    ]
  },
  {
    id: 'auth-change-password',
    category: 'Autentikasi & Akun Pengguna',
    method: 'POST',
    path: '/api/auth/change-password',
    summary: 'Ubah Kata Sandi Akun Sendiri',
    description: 'Memperbarui kata sandi untuk akun yang sedang login.',
    requiresAuth: true,
    defaultPayload: {
      currentPassword: "password123",
      newPassword: "passwordBaru123"
    },
    exampleResponse: {
      success: true,
      message: "Password Anda berhasil diperbarui!"
    },
    bodyParams: [
      { name: 'currentPassword', type: 'string', required: false, description: 'Password lama saat ini' },
      { name: 'newPassword', type: 'string', required: true, description: 'Password baru (minimal 6 karakter)' }
    ]
  }
];

export default function ApiDocs({ isPublic = false }: ApiDocsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({
    'msg-send': true
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<Record<string, 'curl' | 'php' | 'laravel' | 'nodejs' | 'python'>>({});
  
  // Try-It-Out State per endpoint
  const [payloads, setPayloads] = useState<Record<string, string>>({});
  const [apiKeys, setApiKeys] = useState<string>('');
  const [testResponses, setTestResponses] = useState<Record<string, { status: number; data: any; loading: boolean }>>({});

  // Webhook Guide Tab State
  const [webhookCodeLang, setWebhookCodeLang] = useState<'php' | 'laravel' | 'nodejs' | 'python'>('php');
  const [showWebhookGuide, setShowWebhookGuide] = useState<boolean>(true);

  const baseUrl = window.location.origin;

  useEffect(() => {
    const initialPayloads: Record<string, string> = {};
    ENDPOINTS.forEach((ep) => {
      if (ep.defaultPayload) {
        initialPayloads[ep.id] = JSON.stringify(ep.defaultPayload, null, 2);
      }
    });
    setPayloads(initialPayloads);

    const token = localStorage.getItem('token');
    if (token) {
      setApiKeys(token);
    }
  }, []);

  const toggleEndpoint = (id: string) => {
    setExpandedEndpoints((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExecute = async (ep: EndpointDef) => {
    setTestResponses((prev) => ({
      ...prev,
      [ep.id]: { status: 0, data: null, loading: true }
    }));

    try {
      const headers: any = {
        'Content-Type': 'application/json'
      };

      if (apiKeys.trim()) {
        if (apiKeys.includes('.') || apiKeys.length > 50) {
          headers['Authorization'] = `Bearer ${apiKeys.trim()}`;
        } else {
          headers['x-api-key'] = apiKeys.trim();
        }
      }

      let bodyData = undefined;
      if (ep.method !== 'GET' && payloads[ep.id]) {
        try {
          bodyData = JSON.parse(payloads[ep.id]);
        } catch {
          bodyData = payloads[ep.id];
        }
      }

      let targetUrl = `${baseUrl}${ep.path}`;
      if (targetUrl.includes('{id}')) {
        targetUrl = targetUrl.replace('{id}', 'cmuduqih30001wg0hjnl5dvc1');
      }

      const res = await axios({
        method: ep.method,
        url: targetUrl,
        headers,
        data: bodyData
      });

      setTestResponses((prev) => ({
        ...prev,
        [ep.id]: { status: res.status, data: res.data, loading: false }
      }));
    } catch (err: any) {
      setTestResponses((prev) => ({
        ...prev,
        [ep.id]: {
          status: err.response?.status || 500,
          data: err.response?.data || { error: err.message },
          loading: false
        }
      }));
    }
  };

  const getCodeSnippet = (ep: EndpointDef, lang: 'curl' | 'php' | 'laravel' | 'nodejs' | 'python') => {
    const key = apiKeys || 'YOUR_API_KEY_OR_TOKEN';
    const bodyStr = payloads[ep.id] || (ep.defaultPayload ? JSON.stringify(ep.defaultPayload, null, 2) : '{}');
    const fullUrl = `${baseUrl}${ep.path}`;

    if (lang === 'curl') {
      let cmd = `curl -X ${ep.method} "${fullUrl}" \\\n  -H "Content-Type: application/json"`;
      if (ep.requiresAuth) {
        cmd += ` \\\n  -H "x-api-key: ${key}"`;
      }
      if (ep.method !== 'GET') {
        cmd += ` \\\n  -d '${bodyStr.replace(/\n\s*/g, ' ')}'`;
      }
      return cmd;
    }

    if (lang === 'php') {
      return `<?php
$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => "${fullUrl}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => "${ep.method}",
    ${ep.method !== 'GET' ? `CURLOPT_POSTFIELDS => '${bodyStr.replace(/\n\s*/g, '')}',` : ''}
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "x-api-key: ${key}"
    ],
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;
?>`;
    }

    if (lang === 'laravel') {
      return `use Illuminate\\Support\\Facades\\Http;

$response = Http::withHeaders([
    'x-api-key' => '${key}',
    'Content-Type' => 'application/json',
])->${ep.method.toLowerCase()}('${fullUrl}'${ep.method !== 'GET' ? `, ${bodyStr}` : ''});

return $response->json();`;
    }

    if (lang === 'nodejs') {
      return `import axios from 'axios';

const run = async () => {
  try {
    const res = await axios.${ep.method.toLowerCase()}('${fullUrl}'${ep.method !== 'GET' ? `, ${bodyStr}` : ''}, {
      headers: {
        'x-api-key': '${key}',
        'Content-Type': 'application/json'
      }
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
};

run();`;
    }

    if (lang === 'python') {
      return `import requests

url = "${fullUrl}"
headers = {
    "x-api-key": "${key}",
    "Content-Type": "application/json"
}
${ep.method !== 'GET' ? `payload = ${bodyStr}` : ''}

response = requests.${ep.method.toLowerCase()}(url${ep.method !== 'GET' ? ', json=payload' : ''}, headers=headers)
print(response.status_code, response.json())`;
    }

    return '';
  };

  const getWebhookReceiverSnippet = (lang: 'php' | 'laravel' | 'nodejs' | 'python') => {
    if (lang === 'php') {
      return `<?php
// webhook.php - Endpoint Penerima Pesan WhatsApp WAGTW

header('Content-Type: application/json');

// 1. Tangkap raw JSON payload dari request POST
$rawPayload = file_get_contents('php://input');
$data = json_decode($rawPayload, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

// 2. Identifikasi jenis event
$event = $data['event'] ?? 'unknown';

if ($event === 'message.received') {
    $fromNumber = $data['from'];       // Contoh: "628123456789@c.us"
    $messageBody = $data['body'];      // Isi teks pesan
    $messageType = $data['type'];      // TEXT, chat, image, dll.
    $deviceId = $data['deviceId'];

    // PROSES BISNIS ANDA DI SINI:
    // - Simpan percakapan ke database MySQL/PostgreSQL
    // - Notifikasi ke bot Telegram tim Anda
    // - Kirim balasan otomatis via API /api/messages/send
    error_log("Pesan masuk dari {$fromNumber}: {$messageBody}");

} elseif ($event === 'ping' || $event === 'webhook_test') {
    // Event uji coba koneksi dari dashboard WAGTW
    error_log("Webhook ping received successfully.");
}

// 3. WAJIB: Kembalikan respon HTTP 200 OK agar gateway tahu pesan terkirim
http_response_code(200);
echo json_encode(['status' => 'success', 'received_at' => date('Y-m-d H:i:s')]);
?>`;
    }

    if (lang === 'laravel') {
      return `<?php
// app/Http/Controllers/WhatsAppWebhookController.php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WhatsAppWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $event = $request->input('event');
        $from = $request->input('from');       // misal: 628123456789@c.us
        $body = $request->input('body');       // isi teks pesan
        $deviceId = $request->input('deviceId');

        Log::info("WAGTW Inbound [{$event}] from {$from}: {$body}");

        if ($event === 'message.received') {
            // Lakukan pemrosesan pesan (simpan tiket CS, order, dll)
        }

        // WAJIB: Return respon JSON status 200
        return response()->json([
            'status' => 'received',
            'timestamp' => now()->toISOString()
        ], 200);
    }
}`;
    }

    if (lang === 'nodejs') {
      return `// server.js - Express Webhook Receiver
import express from 'express';

const app = express();
app.use(express.json());

app.post('/api/wa-webhook', (req, res) => {
  const { event, from, body, type, deviceId, timestamp } = req.body;

  console.log(\`📩 [WAGTW] \${event} | Dari: \${from} | Pesan: \${body}\`);

  if (event === 'message.received') {
    // Proses pesan masuk di sistem Anda
  }

  // Respon HTTP 200 OK ke server WAGTW
  res.status(200).json({ status: 'ok', received: true });
});

app.listen(3000, () => console.log('Webhook server siap menerima di port 3000'));`;
    }

    if (lang === 'python') {
      return `# main.py - FastAPI Webhook Receiver
from fastapi import FastAPI, Request
from pydantic import BaseModel

app = FastAPI()

@app.post("/api/wa-webhook")
async def handle_whatsapp_webhook(request: Request):
    payload = await request.json()
    event = payload.get("event")
    sender = payload.get("from")
    body = payload.get("body")

    print(f"📩 [WAGTW Inbound] {event} | Dari: {sender} | Isi: {body}")

    # Kembalikan HTTP 200 OK
    return {"status": "success", "event": event}`;
    }

    return '';
  };

  const categories = Array.from(new Set(ENDPOINTS.map((e) => e.category)));
  const filteredEndpoints = selectedCategory === 'ALL'
    ? ENDPOINTS
    : ENDPOINTS.filter((e) => e.category === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans pb-24">
      {/* Top Header Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              W
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 tracking-tight">WAGTW API Documentation</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  v1.2 OAS Complete
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Enterprise WhatsApp REST API dengan Auto-Rotate, Failover, & Webhook Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>Kembali ke Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 pt-6 space-y-6">
        {/* API Authentication & Server Selector */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600" />
                <span>Base Endpoint Gateway</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Semua request REST API dikirimkan ke alamat server gateway ini.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{baseUrl}</span>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-600" />
              <span>Autentikasi Header (x-api-key atau Bearer Token)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiKeys}
                onChange={(e) => setApiKeys(e.target.value)}
                placeholder="Masukkan API Key Client Anda atau Bearer Token JWT"
                className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  const saved = localStorage.getItem('token');
                  if (saved) setApiKeys(saved);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                Gunakan Token Sesi
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Header HTTP: <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">x-api-key: [kunci_api]</code> atau <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">Authorization: Bearer [token_jwt]</code>.
            </p>
          </div>
        </div>

        {/* PANDUAN LENGKAP WEBHOOK & FORMAT HASIL PAYLOAD */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div 
            onClick={() => setShowWebhookGuide(!showWebhookGuide)}
            className="p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold tracking-tight">Panduan Webhook WhatsApp & Spesifikasi Hasil Payload</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                    Sangat Direkomendasikan
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Pelajari bagaimana sistem website Anda menerima pesan masuk WhatsApp dari pelanggan secara real-time.
                </p>
              </div>
            </div>

            <div className="text-slate-300">
              {showWebhookGuide ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>

          {showWebhookGuide && (
            <div className="p-6 space-y-6 border-t border-slate-100">
              {/* Cara Kerja Webhook */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">1</span>
                  <h4 className="text-xs font-bold text-slate-900">Pelanggan Mengirim Pesan</h4>
                  <p className="text-[11px] text-slate-500">
                    Penerima WhatsApp mengirim chat teks atau media ke nomor yang tertaut di WAGTW Gateway.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">2</span>
                  <h4 className="text-xs font-bold text-slate-900">WAGTW POST ke URL Anda</h4>
                  <p className="text-[11px] text-slate-500">
                    Gateway memicu HTTP POST secara instan dengan membawa payload JSON lengkap ke Webhook URL Anda.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">3</span>
                  <h4 className="text-xs font-bold text-slate-900">Server Anda Beri Respon 200</h4>
                  <p className="text-[11px] text-slate-500">
                    Aplikasi Anda memproses data (simpan/balas otomatis) dan mengembalikan status HTTP 200 OK.
                  </p>
                </div>
              </div>

              {/* Hasil Format Payload JSON yang Dikirimkan WAGTW */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Format Hasil Payload JSON yang Diterima Server Anda (Inbound Message)</span>
                  </h4>
                  <button
                    onClick={() => handleCopy(`{
  "event": "message.received",
  "deviceId": "cmuduqih30001wg0hjnl5dvc1",
  "from": "628123456789@c.us",
  "body": "Halo, apakah stok produk ini masih tersedia?",
  "type": "chat",
  "timestamp": "2026-09-23T11:45:00.000Z",
  "metadata": {
    "id": "true_628123456789@c.us_3EB01234567890",
    "notifyName": "Budi Santoso",
    "isGroupMsg": false,
    "from": "628123456789@c.us",
    "to": "628175013371@c.us",
    "type": "chat",
    "body": "Halo, apakah stok produk ini masih tersedia?"
  }
}`, 'webhook-sample-payload')}
                    className="text-[11px] text-emerald-600 font-bold hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'webhook-sample-payload' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Salin Payload JSON</span>
                  </button>
                </div>

                <div className="bg-slate-950 rounded-xl p-4 font-mono text-[11px] text-emerald-400 border border-slate-800 overflow-x-auto">
                  <pre>{`{
  "event": "message.received",             // Jenis event
  "deviceId": "cmuduqih30001wg0hjnl5dvc1", // ID perangkat penerima di gateway
  "from": "628123456789@c.us",             // WhatsApp JID pengirim pesan
  "body": "Halo, apakah stok produk ini masih tersedia?", // Isi pesan teks
  "type": "chat",                          // Jenis pesan (chat, image, video, document)
  "timestamp": "2026-09-23T11:45:00.000Z", // Waktu UTC penerimaan
  "metadata": {
    "id": "true_628123456789@c.us_3EB01234567890",
    "notifyName": "Budi Santoso",           // Nama akun WhatsApp pengirim
    "isGroupMsg": false,                   // True jika pesan berasal dari Grup
    "from": "628123456789@c.us",
    "to": "628175013371@c.us"
  }
}`}</pre>
                </div>
              </div>

              {/* Template Skrip Penerima Webhook (Receiver Code) */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-emerald-600" />
                    <span>Contoh Script Webhook Receiver untuk Server Anda (Siap Pakai)</span>
                  </h4>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold">
                    {(['php', 'laravel', 'nodejs', 'python'] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => setWebhookCodeLang(l)}
                        className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                          webhookCodeLang === l ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {l === 'php' ? 'PHP Native' : l === 'laravel' ? 'Laravel' : l === 'nodejs' ? 'Node.js Express' : 'Python FastAPI'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative bg-slate-950 rounded-xl p-4 font-mono text-[11px] text-slate-200 border border-slate-800 overflow-x-auto">
                  <button
                    onClick={() => handleCopy(getWebhookReceiverSnippet(webhookCodeLang), `webhook-code-${webhookCodeLang}`)}
                    className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                    title="Salin Skrip"
                  >
                    {copiedId === `webhook-code-${webhookCodeLang}` ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <pre className="leading-relaxed whitespace-pre">{getWebhookReceiverSnippet(webhookCodeLang)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Category Navigation Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Semua Endpoint ({ENDPOINTS.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Endpoints Accordion List */}
        <div className="space-y-6">
          {categories
            .filter((c) => selectedCategory === 'ALL' || selectedCategory === c)
            .map((cat) => {
              const catEndpoints = ENDPOINTS.filter((e) => e.category === cat);
              return (
                <div key={cat} className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                    <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">{cat}</h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {catEndpoints.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {catEndpoints.map((ep) => {
                      const isExpanded = !!expandedEndpoints[ep.id];
                      const currentLang = activeLang[ep.id] || 'curl';
                      const testResp = testResponses[ep.id];

                      const methodColor =
                        ep.method === 'POST' ? 'bg-emerald-100 text-emerald-800' :
                        ep.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                        ep.method === 'PATCH' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800';

                      const borderMethod =
                        ep.method === 'POST' ? 'border-emerald-200' :
                        ep.method === 'GET' ? 'border-blue-200' :
                        ep.method === 'PATCH' ? 'border-amber-200' :
                        'border-rose-200';

                      const bgMethodHeader =
                        ep.method === 'POST' ? 'bg-emerald-50/40 hover:bg-emerald-50/70' :
                        ep.method === 'GET' ? 'bg-blue-50/40 hover:bg-blue-50/70' :
                        ep.method === 'PATCH' ? 'bg-amber-50/40 hover:bg-amber-50/70' :
                        'bg-rose-50/40 hover:bg-rose-50/70';

                      return (
                        <div
                          key={ep.id}
                          className={`rounded-xl border ${borderMethod} bg-white shadow-xs overflow-hidden transition-all`}
                        >
                          {/* Accordion Bar */}
                          <div
                            onClick={() => toggleEndpoint(ep.id)}
                            className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none ${bgMethodHeader}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black font-mono shrink-0 ${methodColor}`}>
                                {ep.method}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-900 truncate">
                                {ep.path}
                              </span>
                              <span className="text-xs text-slate-500 truncate hidden md:inline">
                                - {ep.summary}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {ep.requiresAuth && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>Auth</span>
                                </span>
                              )}
                              <button className="text-slate-400 hover:text-slate-700">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Accordion Content Body */}
                          {isExpanded && (
                            <div className="p-5 border-t border-slate-100 space-y-5 bg-white">
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {ep.description}
                              </p>

                              {/* Parameters Table */}
                              {ep.bodyParams && ep.bodyParams.length > 0 && (
                                <div>
                                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                    Request Body Parameters (JSON)
                                  </h4>
                                  <div className="rounded-lg border border-slate-200 overflow-x-auto text-xs">
                                    <table className="w-full text-left">
                                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                                        <tr>
                                          <th className="px-3 py-2">Parameter</th>
                                          <th className="px-3 py-2">Tipe</th>
                                          <th className="px-3 py-2">Status</th>
                                          <th className="px-3 py-2">Keterangan</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {ep.bodyParams.map((p) => (
                                          <tr key={p.name}>
                                            <td className="px-3 py-2 font-mono font-bold text-slate-900">{p.name}</td>
                                            <td className="px-3 py-2 font-mono text-slate-500">{p.type}</td>
                                            <td className="px-3 py-2">
                                              {p.required ? (
                                                <span className="text-[10px] font-bold text-rose-600">Wajib</span>
                                              ) : (
                                                <span className="text-[10px] text-slate-400">Opsional</span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">{p.description}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* HASIL CONTOH RESPON (EXPECTED RESPONSE OUTPUT) */}
                              {ep.exampleResponse && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Contoh Format Hasil Response (HTTP 200 OK)</span>
                                    </span>
                                    <button
                                      onClick={() => handleCopy(JSON.stringify(ep.exampleResponse, null, 2), `resp-${ep.id}`)}
                                      className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                                    >
                                      {copiedId === `resp-${ep.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                      <span>Salin JSON Hasil</span>
                                    </button>
                                  </div>
                                  <div className="bg-slate-900 rounded-xl p-3.5 font-mono text-[11px] text-emerald-400 border border-slate-800 overflow-x-auto max-h-56">
                                    <pre>{JSON.stringify(ep.exampleResponse, null, 2)}</pre>
                                  </div>
                                </div>
                              )}

                              {/* Live Interactive "Try it out" Section */}
                              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                                    <span>Try it out (Eksekusi Permintaan Langsung)</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {baseUrl}{ep.path}
                                  </span>
                                </div>

                                {ep.defaultPayload && (
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                      JSON Request Body
                                    </label>
                                    <textarea
                                      rows={5}
                                      value={payloads[ep.id] || ''}
                                      onChange={(e) => setPayloads({ ...payloads, [ep.id]: e.target.value })}
                                      className="w-full p-2.5 font-mono text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                                    />
                                  </div>
                                )}

                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[11px] text-slate-500">
                                    {apiKeys ? '✓ Menggunakan Kredensial Aktif' : '⚠️ Pastikan Header Autentikasi di atas terisi'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleExecute(ep)}
                                    disabled={testResp?.loading}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                                  >
                                    {testResp?.loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    <span>{testResp?.loading ? 'Mengirim...' : 'Execute Request'}</span>
                                  </button>
                                </div>

                                {/* Live Response Viewer */}
                                {testResp && !testResp.loading && (
                                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-bold text-slate-700">Hasil Respon Server:</span>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                        testResp.status === 200 || testResp.status === 201 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        HTTP Status: {testResp.status}
                                      </span>
                                    </div>
                                    <div className="bg-slate-900 rounded-lg p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-60 border border-slate-800">
                                      <pre>{JSON.stringify(testResp.data, null, 2)}</pre>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Multi-Language Code Snippets */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    Contoh Kode Pemanggilan Client
                                  </span>
                                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                                    {(['curl', 'php', 'laravel', 'nodejs', 'python'] as const).map((l) => (
                                      <button
                                        key={l}
                                        onClick={() => setActiveLang({ ...activeLang, [ep.id]: l })}
                                        className={`px-2 py-1 rounded cursor-pointer transition-all ${
                                          currentLang === l ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                      >
                                        {l.toUpperCase()}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="relative bg-slate-950 rounded-xl p-3.5 font-mono text-[11px] text-slate-200 border border-slate-800 overflow-x-auto">
                                  <button
                                    onClick={() => handleCopy(getCodeSnippet(ep, currentLang), ep.id)}
                                    className="absolute right-2.5 top-2.5 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                                    title="Salin Kode"
                                  >
                                    {copiedId === ep.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                  <pre className="leading-relaxed whitespace-pre">{getCodeSnippet(ep, currentLang)}</pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </main>
    </div>
  );
}
