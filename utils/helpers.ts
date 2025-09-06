import { Document, GeminiUpdatePayload, ContentBlock } from '../types';

export const estimateTokens = (text: string): number => Math.round((text || '').length / 3.5);

export const applyChanges = (currentDocs: Document[], changes: GeminiUpdatePayload): Document[] => {
    const originalImageSources = new Map<string, string>();
    currentDocs.forEach(doc => {
        doc.content.forEach(block => {
            if (block.type === 'image' && block.src) {
                originalImageSources.set(block.id, block.src);
            }
        });
    });

    const restoreImageSrc = (doc: Document): Document => ({
        ...doc,
        content: doc.content.map(block => {
            if (block.type === 'image' && block.id && !block.src) {
                const originalSrc = originalImageSources.get(block.id);
                return { ...block, src: originalSrc || '' };
            }
            return block;
        })
    });

    const now = new Date().toISOString();

    const docMap = new Map<string, Document>(currentDocs.map(doc => [doc.id, doc]));

    changes.deletedDocumentIds.forEach(id => {
        docMap.delete(id);
    });

    changes.updatedDocuments.forEach(updatedDoc => {
        const restoredDoc = restoreImageSrc(updatedDoc);
        docMap.set(updatedDoc.id, { ...restoredDoc, lastEdited: now });
    });

    const newDocsWithExtras = changes.newDocuments.map(newDoc => ({
        ...restoreImageSrc(newDoc),
        lastEdited: now,
    }));

    const finalDocs = [...docMap.values(), ...newDocsWithExtras];
    
    return finalDocs;
};

export const ensureTimestamps = (docs: Document[]): Document[] => {
    if (!Array.isArray(docs)) return [];
    const now = new Date().toISOString();
    return docs.map(doc => ({
        ...doc,
        lastEdited: doc.lastEdited || now,
    }));
};
