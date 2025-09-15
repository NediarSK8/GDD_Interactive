import React, { useState, useCallback } from 'react';
import { CHANGELOG_VERSIONS, getChangelogContent } from '../services/changelogService';
import { ChevronDownIcon } from '../assets/changelog-icons';

const parseMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(<ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 mt-2">{listItems}</ul>);
            listItems = [];
        }
    };

    lines.forEach((line, index) => {
        if (line.startsWith('### ')) {
            flushList();
            elements.push(<h3 key={index} className="text-lg font-semibold text-indigo-400 mt-4 first:mt-0">{line.substring(4)}</h3>);
        } else if (line.startsWith('- ')) {
            listItems.push(<li key={index}>{line.substring(2)}</li>);
        } else {
            flushList();
            if (line.trim()) {
                elements.push(<p key={index} className="text-gray-400">{line}</p>);
            }
        }
    });

    flushList();
    return elements;
};


const VersionItem: React.FC<{ version: string }> = ({ version }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [content, setContent] = useState<React.ReactNode[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const toggleExpand = useCallback(async () => {
        const currentlyExpanded = isExpanded;
        setIsExpanded(!currentlyExpanded);

        if (!currentlyExpanded && !content) {
            setIsLoading(true);
            try {
                const markdownText = await getChangelogContent(version);
                setContent(parseMarkdown(markdownText));
            } catch (e) {
                setContent([<p key="error" className="text-red-400">Falha ao carregar conteúdo.</p>]);
            } finally {
                setIsLoading(false);
            }
        }
    }, [isExpanded, content, version]);

    return (
        <div className="bg-gray-900/50 rounded-lg transition-colors">
            <button
                onClick={toggleExpand}
                className="w-full flex justify-between items-center text-left p-4 hover:bg-gray-700/50 rounded-lg"
                aria-expanded={isExpanded}
            >
                <span className="font-semibold text-lg text-gray-200">Versão {version}</span>
                <ChevronDownIcon isExpanded={isExpanded} />
            </button>
            {isExpanded && (
                <div className="p-4 border-t border-gray-700">
                    {isLoading && <p className="text-gray-400">Carregando...</p>}
                    {content}
                </div>
            )}
        </div>
    );
};


interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-2xl transform transition-all animate-dropdown flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h2 className="text-2xl font-bold text-white">Histórico de Versões</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>
        
        <div className="overflow-y-auto pr-2 -mr-4 space-y-3">
            {CHANGELOG_VERSIONS.map(version => (
                <VersionItem key={version} version={version} />
            ))}
        </div>
      </div>
    </div>
  );
};
