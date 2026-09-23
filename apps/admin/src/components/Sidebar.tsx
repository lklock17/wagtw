import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Smartphone, 
  Flame, 
  Send, 
  Inbox, 
  Calendar, 
  FileText, 
  FolderGit2, 
  KeyRound, 
  Code2, 
  Settings, 
  LogOut, 
  Radio, 
  RotateCw,
  Sparkles
} from 'lucide-react';
import { clsx } from 'clsx';

const navigation = [
  {
    group: 'Utama',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'Devices WhatsApp', path: '/devices', icon: Smartphone },
      { name: 'Warmup Nomor', path: '/warmup', icon: Flame, badge: 'AI' },
      { name: 'Inbox Chat', path: '/inbox', icon: Inbox },
    ]
  },
  {
    group: 'Pengiriman & Pesan',
    items: [
      { name: 'Broadcast Massal', path: '/broadcast', icon: Send },
      { name: 'Penjadwalan Pesan', path: '/scheduling', icon: Calendar },
      { name: 'Template Pesan', path: '/templates', icon: FileText },
      { name: 'Media Library', path: '/media', icon: FolderGit2 },
    ]
  },
  {
    group: 'Developer & API',
    items: [
      { name: 'Dokumentasi API', path: '/docs', icon: Code2, badge: 'AUTO-ROTATE' },
      { name: 'API Client Keys', path: '/clients', icon: KeyRound },
      { name: 'Pengaturan Sistem', path: '/settings', icon: Settings },
    ]
  }
];

export default function Sidebar() {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Administrator","email":"admin@wagtw.com"}');

  return (
    <aside className="w-60 bg-white h-screen flex flex-col sticky top-0 border-r border-slate-200/90 z-30 select-none font-sans">
      {/* Brand Monogram Header */}
      <div className="h-14 px-5 border-b border-slate-100 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-600/30 group-hover:scale-105 transition-transform">
            <Radio className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-slate-900">WAGTW</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-none">Enterprise Gateway</p>
          </div>
        </Link>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navigation.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <div className="px-2.5 mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                {group.group}
              </p>
            </div>
            {group.items.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    "flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150",
                    active
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className={clsx(
                      "w-4 h-4 shrink-0 transition-colors",
                      active ? "text-emerald-400" : "text-slate-400"
                    )} />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className={clsx(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide",
                      active 
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30" 
                        : item.badge === 'AI' 
                          ? "bg-amber-50 text-amber-700 border border-amber-200" 
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Engine Status Bar */}
      <div className="px-3 pb-3">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-700">Cluster 4010/4011</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
            Online
          </span>
        </div>
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {user.name ? user.name.charAt(0) : 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate leading-tight">{user.name || 'Admin'}</p>
              <p className="text-[10px] text-slate-400 truncate leading-tight">{user.email || 'admin@wagtw.com'}</p>
            </div>
          </div>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors shrink-0 cursor-pointer"
            title="Keluar"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
