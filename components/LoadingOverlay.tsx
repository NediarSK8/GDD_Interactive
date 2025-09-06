

import React from 'react';

interface LoadingOverlayProps {
  message: string;
  currentTokens?: number;
  estimatedTokens?: number;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message, currentTokens, estimatedTokens }) => {
  const progress = (estimatedTokens && currentTokens && estimatedTokens > 0) 
    ? (currentTokens / estimatedTokens) * 100 
    : 0;

  const showProgress = typeof currentTokens === 'number' && typeof estimatedTokens === 'number' && estimatedTokens > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 text-white">
      <svg className="animate-spin h-12 w-12 text-indigo-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p className="text-xl font-semibold mb-4">{message}</p>
      {showProgress && (
        <div className="w-80 text-center">
            <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${Math.min(progress, 100)}%` }}></div>
            </div>
            <p className="text-sm text-gray-400 mt-2">
                {currentTokens.toLocaleString('pt-BR')} / {estimatedTokens.toLocaleString('pt-BR')} tokens gerados (estimativa)
            </p>
        </div>
      )}
    </div>
  );
};
