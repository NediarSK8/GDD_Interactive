import React, { useState } from 'react';

interface GlobalUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (instruction: string, config: { maxOutputTokens: number; thinkingBudget: number }) => void;
  contextType: 'GDD' | 'Roteiro';
}

export const GlobalUpdateModal: React.FC<GlobalUpdateModalProps> = ({ isOpen, onClose, onSubmit, contextType }) => {
  const [instruction, setInstruction] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxOutputTokens, setMaxOutputTokens] = useState(65000);
  const [thinkingBudget, setThinkingBudget] = useState(10000);


  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (instruction.trim()) {
      onSubmit(instruction, { maxOutputTokens, thinkingBudget });
      setInstruction('');
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
  
  const placeholderText = contextType === 'GDD' 
    ? "Ex: Crie uma nova categoria 'Inimigos' e adicione documentos para 'Grunt' e 'Brute' com base na lore existente..."
    : "Ex: Divida o Ato 1 em mais duas missões, focando na introdução da mecânica de furtividade antes do primeiro chefe.";

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
            <h2 className="text-2xl font-bold text-white">Atualização Global do {contextType} com IA</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <p className="text-gray-400 mb-4">
            Forneça uma instrução de alto nível. A IA analisará todo o {contextType} e aplicará as mudanças necessárias, como criar novos documentos, atualizar seções existentes e garantir a consistência dos links.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={placeholderText}
            className="w-full h-48 p-4 bg-gray-900 border border-gray-700 rounded-md text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
           <div className="mt-4">
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-indigo-400 hover:text-indigo-300 focus:outline-none">
                {showAdvanced ? 'Ocultar' : 'Mostrar'} Configurações Avançadas
            </button>
            {showAdvanced && (
                <div className="mt-2 space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700 animate-fade-in">
                    <div>
                        <label htmlFor="maxOutputTokensGlobal" className="block text-sm font-medium text-gray-300">
                            Limite de Tokens de Saída: <span className="font-bold text-white">{maxOutputTokens.toLocaleString('pt-BR')}</span>
                        </label>
                        <input
                            id="maxOutputTokensGlobal"
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
                        <label htmlFor="thinkingBudgetGlobal" className="block text-sm font-medium text-gray-300">
                            Orçamento de Raciocínio (Thinking Budget): <span className="font-bold text-white">{thinkingBudget.toLocaleString('pt-BR')}</span>
                        </label>
                        <input
                            id="thinkingBudgetGlobal"
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
              disabled={!instruction.trim()}
              className="px-6 py-2 rounded-md font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Atualizar {contextType}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};