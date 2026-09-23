import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  FileText, 
  Copy, 
  Check, 
  RotateCw,
  Sparkles
} from 'lucide-react';
import { templateService } from '../services/api';

export default function Templates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await templateService.getTemplates();
      setTemplates(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      await templateService.createTemplate({ name: name.trim(), body: body.trim(), type: 'TEXT' });
      setName('');
      setBody('');
      setShowModal(false);
      fetchTemplates();
    } catch (err) {
      alert('Gagal membuat template baru');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus template pesan ini?')) return;
    try {
      await templateService.deleteTemplate(id);
      fetchTemplates();
    } catch (err) {
      alert('Gagal menghapus template');
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Template Pesan WhatsApp</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kumpulan draf teks siap pakai untuk mempercepat balasan CS atau kampanye pesan.
          </p>
        </div>

        <button 
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg font-bold text-xs transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Buat Template Baru</span>
        </button>
      </div>

      {/* Grid of Templates */}
      {loading && templates.length === 0 ? (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-xs text-slate-500">
          Memuat template...
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center flex flex-col items-center shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Belum Ada Template Tersimpan</h3>
          <p className="text-slate-500 text-xs mt-1 mb-4 max-w-md">
            Buat template pesan pertama Anda untuk digunakan pada broadcast massal atau balasan cepat.
          </p>
          <button 
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Template Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl: any) => (
            <div 
              key={tpl.id} 
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-xs truncate max-w-[170px]">{tpl.name}</h3>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                    TEXT
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs text-slate-700 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {tpl.body}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => handleCopy(tpl.body, tpl.id)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  {copiedId === tpl.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === tpl.id ? 'Tersalin' : 'Salin Pesan'}</span>
                </button>

                <button 
                  onClick={() => handleDelete(tpl.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create Template */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Buat Template Pesan Baru</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nama Template
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Sambutan Selamat Datang"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Isi Pesan Template
                </label>
                <textarea
                  required
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Halo, terima kasih telah menghubungi kami. Ada yang bisa kami bantu?"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {submitting ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{submitting ? 'Menyimpan...' : 'Simpan Template'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
