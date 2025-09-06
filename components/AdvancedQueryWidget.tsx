import React, { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AdvancedQueryWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
}

const ChatIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75a7.5 7.5 0 01-7.5-7.5" />
    </svg>
);

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
);

const ClearIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v18m-4.5-13.5h9M5.25 6H18.75M8.25 4.5V3.75a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5V4.5m-6 13.5V18a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5v.75" />
    </svg>
);

const SendIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
);


export const AdvancedQueryWidget: React.FC<AdvancedQueryWidgetProps> = ({
  isOpen,
  onToggle,
  messages,
  isLoading,
  onSendMessage,
  onClearChat,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white rounded-full p-4 shadow-lg hover:bg-indigo-500 transition-transform hover:scale-110 z-50"
        title="Consulta Avançada"
      >
        <ChatIcon />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col z-50">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-gray-900/50 rounded-t-2xl border-b border-gray-700">
        <h3 className="text-lg font-bold text-white flex items-center">
            <ChatIcon />
            <span className="ml-2">Consulta Avançada</span>
        </h3>
        <div className="flex items-center space-x-2">
            <button 
                onClick={onClearChat} 
                className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                title="Limpar chat"
                disabled={messages.length === 0}
            >
                <ClearIcon />
            </button>
            <button onClick={onToggle} className="text-gray-400 hover:text-white">
                <CloseIcon />
            </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm h-full flex items-center justify-center">
                <p>Faça uma pergunta sobre o GDD ou o Roteiro. Por exemplo: "Qual o loop de gameplay principal?"</p>
            </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                 <div className="max-w-[80%] rounded-xl px-4 py-2 bg-gray-700 text-gray-200">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    </div>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center bg-gray-900 rounded-lg pr-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Pergunte algo..."
            className="w-full bg-transparent p-3 text-sm text-gray-200 focus:outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-md text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
