import { useState, useEffect } from 'react';
import { Plus, Smartphone, RefreshCw, LogOut, Power } from 'lucide-react';
import { deviceService } from '../services/api';
import { clsx } from 'clsx';

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

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
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-500 mt-1">Manage your WhatsApp sessions and monitoring.</p>
        </div>
        <button 
          onClick={handleAddDevice}
          className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Device
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading devices...</div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-300 p-12 text-center">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No devices connected</h3>
          <p className="text-gray-500 mt-1 mb-6">Start by adding your first WhatsApp number.</p>
          <button 
            onClick={handleAddDevice}
            className="text-primary font-medium hover:underline"
          >
            Connect New Device
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device: any) => (
            <div key={device.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Smartphone className="w-6 h-6 text-primary" />
                  </div>
                  <span className={clsx(
                    "px-2 py-1 text-xs font-bold rounded-full",
                    device.status === 'CONNECTED' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  )}>
                    {device.status}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{device.name}</h3>
                <p className="text-gray-500 text-sm mb-4">{device.phoneNumber || 'Not connected'}</p>
                
                {device.qrCode && device.status === 'QR_READY' && (
                  <div className="mt-4 p-2 bg-white border rounded-lg">
                    <img src={device.qrCode} alt="QR Code" className="w-full h-auto" />
                    <p className="text-xs text-center text-gray-500 mt-2">Scan with WhatsApp</p>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-between border-t">
                 <button 
                  onClick={() => handleConnect(device.id)}
                  className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors" 
                  title="Reconnect"
                 >
                    <RefreshCw className="w-5 h-5" />
                 </button>
                 <button className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors" title="Disable Auto Reply">
                    <Power className="w-5 h-5" />
                 </button>
                 <button className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors" title="Logout">
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
