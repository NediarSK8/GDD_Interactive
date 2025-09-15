import React, { useState, useEffect, useMemo } from 'react';
import { Document, MindMapNode, HeadingBlock } from '../types';

interface MindMapNodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (node: MindMapNode) => void;
  nodeToEdit: MindMapNode | null;
  allDocuments: Document[];
}

const slugify = (text: string) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const MindMapNodeEditModal: React.FC<MindMapNodeEditModalProps> = ({ isOpen, onClose, onSave, nodeToEdit, allDocuments }) => {
  const [label, setLabel] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [selectedHeading, setSelectedHeading] = useState<string>('');

  useEffect(() => {
    if (nodeToEdit) {
      setLabel(nodeToEdit.label);
      setSelectedDocId(nodeToEdit.docId || '');
      setSelectedHeading(nodeToEdit.headingSlug || '');
    }
  }, [nodeToEdit]);

  const availableHeadings = useMemo(() => {
    if (!selectedDocId) return [];
    const doc = allDocuments.find(d => d.id === selectedDocId);
    if (!doc) return [];
    return doc.content
      .filter((block): block is HeadingBlock => block.type === 'heading')
      .map(h => ({ text: h.text, slug: slugify(h.text) }));
  }, [selectedDocId, allDocuments]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeToEdit || !label.trim()) return;
    
    onSave({
        ...nodeToEdit,
        label: label.trim(),
        docId: selectedDocId || undefined,
        headingSlug: selectedHeading || undefined,
    });
  };

  if (!isOpen || !nodeToEdit) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-lg transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Editar Nó do Mapa Mental</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="node-label" className="block text-sm font-medium text-gray-300 mb-1">
                    Rótulo do Nó
                </label>
                <input
                    id="node-label"
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                />
            </div>
            <div>
                <label htmlFor="node-link-doc" className="block text-sm font-medium text-gray-300 mb-1">
                    Link para Documento (Opcional)
                </label>
                <select
                    id="node-link-doc"
                    value={selectedDocId}
                    onChange={e => {
                        setSelectedDocId(e.target.value);
                        setSelectedHeading(''); // Reset heading when doc changes
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">Nenhum</option>
                    {allDocuments.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.title}</option>
                    ))}
                </select>
            </div>
            {selectedDocId && availableHeadings.length > 0 && (
                <div>
                    <label htmlFor="node-link-heading" className="block text-sm font-medium text-gray-300 mb-1">
                        Link para Título (Opcional)
                    </label>
                    <select
                        id="node-link-heading"
                        value={selectedHeading}
                        onChange={e => setSelectedHeading(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">Topo do Documento</option>
                        {availableHeadings.map(h => (
                             <option key={h.slug} value={h.slug}>{h.text}</option>
                        ))}
                    </select>
                </div>
            )}
          <div className="mt-8 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-md font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
