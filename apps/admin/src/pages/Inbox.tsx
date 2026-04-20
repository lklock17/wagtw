import { useState } from 'react';
import { Search, Send, User, MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';

export default function Inbox() {
  const [selectedChat, setSelectedChat] = useState<any>(null);

  const chats = [
    { id: '1', name: 'Budi Santoso', lastMessage: 'Halo, paket saya sudah sampai?', time: '10:45', unread: 2 },
    { id: '2', name: 'Ani Wijaya', lastMessage: 'Terima kasih informasinya', time: 'Yesterday', unread: 0 },
    { id: '3', name: 'Customer Support', lastMessage: 'Pesanan sedang diproses', time: 'Yesterday', unread: 0 },
  ];

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-6">
      {/* Chat List */}
      <div className="w-96 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={clsx(
                "w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors border-b border-slate-50",
                selectedChat?.id === chat.id && "bg-slate-50"
              )}
            >
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                {chat.name[0]}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-semibold text-slate-900 truncate">{chat.name}</h4>
                  <span className="text-[10px] text-slate-400 font-medium">{chat.time}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
              </div>
              {chat.unread > 0 && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold shadow-sm shadow-primary/30">
                  {chat.unread}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat View */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        {selectedChat ? (
          <>
            <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {selectedChat.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-none">{selectedChat.name}</h3>
                  <span className="text-[10px] text-green-500 font-medium uppercase tracking-wider">Online</span>
                </div>
              </div>
              <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 bg-[#F0F2F5] p-6 space-y-4 overflow-y-auto">
               <div className="flex justify-start">
                  <div className="bg-white px-4 py-2 rounded-2xl rounded-tl-none shadow-sm max-w-md text-sm">
                    {selectedChat.lastMessage}
                  </div>
               </div>
               <div className="flex justify-end">
                  <div className="bg-[#D9FDD3] px-4 py-2 rounded-2xl rounded-tr-none shadow-sm max-w-md text-sm">
                    Halo! Kami sedang memproses pesanan Anda. Mohon tunggu sebentar ya.
                  </div>
               </div>
            </div>

            <div className="p-4 border-t border-slate-50">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button className="p-3 bg-primary hover:bg-secondary text-white rounded-xl shadow-lg shadow-primary/20 transition-all">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-12 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <User className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-400">Select a conversation</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-xs">Pilih salah satu pesan di sebelah kiri untuk mulai mengobrol.</p>
          </div>
        )}
      </div>
    </div>
  );
}
