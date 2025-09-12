import React, { useState } from 'react';
import { SecretIcon } from '../assets/icons';

interface UnlockSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (key: string) => Promise<boolean>;
}

export const UnlockSecretModal: React.FC<UnlockSecretModalProps> = ({ isOpen, onClose, onUnlock }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!key.trim()) {
        setError('A chave não pode estar em branco.');
        return;
    }
    
    setIsLoading(true);
    try {
        const success = await onUnlock(key);
        if (!success) {
            setError('A chave de administrador está incorreta ou a verificação falhou.');
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocorreu um erro de comunicação.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md transform transition-all animate-dropdown" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center">
                <SecretIcon />
                <span className="ml-2">Acessar Categoria Secreta</span>
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>
        <p className="text-gray-400 mb-4">
            Para visualizar e editar documentos estratégicos, por favor, insira sua chave de Administrador do Worker.
        </p>
        <form onSubmit={handleUnlock}>
          <input
            type="password"
            value={key}
            onChange={(e) => {
                setKey(e.target.value)
                setError(null);
            }}
            placeholder="Sua Chave de Administrador"
            className={`w-full bg-gray-900 border ${error ? 'border-red-500' : 'border-gray-700'} rounded-md p-2 text-sm focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-indigo-500'}`}
            autoFocus
            disabled={isLoading}
          />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <div className="mt-6 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2 rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!key.trim() || isLoading}
              className="px-6 py-2 rounded-md font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Verificando...' : 'Desbloquear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};