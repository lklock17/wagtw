import { useState, useEffect } from 'react';
import { Plus, Smartphone, RefreshCw, LogOut, Power, MoreHorizontal, ShieldCheck, Link, Globe, Send as SendIcon, Check, X, Loader2 } from 'lucide-react';
import { deviceService } from '../services/api';
import { clsx } from 'clsx';

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showWebhook, setShowWebhook] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleUpdateWebhook = async (id: string) => {
    try {
      await deviceService.updateWebhook(id, webhookUrl);
      alert('Webhook updated successfully');
      setShowWebhook(null);
      fetchDevices();
    } catch (err) {
      alert('Failed to update webhook');
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await deviceService.testWebhook(webhookUrl);
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.response?.data?.error || err.message });
    } finally {
      setTesting(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await deviceService.getDevices();
      setDevices(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    const name = prompt('Enter device name:');
    if (!name) return;
    try {
      await deviceService.createDevice(name);
      fetchDevices();
    } catch (err) {
      alert('Failed to add device');
    }
  };

  const handleConnect = async (id: string) => {
    try {
      await deviceService.connectDevice(id);
      alert('QR Code generation started. Please wait...');
      fetchDevices();
    } catch (err) {
      alert('Failed to connect');
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Devices</h1>
          <p className="text-slate-500 mt-2 text-lg">Manage and monitor your connected WhatsApp numbers.</p>
        </div>
        <button 
          onClick={handleAddDevice}
          className="bg-primary hover:bg-secondary text-white px-6 py-3 rounded-2xl flex items-center gap-3 transition-all shadow-lg shadow-primary/30 font-bold"
        >
          <Plus className="w-5 h-5" />
          Add New Device
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium">Fetching your devices...</p>
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-dashed border-slate-200 p-20 text-center flex flex-col items-center">
          <div className="bg-slate-50 w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
            <Smartphone className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">No devices found</h3>
          <p className="text-slate-400 mt-2 mb-8 max-w-sm">Connect your first WhatsApp number to start using the gateway services.</p>
          <button 
            onClick={handleAddDevice}
            className="text-primary font-bold hover:bg-primary/5 px-6 py-3 rounded-xl transition-all"
          >
            + Connect New Device
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {devices.map((device: any) => (
            <div key={device.id} className="group bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500">
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="bg-slate-50 p-4 rounded-2xl group-hover:bg-primary/10 transition-colors duration-500">
                    <Smartphone className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={clsx(
                      "px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest",
                      device.status === 'CONNECTED' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {device.status}
                    </span>
                    {device.status === 'CONNECTED' && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                        <ShieldCheck className="w-3 h-3" />
                        SECURE
                      </div>
                    )}
                  </div>
                </div>
                
                <h3 className="font-bold text-slate-900 text-xl mb-1">{device.name}</h3>
                <p className="text-slate-400 text-sm font-medium mb-4">{device.phoneNumber || 'Awaiting connection...'}</p>

                {/* Webhook Section */}
                <div className="mt-6 space-y-3">
                   <button 
                    onClick={() => {
                      setShowWebhook(showWebhook === device.id ? null : device.id);
                      setWebhookUrl(device.webhookUrl || '');
                      setTestResult(null);
                    }}
                    className={clsx(
                      "flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                      device.webhookUrl ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                    )}
                   >
                      <Globe className="w-3.5 h-3.5" />
                      {device.webhookUrl ? 'WEBHOOK ACTIVE' : 'CONFIGURE WEBHOOK'}
                   </button>

                   {showWebhook === device.id && (
                     <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                           <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                           <input 
                            type="text" 
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="https://your-api.com/webhook"
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                           />
                        </div>
                        
                        <div className="flex gap-2">
                           <button 
                            onClick={handleTestWebhook}
                            disabled={testing || !webhookUrl}
                            className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                           >
                              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <SendIcon className="w-3 h-3" />}
                              TEST URL
                           </button>
                           <button 
                            onClick={() => handleUpdateWebhook(device.id)}
                            className="flex-1 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-800 transition-all"
                           >
                              SAVE
                           </button>
                        </div>

                        {testResult && (
                          <div className={clsx(
                            "p-2 rounded-xl text-[10px] font-medium flex items-center gap-2",
                            testResult.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          )}>
                             {testResult.success ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                             {testResult.success ? `Success! Latency: ${testResult.latency}ms` : `Failed: ${testResult.error}`}
                          </div>
                        )}
                     </div>
                   )}
                </div>
                
                {device.qrCode && device.status === 'QR_READY' && (
                  <div className="mt-8 p-4 bg-slate-50 border border-slate-100 rounded-3xl relative group/qr">
                    <img src={device.qrCode} alt="QR Code" className="w-full h-auto rounded-xl shadow-inner mix-blend-multiply" />
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] opacity-0 group-hover/qr:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
                       <p className="bg-slate-900 text-white text-[10px] font-bold px-3 py-2 rounded-full">Scan with WhatsApp</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-slate-50/50 px-8 py-5 flex justify-between items-center border-t border-slate-50">
                 <div className="flex gap-2">
                   <button 
                    onClick={() => handleConnect(device.id)}
                    className="p-3 bg-white hover:bg-slate-900 hover:text-white rounded-xl text-slate-400 transition-all shadow-sm" 
                    title="Reconnect"
                   >
                      <RefreshCw className="w-5 h-5" />
                   </button>
                   <button className="p-3 bg-white hover:bg-slate-900 hover:text-white rounded-xl text-slate-400 transition-all shadow-sm" title="Disable Auto Reply">
                      <Power className="w-5 h-5" />
                   </button>
                 </div>
                 <button className="p-3 bg-white hover:bg-rose-500 hover:text-white rounded-xl text-slate-400 transition-all shadow-sm" title="Logout">
                    <LogOut className="w-5 h-5" />
                 </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
