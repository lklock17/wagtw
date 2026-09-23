import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Download, 
  Upload, 
  Tag, 
  Trash2, 
  Edit3, 
  Phone, 
  Mail, 
  FileText, 
  Copy, 
  Check, 
  ExternalLink,
  Sparkles,
  Filter,
  X,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { contactService } from '../services/api';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string | null;
  tags: string[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Import State
  const [csvText, setCsvText] = useState('');
  const [defaultImportTag, setDefaultImportTag] = useState('Import');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
    fetchTags();
  }, [selectedTag]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await contactService.getContacts({
        search: search.trim() || undefined,
        tag: selectedTag !== 'ALL' ? selectedTag : undefined
      });
      setContacts(res.data || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await contactService.getTags();
      setTags(res.data || []);
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchContacts();
  };

  const openCreateModal = () => {
    setEditingContact(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormTags([]);
    setFormNotes('');
    setTagInput('');
    setShowAddModal(true);
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormPhone(contact.phoneNumber);
    setFormEmail(contact.email || '');
    setFormTags(contact.tags || []);
    setFormNotes(contact.notes || '');
    setTagInput('');
    setShowAddModal(true);
  };

  const handleAddTag = () => {
    const clean = tagInput.trim();
    if (clean && !formTags.includes(clean)) {
      setFormTags([...formTags, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormTags(formTags.filter((t) => t !== tagToRemove));
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      alert('Nama dan Nomor WhatsApp wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      if (editingContact) {
        await contactService.updateContact(editingContact.id, {
          name: formName.trim(),
          phoneNumber: formPhone.trim(),
          email: formEmail.trim() || undefined,
          tags: formTags,
          notes: formNotes.trim() || undefined
        });
      } else {
        await contactService.createContact({
          name: formName.trim(),
          phoneNumber: formPhone.trim(),
          email: formEmail.trim() || undefined,
          tags: formTags,
          notes: formNotes.trim() || undefined
        });
      }

      setShowAddModal(false);
      fetchContacts();
      fetchTags();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Gagal menyimpan kontak');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Hapus kontak "${contact.name}" (+${contact.phoneNumber})?`)) return;
    try {
      await contactService.deleteContact(contact.id);
      fetchContacts();
      fetchTags();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Gagal menghapus kontak');
    }
  };

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText('+' + phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;

    // Parse CSV lines
    const lines = csvText.trim().split('\n');
    const parsed: Array<{ name: string; phoneNumber: string; tags?: string[]; notes?: string }> = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Support comma or semicolon or tab separated
      const separator = line.includes(';') ? ';' : (line.includes('\t') ? '\t' : ',');
      const parts = line.split(separator).map((p) => p.trim().replace(/^["']|["']$/g, ''));

      // If header row, skip
      if (parts[0]?.toLowerCase().includes('nama') || parts[0]?.toLowerCase().includes('name')) {
        continue;
      }

      if (parts.length >= 2) {
        parsed.push({
          name: parts[0] || 'Kontak Tanpa Nama',
          phoneNumber: parts[1],
          tags: parts[2] ? parts[2].split('|').map((t) => t.trim()) : [],
          notes: parts[3] || undefined
        });
      } else if (parts.length === 1 && parts[0]) {
        // Just phone number
        parsed.push({
          name: 'Kontak ' + parts[0].slice(-4),
          phoneNumber: parts[0]
        });
      }
    }

    if (parsed.length === 0) {
      alert('Tidak ada baris kontak yang valid untuk diimpor.');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const res = await contactService.importContacts({
        contacts: parsed,
        defaultTag: defaultImportTag.trim() || undefined
      });
      setImportResult(res.data?.message || 'Impor selesai');
      setCsvText('');
      fetchContacts();
      fetchTags();
      setTimeout(() => {
        setShowImportModal(false);
        setImportResult(null);
      }, 2500);
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Gagal mengimpor kontak');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadVcf = () => {
    const url = contactService.getExportVcfUrl(selectedTag !== 'ALL' ? selectedTag : undefined);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Kontak (Buku Telepon)</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simpan nomor kontak pelanggan, segmentasikan berdasarkan label/tag, dan ekspor ke buku telepon HP.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleDownloadVcf}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
            title="Download vCard (.vcf) untuk diimpor ke kontak Google / HP WhatsApp"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Ekspor vCard (.vcf)</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Tambah Kontak</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Kontak</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{contacts.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Tersimpan di database</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kategori / Tag</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{tags.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Segmentasi audiens aktif</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sinkronisasi HP</p>
            <p className="text-sm font-bold text-emerald-600 mt-1">Siap Ekspor (vCard 3.0)</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Kompatibel Google & iPhone</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Cari nama, nomor HP, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </form>

          {/* Tag Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedTag('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedTag === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Semua ({contacts.length})
            </button>
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTag(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedTag === t
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
            Memuat daftar kontak...
          </div>
        ) : contacts.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Belum Ada Kontak Tersimpan</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {search || selectedTag !== 'ALL'
                ? 'Tidak ada kontak yang cocok dengan filter pencarian.'
                : 'Mulai tambahkan nomor kontak pelanggan untuk memudahkan broadcast, segmentasi, dan pemanasan nomor AI.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={openCreateModal}
                className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all"
              >
                + Tambah Kontak Pertama
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-3.5 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all"
              >
                Import CSV
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-5">Nama Kontak</th>
                  <th className="py-3.5 px-4">Nomor WhatsApp</th>
                  <th className="py-3.5 px-4">Tag / Kategori</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((c) => {
                  const initials = c.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            {initials || 'WA'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{c.name}</div>
                            {c.email && (
                              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span>{c.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            +{c.phoneNumber}
                          </span>
                          <button
                            onClick={() => handleCopyPhone(c.id, c.phoneNumber)}
                            className="text-slate-400 hover:text-slate-700 transition-colors p-1"
                            title="Salin nomor HP"
                          >
                            {copiedId === c.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={`https://wa.me/${c.phoneNumber}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-emerald-600 transition-colors p-1"
                            title="Buka WhatsApp langsung"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {c.tags && c.tags.length > 0 ? (
                            c.tags.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60"
                              >
                                #{t}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Tanpa tag</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                        {c.notes || <span className="text-slate-300 italic">-</span>}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Kontak"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Kontak"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal Tambah / Edit Kontak */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingContact ? 'Edit Kontak' : 'Tambah Kontak Baru'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nomor WhatsApp *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 08123456789 atau 628123456789"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 Format otomatis dinormalisasi menjadi kode negara (628...).
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  placeholder="contoh@gmail.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Tag / Label Segmentasi
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Ketik tag lalu tekan enter atau Tambah..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                  >
                    Tambah
                  </button>
                </div>

                {/* Quick suggestions */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {['Warmup', 'VIP', 'Pelanggan', 'Leads', 'Reseller'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (!formTags.includes(preset)) setFormTags([...formTags, preset]);
                      }}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>

                {/* Selected tags */}
                <div className="flex items-center gap-1.5 flex-wrap min-h-6">
                  {formTags.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan profil atau alamat..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Kontak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import CSV */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Import Kontak Massal (CSV / Teks)</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Label / Tag Bawaan (Otomatis Ditambahkan)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Warmup atau Pelanggan Baru"
                  value={defaultImportTag}
                  onChange={(e) => setDefaultImportTag(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Paste Data Kontak CSV
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Format: Nama, NomorHP, Tag, Catatan</span>
                </div>
                <textarea
                  rows={8}
                  required
                  placeholder={`Budi Santoso, 081234567890, Pelanggan, Toko Cabang A\nSiti Rahma, 089674657175, Warmup, Nomor Uji Coba\nAndi Prasetyo, 0816531337`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full font-mono text-[11px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Petunjuk Format Import:</span>
                </div>
                <p>
                  • Satu kontak per baris. Pisahkan kolom menggunakan koma (,) atau titik-koma (;).
                </p>
                <p>
                  • Kolom minimal: <strong>Nama, Nomor WhatsApp</strong>. Jika nomor sudah ada, data nama dan tag akan diperbarui otomatis.
                </p>
              </div>

              {importResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 font-medium">
                  ✅ {importResult}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={importing || !csvText.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {importing ? 'Memproses Import...' : 'Mulai Import Kontak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
