import { useState, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, FileText } from 'lucide-react';
import { templateService } from '../services/api';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await templateService.getTemplates();
      setTemplates(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = prompt('Template Name:');
    const body = prompt('Template Body:');
    if (!name || !body) return;
    try {
      await templateService.createTemplate({ name, body, type: 'TEXT' });
      fetchTemplates();
    } catch (err) {
      alert('Failed to create template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await templateService.deleteTemplate(id);
      fetchTemplates();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Templates</h1>
          <p className="text-slate-500 mt-2 text-lg">Manage your frequently used message templates.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="bg-primary hover:bg-secondary text-white px-6 py-3 rounded-2xl flex items-center gap-3 transition-all shadow-lg shadow-primary/30 font-bold"
        >
          <Plus className="w-5 h-5" />
          Create Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tpl: any) => (
          <div key={tpl.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{tpl.name}</h3>
              <p className="text-slate-500 text-sm italic">"{tpl.body}"</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-50 flex justify-end">
              <button 
                onClick={() => handleDelete(tpl.id)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
