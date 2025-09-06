import React from 'react';

interface Reference {
  docId: string;
  docTitle: string;
  category: string;
  snippet: React.ReactNode;
}

interface ReferenceFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDocTitle: string;
  references: Reference[];
  onNavigate: (docId: string, headingSlug?: string) => void;
}

const LinkIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
);


export const ReferenceFinderModal: React.FC<ReferenceFinderModalProps> = ({ isOpen, onClose, targetDocTitle, references, onNavigate }) => {
  if (!isOpen) return null;

  const handleNavigation = (docId: string) => {
    onNavigate(docId);
    onClose();
  };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity"
        onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-3xl transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center">
            <LinkIcon />
            <div>
              <h2 className="text-2xl font-bold text-white">Referências a "{targetDocTitle}"</h2>
              <p className="text-gray-400 text-sm">{references.length} menção(ões) encontrada(s).</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>
        
        {references.length > 0 ? (
          <ul className="max-h-[60vh] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {references.map((ref, index) => (
              <li key={index}>
                <button 
                  onClick={() => handleNavigation(ref.docId)} 
                  className="w-full text-left bg-gray-900/50 p-4 rounded-lg hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <div className="font-semibold text-indigo-400 text-lg">{ref.docTitle}</div>
                  <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">{ref.category}</div>
                  <blockquote className="text-gray-300 border-l-2 border-gray-600 pl-3 text-sm italic">
                    ...{ref.snippet}...
                  </blockquote>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-400">Nenhuma referência encontrada para este documento.</p>
          </div>
        )}
      </div>
    </div>
  );
};
