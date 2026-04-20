import { useState, useEffect } from 'react';
import { Image as ImageIcon, Video, FileText, Upload, Trash2, Copy, Check, Search, Filter, Loader2 } from 'lucide-react';
import { mediaService } from '../services/api';
import { clsx } from 'clsx';

export default function Media() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      const res = await mediaService.getMedia();
      setMedia(res.data);
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
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await mediaService.deleteMedia(id);
      fetchMedia();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredMedia = media.filter((m: any) => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Media Library</h1>
          <p className="text-slate-500 mt-2 text-lg">Central storage for your images, videos, and documents.</p>
        </div>
        
        <label className="flex items-center gap-2 px-8 py-4 bg-primary hover:bg-secondary text-white rounded-2xl font-bold shadow-lg shadow-primary/30 transition-all cursor-pointer group">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />}
          <span>Upload New Media</span>
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input 
            type="text" 
            placeholder="Search media by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <button className="flex-1 md:flex-none px-6 py-3 bg-slate-50 text-slate-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all">
             <Filter className="w-4 h-4" />
             All Types
           </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-slate-400 font-medium tracking-wide">Loading your library...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredMedia.map((item: any) => (
            <div key={item.id} className="group bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all overflow-hidden flex flex-col">
              <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center border-b border-slate-50">
                {item.type === 'IMAGE' ? (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : item.type === 'VIDEO' ? (
                  <Video className="w-16 h-16 text-slate-200" />
                ) : (
                  <FileText className="w-16 h-16 text-slate-200" />
                )}
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                   <button 
                    onClick={() => copyToClipboard(item.url, item.id)}
                    className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 hover:bg-primary hover:text-white transition-all shadow-xl"
                    title="Copy URL"
                   >
                     {copiedId === item.id ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                   </button>
                   <button 
                    onClick={() => handleDelete(item.id)}
                    className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-xl"
                    title="Delete"
                   >
                     <Trash2 className="w-5 h-5" />
                   </button>
                </div>

                <div className="absolute top-4 left-4">
                  <div className={clsx(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm",
                    item.type === 'IMAGE' ? "bg-emerald-500 text-white" : 
                    item.type === 'VIDEO' ? "bg-amber-500 text-white" : "bg-primary text-white"
                  )}>
                    {item.type}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="font-bold text-slate-900 truncate mb-1" title={item.name}>{item.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {(item.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-[10px] font-medium text-slate-300">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredMedia.length === 0 && (
        <div className="flex flex-col items-center justify-center py-40 space-y-6">
           <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center">
             <ImageIcon className="w-10 h-10 text-slate-200" />
           </div>
           <p className="text-slate-400 font-medium">Your library is empty. Start uploading!</p>
        </div>
      )}
    </div>
  );
}
