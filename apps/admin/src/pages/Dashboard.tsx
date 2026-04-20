import { LayoutDashboard, Smartphone, MessageCircle, Clock } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { label: 'Active Devices', value: '0', icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Total Messages', value: '0', icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Response Rate', value: '0%', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'API Requests', value: '0', icon: LayoutDashboard, color: 'text-orange-600', bg: 'bg-orange-100' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your WhatsApp Gateway performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`${stat.bg} p-3 rounded-lg`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80 flex items-center justify-center text-gray-400">
          [Activity Chart Placeholder]
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
          <h3 className="font-bold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
             <p className="text-sm text-gray-500 italic">No recent activity found.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
