import React, { useState } from 'react';
import { CloudSyncIcon } from '../assets/icons';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isClosable?: boolean;
  initialUrl: string;
  initialKey: string;
  onSaveSettings: (url: string, key: string) => void;
  onUploadClick: () => void;
  onDownloadClick: () => void;
  isSyncing: boolean;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  isClosable = true,
  initialUrl,
  initialKey,
  onSaveSettings,
  onUploadClick,
  onDownloadClick,
  isSyncing,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [key, setKey] = useState(initialKey);
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSaveSettings(url, key);
  };
  
  const handleClose = () => {
    if (isClosable) {
      onClose();
    }
  };

  const hasCredentials = url && key;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity animate-fade-in" onClick={handleClose}>
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-xl transform transition-all animate-dropdown" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center">
                <CloudSyncIcon />
                <span className="ml-3">Sincronização na Nuvem</span>
            </h2>
            <button 
                onClick={handleClose} 
                className="text-gray-400 hover:text-white text-3xl leading-none disabled:text-gray-600 disabled:cursor-not-allowed"
                disabled={!isClosable}
            >
                &times;
            </button>
        </div>
        
        <div className="space-y-6">
            {!isClosable && (
                <div className="p-3 bg-yellow-900/40 border border-yellow-700 rounded-md text-sm text-yellow-300">
                    <p>Por favor, insira e salve suas credenciais de sincronização na nuvem para começar a usar a aplicação.</p>
                </div>
            )}
            <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-2">Configuração</h3>
                <p className="text-sm text-gray-400 mb-4">Insira os detalhes do seu Worker Cloudflare e a chave de acesso para ativar a sincronização. As informações serão salvas localmente no seu navegador.</p>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="worker-url" className="block text-sm font-medium text-gray-300 mb-1">URL do Worker</label>
                        <input
                            id="worker-url"
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://meu-gdd.meu-usuario.workers.dev"
                            className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="access-key" className="block text-sm font-medium text-gray-300 mb-1">Chave de Administrador</label>
                        <div className="relative">
                            <input
                                id="access-key"
                                type={showKey ? 'text' : 'password'}
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder="Sua chave secreta"
                                className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-300"
                                title={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                            >
                                {showKey ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644l.66-1.229a1.012 1.012 0 000-.644l-.66-1.229a1.012 1.012 0 01.644-1.666l1.229.66a1.012 1.012 0 00.644 0l1.229-.66a1.012 1.012 0 011.666.644l-.66 1.229a1.012 1.012 0 000 .644l.66 1.229a1.012 1.012 0 01-.644 1.666l-1.229-.66a1.012 1.012 0 00-.644 0l-1.229.66a1.012 1.012 0 01-1.666-.644l.66-1.229a1.012 1.012 0 000-.644l-.66-1.229z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="mt-4 w-full px-4 py-2 text-sm font-semibold rounded-md text-white bg-gray-600 hover:bg-gray-500 transition-colors"
                >
                    Salvar Configurações
                </button>
            </div>

            <div className="relative">
               <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-600"></div></div>
               <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-800 text-gray-500 uppercase">Ações</span></div>
            </div>

            <div>
                 <div className="flex items-center space-x-4">
                    <button
                        onClick={onUploadClick}
                        disabled={!hasCredentials || isSyncing}
                        className="w-full flex items-center justify-center px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors rounded-md"
                    >
                        {isSyncing ? 'Sincronizando...' : 'Salvar Versão na Nuvem'}
                    </button>
                     <button
                        onClick={onDownloadClick}
                        disabled={!hasCredentials || isSyncing}
                        className="w-full flex items-center justify-center px-4 py-3 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors rounded-md"
                    >
                        {isSyncing ? 'Sincronizando...' : 'Carregar Versão da Nuvem'}
                    </button>
                 </div>
                 {!hasCredentials && <p className="text-xs text-yellow-500 mt-2 text-center">Salve a URL e a Chave para ativar as ações de sincronização.</p>}
            </div>
        </div>
      </div>
    </div>
  );
};