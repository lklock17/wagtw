import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Bot, 
  Globe, 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sliders, 
  Copy, 
  ExternalLink,
  ShieldCheck,
  Send,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Edit2
} from 'lucide-react';
import { autoReplyService } from '../services/api';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'autoreply' | 'ai' | 'webhook' | 'system'>('autoreply');
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [formMode, setFormMode] = useState<'text' | 'ai'>('text');
  const [formKeyword, setFormKeyword] = useState('');
  const [formResponse, setFormResponse] = useState('');
  const [formCooldown, setFormCooldown] = useState(30);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // AI Settings State (persisted to localStorage)
  const [aiEnabled, setAiEnabled] = useState(() => localStorage.getItem('wagtw_ai_enabled') !== 'false');
  const [aiSystemPrompt, setAiSystemPrompt] = useState(() => localStorage.getItem('wagtw_ai_prompt') || 'Anda adalah customer service asisten WhatsApp yang ramah, sopan, dan sigap membantu.');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('wagtw_ai_model') || 'gemini-1.5-flash');

  // Global Webhook State
  const [globalWebhook, setGlobalWebhook] = useState(() => localStorage.getItem('wagtw_global_webhook') || '');
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await autoReplyService.getRules();
      setRules(res.data || []);
    } catch (err: any) {
      console.error(err);
      setBanner({ type: 'error', message: 'Gagal memuat aturan auto-reply: ' + (err.message || 'Error') });
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setFormMode('text');
    setFormKeyword('');
    setFormResponse('');
    setFormCooldown(30);
    setFormActive(true);
    setShowModal(true);
  };

  const openEditModal = (rule: any) => {
    setEditingRule(rule);
    setFormMode(rule.isAi ? 'ai' : 'text');
    setFormKeyword(rule.keyword || '');
    setFormResponse(rule.response || '');
    setFormCooldown(rule.cooldown || 30);
    setFormActive(rule.isActive !== false);
    setShowModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === 'text' && !formKeyword.trim()) {
      setBanner({ type: 'error', message: 'Kata kunci (keyword) wajib diisi untuk mode teks biasa.' });
      return;
    }
    if (formMode === 'text' && !formResponse.trim()) {
      setBanner({ type: 'error', message: 'Isi teks balasan wajib diisi.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        keyword: formKeyword.trim() || null,
        response: formResponse.trim() || null,
        isAi: formMode === 'ai',
        cooldown: Number(formCooldown) || 30,
        isActive: formActive
      };

      if (editingRule) {
        await autoReplyService.updateRule(editingRule.id, payload);
        setBanner({ type: 'success', message: 'Aturan auto-reply berhasil diperbarui!' });
      } else {
        await autoReplyService.createRule(payload);
        setBanner({ type: 'success', message: 'Aturan auto-reply baru berhasil disimpan!' });
      }
      setShowModal(false);
      fetchRules();
      setTimeout(() => setBanner(null), 3500);
    } catch (err: any) {
      setBanner({ type: 'error', message: 'Gagal menyimpan aturan: ' + (err.response?.data?.error || err.message) });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: any) => {
    try {
      const newStatus = !rule.isActive;
      await autoReplyService.updateRule(rule.id, { isActive: newStatus });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, isActive: newStatus } : r));
    } catch (err) {
      alert('Gagal mengubah status rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus aturan auto-reply ini?')) return;
    try {
      await autoReplyService.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      setBanner({ type: 'success', message: 'Aturan berhasil dihapus.' });
      setTimeout(() => setBanner(null), 3000);
    } catch (err) {
      setBanner({ type: 'error', message: 'Gagal menghapus aturan.' });
    }
  };

  const handleSaveAiSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('wagtw_ai_enabled', String(aiEnabled));
    localStorage.setItem('wagtw_ai_prompt', aiSystemPrompt);
    localStorage.setItem('wagtw_ai_model', aiModel);
    setBanner({ type: 'success', message: 'Pengaturan AI Gemini berhasil disimpan!' });
    setTimeout(() => setBanner(null), 3000);
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('wagtw_global_webhook', globalWebhook);
    setBanner({ type: 'success', message: 'Global Webhook berhasil disimpan!' });
    setTimeout(() => setBanner(null), 3000);
  };

  const handleTestWebhook = async () => {
    if (!globalWebhook) {
      alert('Masukkan URL webhook terlebih dahulu.');
      return;
    }
    setWebhookTesting(true);
    setWebhookResult(null);
    try {
      // Send sample ping payload via backend
      const res = await fetch(globalWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'webhook.ping',
          timestamp: new Date().toISOString(),
          message: 'Ping test from WAGTW WhatsApp Gateway'
        })
      });
      if (res.ok) {
        setWebhookResult({ success: true, msg: `HTTP ${res.status}: Webhook terkirim & diterima dengan baik!` });
      } else {
        setWebhookResult({ success: false, msg: `HTTP ${res.status}: Server merespon status error.` });
      }
    } catch (err: any) {
      setWebhookResult({ success: false, msg: 'Koneksi gagal: ' + err.message });
    } finally {
      setWebhookTesting(false);
    }
  };

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Pengaturan Sistem & Automasi
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Konfigurasi Auto-Reply pintar, integrasi AI Gemini, webhook notifikasi, dan status gateway WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Zona Waktu: <strong className="font-mono text-emerald-700">{userTimeZone}</strong>
          </span>
        </div>
      </div>

      {/* Banner Notification */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            banner.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('autoreply')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'autoreply'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Aturan Auto-Reply ({rules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ai'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Asisten AI Gemini</span>
        </button>

        <button
          onClick={() => setActiveTab('webhook')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'webhook'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Global Webhook</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'system'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Status Gateway</span>
        </button>
      </div>

      {/* TAB 1: AUTO REPLY RULES */}
      {activeTab === 'autoreply' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Daftar Aturan Balasan Otomatis
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pesan WhatsApp masuk yang cocok dengan kata kunci akan langsung dibalas otomatis sesuai aturan.
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Rule Auto-Reply</span>
            </button>
          </div>

          {loading ? (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400 text-xs">
              Memuat aturan auto-reply...
            </div>
          ) : rules.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Belum Ada Aturan Auto-Reply</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Buat aturan kata kunci seperti "halo", "order", atau "harga", lalu tentukan balasan otomatis atau aktifkan AI Gemini.
              </p>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Rule Pertama Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => {
                const isActive = rule.isActive !== false;
                return (
                  <div
                    key={rule.id}
                    className={`bg-white rounded-xl border p-4.5 shadow-xs transition-all flex flex-col justify-between ${
                      isActive ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 bg-slate-50/60 opacity-75'
                    }`}
                  >
                    <div>
                      {/* Top Bar: Badges & Toggle */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rule.isAi ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-600" />
                              Gemini AI Assistant
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-blue-600" />
                              Teks Tetap
                            </span>
                          )}

                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            ⏳ Jeda {rule.cooldown || 30}s
                          </span>
                        </div>

                        {/* Active Switch */}
                        <button
                          onClick={() => handleToggleActive(rule)}
                          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                          title="Klik untuk ubah status aktif"
                        >
                          {isActive ? 'Aktif' : 'Non-Aktif'}
                        </button>
                      </div>

                      {/* Keyword Title */}
                      <div className="mt-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Pemicu (Keyword)
                        </span>
                        <div className="text-sm font-bold text-slate-900 mt-0.5">
                          {rule.keyword ? (
                            <code className="text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono">
                              "{rule.keyword}"
                            </code>
                          ) : (
                            <span className="text-xs italic text-emerald-700 font-semibold">
                              (Semua Pesan Masuk / Fallback)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Response Body */}
                      <div className="mt-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Balasan
                        </span>
                        <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 line-clamp-3 leading-relaxed">
                          {rule.isAi
                            ? 'Dibalas otomatis secara cerdas oleh Google Gemini AI berdasarkan pertanyaan dan persona sistem.'
                            : rule.response || '—'}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-[10px] text-slate-400">
                      <span>Dibuat: {new Date(rule.createdAt).toLocaleDateString('id-ID')}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          title="Edit Aturan"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Hapus Aturan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI GEMINI SETTINGS */}
      {activeTab === 'ai' && (
        <form onSubmit={handleSaveAiSettings} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Konfigurasi Google Gemini AI
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gunakan kecerdasan buatan Gemini untuk membalas chat customer otomatis 24/7 seperti CS profesional.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-700">Status AI:</span>
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${aiEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {aiEnabled ? 'Aktif' : 'Non-Aktif'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Pilih Model Gemini
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Sangat Cepat & Direkomendasikan)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Kemampuan Analisis Lebih Tinggi)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Menggunakan kunci API resmi dari file konfigurasi environment server (GEMINI_API_KEY).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Jeda Respon AI (Cooldown Anti-Spam)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={30}
                  min={5}
                  max={600}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-xs font-semibold text-slate-500 shrink-0">Detik</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Mencegah bot mengirim respon ganda jika kontak mengirim pesan beruntun dalam waktu singkat.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Instruksi Sistem / Persona CS (System Prompt)
            </label>
            <textarea
              rows={5}
              value={aiSystemPrompt}
              onChange={(e) => setAiSystemPrompt(e.target.value)}
              placeholder="Jelaskan peran AI, info produk, jam operasional, dan gaya bahasa..."
              className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Tips: Tuliskan informasi harga barang, nomor rekening, alamat toko, atau instruksi FAQ agar AI menjawab secara akurat.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Simpan Pengaturan AI</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: GLOBAL WEBHOOK */}
      {activeTab === 'webhook' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600" />
              Global Webhook Event Forwarding
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kirimkan seluruh event WhatsApp masuk (pesan diterima, status pesan, pergantian sesi) ke server atau API Anda secara real-time.
            </p>
          </div>

          <form onSubmit={handleSaveWebhook} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                URL Global Webhook (POST HTTP/HTTPS)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={globalWebhook}
                  onChange={(e) => setGlobalWebhook(e.target.value)}
                  placeholder="https://aplikasi-anda.com/api/webhook/whatsapp"
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={webhookTesting || !globalWebhook}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{webhookTesting ? 'Menguji...' : 'Tes Ping'}</span>
                </button>
              </div>
            </div>

            {webhookResult && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
                  webhookResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {webhookResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{webhookResult.msg}</span>
              </div>
            )}

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Event Payload yang Diteruskan:</p>
              <ul className="list-disc pl-4 space-y-0.5 font-mono text-[10px] text-slate-500">
                <li><code>message.received</code> — Saat ada kontak/pelanggan mengirim pesan teks atau media</li>
                <li><code>message.sent</code> — Saat pesan berhasil diproses dan dikirim via worker</li>
                <li><code>device.status</code> — Saat koneksi device berubah (CONNECTED / QR_READY / DISCONNECTED)</li>
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simpan Global Webhook</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: SYSTEM & GATEWAY STATUS */}
      {activeTab === 'system' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" />
              Status Sistem & Arsitektur Gateway
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Informasi internal runtime, service port, dan environment cluster WAGTW.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">API Server</span>
              <p className="text-sm font-mono font-bold text-slate-900">Port 4010</p>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Active / Express REST</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Worker Node</span>
              <p className="text-sm font-mono font-bold text-slate-900">Port 4011</p>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">WPPConnect Headless</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Database Engine</span>
              <p className="text-sm font-mono font-bold text-slate-900">PostgreSQL 16</p>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Prisma ORM Connected</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Zona Waktu Klien</span>
              <p className="text-sm font-mono font-bold text-slate-900">{userTimeZone}</p>
              <span className="text-[10px] text-slate-500 font-mono">Auto-detected Browser</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Format Auto-Detect Nomor</span>
              <p className="text-sm font-mono font-bold text-emerald-800">08xxx ➔ +628xxx</p>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Aktif Otomatis</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Process Manager</span>
              <p className="text-sm font-mono font-bold text-slate-900">PM2 Daemon</p>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Cluster Online</span>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: TAMBAH / EDIT RULE AUTO-REPLY */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingRule ? 'Edit Aturan Auto-Reply' : 'Tambah Aturan Auto-Reply Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Konfigurasikan pemicu kata kunci dan respon otomatis bot.</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveRule} className="p-6 space-y-4">
              {/* Mode Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Pilih Mode Balasan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormMode('text')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formMode === 'text'
                        ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900">Teks Template</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Kirim teks balasan yang Anda tentukan secara spesifik.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormMode('ai')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formMode === 'ai'
                        ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900">Gemini AI</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Dibalas cerdas oleh AI berdasarkan konteks pertanyaan.
                    </p>
                  </button>
                </div>
              </div>

              {/* Keyword Field */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Kata Kunci Pemicu (Keyword)
                </label>
                <input
                  type="text"
                  value={formKeyword}
                  onChange={(e) => setFormKeyword(e.target.value)}
                  placeholder={formMode === 'ai' ? 'Kosongkan jika ingin jadi AI Fallback semua pesan' : 'Contoh: halo / info / harga / order'}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {formMode === 'ai'
                    ? 'Jika dikosongkan, AI akan menjawab setiap pesan yang tidak cocok dengan kata kunci teks lainnya.'
                    : 'Pesan pelanggan yang mengandung kata ini akan langsung memicu balasan.'}
                </p>
              </div>

              {/* Response Textarea (Only for Text Mode) */}
              {formMode === 'text' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Isi Pesan Balasan Otomatis
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formResponse}
                    onChange={(e) => setFormResponse(e.target.value)}
                    placeholder="Halo! Terima kasih telah menghubungi kami. Ada yang bisa kami bantu?"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
                  />
                </div>
              )}

              {/* Cooldown & Active Toggle Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Jeda Respon (Cooldown)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={5}
                      max={600}
                      value={formCooldown}
                      onChange={(e) => setFormCooldown(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-400 shrink-0">Detik</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Mencegah spam ke nomor yang sama.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Status Aturan
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormActive(!formActive)}
                    className={`w-full py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      formActive
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${formActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    <span>{formActive ? 'Aktif (Berjalan)' : 'Non-Aktif (Jeda)'}</span>
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Aturan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
