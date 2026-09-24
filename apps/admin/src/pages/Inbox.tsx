import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Send, 
  User, 
  MoreVertical, 
  Image as ImageIcon, 
  RotateCw, 
  Radio, 
  ExternalLink, 
  CheckCheck,
  Smartphone,
  ArrowLeft,
  X,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';
import { inboxService, messageService, deviceService } from '../services/api';

// Helper to detect if a string is a base64 encoded image
const isBase64Image = (str: string | null | undefined): boolean => {
  if (!str) return false;
  const s = String(str).trim();
  return s.startsWith('/9j/') || s.startsWith('data:image/') || s.startsWith('iVBORw0KGgo');
};

const getImageSrc = (str: string): string => {
  const s = String(str).trim();
  if (s.startsWith('data:image/')) return s;
  if (s.startsWith('/9j/')) return `data:image/jpeg;base64,${s}`;
  if (s.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${s}`;
  return `data:image/jpeg;base64,${s}`;
};

export default function Inbox() {
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('all');
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'channel'>('all');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchDevices();
    fetchThreads('all');
    const interval = setInterval(() => {
      fetchThreads(selectedDeviceId);
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedDeviceId]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat]);

  const fetchDevices = async () => {
    try {
      const res = await deviceService.getDevices();
      setDevices(res.data || []);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    }
  };

  const fetchThreads = async (devId = selectedDeviceId) => {
    try {
      const res = await inboxService.getThreads(devId);
      setThreads(res.data || []);
    } catch (err) {
      console.error('Failed to fetch threads:', err);
    }
  };

  const handleDeviceChange = (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    fetchThreads(newDeviceId);
    // If active chat doesn't belong to the newly selected device, unselect it
    if (selectedChat && newDeviceId !== 'all' && selectedChat.deviceId !== newDeviceId) {
      setSelectedChat(null);
    }
  };

  const fetchMessages = async (threadId: string) => {
    try {
      const res = await inboxService.getMessages(threadId);
      setMessages(res.data || []);
      await inboxService.markAsRead(threadId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedChat || sending) return;
    setSending(true);
    const sentText = inputText;
    try {
      await messageService.sendMessage({
        deviceId: selectedChat.deviceId,
        to: selectedChat.remoteNumber,
        text: sentText
      });

      // Optimistic message append
      const tempMsg = {
        id: 'temp-' + Date.now(),
        threadId: selectedChat.id,
        deviceId: selectedChat.deviceId,
        fromMe: true,
        body: sentText,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, tempMsg]);
      setInputText('');

      // Refresh server state
      setTimeout(() => {
        fetchMessages(selectedChat.id);
        fetchThreads(selectedDeviceId);
      }, 700);
    } catch (err: any) {
      alert('Gagal mengirim pesan: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  };

  // Resolve human-friendly contact display info
  const getContactDisplay = (thread: any) => {
    const remoteNumber = thread.remoteNumber || '';
    const isChannel = remoteNumber.endsWith('@newsletter');
    const isGroup = remoteNumber.endsWith('@g.us');
    const isLid = remoteNumber.endsWith('@lid');

    if (isChannel) {
      return {
        title: thread.contactName || 'Saluran WhatsApp',
        subtitle: 'WhatsApp Channel',
        phone: null,
        isChannel: true,
        isGroup: false,
        initial: '📢',
        badge: 'Saluran'
      };
    }

    if (isGroup) {
      return {
        title: thread.contactName || 'Grup WhatsApp',
        subtitle: thread.formattedNumber || remoteNumber,
        phone: null,
        isChannel: false,
        isGroup: true,
        initial: '👥',
        badge: 'Grup'
      };
    }

    // Direct / Personal Contact
    let title = thread.contactName;
    let subtitle = thread.formattedNumber;

    if (!title && subtitle) {
      title = subtitle;
      subtitle = isLid ? 'Kontak WhatsApp (LID)' : 'Kontak Personal';
    } else if (!title && !subtitle) {
      if (remoteNumber.endsWith('@c.us')) {
        title = `+${remoteNumber.replace('@c.us', '')}`;
        subtitle = 'Kontak Personal';
      } else if (isLid) {
        title = `Kontak WhatsApp`;
        subtitle = `ID: ${remoteNumber.replace('@lid', '').slice(0, 8)}...`;
      } else {
        title = remoteNumber;
        subtitle = 'Kontak Personal';
      }
    } else if (title && !subtitle) {
      if (remoteNumber.endsWith('@c.us')) {
        subtitle = `+${remoteNumber.replace('@c.us', '')}`;
      } else {
        subtitle = isLid ? 'Kontak WhatsApp' : remoteNumber;
      }
    }

    // Compute avatar initial
    let initial = '👤';
    if (title) {
      const clean = title.replace(/^\+/, '').trim();
      initial = clean.slice(0, 2).toUpperCase();
    }

    return {
      title,
      subtitle,
      phone: thread.formattedNumber || (remoteNumber.endsWith('@c.us') ? `+${remoteNumber.replace('@c.us', '')}` : null),
      isChannel: false,
      isGroup: false,
      initial,
      badge: isLid ? 'Personal' : undefined
    };
  };

  const filteredThreads = threads.filter((t) => {
    const isChannel = t.remoteNumber.endsWith('@newsletter');
    if (filterType === 'direct' && isChannel) return false;
    if (filterType === 'channel' && !isChannel) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNum = t.remoteNumber.toLowerCase().includes(q);
      const matchMsg = t.lastMessage && t.lastMessage.toLowerCase().includes(q);
      const matchName = t.contactName && t.contactName.toLowerCase().includes(q);
      const matchFormatted = t.formattedNumber && t.formattedNumber.toLowerCase().includes(q);
      const matchDev = t.device?.name && t.device.name.toLowerCase().includes(q);
      return matchNum || matchMsg || matchName || matchFormatted || matchDev;
    }
    return true;
  });

  return (
    <div className="h-[calc(100vh-6.5rem)] flex gap-4 w-full pb-2 overflow-hidden">
      {/* Left Column: Chat Threads List */}
      <div className={`
        ${selectedChat ? 'hidden md:flex' : 'flex'}
        w-full md:w-84 lg:w-[370px] xl:w-[400px] bg-white rounded-2xl border border-slate-200 shadow-xs flex-col overflow-hidden shrink-0
      `}>
        {/* Top Control Bar: Device Filter & Refresh */}
        <div className="p-3 border-b border-slate-100 space-y-2.5 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <span>Pesan Masuk</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono">
                {threads.length}
              </span>
            </h2>
            <button 
              onClick={() => fetchThreads(selectedDeviceId)} 
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Perbarui daftar chat"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Device Selector Dropdown */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none w-full cursor-pointer truncate"
            >
              <option value="all">Semua Perangkat ({devices.length} Device)</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.phoneNumber ? `(+${d.phoneNumber.replace('+', '')})` : ''} - [{d.status}]
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, nomor, pesan..." 
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              onClick={() => setFilterType('all')}
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterType('direct')}
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                filterType === 'direct'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Personal
            </button>
            <button
              onClick={() => setFilterType('channel')}
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                filterType === 'channel'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Saluran (Channel)
            </button>
          </div>
        </div>

        {/* Thread Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <User className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">Tidak ada percakapan</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {selectedDeviceId === 'all'
                  ? 'Pesan masuk dari WhatsApp akan muncul di sini secara real-time.'
                  : 'Belum ada pesan masuk untuk perangkat yang dipilih.'}
              </p>
            </div>
          ) : (
            filteredThreads.map((chat) => {
              const info = getContactDisplay(chat);
              const isSelected = selectedChat?.id === chat.id;
              const hasImage = isBase64Image(chat.lastMessage);

              return (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={clsx(
                    "w-full p-3 flex items-start gap-3 text-left transition-colors cursor-pointer hover:bg-slate-50 relative",
                    isSelected ? "bg-emerald-50/80 border-l-4 border-l-emerald-600" : ""
                  )}
                >
                  {/* Contact Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    info.isChannel 
                      ? 'bg-purple-100 text-purple-700' 
                      : info.isGroup 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {info.initial}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate pr-2">
                        {info.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Subtitle / Real Phone Number */}
                    {info.subtitle && (
                      <p className="text-[10px] text-slate-400 truncate mb-1">
                        {info.subtitle}
                      </p>
                    )}

                    {/* Last Message Snippet */}
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className="text-[11px] text-slate-600 truncate flex items-center gap-1">
                        {hasImage ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <ImageIcon className="w-3 h-3 text-emerald-600" />
                            [Foto / Gambar]
                          </span>
                        ) : (
                          chat.lastMessage || '—'
                        )}
                      </p>

                      {chat.unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-bold text-[9px] shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Device Badge (Shows which device received the chat) */}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                        <Smartphone className="w-2.5 h-2.5 text-slate-500" />
                        <span>{chat.device?.name || 'Device'}</span>
                      </span>
                      {info.phone && info.phone !== info.title && (
                        <span className="text-[9px] text-slate-400 font-mono">
                          {info.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Chat Conversation View */}
      <div className={`
        ${!selectedChat ? 'hidden md:flex' : 'flex'}
        flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-xs flex-col overflow-hidden
      `}>
        {selectedChat ? (
          <>
            {/* Chat Top Header */}
            {(() => {
              const info = getContactDisplay(selectedChat);
              return (
                <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Mobile Back Button */}
                    <button 
                      onClick={() => setSelectedChat(null)}
                      className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Kembali ke daftar chat"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                      info.isChannel 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {info.initial}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900 leading-tight truncate">
                          {info.title}
                        </h3>
                        {info.isChannel && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                            Saluran
                          </span>
                        )}
                        {info.badge && !info.isChannel && (
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                            {info.badge}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                        {info.phone && (
                          <span className="font-mono text-emerald-800 font-semibold">{info.phone}</span>
                        )}
                        {info.phone && <span>•</span>}
                        <span className="flex items-center gap-1 text-slate-600">
                          <Smartphone className="w-3 h-3 text-emerald-600" />
                          <span>Diterima via: <strong>{selectedChat.device?.name || 'Device'}</strong></span>
                          {selectedChat.device?.phoneNumber && (
                            <span className="text-slate-400">({selectedChat.device.phoneNumber})</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => fetchMessages(selectedChat.id)} 
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Perbarui percakapan"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Chat Messages Body */}
            <div className="flex-1 min-h-0 bg-slate-100/60 p-4 sm:p-5 space-y-3 overflow-y-auto flex flex-col">
              {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                  Belum ada rekaman riwayat pesan.
                </div>
              ) : (
                messages.map((msg) => {
                  const hasImage = isBase64Image(msg.body);
                  const isOut = msg.fromMe;

                  return (
                    <div
                      key={msg.id}
                      className={clsx(
                        "flex",
                        isOut ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={clsx(
                          "rounded-2xl p-3 shadow-xs max-w-md text-xs relative space-y-1.5",
                          isOut
                            ? "bg-emerald-600 text-white rounded-tr-none"
                            : "bg-white text-slate-800 rounded-tl-none border border-slate-200/80"
                        )}
                      >
                        {/* If Base64 Image */}
                        {hasImage ? (
                          <div className="space-y-1">
                            <div className="rounded-xl overflow-hidden bg-slate-900/5 border border-black/5">
                              <img
                                src={getImageSrc(msg.body)}
                                alt="Foto WhatsApp"
                                onClick={() => setPreviewImage(getImageSrc(msg.body))}
                                className="max-h-72 w-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] pt-0.5 opacity-75 font-mono">
                              <span className="flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                <span>Foto WhatsApp (Klik untuk perbesar)</span>
                              </span>
                              <span>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap leading-relaxed break-words">
                              {msg.body}
                            </p>
                            <div className={clsx(
                              "text-[9px] flex items-center justify-end gap-1 mt-0.5 font-mono",
                              isOut ? "text-emerald-100" : "text-slate-400"
                            )}>
                              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isOut && <CheckCheck className="w-3 h-3" />}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-slate-100 bg-white">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center gap-2"
              >
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Balas pesan via ${selectedChat.device?.name || 'WhatsApp'}...`} 
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button 
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center shrink-0"
                  title="Kirim Pesan"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-3 text-slate-400">
              <User className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Pilih Percakapan WhatsApp</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Pilih salah satu kontak di bilah sebelah kiri untuk membaca dan membalas pesan secara langsung.
            </p>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-3xl max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2"
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img 
              src={previewImage} 
              alt="Preview Penuh" 
              className="max-h-[80vh] w-auto mx-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
