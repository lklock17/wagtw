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
  Send, 
  Sparkles,
  Edit2,
  RefreshCw,
  Cpu,
  Users,
  KeyRound,
  UserPlus,
  Shield,
  Lock,
  Loader2
} from 'lucide-react';
import { autoReplyService, warmupService, authService } from '../services/api';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'autoreply' | 'ai' | 'webhook' | 'system' | 'users'>('autoreply');
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State for Auto Reply
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [formMode, setFormMode] = useState<'text' | 'ai'>('text');
  const [formKeyword, setFormKeyword] = useState('');
  const [formResponse, setFormResponse] = useState('');
  const [formCooldown, setFormCooldown] = useState(30);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // 9routes AI State
  const [aiEnabled, setAiEnabled] = useState(() => localStorage.getItem('wagtw_ai_enabled') !== 'false');
  const [aiBaseUrl, setAiBaseUrl] = useState('http://103.89.2.102:20128/v1');
  const [aiApiKey, setAiApiKey] = useState('sk-abf54a1d39290d81-l74lwh-ac3e8eda');
  const [aiModel, setAiModel] = useState('mistral/mistral-large-latest');
  const [aiSystemPrompt, setAiSystemPrompt] = useState(() => localStorage.getItem('wagtw_ai_prompt') || 'Anda adalah customer service asisten WhatsApp yang ramah, sopan, dan sigap membantu.');
  const [aiCooldown, setAiCooldown] = useState(30);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [savingAi, setSavingAi] = useState(false);

  // Global Webhook State
  const [globalWebhook, setGlobalWebhook] = useState(() => localStorage.getItem('wagtw_global_webhook') || '');
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; msg: string } | null>(null);

  // User Management & Security State
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });

  // Change My Password State
  const [myCurrentPassword, setMyCurrentPassword] = useState('');
  const [myNewPassword, setMyNewPassword] = useState('');
  const [myConfirmPassword, setMyConfirmPassword] = useState('');
  const [changingMyPassword, setChangingMyPassword] = useState(false);

  // Add Employee/User Modal State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  // Reset Other User Password Modal State
  const [resettingUser, setResettingUser] = useState<any | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    fetchRules();
    loadAiConfig();
    fetchUsersList();
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

  const loadAiConfig = async () => {
    try {
      const res = await warmupService.getConfig();
      if (res.data) {
        if (res.data.aiBaseUrl) setAiBaseUrl(res.data.aiBaseUrl);
        if (res.data.aiApiKey) setAiApiKey(res.data.aiApiKey);
        if (res.data.aiModel) setAiModel(res.data.aiModel);
      }
    } catch (err) {
      console.warn('Could not load warmup config, using 9routes defaults');
    }
  };

  const fetchUsersList = async () => {
    setLoadingUsers(true);
    try {
      const res = await authService.getUsers();
      setUsers(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleFetch9routesModels = async () => {
    setFetchingModels(true);
    try {
      const res = await warmupService.fetchModels(aiBaseUrl, aiApiKey);
      const list = res.data?.models || res.data || [];
      if (Array.isArray(list) && list.length > 0) {
        setAvailableModels(list);
        setBanner({ type: 'success', message: `Berhasil menemukan ${list.length} model aktif dari 9routes AI!` });
      } else {
        setBanner({ type: 'error', message: 'Tidak ada daftar model yang dikembalikan dari 9routes.' });
      }
      setTimeout(() => setBanner(null), 3500);
    } catch (err: any) {
      setBanner({ type: 'error', message: 'Gagal scan model 9routes: ' + (err.response?.data?.error || err.message) });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSaveAiConfig = async () => {
    setSavingAi(true);
    try {
      localStorage.setItem('wagtw_ai_enabled', String(aiEnabled));
      localStorage.setItem('wagtw_ai_prompt', aiSystemPrompt);

      await warmupService.updateConfig({
        aiBaseUrl,
        aiApiKey,
        aiModel,
      });

      setBanner({ type: 'success', message: 'Konfigurasi 9routes AI berhasil disimpan!' });
      setTimeout(() => setBanner(null), 3000);
    } catch (err: any) {
      setBanner({ type: 'error', message: 'Gagal menyimpan konfigurasi AI: ' + (err.response?.data?.error || err.message) });
    } finally {
      setSavingAi(false);
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
      setBanner({ type: 'success', message: 'Aturan auto-reply berhasil dihapus.' });
      setTimeout(() => setBanner(null), 3000);
    } catch (err: any) {
      setBanner({ type: 'error', message: 'Gagal menghapus aturan.' });
    }
  };

  const handleSaveGlobalWebhook = () => {
    localStorage.setItem('wagtw_global_webhook', globalWebhook.trim());
    setBanner({ type: 'success', message: 'Global webhook berhasil disimpan!' });
    setTimeout(() => setBanner(null), 3000);
  };

  const handleTestGlobalWebhook = async () => {
    if (!globalWebhook.trim()) return;
    setWebhookTesting(true);
    setWebhookResult(null);
    try {
      const start = Date.now();
      const res = await fetch(globalWebhook.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'webhook_test',
          timestamp: new Date().toISOString(),
          gateway: 'WAGTW-Pro',
          data: { ping: 'pong' }
        })
      });
      const latency = Date.now() - start;
      if (res.ok) {
        setWebhookResult({ success: true, msg: `Webhook Aktif! Response HTTP ${res.status} (${latency}ms)` });
      } else {
        setWebhookResult({ success: false, msg: `Server webhook merespon HTTP ${res.status}` });
      }
    } catch (err: any) {
      setWebhookResult({ success: false, msg: `Gagal menjangkau webhook: ${err.message}` });
    } finally {
      setWebhookTesting(false);
    }
  };

  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myNewPassword || myNewPassword.length < 6) {
      setBanner({ type: 'error', message: 'Password baru minimal 6 karakter.' });
      return;
    }
    if (myNewPassword !== myConfirmPassword) {
      setBanner({ type: 'error', message: 'Konfirmasi password tidak cocok dengan password baru.' });
      return;
    }
    setChangingMyPassword(true);
    try {
      await authService.changePassword({
        currentPassword: myCurrentPassword || undefined,
        newPassword: myNewPassword
      });
      setBanner({ type: 'success', message: 'Password Anda berhasil diubah! Gunakan password baru saat login berikutnya.' });
      setMyCurrentPassword('');
      setMyNewPassword('');
      setMyConfirmPassword('');
      setTimeout(() => setBanner(null), 4000);
    } catch (err: any) {
      setBanner({ type: 'error', message: 'Gagal mengubah password: ' + (err.response?.data?.error || err.message) });
    } finally {
      setChangingMyPassword(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword) {
      setBanner({ type: 'error', message: 'Email dan password wajib diisi.' });
      return;
    }
    if (newUserPassword.length < 6) {
      setBanner({ type: 'error', message: 'Password minimal 6 karakter.' });
      return;
    }
    setAddingUser(true);
    try {
      await authService.createUser({
        name: newUserName.trim() || undefined,
        email: newUserEmail.trim(),
        password: newUserPassword
      });
      setBanner({ type: 'success', message: `Pengguna baru "${newUserEmail}" berhasil dibuat dan siap login!` });
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      fetchUsersList();
      setTimeout(() => setBanner(null), 4000);
    } catch (err: any) {
      setBanner({ type: 'error', message: 'Gagal menambah pengguna: ' + (err.response?.data?.error || err.message) });
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async (userToDelete: any) => {
    if (!confirm(`Hapus pengguna "${userToDelete.email}"?\n\nPengguna ini tidak akan bisa login lagi.`)) {
      return;
    }
    try {
      await authService.deleteUser(userToDelete.id);
      setBanner({ type: 'success', message: `Pengguna "${userToDelete.email}" berhasil dihapus.` });
      fetchUsersList();
      setTimeout(() => setBanner(null), 3000);
    } catch (err: any) {
      setBanner({ type: 'error', message: 'Gagal menghapus pengguna: ' + (err.response?.data?.error || err.message) });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !resetNewPassword || resetNewPassword.length < 6) {
      setBanner({ type: 'error', message: 'Password baru minimal 6 karakter.' });
      return;
    }
    setResettingPassword(true);
    try {
      await authService.resetUserPassword(resettingUser.id, resetNewPassword);
      setBanner({ type: 'success', message: `Password untuk "${resettingUser.email}" berhasil diperbarui!` });
      setResettingUser(null);
      setResetNewPassword('');
      setTimeout(() => setBanner(null), 4000);
    } catch (err: any) {
      setBanner({ type: 'error', message: 'Gagal mereset password: ' + (err.response?.data?.error || err.message) });
    } finally {
      setResettingPassword(false);
    }
  };

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pengaturan Gateway & Sistem</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola konfigurasi Auto-Reply, Asisten 9routes AI, Webhook Global, serta Manajemen Akun & Password.
          </p>
        </div>
      </div>

      {/* Banner Notifikasi */}
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
          <span>Asisten 9routes AI</span>
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
          onClick={() => {
            setActiveTab('users');
            fetchUsersList();
          }}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Pengguna & Keamanan ({users.length || 1})</span>
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
                Pesan WhatsApp masuk yang cocok dengan kata kunci akan langsung dibalas otomatis via teks template atau 9routes AI.
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
            <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-xs text-slate-500">
              Memuat data aturan auto-reply...
            </div>
          ) : rules.length === 0 ? (
            <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
              <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">Belum Ada Aturan Auto-Reply</h4>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Buat aturan kata kunci pertama Anda agar pesan pelanggan dibalas secara instan.
              </p>
              <button
                onClick={openCreateModal}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Aturan Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`bg-white rounded-xl border p-4 shadow-xs transition-all flex flex-col justify-between ${
                    rule.isActive !== false ? 'border-slate-200' : 'border-slate-200/60 opacity-60 bg-slate-50/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {rule.isAi ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                            <span>9routes AI Auto-Reply</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <MessageSquare className="w-3 h-3 text-emerald-600" />
                            <span>Teks Template</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          Delay: {rule.cooldown || 30}s
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer ${
                          rule.isActive !== false
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {rule.isActive !== false ? '● Aktif' : '○ Jeda'}
                      </button>
                    </div>

                    <div className="mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kata Kunci:</span>
                      <div className="font-mono text-xs font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-100 mt-0.5 inline-block">
                        {rule.keyword ? `"${rule.keyword}"` : <em className="text-slate-400">Semua pesan (Fallback AI)</em>}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Balasan:</span>
                      <p className="text-xs text-slate-600 line-clamp-3 bg-slate-50/50 p-2 rounded border border-slate-100/60 mt-0.5 whitespace-pre-wrap">
                        {rule.isAi ? (
                          <span className="text-indigo-600 font-medium">
                            Dijawab otomatis oleh 9routes AI ({aiModel}) berdasarkan instruksi sistem.
                          </span>
                        ) : (
                          rule.response
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-slate-100">
                    <button
                      onClick={() => openEditModal(rule)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASISTEN 9ROUTES AI */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-600" />
                  <span>Pengaturan Asisten 9routes AI</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gunakan server AI lokal/eksternal 9routes yang mendukung chat completions format OpenAI.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAiEnabled(!aiEnabled)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  aiEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${aiEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                <span>{aiEnabled ? '9routes AI: AKTIF' : '9routes AI: NON-AKTIF'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Base URL Server 9routes
                </label>
                <input
                  type="text"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="http://103.89.2.102:20128/v1"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Endpoint OpenAI-compatible endpoint v1.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  API Key / Token Otorisasi
                </label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Token rahasia akses ke cluster 9routes AI.</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Model AI yang Digunakan
                </label>
                <button
                  type="button"
                  onClick={handleFetch9routesModels}
                  disabled={fetchingModels}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${fetchingModels ? 'animate-spin' : ''}`} />
                  <span>Scan Model dari Server 9routes</span>
                </button>
              </div>

              {availableModels.length > 0 ? (
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="misal: mistral/mistral-large-latest atau ag/gemini-3.8-flash-high"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                Pilih atau masukkan nama model LLM yang ingin memproses respon pesan WhatsApp.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Instruksi Sistem (System Prompt / Persona AI)
              </label>
              <textarea
                rows={4}
                value={aiSystemPrompt}
                onChange={(e) => setAiSystemPrompt(e.target.value)}
                placeholder="Anda adalah customer service asisten WhatsApp yang ramah, sopan, dan sigap membantu..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Tentukan gaya bahasa, informasi produk/layanan toko, serta batasan jawaban untuk AI.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveAiConfig}
                disabled={savingAi}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{savingAi ? 'Menyimpan...' : 'Simpan Pengaturan 9routes AI'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GLOBAL WEBHOOK */}
      {activeTab === 'webhook' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>Global Webhook Event Forwarder</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Setiap pesan WhatsApp masuk (inbound message) dan update status dapat diteruskan secara otomatis ke URL server backend Anda sendiri.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                URL Endpoint Webhook (POST Method)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={globalWebhook}
                  onChange={(e) => setGlobalWebhook(e.target.value)}
                  placeholder="https://aplikasi-anda.com/api/wa-webhook"
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleTestGlobalWebhook}
                  disabled={webhookTesting || !globalWebhook.trim()}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  <Send className="w-3 h-3" />
                  <span>{webhookTesting ? 'Menguji...' : 'Uji Webhook'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Sistem akan mengirimkan request HTTP POST dengan payload JSON berisi nomor pengirim, teks pesan, dan ID device.
              </p>
            </div>

            {webhookResult && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                  webhookResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {webhookResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{webhookResult.msg}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveGlobalWebhook}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simpan Global Webhook</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PENGGUNA & KEAMANAN (USER MANAGEMENT & GANTI PASSWORD) */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          {/* Card 1: Ganti Password Akun Saya */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Ubah Password Akun Saya</h3>
                <p className="text-xs text-slate-500">
                  Ganti password login untuk akun Anda yang sedang aktif ({currentUser.email || 'Akun Anda'}).
                </p>
              </div>
            </div>

            <form onSubmit={handleChangeMyPassword} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Password Saat Ini (Opsional jika baru)
                </label>
                <input
                  type="password"
                  value={myCurrentPassword}
                  onChange={(e) => setMyCurrentPassword(e.target.value)}
                  placeholder="Masukkan password lama Anda"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Password Baru (Min 6 Karakter) *
                  </label>
                  <input
                    type="password"
                    required
                    value={myNewPassword}
                    onChange={(e) => setMyNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Ulangi Password Baru *
                  </label>
                  <input
                    type="password"
                    required
                    value={myConfirmPassword}
                    onChange={(e) => setMyConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang password baru"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={changingMyPassword || !myNewPassword}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {changingMyPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>Simpan Password Baru</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Manajemen Akun Pegawai / Pengguna Lain */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Daftar Akun Pengguna / Pegawai</h3>
                  <p className="text-xs text-slate-500">
                    Tambah atau kelola akun staf/pegawai yang memiliki akses setara admin ke gateway ini.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddUserModal(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Tambah Pengguna Baru</span>
              </button>
            </div>

            {loadingUsers ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Memuat daftar pengguna...
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Belum ada data pengguna.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                      <th className="py-2.5 px-3">Pengguna</th>
                      <th className="py-2.5 px-3">Email Login</th>
                      <th className="py-2.5 px-3">Role / Hak Akses</th>
                      <th className="py-2.5 px-3">Terdaftar Sejak</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const isMe = currentUser.id === u.id || currentUser.email === u.email;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[11px]">
                                {(u.name || u.email).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">
                                  {u.name || 'Pengguna'} {isMe && <span className="text-[10px] text-emerald-600 font-semibold">(Anda)</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            {u.email}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                              <Shield className="w-2.5 h-2.5" />
                              <span>Administrator</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {new Date(u.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setResettingUser(u);
                                  setResetNewPassword('');
                                }}
                                className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                title="Ubah Password"
                              >
                                <KeyRound className="w-3 h-3 text-slate-500" />
                                <span>Reset Password</span>
                              </button>

                              {!isMe && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  title="Hapus Pengguna"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: STATUS GATEWAY */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Node API Engine</span>
              <p className="text-sm font-mono font-bold text-slate-900">Port 4010</p>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Ready & Healthy</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Worker Chromium</span>
              <p className="text-sm font-mono font-bold text-slate-900">Port 4011</p>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Puppeteer Active</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admin Dashboard</span>
              <p className="text-sm font-mono font-bold text-slate-900">Port 5174</p>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Vite React SPA</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI LLM Provider</span>
              <p className="text-sm font-mono font-bold text-slate-900">9routes v1</p>
              <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded">OpenAI Compatible</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Anti-Bot Fingerprint</span>
              <p className="text-sm font-mono font-bold text-slate-900">Intel Iris Xe</p>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">WebGL Spoof Active</span>
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Process Manager</span>
              <p className="text-sm font-mono font-bold text-slate-900">PM2 Daemon</p>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Cluster Online</span>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL 1: TAMBAH / EDIT RULE AUTO-REPLY */}
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
                      <span className="text-xs font-bold text-slate-900">9routes AI</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Dibalas cerdas oleh 9routes AI berdasarkan konteks pertanyaan.
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
                  placeholder={formMode === 'ai' ? 'Kosongkan jika ingin jadi 9routes AI Fallback semua pesan' : 'Contoh: halo / info / harga / order'}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {formMode === 'ai'
                    ? 'Jika dikosongkan, 9routes AI akan menjawab setiap pesan yang tidak cocok dengan kata kunci teks lainnya.'
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

      {/* POPUP MODAL 2: TAMBAH USER / PEGAWAI BARU */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tambah Akun Pegawai Baru</h3>
                  <p className="text-[11px] text-slate-500">Berikan akses pengelolaan gateway WhatsApp.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Nama Lengkap / Jabatan
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Contoh: Budi Santoso (Customer Service)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Email Login *
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="pegawai@perusahaan.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Password Login (Min 6 Karakter) *
                </label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {addingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Tambah Pengguna</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL 3: RESET PASSWORD PENGGUNA */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reset Password Pengguna</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{resettingUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Password Baru Pengguna (Min 6 Karakter) *
                </label>
                <input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Ketik password baru"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {resettingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>Perbarui Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
