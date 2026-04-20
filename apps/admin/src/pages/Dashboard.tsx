import { Smartphone, MessageCircle, Clock, Zap, TrendingUp, Users } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { label: 'Active Devices', value: '4', icon: Smartphone, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+12%' },
    { label: 'Messages Sent', value: '1,284', icon: MessageCircle, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+8%' },
    { label: 'Avg. Response', value: '1.2m', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: '-2%' },
    { label: 'Active Clients', value: '12', icon: Users, color: 'text-orange-600', bg: 'bg-orange-50', trend: '+5%' },
  ];

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-2 text-lg">Welcome back! Here's what's happening with your gateway.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            Export Report
          </button>
          <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
            Realtime View
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="group bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className={`${stat.bg} p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <span className={clsx(
                "text-[10px] font-bold px-2 py-1 rounded-full",
                stat.trend.startsWith('+') ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
              )}>
                {stat.trend}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">{stat.label}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-8">
             <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Messaging Volume
             </h3>
             <select className="bg-slate-50 border-none rounded-xl text-xs font-medium px-4 py-2 focus:ring-0">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
             </select>
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {[40, 70, 45, 90, 65, 80, 100].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                <div 
                  className="w-full bg-slate-100 rounded-t-xl group-hover:bg-primary transition-all duration-500 relative" 
                  style={{ height: `${h}%` }}
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {h * 12} messages
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400">Day {i+1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl shadow-slate-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="mb-6">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">System Health</h3>
              <p className="text-slate-400 text-sm">All systems operational across 3 regions.</p>
            </div>
            
            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Worker Status</span>
                <span className="text-primary font-bold">100%</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-full"></div>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Database Latency</span>
                <span className="text-blue-400 font-bold">24ms</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-400 h-full w-1/4"></div>
              </div>
            </div>

            <button className="w-full py-4 bg-primary text-slate-900 font-bold rounded-2xl mt-8 hover:bg-white transition-all">
              View Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { clsx } from 'clsx';
