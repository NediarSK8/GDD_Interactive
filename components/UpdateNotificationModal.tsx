import React from 'react';
import { Version } from '../types';
import { CloudSyncIcon } from '../assets/icons';

interface UpdateNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  latestVersion: Version | null;
}

const formatTimestamp = (isoString: string | undefined): string => {
    if (!isoString) return 'Data desconhecida';
    try {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
    } catch (e) {
        return 'Data inválida';
    }
};

export const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  latestVersion,
}) => {
  if (!isOpen || !latestVersion) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-lg transform transition-all animate-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start">
            <div className="mr-4 flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400">
                    <CloudSyncIcon />
                </div>
            </div>
            <div>
                <h2 className="text-xl font-bold text-white">Atualização Disponível na Nuvem</h2>
                <p className="text-gray-400 mt-2">
                    Uma versão mais recente dos seus documentos foi encontrada na nuvem. Deseja carregá-la agora?
                </p>
                <div className="mt-4 p-3 bg-gray-900/50 rounded-md border border-gray-700">
                    <p className="text-sm font-semibold text-gray-200">
                        {latestVersion.name ? `Nome: ${latestVersion.name}` : 'Backup Automático'}
                    </p>
                    <p className="text-xs text-gray-500">
                        Salvo em: {formatTimestamp(latestVersion.timestamp)}
                    </p>
                </div>
                <p className="text-xs text-yellow-400 mt-3">
                    Atenção: Carregar esta versão substituirá quaisquer alterações locais não salvas.
                </p>
            </div>
        </div>
        
        <div className="mt-8 flex justify-end space-x-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            Ignorar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-2 rounded-md font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
          >
            Carregar Versão Mais Recente
          </button>
        </div>
      </div>
    </div>
  );
};
