import { Routes, Route, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Contacts from './pages/Contacts';
import Inbox from './pages/Inbox';
import Templates from './pages/Templates';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import Broadcast from './pages/Broadcast';
import Media from './pages/Media';
import Scheduling from './pages/Scheduling';
import Warmup from './pages/Warmup';
import ApiDocs from './pages/ApiDocs';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import { ShieldCheck, Activity, Terminal, ExternalLink } from 'lucide-react';

function TopNavbar() {
  const location = useLocation();

  const getPageMeta = () => {
    switch (location.pathname) {
      case '/': return { title: 'Dashboard', desc: 'Ringkasan operasional dan analitik gateway' };
      case '/devices': return { title: 'Devices WhatsApp', desc: 'Manajemen sesi nomor dan QR code' };
      case '/contacts': return { title: 'Buku Kontak (Phonebook)', desc: 'Manajemen nomor pelanggan, label segmentasi, dan ekspor vCard' };
      case '/warmup': return { title: 'Warmup Nomor (AI)', desc: 'Pemanasan nomor otomatis 24/7 via 9routes' };
      case '/inbox': return { title: 'Inbox & Live Chat', desc: 'Riwayat percakapan masuk dan keluar' };
      case '/broadcast': return { title: 'Broadcast Massal', desc: 'Kirim kampanye pesan aman dengan delay cerdas' };
      case '/scheduling': return { title: 'Penjadwalan Pesan', desc: 'Antrean pesan terjadwal otomatis' };
      case '/templates': return { title: 'Template Pesan', desc: 'Kumpulan draft pesan siap pakai' };
      case '/media': return { title: 'Media Library', desc: 'Penyimpanan berkas gambar dan dokumen' };
      case '/docs': return { title: 'Dokumentasi REST API', desc: 'Integrasi aplikasi eksternal, Auto-Rotate & Failover' };
      case '/clients': return { title: 'API Client Keys', desc: 'Manajemen kredensial dan rate limit' };
      case '/settings': return { title: 'Pengaturan Sistem', desc: 'Konfigurasi webhook, AI dan engine' };
      default: return { title: 'Portal WAGTW', desc: '' };
    }
  };

  const meta = getPageMeta();

  return (
    <header className="h-14 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-slate-900 tracking-tight">{meta.title}</h2>
        {meta.desc && (
          <span className="hidden md:inline-block text-[11px] text-slate-400 border-l border-slate-200 pl-2">
            {meta.desc}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Active Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Gateway Active</span>
        </div>

        <a
          href="/docs"
          className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
        >
          <span>REST API</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>
      </div>
    </header>
  );
}

function App() {
  const token = localStorage.getItem('token');
  const location = useLocation();

  // Public Documentation Route (No Login Required)
  if (location.pathname === '/docs') {
    return <ApiDocs isPublic={true} />;
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/docs" element={<ApiDocs isPublic={true} />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/warmup" element={<Warmup />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/broadcast" element={<Broadcast />} />
            <Route path="/media" element={<Media />} />
            <Route path="/scheduling" element={<Scheduling />} />
            <Route path="/docs" element={<ApiDocs />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
