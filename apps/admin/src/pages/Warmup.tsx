import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Bot, 
  Settings2, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Smartphone, 
  MessageSquare, 
  Sparkles, 
  AlertCircle,
  Dice5,
  UserCheck,
  Timer,
  Layers,
  HelpCircle,
  Shuffle
} from 'lucide-react';
import { warmupService, deviceService } from '../services/api';
import { PERSONA_TEMPLATES, PersonaTemplate } from '../constants/personas';

export default function Warmup() {
  const [config, setConfig] = useState({
    isEnabled: false,
    dailyTarget: 10,
    minDelayMinutes: 2,
    minDelaySeconds: 5,
    maxDelaySeconds: 15,
    chatTurns: 3,
    personaMode: 'random',
    autoChatNewDevice: true,
    aiBaseUrl: 'http://103.89.2.102:20128/v1',
    aiApiKey: 'sk-abf54a1d39290d81-l74lwh-ac3e8eda',
    aiModel: 'mistral/mistral-large-latest',
    topicPrompt: '',
    deviceIds: [] as string[]
  });

  const [devices, setDevices] = useState<any[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [customPromptOpen, setCustomPromptOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configRes, devRes, logsRes] = await Promise.all([
        warmupService.getConfig(),
        deviceService.getDevices(),
        warmupService.getLogs(30)
      ]);

      if (configRes.data) {
        setConfig((prev) => ({
          ...prev,
          ...configRes.data,
          minDelaySeconds: configRes.data.minDelaySeconds ?? 5,
          maxDelaySeconds: configRes.data.maxDelaySeconds ?? 15,
          chatTurns: configRes.data.chatTurns ?? 3,
          personaMode: configRes.data.personaMode || 'random',
          autoChatNewDevice: configRes.data.autoChatNewDevice !== undefined ? configRes.data.autoChatNewDevice : true
        }));
      }
      setDevices(devRes.data || []);
      setLogs(logsRes.data || []);
      
      if (configRes.data?.aiBaseUrl && configRes.data?.aiApiKey) {
        fetchModelsList(configRes.data.aiBaseUrl, configRes.data.aiApiKey, false);
      }
    } catch (err: any) {
      console.error('Failed to load warmup data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchModelsList = async (url?: string, key?: string, isManual = false) => {
    try {
      setFetchingModels(true);
      const res = await warmupService.fetchModels(url || config.aiBaseUrl, key || config.aiApiKey);
      if (res.data?.models && Array.isArray(res.data.models)) {
        setModels(res.data.models);
        if (!config.aiModel && res.data.models.length > 0) {
          setConfig((prev) => ({ ...prev, aiModel: res.data.models[0] }));
        }
        if (isManual) {
          setAlert({
            type: 'success',
            message: `Berhasil mengambil ${res.data.models.length} model dari 9routes!`
          });
          setTimeout(() => setAlert(null), 3000);
        }
      }
    } catch (err: any) {
      if (isManual) {
        setAlert({
          type: 'error',
          message: 'Gagal mengambil daftar model 9routes: ' + (err.response?.data?.error || err.message)
        });
      } else {
        console.warn('Auto-detect models note:', err.response?.data?.error || err.message);
      }
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      setAlert(null);
      await warmupService.updateConfig(config);
      setAlert({ type: 'success', message: 'Konfigurasi warmup berhasil disimpan!' });
      setTimeout(() => setAlert(null), 4000);
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: 'Gagal menyimpan konfigurasi: ' + (err.response?.data?.error || err.message)
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnable = async () => {
    const nextState = !config.isEnabled;
    setConfig((prev) => ({ ...prev, isEnabled: nextState }));
    try {
      await warmupService.updateConfig({ ...config, isEnabled: nextState });
      setAlert({
        type: 'success',
        message: nextState ? 'Warmup otomatis telah DIAKTIFKAN (24/7)!' : 'Warmup otomatis telah DINONAKTIFKAN.'
      });
      setTimeout(() => setAlert(null), 3000);
    } catch (err: any) {
      setAlert({ type: 'error', message: 'Gagal mengubah status: ' + err.message });
    }
  };

  const handleTestNow = async () => {
    try {
      setTesting(true);
      setAlert(null);
      const res = await warmupService.triggerManual();
      if (res.data?.success) {
        setAlert({ type: 'success', message: res.data.message });
        setTimeout(async () => {
          const lRes = await warmupService.getLogs(30);
          setLogs(lRes.data || []);
        }, 2000);
      } else {
        setAlert({ type: 'error', message: res.data.message || 'Gagal menjalankan warmup' });
      }
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: 'Error saat test warmup: ' + (err.response?.data?.error || err.message)
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleDevice = (deviceId: string) => {
    setConfig((prev) => {
      const current = prev.deviceIds || [];
      const updated = current.includes(deviceId)
        ? current.filter((id) => id !== deviceId)
        : [...current, deviceId];
      return { ...prev, deviceIds: updated };
    });
  };

  const handleSelectPersona = (personaId: string) => {
    if (personaId === 'random') {
      setConfig((prev) => ({ ...prev, personaMode: 'random' }));
    } else if (personaId === 'custom') {
      setConfig((prev) => ({ ...prev, personaMode: 'custom' }));
      setCustomPromptOpen(true);
    } else {
      const template = PERSONA_TEMPLATES.find((p) => p.id === personaId);
      setConfig((prev) => ({
        ...prev,
        personaMode: personaId,
        topicPrompt: template ? template.prompt : prev.topicPrompt
      }));
    }
  };

  const connectedDevices = devices.filter((d) => d.status === 'CONNECTED');
  const selectedValidCount = (config.deviceIds || []).filter((id) => devices.some((d) => d.id === id)).length;
  const currentPersona = PERSONA_TEMPLATES.find((p) => p.id === config.personaMode);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Flame className="w-5 h-5 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Warmup Nomor (Pemanasan AI)</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Simulasi percakapan natural peer-to-peer antar perangkat WhatsApp menggunakan <strong>9routes AI</strong> untuk membangun trust score dan reputasi nomor baru.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestNow}
            disabled={testing || connectedDevices.length < 2}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm shadow-slate-900/10 cursor-pointer"
            title={connectedDevices.length < 2 ? 'Perlu minimal 2 device CONNECTED' : 'Kirim obrolan warmup uji coba sekarang'}
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            )}
            <span>{testing ? 'Mengirim Chat AI...' : 'Uji Coba Kirim Chat'}</span>
          </button>

          <button
            onClick={handleToggleEnable}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
              config.isEnabled
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 hover:bg-emerald-700'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${config.isEnabled ? 'bg-white animate-pulse' : 'bg-slate-300'}`}></span>
            <span>{config.isEnabled ? 'WARMUP AKTIF (24/7)' : 'WARMUP NONAKTIF'}</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between border transition-all ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{alert.message}</span>
          </div>
          <button onClick={() => setAlert(null)} className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Chat Selesai</span>
            <MessageSquare className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {logs.filter((l) => l.status === 'SENT').length}
          </div>
          <p className="text-xs text-slate-500 mt-1">Percakapan pemanasan sukses</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Harian</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {config.dailyTarget} <span className="text-xs font-normal text-slate-500">sesi/hari</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">~{config.dailyTarget * (config.chatTurns || 3)} pesan terdistribusi acak</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Jeda Antar Balasan</span>
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {config.minDelaySeconds || 5}-{config.maxDelaySeconds || 15} <span className="text-xs font-normal text-slate-500">detik</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Delay acak per balasan ({config.chatTurns || 3}x turn/sesi)</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Device Terhubung</span>
            <Smartphone className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {connectedDevices.length} <span className="text-xs font-normal text-slate-500">/ {devices.length} aktif</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {connectedDevices.length >= 2 ? (
              <span className="text-emerald-600 font-medium">✓ Siap untuk peer-to-peer</span>
            ) : (
              <span className="text-amber-600 font-medium">⚠️ Minimal butuh 2 device</span>
            )}
          </p>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: 9routes AI & Persona Templates */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Konfigurasi AI & Persona</h3>
                  <p className="text-xs text-slate-400">Pilihan model dan template karakter percakapan</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                OpenAI Compatible
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                9routes Base URL
              </label>
              <input
                type="text"
                value={config.aiBaseUrl}
                onChange={(e) => setConfig({ ...config, aiBaseUrl: e.target.value })}
                placeholder="http://103.89.2.102:20128/v1"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                API Key 9routes
              </label>
              <input
                type="password"
                value={config.aiApiKey}
                onChange={(e) => setConfig({ ...config, aiApiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Model AI (Auto-Detected)
                </label>
                <button
                  type="button"
                  onClick={() => fetchModelsList(undefined, undefined, true)}
                  disabled={fetchingModels}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${fetchingModels ? 'animate-spin' : ''}`} />
                  <span>{fetchingModels ? 'Memindai Model...' : 'Cek Model 9routes'}</span>
                </button>
              </div>

              {models.length > 0 ? (
                <select
                  value={config.aiModel}
                  onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  {config.aiModel && !models.includes(config.aiModel) && (
                    <option value={config.aiModel}>
                      {config.aiModel} (Aktif)
                    </option>
                  )}
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.aiModel}
                    onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
                    placeholder="misal: mistral/mistral-large-latest"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => fetchModelsList(undefined, undefined, true)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Deteksi
                  </button>
                </div>
              )}
            </div>

            {/* Persona Selection System */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Persona AI / Karakter Percakapan</span>
                </label>
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/50">
                  {PERSONA_TEMPLATES.length} Template Siap Pakai
                </span>
              </div>

              {/* Persona Mode Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {/* Random Persona Option */}
                <button
                  type="button"
                  onClick={() => handleSelectPersona('random')}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    config.personaMode === 'random'
                      ? 'bg-amber-500/10 border-amber-400 text-amber-950 ring-2 ring-amber-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Shuffle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span>🎲 Acak Tiap Hari & Sesi</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Berganti template otomatis setiap hari agar topik obrolan selalu segar & bervariasi.
                    </p>
                  </div>
                </button>

                {/* Specific Persona Selector */}
                <div className="relative">
                  <select
                    value={config.personaMode === 'random' ? '' : config.personaMode}
                    onChange={(e) => handleSelectPersona(e.target.value)}
                    className={`w-full h-full min-h-[64px] px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none transition-all cursor-pointer ${
                      config.personaMode !== 'random'
                        ? 'bg-indigo-50/60 border-indigo-300 text-indigo-950 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <option value="" disabled>
                      -- Pilih Template Persona Spesifik --
                    </option>
                    {PERSONA_TEMPLATES.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        [{tmpl.category}] {tmpl.name}
                      </option>
                    ))}
                    <option value="custom">✍️ Tulis Kustom Prompt Sendiri...</option>
                  </select>
                </div>
              </div>

              {/* Active Persona Banner / Preview */}
              {config.personaMode === 'random' ? (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <Dice5 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mode Rotasi Acak Aktif</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Sistem akan memilih salah satu dari {PERSONA_TEMPLATES.length} template persona (Teman Gaul, Rekan Kantor, Reuni, Kuliner, Jual Beli, Olahraga, Liburan, Game, Ngopi, Kuliah, dsb) secara acak pada setiap sesi obrolan.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        {currentPersona ? currentPersona.name : 'Persona Kustom'}
                      </span>
                      {currentPersona && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                          {currentPersona.category}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {currentPersona ? currentPersona.description : 'Prompt kustom yang ditentukan secara mandiri.'}
                    </p>
                  </div>

                  {/* Toggle Custom Edit */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCustomPromptOpen(!customPromptOpen)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      {customPromptOpen ? '▲ Tutup Editor Prompt' : '▼ Lihat / Edit Teks Prompt Detail'}
                    </button>
                  </div>

                  {customPromptOpen && (
                    <div>
                      <textarea
                        rows={3}
                        value={config.topicPrompt || (currentPersona ? currentPersona.prompt : '')}
                        onChange={(e) => setConfig({ ...config, topicPrompt: e.target.value })}
                        placeholder="Instruksi gaya bahasa percakapan..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Rules, Turn Count, Delays in SECONDS & Target Devices */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Jadwal & Aturan Pemanasan</h3>
                  <p className="text-xs text-slate-400">Atur frekuensi obrolan, jumlah balasan, dan jeda detik</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                Otomatis 24/7
              </span>
            </div>

            {/* Target Chats & Turn Counts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Target Sesi Per Hari
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={config.dailyTarget}
                    onChange={(e) => setConfig({ ...config, dailyTarget: parseInt(e.target.value) || 10 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">sesi / hari</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Dijalankan pada jam acak sepanjang 24 jam</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Jumlah Balasan Per Sesi</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={2}
                    max={8}
                    value={config.chatTurns}
                    onChange={(e) => setConfig({ ...config, chatTurns: parseInt(e.target.value) || 3 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">kali chat</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Jumlah saut-sautan pesan dalam 1 percakapan (2-8x)</p>
              </div>
            </div>

            {/* Delay in SECONDS with Random Range */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-emerald-600" />
                  <span>Jeda Antar Balasan (Delay Acak dalam Detik)</span>
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Satuan Detik
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Delay Minimal</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={3}
                      max={60}
                      value={config.minDelaySeconds}
                      onChange={(e) => setConfig({ ...config, minDelaySeconds: parseInt(e.target.value) || 5 })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 font-medium">detik</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Delay Maksimal</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={config.minDelaySeconds || 5}
                      max={120}
                      value={config.maxDelaySeconds}
                      onChange={(e) => setConfig({ ...config, maxDelaySeconds: parseInt(e.target.value) || 15 })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 font-medium">detik</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                ⚡ <em>Setiap balasan akan menunggu secara acak antara <strong>{config.minDelaySeconds || 5} s/d {config.maxDelaySeconds || 15} detik</strong>, menyerupai kecepatan mengetik orang asli.</em>
              </p>
            </div>

            {/* Auto-Greet New Device Toggle */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-200 transition-all">
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Sambut & Auto-Chat Device Baru yang Baru Connect
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Ketika ada device/nomor baru yang baru saja berhasil terhubung (CONNECTED), device senior yang sudah aktif akan <strong>langsung menyapa dan mengajak ngobrol</strong> nomor baru tersebut.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.autoChatNewDevice}
                  onChange={(e) => setConfig({ ...config, autoChatNewDevice: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-5 w-5 shrink-0 mt-0.5 cursor-pointer"
                />
              </label>
            </div>

            {/* Target Devices Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Perangkat Yang Dilibatkan ({devices.length})
                </label>
                <span className="text-[11px] text-slate-400">
                  {selectedValidCount === 0 ? 'Semua Device Terhubung' : `${selectedValidCount} Terpilih`}
                </span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {devices.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Belum ada perangkat terdaftar di sistem.</p>
                ) : (
                  devices.map((device) => {
                    const isConnected = device.status === 'CONNECTED';
                    const isChecked = config.deviceIds.includes(device.id);

                    return (
                      <div
                        key={device.id}
                        onClick={() => handleToggleDevice(device.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-50/50 border-emerald-300 text-emerald-950 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <div>
                            <div className="font-bold">{device.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {device.phoneNumber ? `+${device.phoneNumber}` : 'Nomor belum tersinkron'}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isConnected ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              CONNECTED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              {device.status}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                💡 <em>Kosongkan pilihan jika ingin menyertakan semua perangkat yang terhubung secara otomatis.</em>
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-6 flex justify-end">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Warmup'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Warmup Chat Activity Logs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Riwayat Percakapan Pemanasan (Warmup Logs)</h3>
              <p className="text-xs text-slate-400">Log obrolan peer-to-peer real-time antara nomor terhubung</p>
            </div>
          </div>

          <button
            onClick={async () => {
              const res = await warmupService.getLogs(30);
              setLogs(res.data || []);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan Log</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Waktu</th>
                <th className="px-6 py-3.5">Dari Device (Pengirim)</th>
                <th className="px-6 py-3.5">Ke Device (Penerima)</th>
                <th className="px-6 py-3.5">Isi Pesan AI</th>
                <th className="px-6 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <Flame className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">Belum ada riwayat percakapan pemanasan</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Klik "Uji Coba Kirim Chat" di atas atau aktifkan warmup otomatis untuk memulai.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{log.fromDevice?.name || 'Device'}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {log.fromNumber ? `+${log.fromNumber}` : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{log.toDevice?.name || 'Device'}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {log.toNumber ? `+${log.toNumber}` : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-800 font-medium leading-relaxed">
                        "{log.message}"
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {log.status === 'SENT' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          TERKIRIM
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                          title={log.error}
                        >
                          <XCircle className="w-3 h-3 text-rose-600" />
                          GAGAL
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
