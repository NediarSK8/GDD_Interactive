import React, { useState } from 'react';

interface ImageGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userPrompt: string) => void;
}

export const ImageGenerationModal: React.FC<ImageGenerationModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [userPrompt, setUserPrompt] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(userPrompt);
    setUserPrompt('');
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-2xl transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Gerar Imagem com IA</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <p className="text-gray-400 mb-4">
            Opcionalmente, descreva a cena que você quer gerar. A IA usará o contexto do documento (estilo visual, personagens) para criar um prompt detalhado e gerar uma imagem consistente com o GDD.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Ex: Kael em uma pose de combate, com seu amuleto brilhando intensamente..."
            className="w-full h-40 p-4 bg-gray-900 border border-gray-700 rounded-md text-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
          />
          <div className="mt-6 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-md font-semibold text-white bg-green-600 hover:bg-green-500 transition-colors"
            >
              Gerar Imagem
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};