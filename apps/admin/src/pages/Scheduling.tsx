import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Send, 
  Smartphone, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  Plus,
  RotateCcw
} from 'lucide-react';
import { deviceService, scheduleService } from '../services/api';

export default function Scheduling() {
  const [devices, setDevices] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [selectedDevice, setSelectedDevice] = useState('');
  const [targetNumber, setTargetNumber] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchSchedules, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [devRes, schRes] = await Promise.all([
        deviceService.getDevices(),
        scheduleService.getSchedules()
      ]);
      const connected = (devRes.data || []).filter((d: any) => d.status === 'CONNECTED');
      setDevices(connected);
      if (connected.length > 0 && !selectedDevice) {
        setSelectedDevice(connected[0].id);
      }
      setSchedules(schRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await scheduleService.getSchedules();
      setSchedules(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !targetNumber || !message || !scheduledAt) {
      setAlert({ type: 'error', message: 'Harap lengkapi semua kolom isian jadwal.' });
      return;
    }

    setSubmitting(true);
    setAlert(null);
    try {
      await scheduleService.createSchedule({
        deviceId: selectedDevice,
        to: targetNumber.replace(/[^0-9]/g, ''),
        body: message,
        scheduledAt: new Date(scheduledAt).toISOString()
      });
      setAlert({ type: 'success', message: 'Pesan terjadwal berhasil disimpan!' });
      setTargetNumber('');
      setMessage('');
      setScheduledAt('');
      fetchSchedules();
      setTimeout(() => setAlert(null), 3000);
    } catch (err: any) {
      setAlert({ type: 'error', message: 'Gagal membuat jadwal: ' + (err.response?.data?.error || err.message) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Batalkan jadwal pesan ini?')) return;
    try {
      await scheduleService.deleteSchedule(id);
      fetchSchedules();
    } catch (err) {
      alert('Gagal menghapus jadwal');
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Penjadwalan Pesan (Scheduling)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Jadwalkan pengiriman pesan otomatis ke nomor tujuan pada waktu tertentu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {schedules.filter((s) => s.status === 'PENDING').length} Menunggu Dikirim
          </span>
        </div>
      </div>

      {alert && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            alert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{alert.message}</span>
          </div>
          <button onClick={() => setAlert(null)} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Schedule Form (5 Cols) */}
        <div className="lg:col-span-5">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Buat Jadwal Baru</h3>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Pilih Device Pengirim
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {devices.length === 0 ? (
                  <option value="">Tidak ada device CONNECTED</option>
                ) : (
                  devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (+{d.phoneNumber || 'no number'})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Nomor Tujuan (WhatsApp)
              </label>
              <input
                type="text"
                required
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Waktu & Tanggal Kirim
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Isi Pesan
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tulis pesan pengingat..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || devices.length === 0}
              className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {submitting ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              <span>{submitting ? 'Menyimpan Jadwal...' : 'Simpan Jadwal Pesan'}</span>
            </button>
          </form>
        </div>

        {/* Right: Scheduled List (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Daftar Pesan Terjadwal ({schedules.length})
                </h3>
              </div>
              <button onClick={fetchSchedules} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {schedules.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Belum ada pesan terjadwal</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Buat jadwal pengiriman otomatis pada formulir di sebelah kiri.</p>
                </div>
              ) : (
                schedules.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">+{item.to}</span>
                        <span className="text-[10px] text-slate-400">
                          via {item.device?.name || 'Device'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            item.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.status === 'PENDING' && (
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Batalkan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 bg-white p-2 rounded border border-slate-100 line-clamp-2">
                      {item.body}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Jadwal: {new Date(item.scheduledAt).toLocaleString('id-ID')}</span>
                      <span>Dibuat: {new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
