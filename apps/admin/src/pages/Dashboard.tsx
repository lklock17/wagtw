import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Smartphone, 
  Send, 
  Inbox, 
  KeyRound, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  Flame, 
  Code2, 
  Plus, 
  Activity, 
  Server, 
  ShieldCheck,
  Zap,
  Clock,
  ChevronRight
} from 'lucide-react';
import { statsService, deviceService, messageService } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState<any>({
    activeDevices: 0,
    totalDevices: 0,
    sentMessages: 0,
    inboxMessages: 0,
    totalClients: 0
  });
  const [devices, setDevices] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Send Modal State
  const [showQuickSend, setShowQuickSend] = useState(false);
  const [quickTo, setQuickTo] = useState('');
  const [quickMsg, setQuickMsg] = useState('');
  const [quickSending, setQuickSending] = useState(false);
  const [quickAlert, setQuickAlert] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [sRes, dRes] = await Promise.all([
        statsService.getStats(),
        deviceService.getDevices()
      ]);
      setStats(sRes.data || {});
      setDevices(dRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTo || !quickMsg) return;
    setQuickSending(true);
    setQuickAlert(null);
    try {
      await messageService.sendMessage({
        to: quickTo,
        text: quickMsg,
        deviceId: 'rotate', // Use Auto-Rotate by default
        failover: true
      });
      setQuickAlert('Pesan berhasil dikirim via Auto-Rotate!');
      setQuickTo('');
      setQuickMsg('');
      setTimeout(() => {
        setQuickAlert(null);
        setShowQuickSend(false);
        loadDashboard();
      }, 1500);
    } catch (err: any) {
      setQuickAlert('Gagal mengirim: ' + (err.response?.data?.error || err.message));
    } finally {
      setQuickSending(false);
    }
  };

  const connectedDevices = devices.filter((d) => d.status === 'CONNECTED');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Status operasional gerbang WhatsApp, statistik pesan, dan klaster auto-rotate real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuickSend(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim Pesan Cepat</span>
          </button>

          <Link
            to="/docs"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all shadow-xs"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Dokumentasi API</span>
          </Link>

          <button
            onClick={loadDashboard}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 transition-all shadow-xs cursor-pointer"
            title="Muat Ulang Data"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Compact Metrics Bar (4 Proportional Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">WhatsApp Devices</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {stats.activeDevices || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              / {stats.totalDevices || 0} terhubung
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${connectedDevices.length > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
            <span className={connectedDevices.length > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
              {connectedDevices.length > 0 ? 'Cluster Siap Digunakan' : 'Belum Ada Device Aktif'}
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Pesan Keluar</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {stats.sentMessages || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">terkirim</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-blue-700 font-semibold">
            <ArrowUpRight className="w-3 h-3" />
            <span>Success Rate 99.8%</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pesan Masuk (Inbox)</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Inbox className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {stats.inboxMessages || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">diterima</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Respons real-time</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">API Clients</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <KeyRound className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {stats.totalClients || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">kunci aktif</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
            <Zap className="w-3 h-3 text-emerald-500" />
            <span>Auto-Rotate Ready</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Devices Hub + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Device Cluster & Volume Activity (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Device Cluster Hub Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Status Perangkat WhatsApp Terdaftar
                </h3>
              </div>
              <Link
                to="/devices"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <span>Kelola Semua ({devices.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {devices.length === 0 ? (
                <div className="py-8 text-center">
                  <Smartphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Belum ada perangkat WhatsApp yang ditambahkan</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Hubungkan nomor WhatsApp Anda dengan memindai kode QR.
                  </p>
                  <Link
                    to="/devices"
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Device Sekarang</span>
                  </Link>
                </div>
              ) : (
                devices.map((device) => {
                  const isConn = device.status === 'CONNECTED';
                  return (
                    <div key={device.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isConn ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">{device.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                isConn
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {device.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {device.phoneNumber ? `+${device.phoneNumber}` : 'Belum scan QR'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to="/devices"
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                        >
                          Detail
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Clean Message Activity & Volume Overview */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Volume Trafik Pesan Harian
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">7 Hari Terakhir</span>
            </div>

            {/* Compact Scaled SVG Graphic */}
            <div className="mt-4 pt-2">
              <div className="h-36 flex items-end justify-between gap-3 px-2">
                {[
                  { day: 'Kam', val: 35, count: 120 },
                  { day: 'Jum', val: 55, count: 210 },
                  { day: 'Sab', val: 40, count: 160 },
                  { day: 'Min', val: 65, count: 280 },
                  { day: 'Sen', val: 85, count: 420 },
                  { day: 'Sel', val: 70, count: 350 },
                  { day: 'Hari Ini', val: 92, count: 490, active: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                      {item.count}
                    </span>
                    <div className="w-full bg-slate-100 rounded-lg overflow-hidden flex items-end h-24">
                      <div
                        style={{ height: `${item.val}%` }}
                        className={`w-full rounded-md transition-all duration-300 ${
                          item.active
                            ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-xs'
                            : 'bg-slate-300 group-hover:bg-slate-400'
                        }`}
                      ></div>
                    </div>
                    <span className={`text-[10px] font-semibold ${item.active ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                      {item.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Engine Cluster, Auto-Rotate & Quick Actions (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Refined System Health Card (Clean White with Subtle Slate Borders) */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Klaster Gateway</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                NORMAL
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-semibold text-slate-700">WPPConnect Worker</span>
                <span className="font-mono font-bold text-emerald-700">Port 4011 (Online)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-semibold text-slate-700">REST API Server</span>
                <span className="font-mono font-bold text-emerald-700">Port 4010 (Online)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-semibold text-slate-700">Database Engine</span>
                <span className="font-mono font-bold text-emerald-700">PostgreSQL (5432)</span>
              </div>
            </div>

            {/* Auto-Rotate Pool Status Indicator */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                <RotateCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                <span>Auto-Rotate & Failover: Siap</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-tight">
                {connectedDevices.length} device aktif siap mendistribusikan beban pesan secara otomatis tanpa downtime.
              </p>
            </div>
          </div>

          {/* Quick Integration Banner */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Integrasi API Instan</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Hubungkan WhatsApp Gateway dengan Laravel, PHP, NodeJS, atau Python menggunakan REST API kami.
            </p>
            <div className="pt-1">
              <Link
                to="/docs"
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Buka Dokumentasi & Code Snippets</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Warmup Feature Callout */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Warmup AI</h3>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                9routes AI
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Cegah nomor baru diblokir WhatsApp dengan pemanasan obrolan peer-to-peer 24/7 menggunakan AI.
            </p>
            <Link
              to="/warmup"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 pt-1"
            >
              <span>Atur Pemanasan Nomor</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Send Modal */}
      {showQuickSend && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Kirim Pesan Cepat</h3>
              </div>
              <button
                onClick={() => setShowQuickSend(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {quickAlert && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200">
                {quickAlert}
              </div>
            )}

            <form onSubmit={handleQuickSend} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nomor WhatsApp Tujuan
                </label>
                <input
                  type="text"
                  required
                  value={quickTo}
                  onChange={(e) => setQuickTo(e.target.value)}
                  placeholder="081234567890"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Isi Pesan
                </label>
                <textarea
                  required
                  rows={3}
                  value={quickMsg}
                  onChange={(e) => setQuickMsg(e.target.value)}
                  placeholder="Tulis pesan..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Pesan otomatis dikirim menggunakan <strong>Auto-Rotate & Failover</strong> pool.</span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickSend(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={quickSending}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {quickSending ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{quickSending ? 'Mengirim...' : 'Kirim Sekarang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
