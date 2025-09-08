import React, { useState } from 'react';

interface SaveVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  isSaving: boolean;
}

export const SaveVersionModal: React.FC<SaveVersionModalProps> = ({ isOpen, onClose, onSave, isSaving }) => {
  const [name, setName] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md transform transition-all animate-dropdown" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Salvar Versão na Nuvem</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>
        <p className="text-gray-400 mb-4">
            Dê um nome a esta versão para identificá-la facilmente mais tarde. Ex: "Após a reunião de design".
        </p>
        <form onSubmit={handleSave}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da Versão"
            className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          <div className="mt-6 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2 rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="px-6 py-2 rounded-md font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
