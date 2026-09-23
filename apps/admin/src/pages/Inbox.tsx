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
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { inboxService, messageService } from '../services/api';

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
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'channel'>('all');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat]);

  const fetchThreads = async () => {
    try {
      const res = await inboxService.getThreads();
      setThreads(res.data || []);
    } catch (err) {
      console.error(err);
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
    try {
      await messageService.sendMessage({
        deviceId: selectedChat.deviceId,
        to: selectedChat.remoteNumber,
        text: inputText
      });
      setInputText('');
      await fetchMessages(selectedChat.id);
      fetchThreads();
    } catch (err) {
      alert('Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  const getContactInfo = (remoteNumber: string) => {
    const isChannel = remoteNumber.endsWith('@newsletter');
    const isGroup = remoteNumber.endsWith('@g.us');

    if (isChannel) {
      const id = remoteNumber.replace('@newsletter', '');
      return {
        title: `Saluran WhatsApp (${id.slice(0, 6)}...)`,
        subtitle: 'WhatsApp Channel / Saluran Informasi',
        isChannel: true,
        isGroup: false,
        initial: '📢'
      };
    }

    if (isGroup) {
      return {
        title: 'Grup WhatsApp',
        subtitle: remoteNumber,
        isChannel: false,
        isGroup: true,
        initial: '👥'
      };
    }

    const cleanNum = remoteNumber.replace(/@.*$/, '');
    return {
      title: `+${cleanNum}`,
      subtitle: 'Kontak Personal',
      isChannel: false,
      isGroup: false,
      initial: cleanNum.slice(0, 2)
    };
  };

  const filteredThreads = threads.filter((t) => {
    const isChannel = t.remoteNumber.endsWith('@newsletter');
    if (filterType === 'direct' && isChannel) return false;
    if (filterType === 'channel' && !isChannel) return false;
    if (searchQuery) {
      return t.remoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.lastMessage && t.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return true;
  });

  return (
    <div className="h-[calc(100vh-6.5rem)] flex gap-4 max-w-7xl mx-auto pb-4">
      {/* Left Column: Chat Threads List */}
      <div className="w-88 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden shrink-0">
        {/* Search & Filter Bar */}
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Pesan Masuk ({threads.length})
            </h2>
            <button 
              onClick={fetchThreads} 
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
              title="Perbarui daftar chat"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari obrolan..." 
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => setFilterType('all')}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterType('direct')}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                filterType === 'direct'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Personal
            </button>
            <button
              onClick={() => setFilterType('channel')}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                filterType === 'channel'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Saluran (Channel)
            </button>
          </div>
        </div>

        {/* Thread Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <User className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold">Tidak ada percakapan</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Pesan masuk dari WhatsApp akan muncul di sini secara real-time.</p>
            </div>
          ) : (
            filteredThreads.map((chat) => {
              const info = getContactInfo(chat.remoteNumber);
              const isSelected = selectedChat?.id === chat.id;
              const hasImage = isBase64Image(chat.lastMessage);

              return (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={clsx(
                    "w-full p-3 flex items-start gap-3 text-left transition-colors cursor-pointer hover:bg-slate-50",
                    isSelected ? "bg-emerald-50/70 border-l-4 border-l-emerald-600" : ""
                  )}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    info.isChannel ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {info.initial}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {info.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
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
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Chat Conversation View */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        {selectedChat ? (
          <>
            {/* Chat Top Header */}
            {(() => {
              const info = getContactInfo(selectedChat.remoteNumber);
              return (
                <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      info.isChannel ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {info.initial}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900 leading-tight">
                          {info.title}
                        </h3>
                        {info.isChannel && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            Saluran
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>via {selectedChat.device?.name || 'Device'}</span>
                        <span>•</span>
                        <span className="font-mono">{selectedChat.remoteNumber}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => fetchMessages(selectedChat.id)} 
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Perbarui pesan"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Chat Messages Body */}
            <div className="flex-1 bg-slate-100/60 p-5 space-y-3 overflow-y-auto flex flex-col">
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
                  placeholder="Ketik balasan pesan WhatsApp..." 
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
