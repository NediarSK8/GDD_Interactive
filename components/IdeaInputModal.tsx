import React, { useState, useEffect } from 'react';

interface IdeaInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (idea: string, config: { model: string; maxOutputTokens?: number; thinkingBudget: number }) => void;
  contextType: 'GDD' | 'Roteiro' | 'Secreta';
}

export const IdeaInputModal: React.FC<IdeaInputModalProps> = ({ isOpen, onClose, onSubmit, contextType }) => {
  const [idea, setIdea] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [model, setModel] = useState('gemini-2.5-flash');
  
  const [isMaxOutputTokensMax, setIsMaxOutputTokensMax] = useState(true);
  const [isThinkingBudgetAuto, setIsThinkingBudgetAuto] = useState(true);

  const [maxOutputTokens, setMaxOutputTokens] = useState(65000);
  const [thinkingBudget, setThinkingBudget] = useState(10000);
  const [lastThinkingBudget, setLastThinkingBudget] = useState(10000);

  useEffect(() => {
    // Reset to defaults when modal opens
    if (isOpen) {
        setIdea('');
        setShowAdvanced(false);
        setModel('gemini-2.5-flash');
        setIsMaxOutputTokensMax(true);
        setIsThinkingBudgetAuto(true);
        setMaxOutputTokens(65000);
        setThinkingBudget(10000);
        setLastThinkingBudget(10000);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isThinkingBudgetAuto) {
      setLastThinkingBudget(thinkingBudget);
      setThinkingBudget(-1);
    } else {
      setThinkingBudget(lastThinkingBudget === -1 ? 10000 : lastThinkingBudget);
    }
  }, [isThinkingBudgetAuto]);


  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (idea.trim()) {
      const config = {
        model,
        maxOutputTokens: isMaxOutputTokensMax ? undefined : maxOutputTokens,
        thinkingBudget: isThinkingBudgetAuto ? -1 : thinkingBudget,
      };
      onSubmit(idea, config);
    }
  };

  const handleMaxOutputTokensChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setMaxOutputTokens(value);
    if (!isThinkingBudgetAuto && thinkingBudget >= value) {
        setThinkingBudget(Math.max(0, value - 512));
    }
  };

  const handleThinkingBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setThinkingBudget(value);
  };

  const isThinkingSupported = model === 'gemini-2.5-flash';

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
                <div className="mt-2 space-y-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700 animate-fade-in">
                    <div>
                        <label htmlFor="ai-model-idea" className="block text-sm font-medium text-gray-300">Modelo de IA</label>
                        <select
                            id="ai-model-idea"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Rápido)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro (Avançado)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">"Pro" é mais poderoso para tarefas complexas, mas pode ser mais lento.</p>
                    </div>
                    <div>
                        <div className="flex items-center justify-between">
                            <label htmlFor="maxOutputTokens" className="block text-sm font-medium text-gray-300">
                                Limite de Tokens de Saída: <span className="font-bold text-white">{isMaxOutputTokensMax ? 'Máximo' : maxOutputTokens.toLocaleString('pt-BR')}</span>
                            </label>
                            <div className="flex items-center">
                                <input id="max-tokens-check" type="checkbox" checked={isMaxOutputTokensMax} onChange={e => setIsMaxOutputTokensMax(e.target.checked)} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
                                <label htmlFor="max-tokens-check" className="ml-2 text-sm text-gray-300">Max</label>
                            </div>
                        </div>
                        <input
                            id="maxOutputTokens"
                            type="range"
                            min="2048"
                            max="65000"
                            step="512"
                            value={maxOutputTokens}
                            onChange={handleMaxOutputTokensChange}
                            disabled={isMaxOutputTokensMax}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">Controla o tamanho máximo da resposta da IA.</p>
                    </div>
                    <div>
                         <div className="flex items-center justify-between">
                            <label htmlFor="thinkingBudget" className={`block text-sm font-medium transition-colors ${isThinkingSupported ? 'text-gray-300' : 'text-gray-500'}`}>
                                Orçamento de Raciocínio: <span className="font-bold text-white">{isThinkingBudgetAuto ? 'Automático' : thinkingBudget.toLocaleString('pt-BR')}</span>
                            </label>
                             <div className="flex items-center">
                                <input id="auto-thinking-check" type="checkbox" checked={isThinkingBudgetAuto} onChange={e => setIsThinkingBudgetAuto(e.target.checked)} disabled={!isThinkingSupported} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" />
                                <label htmlFor="auto-thinking-check" className={`ml-2 text-sm transition-colors ${isThinkingSupported ? 'text-gray-300' : 'text-gray-500'}`}>Auto</label>
                            </div>
                        </div>
                        <input
                            id="thinkingBudget"
                            type="range"
                            min="0"
                            max={isMaxOutputTokensMax ? 16000 : Math.max(0, maxOutputTokens - 512)}
                            step="256"
                            value={thinkingBudget}
                            onChange={handleThinkingBudgetChange}
                            disabled={isThinkingBudgetAuto || !isThinkingSupported}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Reserva tokens para a IA "pensar" para melhor qualidade. 'Auto' é o recomendado.
                            {!isThinkingSupported && <span className="text-yellow-500 block">Indisponível para o modelo Pro.</span>}
                        </p>
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
