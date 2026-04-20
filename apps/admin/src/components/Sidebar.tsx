import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Smartphone, 
  Inbox, 
  Send, 
  Key, 
  Settings, 
  MessageSquare,
  ChevronRight,
  Image as ImageIcon,
  LogOut
} from 'lucide-react';
import { clsx } from 'clsx';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Smartphone, label: 'Devices', path: '/devices' },
  { icon: Send, label: 'Broadcast', path: '/broadcast' },
  { icon: ImageIcon, label: 'Media Library', path: '/media' },
  { icon: Inbox, label: 'Inbox', path: '/inbox' },
  { icon: MessageSquare, label: 'Templates', path: '/templates' },
  { icon: Key, label: 'API Clients', path: '/clients' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-72 bg-white h-screen flex flex-col sticky top-0 border-r border-slate-100">
      <div className="p-8">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 group-hover:rotate-12 transition-transform duration-300">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WAGTW</h1>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Main Menu</p>
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                "group flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300",
                active 
                  ? "bg-slate-900 text-white shadow-xl shadow-slate-200" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={clsx("w-5 h-5", active ? "text-primary" : "group-hover:text-primary transition-colors")} />
                <span className="font-semibold text-sm">{item.label}</span>
              </div>
              {active && <ChevronRight className="w-4 h-4 text-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-6">
        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center gap-4 group cursor-pointer hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all duration-300">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white font-bold shadow-md shadow-primary/20">
            A
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="font-bold text-slate-900 text-sm truncate">Admin Premium</p>
            <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Super Admin</p>
          </div>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
