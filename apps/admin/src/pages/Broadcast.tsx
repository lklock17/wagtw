import { useState, useEffect } from 'react';
import { 
  Upload, 
  Send, 
  Smartphone, 
  Clock, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Users, 
  ShieldCheck, 
  Zap,
  Play
} from 'lucide-react';
import { deviceService, bulkService } from '../services/api';

export default function Broadcast() {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('rotate');
  const [jobName, setJobName] = useState('');
  const [message, setMessage] = useState('');
  const [contacts, setContacts] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [delay, setDelay] = useState(5);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchDevices();
    fetchJobs();
    const interval = setInterval(fetchJobs, 6000);
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      const res = await deviceService.getDevices();
      const connected = (res.data || []).filter((d: any) => d.status === 'CONNECTED');
      setDevices(connected);
      if (connected.length > 0 && selectedDevice !== 'rotate') {
        setSelectedDevice(connected[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await bulkService.getJobs();
      setJobs(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      setContacts(lines);
      setManualInput(lines.join('\n'));
    };
    reader.readAsText(file);
  };

  const handleManualChange = (val: string) => {
    setManualInput(val);
    const parsed = val
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    setContacts(parsed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contacts.length === 0 || !message) {
      setAlertMsg({ type: 'error', text: 'Mohon isi daftar nomor kontak dan pesan broadcast.' });
      return;
    }

    const activeConnected = devices.filter((d: any) => !d.isPaused);
    if (activeConnected.length === 0) {
      setAlertMsg({ type: 'error', text: 'Tidak ada perangkat WhatsApp yang aktif dan tidak dijeda (Unpaused).' });
      return;
    }

    setLoading(true);
    setAlertMsg(null);
    try {
      // If 'rotate', use the first active unpaused device or let worker handle
      const devId = selectedDevice === 'rotate' ? activeConnected[0]?.id : selectedDevice;
      await bulkService.createJob({
        name: jobName || `Kampanye ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        deviceId: devId,
        contacts,
        body: message,
        delay
      });
      setAlertMsg({ type: 'success', text: `Kampanye broadcast berhasil dimulai untuk ${contacts.length} kontak!` });
      setJobName('');
      setMessage('');
      setContacts([]);
      setManualInput('');
      fetchJobs();
      setTimeout(() => setAlertMsg(null), 4000);
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: 'Gagal membuat kampanye: ' + (err.response?.data?.error || err.message) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Broadcast Massal (Campaign)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kirim pesan broadcast ke ribuan kontak dengan jeda dinamis untuk menjaga keamanan akun WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
            {devices.length} Perangkat Aktif
          </span>
        </div>
      </div>

      {alertMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{alertMsg.text}</span>
          </div>
          <button onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Broadcast Form (7 Cols) */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nama Kampanye
                </label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="Misal: Promo Ramadhan 2026"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Perangkat Pengirim
                </label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="rotate">
                    ⚡ Auto-Rotate Pool ({devices.filter(d => !d.isPaused).length} Nomor Aktif)
                  </option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id} disabled={d.isPaused}>
                      {d.name} (+{d.phoneNumber || 'no-number'}) {d.isPaused ? '(⏸️ Sedang Dijeda)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Delay Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Jeda Antar Pesan (Delay Aman)
                </label>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {delay} Detik / Kontak
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                value={delay}
                onChange={(e) => setDelay(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Rekomendasi minimal 5-10 detik untuk menghindari deteksi spam WhatsApp.
              </p>
            </div>

            {/* Contacts Input & File Upload */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Daftar Nomor Kontak ({contacts.length} Nomor Terdeteksi)
                </label>
                <label className="cursor-pointer text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV/TXT</span>
                  <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <textarea
                rows={4}
                value={manualInput}
                onChange={(e) => handleManualChange(e.target.value)}
                placeholder="Masukkan nomor satu per baris, contoh:&#10;081234567890&#10;085712345678"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
              />
            </div>

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Isi Pesan Broadcast
                </label>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span>Tag:</span>
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">{"{{name}}"}</code>
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">{"{{phone}}"}</code>
                </div>
              </div>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Halo {{name}}, kami memiliki penawaran spesial untuk Anda..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Estimasi waktu: ~{Math.ceil((contacts.length * delay) / 60)} menit
              </span>
              <button
                type="submit"
                disabled={loading || contacts.length === 0 || !message}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-xs shadow-emerald-600/20"
              >
                {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                <span>{loading ? 'Memproses...' : 'Mulai Broadcast'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right: Active Campaigns & Safe Guidelines (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Active Campaigns Card (Clean White, No Dark Block!) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Antrean & Riwayat Broadcast
                </h3>
              </div>
              <button onClick={fetchJobs} className="text-slate-400 hover:text-slate-700">
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {jobs.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <FileText className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">Belum ada kampanye broadcast</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Mulai kampanye baru menggunakan formulir di sebelah kiri.</p>
                </div>
              ) : (
                jobs.map((job) => {
                  const percent = job.total > 0 ? Math.round(((job.sent + job.failed) / job.total) * 100) : 0;
                  return (
                    <div key={job.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 truncate max-w-[180px]">{job.name}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : job.status === 'PROCESSING'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full transition-all ${
                            job.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-emerald-600'
                          }`}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Terkirim: {job.sent} / {job.total}</span>
                        <span>Gagal: {job.failed}</span>
                        <span className="font-mono">{percent}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Safe Sending Rules Box */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Panduan Broadcast Aman (Anti Banned)</span>
            </div>
            <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>Gunakan jeda minimal 5-10 detik antar kontak.</li>
              <li>Gunakan opsi <strong>Auto-Rotate</strong> untuk mendistribusikan beban ke banyak nomor secara bergantian.</li>
              <li>Gunakan fitur <strong>Warmup Nomor (AI)</strong> terlebih dahulu pada nomor baru sebelum mengirim broadcast besar.</li>
              <li>Hindari menyertakan link tautan pada pesan pertama ke nomor yang belum menyimpan nomor Anda.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
