import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Zap, MessageSquare } from 'lucide-react';
import { autoReplyService } from '../services/api';

export default function Settings() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await autoReplyService.getRules();
      setRules(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const keyword = prompt('Keyword (atau biarkan kosong untuk AI Fallback):');
    const response = prompt('Response (opsional jika menggunakan AI):');
    const isAi = confirm('Gunakan Gemini AI untuk membalas?');
    
    try {
      await autoReplyService.createRule({ 
        keyword: keyword || null, 
        response: response || null, 
        isAi, 
        cooldown: 30 
      });
      fetchRules();
    } catch (err) {
      alert('Failed to create rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await autoReplyService.deleteRule(id);
      fetchRules();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-slate-500 mt-2 text-lg">Configure system behavior and automation rules.</p>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Auto Reply Rules
          </h3>
          <button 
            onClick={handleCreate}
            className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>

        <div className="space-y-4">
          {rules.length === 0 ? (
            <p className="text-slate-400 italic text-center py-8">No auto-reply rules configured.</p>
          ) : rules.map((rule: any) => (
            <div key={rule.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  {rule.isAi ? <Zap className="w-5 h-5 text-primary" /> : <MessageSquare className="w-5 h-5 text-blue-500" />}
                </div>
                <div>
                  <p className="font-bold text-slate-900">
                    {rule.keyword ? `Keyword: "${rule.keyword}"` : "AI Fallback Mode"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {rule.isAi ? "Responds using Gemini AI" : `Reply: "${rule.response}"`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(rule.id)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
