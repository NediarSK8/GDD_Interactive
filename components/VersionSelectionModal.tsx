import React from 'react';
import { CloudVersions, Version } from '../types';

interface VersionSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadVersion: (versionId: string) => void;
  versions: CloudVersions | null;
  isLoading: boolean;
  error: string | null;
}

const formatTimestamp = (isoString: string): string => {
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

const VersionList: React.FC<{ title: string, versions: Version[], onLoadVersion: (id: string) => void }> = ({ title, versions, onLoadVersion }) => (
    <div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">{title}</h3>
        {versions.length > 0 ? (
            <ul className="space-y-2">
                {versions.map(v => (
                    <li key={v.id}>
                        <button
                            onClick={() => onLoadVersion(v.id)}
                            className="w-full text-left p-3 bg-gray-900/50 rounded-lg hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {v.name && <div className="font-semibold text-indigo-400">{v.name}</div>}
                            <div className="text-sm text-gray-400">{formatTimestamp(v.timestamp)}</div>
                        </button>
                    </li>
                ))}
            </ul>
        ) : <p className="text-sm text-gray-500 italic">Nenhuma versão encontrada.</p>}
    </div>
);

export const VersionSelectionModal: React.FC<VersionSelectionModalProps> = ({
  isOpen,
  onClose,
  onLoadVersion,
  versions,
  isLoading,
  error,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-2xl transform transition-all animate-dropdown flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold text-white">Carregar Versão da Nuvem</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>
        
        <div className="overflow-y-auto pr-2 -mr-4">
            {isLoading && <p className="text-center text-gray-400">Buscando versões...</p>}
            {error && <p className="text-center text-red-400 bg-red-900/50 p-3 rounded-md">{error}</p>}
            {versions && (
                <div className="space-y-6">
                    <VersionList title="Versões Manuais" versions={versions.manual} onLoadVersion={onLoadVersion} />
                    <VersionList title="Backups Automáticos" versions={versions.automatic} onLoadVersion={onLoadVersion} />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
