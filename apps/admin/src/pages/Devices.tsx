import { useState, useEffect } from 'react';
import { 
  Plus, 
  Smartphone, 
  RefreshCw, 
  Trash2, 
  Globe, 
  Send as SendIcon, 
  Check, 
  X, 
  Loader2, 
  ShieldCheck, 
  QrCode,
  MessageSquare,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { deviceService, messageService } from '../services/api';
import { clsx } from 'clsx';

export default function Devices() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [addingDevice, setAddingDevice] = useState(false);

  // Test Message Modal
  const [testModalDevice, setTestModalDevice] = useState<any | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Halo! Ini adalah pesan uji coba dari WAGTW Gateway.');
  const [sendingTest, setSendingTest] = useState(false);
  const [testSentStatus, setTestSentStatus] = useState<string | null>(null);

  // QR Modal
  const [qrModalDevice, setQrModalDevice] = useState<any | null>(null);

  // Webhook Modal
  const [webhookDevice, setWebhookDevice] = useState<any | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);

  const fetchDevices = async () => {
    try {
      const res = await deviceService.getDevices();
      setDevices(res.data || []);
      
      setQrModalDevice((prev: any) => {
        if (!prev) return null;
        const updated = (res.data || []).find((d: any) => d.id === prev.id);
        if (!updated) return null;
        if (updated.status === 'CONNECTED' && prev.status !== 'CONNECTED') {
          setTimeout(() => setQrModalDevice(null), 3000);
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    setAddingDevice(true);
    try {
      await deviceService.createDevice(newDeviceName.trim());
      setNewDeviceName('');
      setShowAddModal(false);
      fetchDevices();
    } catch (err) {
      alert('Gagal menambahkan perangkat baru');
    } finally {
      setAddingDevice(false);
    }
  };

  const handleConnect = async (device: any) => {
    setConnectingId(device.id);
    setQrModalDevice(device);
    try {
      await deviceService.connectDevice(device.id);
      fetchDevices();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal memulai koneksi');
    } finally {
      setTimeout(() => setConnectingId(null), 2500);
    }
  };

  const handleDeleteDevice = async (device: any) => {
    if (!confirm(`Hapus perangkat "${device.name}"?\n\nSesi WhatsApp akan dimatikan dan data riwayat akan dibersihkan.`)) {
      return;
    }
    try {
      await deviceService.deleteDevice(device.id);
      if (qrModalDevice?.id === device.id) setQrModalDevice(null);
      fetchDevices();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menghapus perangkat');
    }
  };

  const handleSaveWebhook = async () => {
    if (!webhookDevice) return;
    try {
      await deviceService.updateWebhook(webhookDevice.id, webhookUrl);
      setWebhookDevice(null);
      fetchDevices();
    } catch (err) {
      alert('Gagal menyimpan webhook');
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return;
    setTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const res = await deviceService.testWebhook(webhookUrl);
      setWebhookTestResult(res.data);
    } catch (err: any) {
      setWebhookTestResult({ success: false, error: err.response?.data?.error || err.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  const normalizePhone = (input: string) => {
    let cleaned = input.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8')) {
      cleaned = '62' + cleaned;
    }
    return cleaned;
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testModalDevice || !testPhone.trim()) return;
    setSendingTest(true);
    setTestSentStatus(null);
    try {
      const formattedTo = normalizePhone(testPhone);
      await messageService.sendMessage({
        deviceId: testModalDevice.id,
        to: formattedTo,
        text: testMessage
      });
      setTestSentStatus('Pesan berhasil terkirim!');
      setTimeout(() => {
        setTestModalDevice(null);
        setTestSentStatus(null);
      }, 1500);
    } catch (err: any) {
      setTestSentStatus(`Gagal kirim: ${err.response?.data?.error || err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen WhatsApp Devices</h1>
          <p className="text-xs text-slate-500 mt-0.5">Kelola multi-nomor WhatsApp Anda dalam satu panel kendali terpusat.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg font-bold text-xs transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Device Baru</span>
        </button>
      </div>

      {/* Device Grid */}
      {loading && devices.length === 0 ? (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-600">Memuat daftar perangkat...</p>
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center flex flex-col items-center shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Belum ada WhatsApp Device Terdaftar</h3>
          <p className="text-slate-500 text-xs mt-1 mb-4 max-w-md">
            Mulai dengan menambahkan nama perangkat pertama Anda, lalu scan QR Code dengan WhatsApp di ponsel.
          </p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Device Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device: any) => {
            const isConnected = device.status === 'CONNECTED';
            const isQR = device.status === 'QR_READY';
            const isConnecting = device.status === 'CONNECTING' || connectingId === device.id;

            return (
              <div 
                key={device.id} 
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6">
                  {/* Top Bar */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                      <Smartphone className="w-6 h-6 text-slate-700" />
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className={clsx(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                        isConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" :
                        isQR ? "bg-blue-50 text-blue-700 border border-blue-200/60 animate-pulse" :
                        isConnecting ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60 animate-pulse" :
                        "bg-slate-100 text-slate-600 border border-slate-200"
                      )}>
                        <span className={clsx(
                          "w-1.5 h-1.5 rounded-full",
                          isConnected ? "bg-emerald-500" :
                          isQR ? "bg-blue-500" :
                          isConnecting ? "bg-indigo-500" :
                          "bg-slate-400"
                        )}></span>
                        {device.status}
                      </span>
                    </div>
                  </div>

                  {/* Device Info */}
                  <h3 className="text-lg font-bold text-slate-900 truncate">{device.name}</h3>
                  <div className="flex items-center gap-2 mt-1 mb-4 text-xs font-medium text-slate-500">
                    <span>Nomor:</span>
                    <span className="font-semibold text-slate-800">
                      {device.phoneNumber ? `+${device.phoneNumber}` : 'Belum Terhubung'}
                    </span>
                  </div>

                  {/* Webhook & Features Pill */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => {
                        setWebhookDevice(device);
                        setWebhookUrl(device.webhookUrl || '');
                        setWebhookTestResult(null);
                      }}
                      className={clsx(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
                        device.webhookUrl 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100" 
                          : "bg-slate-50 text-slate-500 border-slate-200/60 hover:bg-slate-100"
                      )}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{device.webhookUrl ? 'Webhook Aktif' : 'Atur Webhook'}</span>
                    </button>

                    {device.autoReply && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Gemini Active</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="bg-slate-50/80 px-6 py-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <button 
                        onClick={() => {
                          setTestModalDevice(device);
                          setTestPhone('');
                          setTestSentStatus(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <SendIcon className="w-3.5 h-3.5" />
                        <span>Kirim Tes</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleConnect(device)}
                        disabled={isConnecting}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <QrCode className="w-3.5 h-3.5" />
                        )}
                        <span>{isQR ? 'Buka QR' : isConnecting ? 'Menghubungkan...' : 'Scan QR'}</span>
                      </button>
                    )}

                    {isConnected && (
                      <button 
                        onClick={() => handleConnect(device)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
                        title="Reconnect Session"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={() => handleDeleteDevice(device)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Hapus Perangkat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Tambah Device Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">Tambah Device Baru</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateDevice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Perangkat / Label
                </label>
                <input 
                  type="text" 
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="Misal: CS Utama, Notifikasi Transaksi" 
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Nama ini digunakan untuk membedakan nomor di dashboard.</p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={addingDevice}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {addingDevice && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Perangkat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Scan QR Code */}
      {qrModalDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div className="text-left">
                <h3 className="text-xl font-extrabold text-slate-900">Tautkan WhatsApp</h3>
                <p className="text-xs text-slate-500 font-medium">Perangkat: <span className="text-slate-800 font-bold">{qrModalDevice.name}</span></p>
              </div>
              <button 
                onClick={() => setQrModalDevice(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {qrModalDevice.status === 'CONNECTED' ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Berhasil Terhubung!</h4>
                <p className="text-xs text-slate-500">Nomor: +{qrModalDevice.phoneNumber}</p>
              </div>
            ) : qrModalDevice.qrCode ? (
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 inline-block shadow-inner">
                  <img 
                    src={qrModalDevice.qrCode} 
                    alt="WhatsApp QR Code" 
                    className="w-64 h-64 mx-auto rounded-xl shadow-sm"
                  />
                </div>

                <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-2">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    Petunjuk Scan dari HP Anda:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-500">
                    <li>Buka aplikasi <strong>WhatsApp</strong> di HP Anda.</li>
                    <li>Buka menu <strong>Titik Tiga</strong> (Android) atau <strong>Pengaturan</strong> (iPhone).</li>
                    <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong>.</li>
                    <li>Ketuk <strong>Tautkan Perangkat</strong> dan arahkan kamera ke QR di atas.</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                <p className="text-sm font-bold text-slate-800">Sedang menyiapkan QR Code...</p>
                <p className="text-xs text-slate-400">Browser Chromium sedang memuat WhatsApp Web di server.</p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setQrModalDevice(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Kirim Pesan Uji Coba */}
      {testModalDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Kirim Pesan Tes</h3>
                <p className="text-xs text-slate-400">Menggunakan nomor: <strong className="text-slate-700">{testModalDevice.name}</strong></p>
              </div>
              <button onClick={() => setTestModalDevice(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendTestMessage} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nomor Tujuan WhatsApp
                  </label>
                  {testPhone.trim() && (
                    <span className={`text-[11px] font-mono font-bold ${
                      normalizePhone(testPhone).length >= 10 ? 'text-emerald-600' : 'text-amber-500'
                    }`}>
                      Format WA: +{normalizePhone(testPhone)}
                    </span>
                  )}
                </div>
                <input 
                  type="text" 
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Contoh: 0817101337 / +62817101337" 
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Bisa diawali 08..., 628..., +62..., atau 8... (otomatis diubah ke format internasional WhatsApp).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Isi Pesan
                </label>
                <textarea 
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {testSentStatus && (
                <div className={clsx(
                  "p-3 rounded-xl text-xs font-semibold",
                  testSentStatus.includes('berhasil') ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                )}>
                  {testSentStatus}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => setTestModalDevice(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={sendingTest}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {sendingTest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Kirim Sekarang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Webhook Setting */}
      {webhookDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Konfigurasi Webhook</h3>
                <p className="text-xs text-slate-400">Terima pesan masuk ke server website Anda sendiri.</p>
              </div>
              <button onClick={() => setWebhookDevice(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Webhook URL (POST Endpoint)
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="url" 
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://domain-anda.com/api/wa-webhook"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {webhookTestResult && (
                <div className={clsx(
                  "p-3 rounded-xl text-xs flex items-center gap-2",
                  webhookTestResult.success ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                )}>
                  {webhookTestResult.success ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-rose-600" />}
                  <span>{webhookTestResult.success ? `Webhook Aktif! Respon dalam ${webhookTestResult.latency}ms` : `Gagal: ${webhookTestResult.error}`}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button 
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !webhookUrl}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {testingWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendIcon className="w-3.5 h-3.5" />}
                  <span>Uji Endpoint URL</span>
                </button>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setWebhookDevice(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleSaveWebhook}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    Simpan Webhook
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
