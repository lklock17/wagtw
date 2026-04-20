import { useState, useEffect } from 'react';
import { Plus, Key, Trash2, Shield, Copy } from 'lucide-react';
import { clientService } from '../services/api';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await clientService.getClients();
      setClients(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = prompt('Client Name:');
    if (!name) return;
    try {
      await clientService.createClient({ name, rateLimit: 60 });
      fetchClients();
    } catch (err) {
      alert('Failed to create client');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await clientService.deleteClient(id);
      fetchClients();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">API Clients</h1>
          <p className="text-slate-500 mt-2 text-lg">Manage access for third-party integrations.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl flex items-center gap-3 transition-all shadow-lg font-bold"
        >
          <Plus className="w-5 h-5" />
          Add Client
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Client Name</th>
              <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">API Key</th>
              <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Rate Limit</th>
              <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {clients.map((client: any) => (
              <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-4 font-bold text-slate-900">{client.name}</td>
                <td className="px-8 py-4">
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    <code className="text-xs text-slate-600">{client.apiKey}</code>
                    <button onClick={() => navigator.clipboard.writeText(client.apiKey)} className="text-slate-400 hover:text-slate-600">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="px-8 py-4 text-sm text-slate-500 font-medium">{client.rateLimit} msg/min</td>
                <td className="px-8 py-4 text-right">
                  <button onClick={() => handleDelete(client.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
