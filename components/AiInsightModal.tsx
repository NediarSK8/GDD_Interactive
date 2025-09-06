import React, { useState } from 'react';
import { GeminiUpdatePayload } from '../types';

interface AiInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  insight: (GeminiUpdatePayload & { rawJson: string }) | null;
}

export const AiInsightModal: React.FC<AiInsightModalProps> = ({ isOpen, onClose, insight }) => {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!isOpen || !insight) {
    return null;
  }
  
  const { summary, thinkingProcess, rawJson } = insight;
  let prettyJson = '';
  try {
    prettyJson = JSON.stringify(JSON.parse(rawJson), null, 2);
  } catch (e) {
    prettyJson = 'Erro ao formatar JSON: ' + rawJson;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-3xl transform transition-all flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold text-white">Análise da Última Ação da IA</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        
        <div className="overflow-y-auto pr-4 -mr-4 space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-teal-400 mb-2">Resumo da IA</h3>
                <p className="bg-gray-900/50 p-3 rounded-md text-gray-300 italic">"{summary}"</p>
            </div>
            
            <div>
                <h3 className="text-lg font-semibold text-teal-400 mb-2">Processo de Raciocínio</h3>
                <ol className="list-decimal list-inside bg-gray-900/50 p-4 rounded-md text-gray-300 space-y-2">
                    {thinkingProcess.map((step, index) => (
                        <li key={index}>{step}</li>
                    ))}
                </ol>
            </div>
            
            <div>
                <button
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="text-sm text-teal-400 hover:text-teal-300 focus:outline-none mb-2"
                >
                    {showRawJson ? 'Ocultar' : 'Mostrar'} Saída JSON Bruta
                </button>
                {showRawJson && (
                    <div className="animate-fade-in bg-gray-900 p-4 rounded-md border border-gray-700 max-h-80 overflow-auto">
                        <pre className="text-xs text-gray-400"><code>{prettyJson}</code></pre>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};