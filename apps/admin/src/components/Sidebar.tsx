import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Smartphone, 
  Inbox, 
  Send, 
  Key, 
  Settings, 
  MessageSquare 
} from 'lucide-react';
import { clsx } from 'clsx';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Smartphone, label: 'Devices', path: '/devices' },
  { icon: Inbox, label: 'Inbox', path: '/inbox' },
  { icon: MessageSquare, label: 'Templates', path: '/templates' },
  { icon: Send, label: 'Logs', path: '/logs' },
  { icon: Key, label: 'API Clients', path: '/clients' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-64 bg-white border-r h-full flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <MessageSquare className="w-8 h-8" />
          WAGTW
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                active 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-4 py-3 text-gray-600">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
            A
          </div>
          <span className="font-medium text-sm">Admin User</span>
        </div>
      </div>
    </div>
  );
}
