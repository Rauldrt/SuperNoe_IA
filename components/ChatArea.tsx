import React, { useState, useEffect, useRef } from 'react';
import { useGemini } from '../context/GeminiContext';
import { Send, User, FileText, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// PLACEHOLDER: Reemplaza esta URL con la ruta a tu imagen local (ej: '/logo.png') 
// o la URL directa de la imagen de Noelia Supermercado.
const BRAND_LOGO_URL = "https://cdn-icons-png.flaticon.com/512/3081/3081559.png"; 

const ChatArea: React.FC<{ sidebarOpen: boolean }> = ({ sidebarOpen }) => {
  const { messages, sendMessage, isTyping } = useGemini();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex flex-col h-full transition-all duration-300 ${sidebarOpen ? 'md:ml-80' : 'ml-0'}`}>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50 animate-fade-in">
            {/* Aurora Bot Avatar Large - WELCOME SCREEN */}
            <div className="aurora-container aurora-always rounded-full p-2 mb-6">
                 <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center relative z-10 border-4 border-white/20 overflow-hidden shadow-xl">
                    <img 
                      src={BRAND_LOGO_URL} 
                      alt="Noelia Logo" 
                      className="w-full h-full object-cover p-2"
                    />
                 </div>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 tracking-tight">Noelia Assistant</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              Configura tu modelo, sube documentos a la base de conocimiento y empieza a chatear. 
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Avatar Bot - CHAT MESSAGE */}
              {msg.role === 'model' && (
                <div className={`relative mt-1 shrink-0 rounded-full transition-all duration-300 ${msg.isStreaming ? 'animate-thinking' : ''}`}>
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-gray-200 dark:border-white/10 overflow-hidden shadow-md">
                        <img 
                          src={BRAND_LOGO_URL} 
                          alt="Noelia AI" 
                          className="w-full h-full object-cover p-1"
                        />
                    </div>
                </div>
              )}

              {/* Message Bubble */}
              <div 
                className={`
                  relative max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm
                  ${msg.role === 'user' 
                    ? 'btn-aurora text-white rounded-br-none shadow-[0_4px_15px_rgba(236,72,153,0.3)]' 
                    : 'bg-white dark:bg-slate-800/80 backdrop-blur border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-sm'
                  }
                `}
              >
                {/* RAG Indicators */}
                {msg.usedDocuments && msg.usedDocuments.length > 0 && (
                   <div className="mb-3 flex flex-wrap gap-2">
                      <span className={`text-[10px] uppercase font-bold opacity-70 ${msg.role === 'user' ? 'text-white/80' : 'text-brand-500'}`}>Fuentes:</span>
                      {msg.usedDocuments.map((docId, idx) => (
                        <div key={idx} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${msg.role === 'user' ? 'bg-black/20 border-white/20 text-white' : 'bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-300'}`}>
                           <FileText size={10} />
                           <span>Doc</span>
                        </div>
                      ))}
                   </div>
                )}

                {/* Content */}
                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'dark:prose-invert'}`}>
                  {msg.role === 'model' ? (
                     <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                     <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.isStreaming && <span className="inline-block w-1.5 h-4 ml-1 bg-brand-400 animate-pulse align-middle"></span>}
                </div>
              </div>

              {/* Avatar User */}
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-gray-300 dark:border-white/10">
                  <User size={16} className="text-gray-500 dark:text-gray-300" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-gray-200 dark:border-white/5">
        <div className="max-w-4xl mx-auto relative aurora-container rounded-xl">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje aquí..."
            className="w-full relative z-10 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl pl-4 pr-14 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-none overflow-hidden transition-all"
            rows={1}
            style={{ minHeight: '50px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={`
              absolute right-2 top-2 z-20 p-2 rounded-lg transition-all
              ${!input.trim() || isTyping 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'btn-aurora shadow-lg shadow-brand-500/30 transform hover:-translate-y-0.5'
              }
            `}
          >
            {isTyping ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-2">
          IA potenciada por Gemini. Verifica la información.
        </p>
      </div>
    </div>
  );
};

export default ChatArea;