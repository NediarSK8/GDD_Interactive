

import React, { useState, useEffect } from 'react';

interface RefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (instruction: string, includeContext: boolean) => void;
  initialText: string;
  contextType: 'GDD' | 'Roteiro';
}

const SUGGESTIONS = [
    "Corrigir ortografia e gramática",
    "Tornar o texto mais formal",
    "Simplificar a linguagem",
    "Expandir esta ideia",
    "Resumir este ponto"
];

export const RefinementModal: React.FC<RefinementModalProps> = ({ isOpen, onClose, onSubmit, initialText, contextType }) => {
  const [instruction, setInstruction] = useState('');
  const [includeContext, setIncludeContext] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInstruction(''); // Reset instruction when modal opens
      setIncludeContext(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (instruction.trim()) {
      onSubmit(instruction, includeContext);
    }
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
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center">✨ Aprimorar Texto com IA</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>
        
        <div className="mb-4">
            <p className="text-sm font-semibold text-gray-400 mb-2">Texto Original:</p>
            <blockquote className="bg-gray-900/50 border-l-4 border-gray-600 p-3 rounded-r-md text-gray-300 max-h-32 overflow-y-auto">
                {initialText}
            </blockquote>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-400 mb-2">Sugestões:</p>
            <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map(sugg => (
                    <button
                        type="button"
                        key={sugg}
                        onClick={() => setInstruction(sugg)}
                        className="px-3 py-1 text-sm bg-gray-700 hover:bg-indigo-600 rounded-full transition-colors"
                    >
                        {sugg}
                    </button>
                ))}
            </div>
          </div>

          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ou escreva sua própria instrução aqui..."
            className="w-full h-24 p-4 bg-gray-900 border border-gray-700 rounded-md text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          <div className="mt-4">
            <label className="flex items-center text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="w-4 h-4 bg-gray-900 border-gray-600 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm select-none">Incluir contexto (enviar todo o {contextType} para a IA)</span>
            </label>
          </div>
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
              disabled={!instruction.trim()}
              className="px-6 py-2 rounded-md font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Aprimorar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};