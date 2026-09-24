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
  Sparkles,
  Search,
  KeyRound,
  Copy,
  CheckCircle2,
  XCircle,
  Hash,
  Pause,
  Play
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

  // QR & Pairing Modal
  const [qrModalDevice, setQrModalDevice] = useState<any | null>(null);
  const [justConnected, setJustConnected] = useState(false);
  const [connectTab, setConnectTab] = useState<'qr' | 'pairing'>('qr');
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [requestingPairingCode, setRequestingPairingCode] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingCopied, setPairingCopied] = useState(false);

  // Webhook Modal
  const [webhookDevice, setWebhookDevice] = useState<any | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);

  // Check Number Modal
  const [showCheckNumberModal, setShowCheckNumberModal] = useState(false);
  const [checkDeviceId, setCheckDeviceId] = useState<string>('');
  const [checkPhone, setCheckPhone] = useState('');
  const [checkingNumber, setCheckingNumber] = useState(false);
  const [checkResult, setCheckResult] = useState<any | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      const res = await deviceService.getDevices();
      setDevices(res.data || []);
      
      setQrModalDevice((prev: any) => {
        if (!prev) return null;
        const updated = (res.data || []).find((d: any) => d.id === prev.id);
        if (!updated) return null;
        // Only trigger justConnected if device status CHANGED to CONNECTED and has valid phone number!
        if (updated.status === 'CONNECTED' && prev.status !== 'CONNECTED' && updated.phoneNumber) {
          setJustConnected(true);
          setTimeout(() => {
            setQrModalDevice(null);
            setJustConnected(false);
          }, 3000);
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
    setJustConnected(false);
    setQrModalDevice(device);
    setConnectTab('qr');
    setPairingPhone(device.phoneNumber || '');
    setPairingCode(null);
    setPairingError(null);
    try {
      await deviceService.connectDevice(device.id);
      fetchDevices();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal memulai koneksi');
    } finally {
      setTimeout(() => setConnectingId(null), 2500);
    }
  };

  const handleSwitchToQrTab = async () => {
    setConnectTab('qr');
    if (qrModalDevice && qrModalDevice.status !== 'CONNECTED') {
      try {
        await deviceService.connectDevice(qrModalDevice.id);
        fetchDevices();
      } catch {}
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

  const [pausingId, setPausingId] = useState<string | null>(null);

  const handleTogglePause = async (device: any) => {
    setPausingId(device.id);
    try {
      await deviceService.togglePause(device.id);
      fetchDevices();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal mengubah status jeda perangkat');
    } finally {
      setPausingId(null);
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

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrModalDevice || !pairingPhone.trim()) return;
    setRequestingPairingCode(true);
    setPairingError(null);
    setPairingCode(null);
    try {
      const formatted = normalizePhone(pairingPhone);
      const res = await deviceService.getPairingCode(qrModalDevice.id, formatted);
      const code = res.data?.pairingCode || res.data?.code;
      if (code) {
        setPairingCode(code);
      } else {
        setPairingError('WhatsApp belum memberikan kode pairing. Pastikan Chromium sudah siap.');
      }
    } catch (err: any) {
      setPairingError(err.response?.data?.error || err.message || 'Gagal memproses kode pairing');
    } finally {
      setRequestingPairingCode(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setPairingCopied(true);
    setTimeout(() => setPairingCopied(false), 2000);
  };

  const handleCheckNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPhone.trim()) return;
    setCheckingNumber(true);
    setCheckResult(null);
    setCheckError(null);
    try {
      const res = await messageService.checkNumber(checkPhone.trim(), checkDeviceId || undefined);
      setCheckResult(res.data);
    } catch (err: any) {
      setCheckError(err.response?.data?.error || err.message || 'Gagal memeriksa nomor');
    } finally {
      setCheckingNumber(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen WhatsApp Devices</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-xs text-slate-500">Kelola multi-nomor WhatsApp Anda dalam satu panel kendali terpusat.</p>
            {devices.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {devices.filter(d => d.status === 'CONNECTED' && !d.isPaused).length} Siap Blast
                </span>
                {devices.some(d => d.isPaused) && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {devices.filter(d => d.isPaused).length} Dijeda
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setShowCheckNumberModal(true);
              setCheckResult(null);
              setCheckError(null);
              const connected = devices.find(d => d.status === 'CONNECTED');
              if (connected) setCheckDeviceId(connected.id);
            }}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-lg font-bold text-xs transition-all shadow-xs cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cek Nomor WA</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg font-bold text-xs transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Device Baru</span>
          </button>
        </div>
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
            Mulai dengan menambahkan nama perangkat pertama Anda, lalu scan QR Code atau gunakan Kode Pairing 8-Digit.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.map((device: any) => {
            const isConnected = device.status === 'CONNECTED';
            const isQR = device.status === 'QR_READY';
            const isConnecting = device.status === 'CONNECTING' || connectingId === device.id;
            const isAndroidAgent = (() => {
              try {
                const s = JSON.parse(device.sessionData || '{}');
                return s.type === 'ANDROID_AGENT';
              } catch (e) {
                return false;
              }
            })();
            const agentModel = (() => {
              try {
                const s = JSON.parse(device.sessionData || '{}');
                return s.model || 'Android Phone';
              } catch (e) {
                return null;
              }
            })();

            return (
              <div 
                key={device.id} 
                className="bg-white rounded-xl border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all duration-150 flex flex-col justify-between overflow-hidden"
              >
                <div className="p-4">
                  {/* Top Bar */}
                  <div className="flex justify-between items-center mb-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                      <Smartphone className="w-4 h-4 text-slate-700" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isAndroidAgent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200" title={agentModel || 'Android Agent'}>
                          📱 {agentModel ? (agentModel.length > 18 ? agentModel.substring(0, 18) + '...' : agentModel) : 'Android Relay'}
                        </span>
                      )}
                      {device.isPaused && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          DIJEDA
                        </span>
                      )}
                      <span className={clsx(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        device.isPaused ? "bg-slate-100 text-slate-500 border border-slate-200" :
                        isConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" :
                        isQR ? "bg-blue-50 text-blue-700 border border-blue-200/60 animate-pulse" :
                        isConnecting ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60 animate-pulse" :
                        "bg-slate-100 text-slate-600 border border-slate-200"
                      )}>
                        <span className={clsx(
                          "w-1.5 h-1.5 rounded-full",
                          device.isPaused ? "bg-amber-400" :
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
                  <h3 className="text-sm font-bold text-slate-900 truncate" title={device.name}>
                    {device.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5 mb-2.5 text-[11px] text-slate-500">
                    <span>Nomor:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {device.phoneNumber ? `+${device.phoneNumber}` : 'Belum Terhubung'}
                    </span>
                  </div>

                  {/* Webhook & Features Pill */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => {
                        setWebhookDevice(device);
                        setWebhookUrl(device.webhookUrl || '');
                        setWebhookTestResult(null);
                      }}
                      className={clsx(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors border cursor-pointer",
                        device.webhookUrl 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100" 
                          : "bg-slate-50 text-slate-500 border-slate-200/60 hover:bg-slate-100"
                      )}
                    >
                      <Globe className="w-3 h-3" />
                      <span>{device.webhookUrl ? 'Webhook Aktif' : 'Atur Webhook'}</span>
                    </button>

                    {device.autoReply && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>AI 9routes Active</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="bg-slate-50/80 px-3.5 py-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {isConnected ? (
                      <>
                        <button 
                          onClick={() => {
                            setTestModalDevice(device);
                            setTestPhone('');
                            setTestSentStatus(null);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <SendIcon className="w-3 h-3" />
                          <span>Kirim Tes</span>
                        </button>

                        <button 
                          onClick={() => handleTogglePause(device)}
                          disabled={pausingId === device.id}
                          className={clsx(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all border cursor-pointer",
                            device.isPaused
                              ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 shadow-xs"
                              : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                          )}
                          title={device.isPaused ? "Lanjutkan nomor ini (ikut blast & auto-reply)" : "Jeda nomor ini (tidak ikut blast & auto-reply)"}
                        >
                          {pausingId === device.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : device.isPaused ? (
                            <Play className="w-3 h-3 fill-amber-600 text-amber-600" />
                          ) : (
                            <Pause className="w-3 h-3 text-slate-600" />
                          )}
                          <span>{device.isPaused ? "Lanjutkan" : "Jeda"}</span>
                        </button>
                      </>
                    ) : isAndroidAgent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-md text-[11px] font-medium border border-slate-200">
                        📱 Aktifkan di APK HP
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleConnect(device)}
                        disabled={isConnecting}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <QrCode className="w-3 h-3" />
                        )}
                        <span>{isQR ? 'Buka QR / Pairing' : isConnecting ? 'Menghubungkan...' : 'Hubungkan'}</span>
                      </button>
                    )}

                    {isConnected && !isAndroidAgent && (
                      <button 
                        onClick={() => handleConnect(device)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white rounded-md transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                        title="Reconnect Session"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={() => handleDeleteDevice(device)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                    title="Hapus Perangkat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
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
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={addingDevice}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {addingDevice && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Perangkat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Tautkan WhatsApp (QR Code / Pairing Code) */}
      {qrModalDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <div className="text-left">
                <h3 className="text-xl font-extrabold text-slate-900">Tautkan WhatsApp</h3>
                <p className="text-xs text-slate-500 font-medium">Perangkat: <span className="text-slate-800 font-bold">{qrModalDevice.name}</span></p>
              </div>
              <button 
                onClick={() => setQrModalDevice(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {justConnected ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Berhasil Terhubung!</h4>
                <p className="text-xs text-slate-500 font-mono">Nomor: +{qrModalDevice.phoneNumber}</p>
                <p className="text-[11px] text-slate-400 mt-1">Jendela ini akan tertutup otomatis...</p>
              </div>
            ) : (
              <div>
                {qrModalDevice.status === 'CONNECTED' && qrModalDevice.phoneNumber && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                    <span>Perangkat sedang aktif (+{qrModalDevice.phoneNumber})</span>
                    <span className="text-[11px] text-emerald-600 font-medium">Bisa scan QR atau minta kode baru untuk ganti nomor</span>
                  </div>
                )}

                {/* Method Tabs */}
                <div className="flex border-b border-slate-200 mb-5">
                  <button
                    type="button"
                    onClick={handleSwitchToQrTab}
                    className={clsx(
                      "flex-1 pb-3 text-xs font-bold transition-all flex items-center justify-center gap-2 border-b-2 cursor-pointer",
                      connectTab === 'qr'
                        ? "border-emerald-600 text-emerald-700"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Scan QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnectTab('pairing')}
                    className={clsx(
                      "flex-1 pb-3 text-xs font-bold transition-all flex items-center justify-center gap-2 border-b-2 cursor-pointer",
                      connectTab === 'pairing'
                        ? "border-emerald-600 text-emerald-700"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Kode Pairing (8 Digit)</span>
                  </button>
                </div>

                {connectTab === 'qr' ? (
                  qrModalDevice.status === 'CONNECTED' ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm animate-pulse">
                        <Check className="w-8 h-8 stroke-[3]" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-800">WhatsApp Sudah Terhubung!</h4>
                        {qrModalDevice.phoneNumber && (
                          <p className="text-sm text-slate-600 mt-1 font-mono">
                            Nomor: <strong className="text-emerald-700">+{qrModalDevice.phoneNumber}</strong>
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">
                          Perangkat ini aktif dan siap digunakan. Jika ingin mengganti akun, gunakan tab Kode Pairing atau hapus & buat perangkat baru.
                        </p>
                      </div>
                    </div>
                  ) : qrModalDevice.qrCode ? (
                    <div className="space-y-5">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 inline-block shadow-inner">
                        <img 
                          src={qrModalDevice.qrCode} 
                          alt="WhatsApp QR Code" 
                          className="w-60 h-60 mx-auto rounded-xl shadow-sm"
                        />
                      </div>

                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            deviceService.connectDevice(qrModalDevice.id);
                            fetchDevices();
                          }}
                          className="px-3.5 py-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 border border-emerald-200"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Segarkan QR Code</span>
                        </button>
                      </div>

                      <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-2">
                        <p className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-emerald-600" />
                          Petunjuk Scan dari HP:
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
                      <p className="text-sm font-bold text-slate-800">Sedang Menyiapkan QR Code...</p>
                      <p className="text-xs text-slate-400">Chromium sedang memuat WhatsApp Web di server.</p>
                      <button
                        type="button"
                        onClick={() => {
                          deviceService.connectDevice(qrModalDevice.id);
                          fetchDevices();
                        }}
                        className="mt-2 px-3.5 py-1.5 text-xs text-slate-600 hover:text-emerald-700 font-bold bg-slate-100 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Minta QR Baru</span>
                      </button>
                    </div>
                  )
                ) : (
                  /* Pairing Code Tab */
                  <div className="space-y-4 text-left">
                    <form onSubmit={handleRequestPairingCode} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Nomor HP WhatsApp Anda
                        </label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={pairingPhone}
                            onChange={(e) => setPairingPhone(e.target.value)}
                            placeholder="Contoh: 08123456789 atau 628123456789" 
                            required
                            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                          />
                          <button
                            type="submit"
                            disabled={requestingPairingCode || !pairingPhone.trim()}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {requestingPairingCode ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <KeyRound className="w-4 h-4" />
                            )}
                            <span>Minta Kode</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Bisa diawali 08..., 628..., atau +62...
                        </p>
                      </div>
                    </form>

                    {pairingError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{pairingError}</span>
                      </div>
                    )}

                    {pairingCode && (
                      <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                          Kode Pairing 8 Digit Anda:
                        </p>
                        <div className="inline-flex items-center gap-3 bg-white px-5 py-3 rounded-xl border border-emerald-300 shadow-sm">
                          <span className="text-2xl font-black font-mono tracking-widest text-slate-900">
                            {pairingCode}
                          </span>
                          <button
                            onClick={handleCopyPairingCode}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                            title="Salin Kode"
                          >
                            {pairingCopied ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {pairingCopied && (
                          <p className="text-[11px] font-bold text-emerald-700">Kode disalin ke clipboard!</p>
                        )}
                        <div>
                          <button
                            type="button"
                            onClick={() => { setPairingCode(null); setPairingError(null); }}
                            className="text-xs text-slate-500 hover:text-slate-700 underline font-medium cursor-pointer"
                          >
                            Minta Kode Ulang / Ganti Nomor
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-2">
                      <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-emerald-600" />
                        Cara Masukkan Kode di HP:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-500">
                        <li>Buka <strong>WhatsApp</strong> di HP Anda.</li>
                        <li>Buka <strong>Perangkat Tertaut (Linked Devices)</strong>.</li>
                        <li>Ketuk <strong>Tautkan Perangkat</strong>.</li>
                        <li>Di bawah layar scanner, ketuk <strong>"Tautkan dengan nomor telepon saja"</strong>.</li>
                        <li>Ketik kode 8 digit yang muncul di atas.</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setQrModalDevice(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
              <button onClick={() => setTestModalDevice(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
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
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={sendingTest}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
              <button onClick={() => setWebhookDevice(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
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
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {testingWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendIcon className="w-3.5 h-3.5" />}
                  <span>Uji Endpoint URL</span>
                </button>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setWebhookDevice(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleSaveWebhook}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    Simpan Webhook
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Cek Nomor WhatsApp Aktif (Validator) */}
      {showCheckNumberModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Cek Nomor WhatsApp</h3>
                  <p className="text-[11px] text-slate-400">Verifikasi apakah nomor terdaftar dan aktif di WhatsApp</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCheckNumberModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCheckNumber} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pilih Device Penguji
                </label>
                <select
                  value={checkDeviceId}
                  onChange={(e) => setCheckDeviceId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">Otomatis (Pilih Device yang Sedang Aktif)</option>
                  {devices.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.status === 'CONNECTED' ? 'Online' : 'Offline'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nomor WhatsApp yang Dicek
                  </label>
                  {checkPhone.trim() && (
                    <span className="text-[11px] font-mono font-bold text-emerald-600">
                      +{normalizePhone(checkPhone)}
                    </span>
                  )}
                </div>
                <input 
                  type="text" 
                  value={checkPhone}
                  onChange={(e) => setCheckPhone(e.target.value)}
                  placeholder="Contoh: 08123456789 atau +628123456789" 
                  required
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Format bebas: 08..., 628..., +62..., 8...
                </p>
              </div>

              {checkError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{checkError}</span>
                </div>
              )}

              {checkResult && (
                <div className={clsx(
                  "p-4 rounded-2xl border space-y-2.5 animate-in fade-in duration-200",
                  checkResult.numberExists 
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950" 
                    : "bg-rose-50/80 border-rose-200 text-rose-950"
                )}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {checkResult.numberExists ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="text-emerald-800">Nomor Terdaftar di WhatsApp</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-rose-600" />
                        <span className="text-rose-800">Nomor Tidak Terdaftar di WhatsApp</span>
                      </>
                    )}
                  </div>

                  <div className="text-xs space-y-1 pt-1 border-t border-slate-200/50">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nomor Terformat:</span>
                      <span className="font-mono font-bold">+{checkResult.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">WhatsApp JID:</span>
                      <span className="font-mono font-medium">{checkResult.jid || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tipe Akun:</span>
                      <span className="font-semibold">
                        {checkResult.isBusiness ? 'WhatsApp Business' : 'WhatsApp Personal/Standar'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status Penerimaan:</span>
                      <span className={clsx("font-bold", checkResult.canReceiveMessage ? "text-emerald-700" : "text-rose-700")}>
                        {checkResult.canReceiveMessage ? 'Siap Menerima Pesan' : 'Tidak Dapat Menerima'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowCheckNumberModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Tutup
                </button>
                <button 
                  type="submit"
                  disabled={checkingNumber || !checkPhone.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {checkingNumber ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Periksa Sekarang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
