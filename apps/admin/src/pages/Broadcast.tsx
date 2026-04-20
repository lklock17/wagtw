import { useState, useEffect } from 'react';
import { Upload, Send, Smartphone, Clock, List, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { deviceService, bulkService } from '../services/api';
import { clsx } from 'clsx';

export default function Broadcast() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [jobName, setJobName] = useState('');
  const [message, setMessage] = useState('');
  const [contacts, setContacts] = useState<string[]>([]);
  const [delay, setDelay] = useState(5);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    fetchDevices();
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      const res = await deviceService.getDevices();
      setDevices(res.data.filter((d: any) => d.status === 'CONNECTED'));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await bulkService.getJobs();
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      setContacts(lines);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || contacts.length === 0 || !message) {
      alert('Please fill all fields and upload contacts');
      return;
    }

    setLoading(true);
    try {
      await bulkService.createJob({
        name: jobName || `Broadcast ${new Date().toLocaleString()}`,
        deviceId: selectedDevice,
        contacts,
        body: message,
        delay
      });
      setJobName('');
      setMessage('');
      setContacts([]);
      fetchJobs();
    } catch (err) {
      alert('Failed to start broadcast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Massive Broadcast</h1>
        <p className="text-slate-500 mt-2 text-lg">Send messages to thousands of contacts with safe delay logic.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Campaign Name</label>
                <input 
                  type="text" 
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g. Promo Ramadhan"
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Select Sender Device</label>
                <select 
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  required
                >
                  <option value="">Choose a connected device</option>
                  {devices.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phoneNumber})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Upload Contacts (CSV/TXT)</label>
              <div className="relative border-2 border-dashed border-slate-100 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer group">
                <input 
                  type="file" 
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-slate-300 group-hover:text-primary transition-colors mb-2" />
                <p className="text-sm font-medium text-slate-500">
                  {contacts.length > 0 ? `${contacts.length} numbers loaded` : "Click or drag CSV file (one number per line)"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Message Body</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hello {{name}}, welcome to our service!"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none h-32 resize-none"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delay</span>
                  <input 
                    type="number" 
                    value={delay}
                    onChange={(e) => setDelay(Number(e.target.value))}
                    className="w-12 bg-transparent border-none text-sm font-bold text-primary focus:ring-0 p-0 text-center"
                  />
                  <span className="text-xs font-bold text-slate-400">SEC</span>
                </div>
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-primary hover:bg-secondary text-white rounded-2xl font-bold shadow-lg shadow-primary/30 transition-all flex items-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Start Broadcast
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar/Status Section */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] rounded-full -mr-16 -mt-16"></div>
             <div className="relative z-10">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                   <List className="w-5 h-5 text-primary" />
                   Active Jobs
                </h3>
                <div className="space-y-6">
                   {jobs.length === 0 ? (
                     <p className="text-slate-500 text-sm italic">No active broadcast jobs.</p>
                   ) : jobs.slice(0, 3).map((job: any) => {
                     const progress = Math.round(((job.sent + job.failed) / job.total) * 100);
                     return (
                       <div key={job.id} className="space-y-3">
                          <div className="flex justify-between items-end">
                             <p className="text-sm font-bold truncate pr-4">{job.name}</p>
                             <span className="text-[10px] font-bold text-slate-400">{progress}%</span>
                          </div>
                          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                             <div 
                               className="bg-primary h-full transition-all duration-500" 
                               style={{ width: `${progress}%` }}
                             />
                          </div>
                          <div className="flex justify-between text-[10px] font-medium text-slate-400">
                             <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400" /> {job.sent} Sent</span>
                             <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-rose-400" /> {job.failed} Failed</span>
                          </div>
                       </div>
                     );
                   })}
                </div>
             </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
             <h3 className="font-bold text-slate-900 mb-4">Pro Tips</h3>
             <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                   Use at least 5-10s delay to stay safe.
                </li>
                <li className="flex gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                   Rotate multiple devices for larger campaigns.
                </li>
                <li className="flex gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                   Avoid sending links in the first message.
                </li>
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
