import React, { useState } from 'react';

interface IdeaInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (idea: string, config: { maxOutputTokens: number; thinkingBudget: number }) => void;
  contextType: 'GDD' | 'Roteiro' | 'Secreta';
}

export const IdeaInputModal: React.FC<IdeaInputModalProps> = ({ isOpen, onClose, onSubmit, contextType }) => {
  const [idea, setIdea] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxOutputTokens, setMaxOutputTokens] = useState(65000);
  const [thinkingBudget, setThinkingBudget] = useState(10000);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (idea.trim()) {
      onSubmit(idea, { maxOutputTokens, thinkingBudget });
      setIdea('');
    }
  };

  const handleMaxOutputTokensChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setMaxOutputTokens(value);
    if (thinkingBudget >= value) {
        setThinkingBudget(Math.max(0, value - 512));
    }
  };

  const handleThinkingBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setThinkingBudget(value);
  };

  const titleText = contextType === 'Secreta' ? 'Integrar Ideia Estratégica' : `Integrar Nova Ideia ao ${contextType}`;
  const descriptionText = contextType === 'Secreta'
    ? 'Descreva uma ideia de alto nível, segredo de enredo, ou estratégia de monetização. A IA analisará o GDD e Roteiro como contexto, mas só modificará seus documentos secretos.'
    : `Cole qualquer texto aqui - um novo documento, uma ideia, um parágrafo para adicionar, notas de reunião, etc. A IA irá analisá-lo e sugerir a melhor forma de integrá-lo ao ${contextType}.`;
  const placeholderText = contextType === 'Secreta'
    ? 'Ex: O personagem Kael é na verdade um clone do vilão principal, e a profecia é uma farsa para manipular ambos...'
    : 'Ex: Vamos adicionar um sistema de criação onde os jogadores podem combinar fragmentos elementais para criar novos feitiços...';

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
            <h2 className="text-2xl font-bold text-white">{titleText}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <p className="text-gray-400 mb-4">
            {descriptionText}
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={placeholderText}
            className="w-full h-64 p-4 bg-gray-900 border border-gray-700 rounded-md text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          <div className="mt-4">
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-indigo-400 hover:text-indigo-300 focus:outline-none">
                {showAdvanced ? 'Ocultar' : 'Mostrar'} Configurações Avançadas
            </button>
            {showAdvanced && (
                <div className="mt-2 space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700 animate-fade-in">
                    <div>
                        <label htmlFor="maxOutputTokens" className="block text-sm font-medium text-gray-300">
                            Limite de Tokens de Saída: <span className="font-bold text-white">{maxOutputTokens.toLocaleString('pt-BR')}</span>
                        </label>
                        <input
                            id="maxOutputTokens"
                            type="range"
                            min="2048"
                            max="65000"
                            step="512"
                            value={maxOutputTokens}
                            onChange={handleMaxOutputTokensChange}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Controla o tamanho máximo da resposta da IA. Valores mais altos permitem mudanças mais complexas.</p>
                    </div>
                    <div>
                        <label htmlFor="thinkingBudget" className="block text-sm font-medium text-gray-300">
                            Orçamento de Raciocínio (Thinking Budget): <span className="font-bold text-white">{thinkingBudget.toLocaleString('pt-BR')}</span>
                        </label>
                        <input
                            id="thinkingBudget"
                            type="range"
                            min="0"
                            max={Math.max(0, maxOutputTokens - 512)}
                            step="256"
                            value={thinkingBudget}
                            onChange={handleThinkingBudgetChange}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reserva tokens para a IA "pensar". Zero desativa o pensamento para respostas mais rápidas, mas de menor qualidade.</p>
                    </div>
                </div>
            )}
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
              disabled={!idea.trim()}
              className="px-6 py-2 rounded-md font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Deixar a IA Integrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};