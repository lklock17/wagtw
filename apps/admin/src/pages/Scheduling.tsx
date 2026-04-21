import { useState, useEffect } from 'react';
import { Calendar, Clock, Send, Smartphone, Trash2, CheckCircle, AlertCircle, Loader2, Plus } from 'lucide-react';
import { deviceService, scheduleService } from '../services/api';
import { clsx } from 'clsx';

export default function Scheduling() {
  const [devices, setDevices] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form State
  const [selectedDevice, setSelectedDevice] = useState('');
  const [targetNumber, setTargetNumber] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchSchedules, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [devRes, schRes] = await Promise.all([
        deviceService.getDevices(),
        scheduleService.getSchedules()
      ]);
      setDevices(devRes.data.filter((d: any) => d.status === 'CONNECTED'));
      setSchedules(schRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await scheduleService.getSchedules();
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !targetNumber || !message || !scheduledAt) return;

    setSubmitting(true);
    try {
      await scheduleService.createSchedule({
        deviceId: selectedDevice,
        to: targetNumber,
        body: message,
        scheduledAt
      });
      setTargetNumber('');
      setMessage('');
      setScheduledAt('');
      fetchSchedules();
    } catch (err) {
      alert('Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Cancel this schedule?')) return;
    try {
      await scheduleService.deleteSchedule(id);
      fetchSchedules();
    } catch (err) {
      alert('Delete failed');
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Message Scheduling</h1>
        <p className="text-slate-500 mt-2 text-lg">Prepare your messages now and send them automatically later.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 sticky top-8">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Plus className="w-5 h-5 text-primary" />
              New Schedule
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Select Device</label>
              <select 
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                required
              >
                <option value="">Choose device</option>
                {devices.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Recipient Number</label>
              <input 
                type="text" 
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value)}
                placeholder="62812345678"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Send Time</label>
              <input 
                type="datetime-local" 
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Message</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none h-32 resize-none"
                required
              />
            </div>

            <button 
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-primary hover:bg-secondary text-white rounded-2xl font-bold shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
              Set Schedule
            </button>
          </form>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                 <h3 className="text-xl font-bold text-slate-900">Upcoming & Past Schedules</h3>
                 <div className="flex gap-2">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase tracking-widest">SENT</span>
                    <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full uppercase tracking-widest">PENDING</span>
                 </div>
              </div>
              
              {loading ? (
                <div className="p-20 flex flex-col items-center justify-center space-y-4">
                   <Loader2 className="w-10 h-10 text-primary animate-spin" />
                   <p className="text-slate-400 text-sm font-medium">Checking schedules...</p>
                </div>
              ) : schedules.length === 0 ? (
                <div className="p-20 text-center space-y-4">
                   <Calendar className="w-12 h-12 text-slate-100 mx-auto" />
                   <p className="text-slate-400 font-medium">No schedules found.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                   {schedules.map((sch: any) => (
                     <div key={sch.id} className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all">
                        <div className="flex items-start gap-4">
                           <div className={clsx(
                             "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                             sch.status === 'SENT' ? "bg-emerald-50 text-emerald-500" : 
                             sch.status === 'FAILED' ? "bg-rose-50 text-rose-500" : "bg-blue-50 text-blue-500"
                           )}>
                              {sch.status === 'SENT' ? <CheckCircle className="w-6 h-6" /> : 
                               sch.status === 'FAILED' ? <AlertCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                           </div>
                           <div>
                              <p className="font-bold text-slate-900 mb-0.5">{sch.to}</p>
                              <p className="text-slate-400 text-xs font-medium truncate max-w-md mb-2">{sch.body}</p>
                              <div className="flex items-center gap-3">
                                 <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(sch.scheduledAt).toLocaleDateString()}
                                 </span>
                                 <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                    <Clock className="w-3 h-3" />
                                    {new Date(sch.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                 </span>
                              </div>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                           <div className="text-right hidden sm:block">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                              <span className={clsx(
                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                sch.status === 'SENT' ? "bg-emerald-500 text-white" : 
                                sch.status === 'FAILED' ? "bg-rose-500 text-white" : "bg-blue-500 text-white"
                              )}>
                                 {sch.status}
                              </span>
                           </div>
                           {sch.status === 'PENDING' && (
                             <button 
                              onClick={() => handleDelete(sch.id)}
                              className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                             >
                                <Trash2 className="w-5 h-5" />
                             </button>
                           )}
                        </div>
                     </div>
                   ))}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
