import React, { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Upload, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  RotateCw,
  FolderOpen
} from 'lucide-react';
import { mediaService } from '../services/api';

export default function Media() {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const res = await mediaService.getMedia();
      setMedia(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await mediaService.uploadMedia(formData);
      fetchMedia();
    } catch (err) {
      alert('Gagal mengunggah media');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus berkas media ini?')) return;
    try {
      await mediaService.deleteMedia(id);
      fetchMedia();
    } catch (err) {
      alert('Gagal menghapus berkas');
    }
  };

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredMedia = media.filter((m: any) => 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Media Storage & Library</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Penyimpanan gambar dan dokumen untuk dikirimkan melalui pesan WhatsApp broadcast atau API.
          </p>
        </div>

        <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-all cursor-pointer">
          {uploading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          <span>{uploading ? 'Mengunggah...' : 'Unggah Media Baru'}</span>
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {/* Compact Search Bar */}
      <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari media berdasarkan nama..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-transparent focus:outline-none text-slate-800"
          />
        </div>
        <span className="text-[11px] text-slate-400 font-medium px-2">
          {filteredMedia.length} berkas
        </span>
      </div>

      {/* Media Grid */}
      {loading && media.length === 0 ? (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-xs text-slate-500">
          Memuat daftar media...
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center flex flex-col items-center shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
            <FolderOpen className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Media Library Kosong</h3>
          <p className="text-slate-500 text-xs mt-1 mb-4 max-w-md">
            Belum ada berkas media yang diunggah. Unggah gambar produk atau brosur untuk mulai kirim pesan media.
          </p>
          <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Unggah Sekarang</span>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {filteredMedia.map((item: any) => {
            const isImg = item.mimeType?.startsWith('image') || item.type === 'IMAGE';
            const isVid = item.mimeType?.startsWith('video') || item.type === 'VIDEO';

            return (
              <div 
                key={item.id} 
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between group"
              >
                <div className="h-28 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                  {isImg ? (
                    <img 
                      src={item.url} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                    />
                  ) : isVid ? (
                    <Video className="w-8 h-8 text-indigo-500" />
                  ) : (
                    <FileText className="w-8 h-8 text-slate-400" />
                  )}
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded bg-black/60 backdrop-blur-xs text-[9px] font-bold text-white font-mono uppercase">
                    {item.type || 'FILE'}
                  </span>
                </div>

                <div className="p-2.5 space-y-1.5">
                  <p className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {(item.size / 1024).toFixed(1)} KB
                  </p>

                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => copyToClipboard(item.url, item.id)}
                      className="text-[10px] font-semibold text-slate-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                      title="Salin URL Publik"
                    >
                      {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === item.id ? 'Tersalin' : 'Salin URL'}</span>
                    </button>

                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
