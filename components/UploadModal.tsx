import React, { useState } from 'react';
import { UploadIcon, GoogleDriveIcon } from '../assets/icons';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadLocal: () => void;
  onUploadFromUrl: (url: string) => void;
  isGoogleAuth: boolean;
  onGoogleAuthClick: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUploadLocal, onUploadFromUrl, isGoogleAuth, onGoogleAuthClick }) => {
  const [url, setUrl] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onUploadFromUrl(url);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-lg transform transition-all animate-dropdown" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Carregar GDD & Roteiro</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>
        
        <div className="space-y-6">
            {/* Local file upload */}
            <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-2">Do seu computador</h3>
                <p className="text-sm text-gray-400 mb-3">Carregue um arquivo .json salvo anteriormente a partir desta aplicação.</p>
                <button
                    onClick={onUploadLocal}
                    className="w-full flex items-center justify-center px-4 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-md"
                >
                    <UploadIcon />
                    <span className="ml-2">Escolher Arquivo do Computador</span>
                </button>
            </div>
            
            <div className="relative">
               <div className="absolute inset-0 flex items-center" aria-hidden="true">
                   <div className="w-full border-t border-gray-600"></div>
               </div>
               <div className="relative flex justify-center text-sm">
                   <span className="px-2 bg-gray-800 text-gray-500 uppercase">Ou</span>
               </div>
            </div>

            {/* Google Drive upload */}
            <div>
                 <h3 className="text-lg font-semibold text-gray-200 mb-2">De um link do Google Drive</h3>
                 <p className="text-sm text-gray-400 mb-3">Cole um link compartilhável de um arquivo .json. Arquivos públicos carregarão diretamente.</p>
                 
                 <form onSubmit={handleUrlSubmit} className="flex items-start space-x-2">
                    <div className="flex-grow">
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://drive.google.com/file/d/..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                         {!isGoogleAuth && (
                           <p className="text-xs text-gray-500 mt-1">
                                Para arquivos privados, você precisará{' '}
                                <button type="button" onClick={onGoogleAuthClick} className="text-indigo-400 hover:underline font-semibold">
                                    conectar sua conta do Google
                                </button>.
                           </p>
                        )}
                         {isGoogleAuth && (
                            <p className="text-xs text-green-400 mt-1 flex items-center">
                                <GoogleDriveIcon /> <span className="ml-1">Conectado ao Google. Arquivos privados podem ser carregados.</span>
                            </p>
                         )}
                    </div>

                    <button
                        type="submit"
                        disabled={!url.trim()}
                        className="px-4 py-2 rounded-md font-semibold text-white bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:text-gray-400 transition-colors flex-shrink-0"
                    >
                        Carregar
                    </button>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
};