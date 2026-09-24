import React, { useState, useEffect, useRef } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock
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
  
  // Thread Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalThreads, setTotalThreads] = useState(0);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Message & Chat State
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);

  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'channel'>('all');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    fetchDevices();
  }, []);

  // Fetch threads whenever device, page, or category changes
  useEffect(() => {
    fetchThreads(currentPage, selectedDeviceId, searchQuery, filterType);
    const interval = setInterval(() => {
      fetchThreads(currentPage, selectedDeviceId, searchQuery, filterType, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [currentPage, selectedDeviceId, filterType]);

  // When search query changes, debounce fetch to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchThreads(1, selectedDeviceId, searchQuery, filterType);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // When selected chat changes, load its messages
  useEffect(() => {
    if (selectedChat) {
      fetchInitialMessages(selectedChat.id);
    } else {
      setMessages([]);
      setHasMoreMessages(false);
    }
  }, [selectedChat?.id]);

  const fetchDevices = async () => {
    try {
      const res = await deviceService.getDevices();
      setDevices(res.data || []);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    }
  };

  const fetchThreads = async (
    page = currentPage,
    devId = selectedDeviceId,
    search = searchQuery,
    type = filterType,
    silent = false
  ) => {
    if (!silent) setLoadingThreads(true);
    try {
      const res = await inboxService.getThreads({
        deviceId: devId !== 'all' ? devId : undefined,
        page,
        limit: 15,
        search: search.trim() || undefined,
        filterType: type !== 'all' ? type : undefined
      });

      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const meta = res.data?.pagination || { page, limit: 15, total: list.length, totalPages: 1 };

      setThreads(list);
      setCurrentPage(meta.page);
      setTotalPages(meta.totalPages);
      setTotalThreads(meta.total);
    } catch (err) {
      console.error('Failed to fetch threads:', err);
    } finally {
      if (!silent) setLoadingThreads(false);
    }
  };

  const handleDeviceChange = (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    setCurrentPage(1);
    fetchThreads(1, newDeviceId, searchQuery, filterType);
    if (selectedChat && newDeviceId !== 'all' && selectedChat.deviceId !== newDeviceId) {
      setSelectedChat(null);
    }
  };

  const handleFilterChange = (newType: 'all' | 'direct' | 'channel') => {
    setFilterType(newType);
    setCurrentPage(1);
    fetchThreads(1, selectedDeviceId, searchQuery, newType);
  };

  const fetchInitialMessages = async (threadId: string) => {
    setLoadingMessages(true);
    try {
      const res = await inboxService.getMessages(threadId, { limit: 35 });
      const msgs = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setMessages(msgs);
      setHasMoreMessages(Boolean(res.data?.hasMore));
      await inboxService.markAsRead(threadId);

      // Scroll to bottom
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchOlderMessages = async () => {
    if (!selectedChat || messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    const oldestTimestamp = messages[0].timestamp;
    try {
      const res = await inboxService.getMessages(selectedChat.id, { 
        limit: 35, 
        before: oldestTimestamp 
      });
      const older = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setHasMoreMessages(Boolean(res.data?.hasMore));
      } else {
        setHasMoreMessages(false);
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingOlder(false);
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

      // Scroll to bottom
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);

      // Refresh server state silently
      setTimeout(() => {
        fetchThreads(currentPage, selectedDeviceId, searchQuery, filterType, true);
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

  // Helper to generate numbered pagination items
  const renderPaginationButtons = () => {
    if (totalPages <= 1) return null;

    const pages: (number | string)[] = [];
    const maxButtons = 5;

    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 2) {
        end = 3;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 2;
      }

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center gap-1">
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} className="px-1 text-slate-400 text-xs select-none">
                •••
              </span>
            );
          }
          const pageNum = Number(p);
          const isActive = currentPage === pageNum;
          return (
            <button
              key={`page-${pageNum}`}
              onClick={() => setCurrentPage(pageNum)}
              className={clsx(
                "w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer",
                isActive
                  ? "bg-emerald-600 text-white shadow-2xs font-bold"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              )}
            >
              {pageNum}
            </button>
          );
        })}
      </div>
    );
  };

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
                {totalThreads}
              </span>
            </h2>
            <button 
              onClick={() => fetchThreads(currentPage, selectedDeviceId, searchQuery, filterType)} 
              disabled={loadingThreads}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
              title="Perbarui daftar chat"
            >
              <RotateCw className={clsx("w-3.5 h-3.5", loadingThreads && "animate-spin text-emerald-600")} />
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
              onClick={() => handleFilterChange('all')}
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => handleFilterChange('direct')}
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                filterType === 'direct'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Personal
            </button>
            <button
              onClick={() => handleFilterChange('channel')}
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
          {loadingThreads && threads.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-emerald-600" />
              <p className="text-xs">Memuat daftar obrolan...</p>
            </div>
          ) : threads.length === 0 ? (
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
            threads.map((chat) => {
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

        {/* Numbered Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-2.5 border-t border-slate-200/80 bg-slate-50/80 flex items-center justify-between gap-2 shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loadingThreads}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {renderPaginationButtons()}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loadingThreads}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
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
                      onClick={() => fetchInitialMessages(selectedChat.id)} 
                      disabled={loadingMessages}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Perbarui percakapan"
                    >
                      <RotateCw className={clsx("w-4 h-4", loadingMessages && "animate-spin text-emerald-600")} />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Chat Messages Body */}
            <div 
              ref={chatContainerRef}
              className="flex-1 min-h-0 bg-slate-100/60 p-4 sm:p-5 space-y-3 overflow-y-auto flex flex-col"
            >
              {/* Load Older Messages Button */}
              {hasMoreMessages && (
                <div className="flex justify-center pb-2">
                  <button
                    onClick={fetchOlderMessages}
                    disabled={loadingOlder}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-full text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {loadingOlder ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                        <span>Memuat pesan terdahulu...</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Muat pesan sebelumnya</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {loadingMessages ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mr-2" />
                  Memuat riwayat percakapan...
                </div>
              ) : messages.length === 0 ? (
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
