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
  ArrowRight
} from 'lucide-react';
import axios from 'axios';

interface ApiDocsProps {
  isPublic?: boolean;
}

interface EndpointDef {
  id: string;
  category: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  path: string;
  summary: string;
  description: string;
  requiresAuth: boolean;
  defaultPayload?: any;
  queryParams?: Array<{ name: string; type: string; required: boolean; description: string; defaultVal?: string }>;
  bodyParams?: Array<{ name: string; type: string; required: boolean; description: string }>;
}

const ENDPOINTS: EndpointDef[] = [
  // 1. Messages & Auto-Rotate
  {
    id: 'msg-send',
    category: 'Messages & Auto-Rotate Engine',
    method: 'POST',
    path: '/api/messages/send',
    summary: 'Kirim Pesan WhatsApp (Dukungan Auto-Rotate & Auto-Failover)',
    description: 'Mengirim pesan teks atau media ke satu nomor WhatsApp. Jika deviceId diisi "rotate" atau "auto", sistem secara otomatis membagi beban pesan ke semua nomor aktif secara merata (Round-Robin). Jika nomor pengirim mati atau terputus koneksinya, sistem secara otomatis mengalihkan (failover) ke nomor aktif lainnya.',
    requiresAuth: true,
    defaultPayload: {
      to: "081234567890",
      text: "Halo! Pesan ini dikirim otomatis via REST API WAGTW.",
      deviceId: "rotate",
      failover: true
    },
    bodyParams: [
      { name: 'to', type: 'string', required: true, description: 'Nomor tujuan (format 08xxx atau 628xxx)' },
      { name: 'text', type: 'string', required: true, description: 'Isi teks pesan (atau alias "message")' },
      { name: 'deviceId', type: 'string', required: false, description: 'Isi "rotate" atau "auto" untuk auto-load balancing & failover, atau ID device tertentu' },
      { name: 'failover', type: 'boolean', required: false, description: 'Default: true. Jika nomor mati / disconnect, otomatis ganti ke nomor sehat lainnya' },
      { name: 'type', type: 'string', required: false, description: 'Pilihan: TEXT (default), IMAGE, atau VIDEO' },
      { name: 'url', type: 'string', required: false, description: 'URL file gambar/video publik jika type bukan TEXT' }
    ]
  },
  {
    id: 'msg-media',
    category: 'Messages & Auto-Rotate Engine',
    method: 'POST',
    path: '/api/messages/send',
    summary: 'Kirim Gambar / Video dengan Caption',
    description: 'Mengirim media gambar atau video dari URL langsung ke penerima WhatsApp dengan caption pendukung.',
    requiresAuth: true,
    defaultPayload: {
      to: "081234567890",
      type: "IMAGE",
      url: "https://picsum.photos/600/400",
      caption: "Lihat gambar promo terbaru dari sistem kami!",
      deviceId: "rotate"
    },
    bodyParams: [
      { name: 'to', type: 'string', required: true, description: 'Nomor WhatsApp tujuan' },
      { name: 'type', type: 'string', required: true, description: 'IMAGE atau VIDEO' },
      { name: 'url', type: 'string', required: true, description: 'URL media yang dapat diakses publik' },
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
    description: 'Memeriksa apakah suatu nomor telepon terdaftar dan aktif di WhatsApp tanpa mengirim pesan apapun. Cocok untuk integrasi dengan sistem/website lain guna validasi nomor prospek/pelanggan sebelum broadcast.',
    requiresAuth: true,
    defaultPayload: {
      phone: "081234567890",
      deviceId: ""
    },
    bodyParams: [
      { name: 'phone', type: 'string', required: true, description: 'Nomor telepon yang ingin diverifikasi (format bebas: 08xxx, 628xxx, +62xxx)' },
      { name: 'deviceId', type: 'string', required: false, description: 'Opsional: ID device aktif tertentu (otomatis memilih device online jika dikosongkan)' }
    ]
  },

  // 2. WhatsApp Devices
  {
    id: 'dev-list',
    category: 'WhatsApp Devices',
    method: 'GET',
    path: '/api/devices',
    summary: 'Ambil Semua Perangkat & Status Koneksi',
    description: 'Mengambil daftar seluruh nomor WhatsApp yang terdaftar di gateway beserta status koneksi (CONNECTED, DISCONNECTED, QR_READY).',
    requiresAuth: true
  },
  {
    id: 'dev-create',
    category: 'WhatsApp Devices',
    method: 'POST',
    path: '/api/devices',
    summary: 'Tambah Sesi Device Baru',
    description: 'Mendaftarkan nama device baru ke dalam gateway untuk siap di-scan QR kodenya.',
    requiresAuth: true,
    defaultPayload: {
      name: "Device Customer Service 01"
    },
    bodyParams: [
      { name: 'name', type: 'string', required: true, description: 'Nama identifikasi perangkat' }
    ]
  },
  {
    id: 'dev-qr',
    category: 'WhatsApp Devices',
    method: 'GET',
    path: '/api/devices/{id}/qr',
    summary: 'Ambil QR Code Real-Time untuk Login',
    description: 'Mengambil string Base64 QR Code dari sesi device untuk di-scan menggunakan aplikasi WhatsApp di ponsel.',
    requiresAuth: true,
    queryParams: [
      { name: 'id', type: 'string', required: true, description: 'ID device yang ingin di-scan' }
    ]
  },
  {
    id: 'dev-pairing-code',
    category: 'WhatsApp Devices',
    method: 'POST',
    path: '/api/devices/{id}/pairing-code',
    summary: 'Minta Kode Pairing 8-Digit (Login Tanpa QR)',
    description: 'Menghasilkan 8 karakter kode pairing WhatsApp untuk ditautkan via opsi "Tautkan dengan nomor telepon saja" pada aplikasi WhatsApp ponsel.',
    requiresAuth: true,
    defaultPayload: {
      phone: "081234567890"
    },
    bodyParams: [
      { name: 'phone', type: 'string', required: true, description: 'Nomor telepon WhatsApp Anda yang akan ditautkan' }
    ]
  },

  // 3. Warmup AI Engine
  {
    id: 'warmup-config',
    category: 'Warmup AI Engine (9routes)',
    method: 'GET',
    path: '/api/warmup/config',
    summary: 'Ambil Konfigurasi Warmup Nomor',
    description: 'Mengambil status pemanasan otomatis (isEnabled), target chat harian, jeda delay menit, dan model 9routes AI yang aktif.',
    requiresAuth: true
  },
  {
    id: 'warmup-update',
    category: 'Warmup AI Engine (9routes)',
    method: 'POST',
    path: '/api/warmup/config',
    summary: 'Update Pengaturan Pemanasan AI',
    description: 'Mengubah master switch, target obrolan per hari, jeda delay, atau mengganti model AI 9routes.',
    requiresAuth: true,
    defaultPayload: {
      isEnabled: true,
      dailyTarget: 10,
      minDelayMinutes: 2,
      aiModel: "mistral/mistral-large-latest",
      topicPrompt: "Ngobrol santai natural bahasa Indonesia sehari-hari seperti teman akrab."
    },
    bodyParams: [
      { name: 'isEnabled', type: 'boolean', required: false, description: 'true untuk mengaktifkan pemanasan 24/7' },
      { name: 'dailyTarget', type: 'number', required: false, description: 'Jumlah target sesi chat per hari' },
      { name: 'minDelayMinutes', type: 'number', required: false, description: 'Jeda minimal sebelum lawan bicara membalas' },
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
    requiresAuth: true
  },

  // 4. Broadcast & Scheduling
  {
    id: 'bulk-create',
    category: 'Broadcast Massal & Penjadwalan',
    method: 'POST',
    path: '/api/bulk',
    summary: 'Mulai Kampanye Broadcast Massal',
    description: 'Mengirim pesan serentak ke ratusan atau ribuan nomor dengan jeda waktu aman per kontak.',
    requiresAuth: true,
    defaultPayload: {
      name: "Promo Spesial Gajian",
      deviceId: "rotate",
      contacts: ["081234567890", "085712345678"],
      body: "Halo! Dapatkan diskon 50% hari ini khusus untuk Anda.",
      delay: 5
    },
    bodyParams: [
      { name: 'name', type: 'string', required: true, description: 'Nama kampanye broadcast' },
      { name: 'contacts', type: 'array', required: true, description: 'Array nomor WhatsApp tujuan' },
      { name: 'body', type: 'string', required: true, description: 'Teks pesan' },
      { name: 'delay', type: 'number', required: false, description: 'Jeda aman dalam detik per pesan (default: 5)' }
    ]
  },
  {
    id: 'sched-create',
    category: 'Broadcast Massal & Penjadwalan',
    method: 'POST',
    path: '/api/schedules',
    summary: 'Jadwalkan Pesan Masa Depan',
    description: 'Menjadwalkan pesan otomatis yang akan dikirim pada tanggal dan jam tertentu.',
    requiresAuth: true,
    defaultPayload: {
      deviceId: "rotate",
      to: "081234567890",
      body: "Pengingat: Jadwal pertemuan besok pukul 10:00 WIB.",
      scheduledAt: new Date(Date.now() + 3600000).toISOString()
    }
  },

  // 5. Inbox
  {
    id: 'inbox-threads',
    category: 'Inbox & Pesan Masuk',
    method: 'GET',
    path: '/api/inbox',
    summary: 'Ambil Seluruh Percakapan Masuk',
    description: 'Mengambil riwayat kontak dan percakapan masuk dari semua nomor WhatsApp.',
    requiresAuth: true
  }
];

export default function ApiDocs({ isPublic = false }: ApiDocsProps) {
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({
    'msg-send': true // default first one opened
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<Record<string, 'curl' | 'php' | 'laravel' | 'nodejs' | 'python'>>({});
  
  // Try-It-Out State per endpoint
  const [payloads, setPayloads] = useState<Record<string, string>>({});
  const [apiKeys, setApiKeys] = useState<string>('');
  const [testResponses, setTestResponses] = useState<Record<string, { status: number; data: any; loading: boolean }>>({});

  const baseUrl = window.location.origin;

  useEffect(() => {
    // Initialize default payloads
    const initialPayloads: Record<string, string> = {};
    ENDPOINTS.forEach((ep) => {
      if (ep.defaultPayload) {
        initialPayloads[ep.id] = JSON.stringify(ep.defaultPayload, null, 2);
      }
    });
    setPayloads(initialPayloads);

    // Try to load user apiKey from localStorage or first client if logged in
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
      if (apiKeys) {
        headers['x-api-key'] = apiKeys;
        headers['Authorization'] = `Bearer ${apiKeys}`;
      }

      let res;
      const targetUrl = `${baseUrl}${ep.path}`;

      if (ep.method === 'POST') {
        const parsedBody = payloads[ep.id] ? JSON.parse(payloads[ep.id]) : {};
        res = await axios.post(targetUrl, parsedBody, { headers, timeout: 15000 });
      } else if (ep.method === 'DELETE') {
        res = await axios.delete(targetUrl, { headers, timeout: 15000 });
      } else {
        res = await axios.get(targetUrl, { headers, timeout: 15000 });
      }

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

  // Generate Code Snippets for an Endpoint
  const getCodeSnippet = (ep: EndpointDef, lang: 'curl' | 'php' | 'laravel' | 'nodejs' | 'python') => {
    const key = apiKeys || 'YOUR_API_KEY';
    const bodyStr = payloads[ep.id] || (ep.defaultPayload ? JSON.stringify(ep.defaultPayload) : '{}');
    const fullUrl = `${baseUrl}${ep.path}`;

    if (lang === 'curl') {
      if (ep.method === 'GET') {
        return `curl -X GET "${fullUrl}" \\
  -H "x-api-key: ${key}"`;
      }
      return `curl -X ${ep.method} "${fullUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${key}" \\
  -d '${bodyStr.replace(/\n\s*/g, '')}'`;
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

  // Group endpoints by category
  const categories = Array.from(new Set(ENDPOINTS.map((e) => e.category)));

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
                  v1.0 OAS
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Enterprise WhatsApp REST API with Auto-Rotate & Failover</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>Masuk ke Panel Admin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Intro Documentation Banner (Sansekai Style) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Welcome to WAGTW WhatsApp Gateway API</h1>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Dokumentasi resmi REST API untuk integrasi WhatsApp Gateway ke berbagai sistem (Laravel, PHP, NodeJS, Python, Bot, ERP).
              Dilengkapi dengan fitur <strong>Auto-Rotate</strong> (pembagian beban pesan antar nomor WhatsApp secara otomatis) dan <strong>Auto-Failover</strong> (nomor mati / terputus otomatis digantikan oleh nomor sehat berikutnya tanpa menggagalkan pengiriman).
            </p>
          </div>

          {/* Servers Dropdown & API Key Bar (Sansekai Style) */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Servers
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-800">
                <Server className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{baseUrl}/api - Production Server (Port 4010)</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                API Key Klien (x-api-key / Bearer)
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:bg-white focus-within:border-emerald-500 transition-colors">
                <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={apiKeys}
                  onChange={(e) => setApiKeys(e.target.value)}
                  placeholder="Masukkan API Key dari menu 'API Client Keys'..."
                  className="w-full bg-transparent text-xs font-mono text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Spotlight: Auto-Rotate & Failover Summary */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl p-4 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <RotateCw className="w-5 h-5 text-white animate-spin" />
            </div>
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>FITUR UTAMA: AUTO-ROTATE & AUTO-FAILOVER AKTIF</span>
                <span className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-mono">"deviceId": "rotate"</span>
              </div>
              <p className="text-[11px] text-emerald-100 mt-0.5">
                Cukup isi parameter <code className="bg-white/20 px-1 py-0.2 rounded font-mono">"deviceId": "rotate"</code> pada endpoint kirim pesan. Bila nomor pengirim terputus atau mati, sistem otomatis mengalihkan ke nomor cadangan secara instan.
              </p>
            </div>
          </div>
        </div>

        {/* Accordion Categories (Exact Sansekai Layout) */}
        <div className="space-y-6">
          {categories.map((category) => {
            const endpointsInCategory = ENDPOINTS.filter((e) => e.category === category);

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{category}</h2>
                  <span className="text-[10px] font-semibold text-slate-400 font-mono">
                    ({endpointsInCategory.length} endpoints)
                  </span>
                </div>

                <div className="space-y-2">
                  {endpointsInCategory.map((ep) => {
                    const isExpanded = !!expandedEndpoints[ep.id];
                    const methodColor = 
                      ep.method === 'POST' ? 'bg-emerald-600 text-white' :
                      ep.method === 'GET' ? 'bg-blue-600 text-white' :
                      ep.method === 'DELETE' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white';

                    const borderMethod =
                      ep.method === 'POST' ? 'border-emerald-200/90' :
                      ep.method === 'GET' ? 'border-blue-200/90' :
                      ep.method === 'DELETE' ? 'border-rose-200/90' : 'border-amber-200/90';

                    const bgMethodHeader =
                      ep.method === 'POST' ? 'bg-emerald-50/40 hover:bg-emerald-50/70' :
                      ep.method === 'GET' ? 'bg-blue-50/40 hover:bg-blue-50/70' :
                      ep.method === 'DELETE' ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'bg-amber-50/40';

                    const currentLang = activeLang[ep.id] || 'curl';
                    const testResp = testResponses[ep.id];

                    return (
                      <div
                        key={ep.id}
                        className={`rounded-xl border ${borderMethod} bg-white shadow-xs overflow-hidden transition-all`}
                      >
                        {/* Accordion Bar (Click to toggle) */}
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

                            {/* Live Interactive "Try it out" Section */}
                            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                                  <span>Try it out (Eksekusi Permintaan)</span>
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
                                  {apiKeys ? '✓ Menggunakan API Key yang terisi' : '⚠️ Pastikan API Key di bar atas terisi'}
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

                              {/* Test Result Viewer */}
                              {testResp && !testResp.loading && (
                                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-700">Response:</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      testResp.status === 200 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      Status: {testResp.status}
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
                                  Contoh Kode
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
                                  className="absolute right-2.5 top-2.5 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
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
