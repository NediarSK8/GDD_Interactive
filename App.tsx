import React, { useState, useEffect, useRef } from 'react';
import { Chat } from '@google/genai';
import { Sidebar } from './components/Sidebar';
import { ContentView } from './components/ContentView';
import { IdeaInputModal } from './components/IdeaInputModal';
import { RefinementModal } from './components/RefinementModal';
import { GlobalUpdateModal } from './components/GlobalUpdateModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ReferenceFinderModal } from './components/ReferenceFinderModal';
import { AdvancedQueryWidget } from './components/AdvancedQueryWidget';
import { AiInsightModal } from './components/AiInsightModal';
import { ImageGenerationModal } from './components/ImageGenerationModal';
import { Document, ContentBlock, GeminiUpdatePayload } from './types';
import { analyzeAndIntegrateIdea, refineText, updateDocumentsWithInstruction, startAdvancedChatQuery, generateImagePrompt, generateImageFromPrompt } from './services/geminiService';
import { useDocuments } from './hooks/useDocuments';
import { useGoogleAuth } from './auth/useGoogleAuth';
import { generateDocxBlob } from './utils/docxGenerator';
import { applyChanges, estimateTokens } from './utils/helpers';
import { BrainIcon, UploadIcon, DownloadIcon, GoogleDriveIcon, DocumentIcon, MagicWandIcon, AiInsightIcon } from './assets/icons';
import { encryptData, decryptData } from './utils/crypto';


interface RefinementModalState {
    isOpen: boolean;
    docId: string | null;
    blockIndex: number | null;
    itemIndex?: number;
    initialText: string;
}

interface Reference {
    docId: string;
    docTitle: string;
    category: string;
    snippet: React.ReactNode;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export default function App() {
  const {
      documents, scriptDocuments, setDocuments, setScriptDocuments, isDBLoading, dbError,
      viewMode, setViewMode,
      activeDocuments, activeDocumentId,
      categories, activeDocument, totalWordCount,
      searchQuery, setSearchQuery, searchResults,
      scrollToHeading, setScrollToHeading,
      handleSelectDocument, handleSelectSearchResult, handleNavigate,
      handleDidScrollToHeading, handleUpdateBlock, handleSetContent,
      handleUpdateBlockContent,
      handleUpdateCategoryName, handleUpdateDocumentTitle,
      handleReorderDocuments, handleReorderCategories,
  } = useDocuments();

  const { googleAccessToken, authError, handleGoogleAuthClick } = useGoogleAuth();
  
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [lastSidebarWidth, setLastSidebarWidth] = useState(320);
  const isResizingRef = useRef(false);
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [isGlobalUpdateModalOpen, setIsGlobalUpdateModalOpen] = useState(false);
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
  const [isImageGenModalOpen, setIsImageGenModalOpen] = useState(false);
  const [imageGenState, setImageGenState] = useState<{ docId: string; insertionIndex: number } | null>(null);
  const [lastAiInsight, setLastAiInsight] = useState<(GeminiUpdatePayload & { rawJson: string }) | null>(null);

  const [refinementModalState, setRefinementModalState] = useState<RefinementModalState>({ isOpen: false, docId: null, blockIndex: null, itemIndex: undefined, initialText: '' });
  const [referenceFinderState, setReferenceFinderState] = useState<{
      isOpen: boolean;
      targetDoc: Document | null;
      references: Reference[];
  }>({ isOpen: false, targetDoc: null, references: [] });
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    message: '',
    currentTokens: 0,
    estimatedTokens: 0,
  });
  const [appError, setAppError] = useState<string | null>(null);

  const [isQueryWidgetOpen, setIsQueryWidgetOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const geminiChat = useRef<Chat | null>(null);
  
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const newWidth = Math.max(240, Math.min(e.clientX, 600)); // Clamp width
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
            document.body.style.cursor = 'auto';
            document.body.style.userSelect = 'auto';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleMouseDownOnResizer = (e: React.MouseEvent) => {
        if (isSidebarCollapsed) return;
        e.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    const handleToggleSidebar = () => {
      setIsSidebarCollapsed(prev => {
        const willCollapse = !prev;
        if (willCollapse) {
          setLastSidebarWidth(sidebarWidth);
          setSidebarWidth(0);
        } else {
          setSidebarWidth(lastSidebarWidth);
        }
        return willCollapse;
      });
    };


  useEffect(() => {
    if (dbError) setAppError(dbError);
  }, [dbError]);

  useEffect(() => {
    if (authError) setAppError(authError);
  }, [authError]);

  const handleSubmitIdea = async (idea: string, config: { maxOutputTokens: number; thinkingBudget: number }) => {
    setIsIdeaModalOpen(false);
    setAppError(null);

    const documentsToUpdate = (viewMode === 'gdd' ? documents : scriptDocuments) || [];
    const setDocumentsToUpdate = viewMode === 'gdd' ? setDocuments : setScriptDocuments;
    const contextType = viewMode === 'gdd' ? 'GDD' : 'Roteiro';

    setLoadingState({
        isLoading: true,
        message: 'A IA está analisando sua ideia...',
        currentTokens: 0,
        estimatedTokens: config.maxOutputTokens,
    });

    const onProgress = (tokens: number) => {
        setLoadingState(prev => ({ ...prev, currentTokens: tokens }));
    };

    try {
      const { payload: changes, rawJson } = await analyzeAndIntegrateIdea(idea, documentsToUpdate, contextType, onProgress, config);
      setLastAiInsight({ ...changes, rawJson });
      
      setLoadingState(prev => ({...prev, message: `Integrando sugestão da IA: ${changes.summary}`}));
      
      let finalDocs: Document[] = [];
      setDocumentsToUpdate(prevDocs => {
          finalDocs = applyChanges(prevDocs || [], changes);
          return finalDocs;
      });
      
      const newDocs = changes.newDocuments;
      if (newDocs.length > 0) {
        handleSelectDocument(newDocs[0].id);
      } else {
        setTimeout(() => {
            const activeDocStillExists = finalDocs.some(d => d.id === activeDocumentId);
            if (!activeDocStillExists && finalDocs.length > 0) {
                handleSelectDocument(finalDocs[0].id);
            }
        }, 0);
      }

    } catch (err) {
      console.error(err);
      setAppError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setTimeout(() => setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 }), 1500);
    }
  };

  const handleGlobalUpdate = async (instruction: string, config: { maxOutputTokens: number; thinkingBudget: number }) => {
    setIsGlobalUpdateModalOpen(false);
    setAppError(null);
    
    const documentsToUpdate = (viewMode === 'gdd' ? documents : scriptDocuments) || [];
    const setDocumentsToUpdate = viewMode === 'gdd' ? setDocuments : setScriptDocuments;
    const contextType = viewMode === 'gdd' ? 'GDD' : 'Roteiro';
    
    setLoadingState({
        isLoading: true,
        message: 'A IA está reestruturando os documentos...',
        currentTokens: 0,
        estimatedTokens: config.maxOutputTokens
    });

    const onProgress = (tokens: number) => {
        setLoadingState(prev => ({ ...prev, currentTokens: tokens }));
    };

    try {
        const { payload: changes, rawJson } = await updateDocumentsWithInstruction(instruction, documentsToUpdate, contextType, onProgress, config);
        setLastAiInsight({ ...changes, rawJson });
        
        let finalDocs: Document[] = [];
        setDocumentsToUpdate(prevDocs => {
            finalDocs = applyChanges(prevDocs || [], changes);
            return finalDocs;
        });

        setLoadingState(prev => ({ ...prev, message: changes.summary || 'Documentos atualizados com sucesso!'}));

        setTimeout(() => {
            const activeDocStillExists = finalDocs.some(d => d.id === activeDocumentId);
            if (!activeDocStillExists && finalDocs.length > 0) {
                handleSelectDocument(finalDocs[0].id);
            }
        }, 0);

    } catch (err) {
        console.error(err);
        setAppError(err instanceof Error ? err.message : `Ocorreu um erro desconhecido durante a atualização global do ${contextType}.`);
    } finally {
        setTimeout(() => setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 }), 1000);
    }
  };

  const handleDownload = () => {
    setAppError(null);
    try {
        const combinedData = {
            gdd: documents,
            script: scriptDocuments,
        };
        const encryptedData = encryptData(combinedData);
        const blob = new Blob([encryptedData], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'gdd-e-roteiro-data.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Falha ao fazer o download dos dados", err);
        setAppError(err instanceof Error ? err.message : "Falha ao fazer o download dos dados.");
    }
  };

  const handleGenerateDocs = async () => {
    setAppError(null);
    setLoadingState({
        isLoading: true,
        message: 'Gerando arquivos .docx...',
        currentTokens: 0,
        estimatedTokens: 0
    });
    
    try {
        const downloadBlob = (blob: Blob, filename: string) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        const gddBlob = await generateDocxBlob(documents, 'GDD');
        if (gddBlob) {
            downloadBlob(gddBlob, 'GDD.docx');
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        const scriptBlob = await generateDocxBlob(scriptDocuments, 'Roteiro');
        if (scriptBlob) {
            downloadBlob(scriptBlob, 'Roteiro.docx');
        }
      
      setLoadingState(prev => ({...prev, message: 'Documentos gerados com sucesso!'}));
    } catch (err) {
      console.error("Falha ao gerar documentos", err);
      setAppError(err instanceof Error ? err.message : 'Falha ao gerar os documentos.');
    } finally {
      setTimeout(() => {
        setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 });
      }, 1500);
    }
  };

  const handleUpload = () => {
    setAppError(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json,text/plain';
    
    input.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        setLoadingState({ isLoading: true, message: 'Processando arquivo...', currentTokens: 0, estimatedTokens: 0});
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result;
            if (typeof content === 'string') {
                try {
                    let parsedData;
                    // First, try to parse as plain JSON (for old files)
                    try {
                        parsedData = JSON.parse(content);
                    } catch (jsonError) {
                        // If that fails, assume it's encrypted and try to decrypt
                        try {
                           parsedData = decryptData(content);
                        } catch (decryptError) {
                            // If decryption also fails, then it's an invalid file
                            console.error("Falha na descriptografia e na análise JSON:", { jsonError, decryptError });
                            throw new Error('Formato de arquivo inválido. O arquivo deve ser um JSON válido ou um arquivo criptografado válido deste aplicativo.');
                        }
                    }
                    
                    const isDocumentArray = (arr: any): arr is Document[] => 
                        Array.isArray(arr) && arr.every(item => 
                            item && typeof item === 'object' && 'id' in item && 'title' in item && 'category' in item && 'content' in item
                        );

                    if (parsedData && typeof parsedData === 'object' && 'gdd' in parsedData && 'script' in parsedData && !Array.isArray(parsedData)) {
                        if (!isDocumentArray(parsedData.gdd) || !isDocumentArray(parsedData.script)) {
                             throw new Error('Formato de arquivo inválido. O arquivo combinado deve conter arrays de documentos válidos para GDD e Roteiro.');
                        }
                        setDocuments(parsedData.gdd);
                        setScriptDocuments(parsedData.script);
                    } 
                    else if (isDocumentArray(parsedData)) {
                        setDocuments(parsedData);
                    } 
                    else {
                        throw new Error('Formato de arquivo desconhecido ou inválido. O arquivo deve conter um GDD e Roteiro combinados ou apenas um GDD antigo.');
                    }
                } catch (err) {
                    console.error("Falha ao analisar o arquivo carregado", err);
                    setAppError(err instanceof Error ? err.message : 'Falha ao processar o arquivo. Certifique-se de que é um arquivo JSON válido ou um arquivo criptografado válido deste aplicativo.');
                } finally {
                    setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 });
                }
            }
        };
        reader.onerror = () => {
             setAppError('Falha ao ler o arquivo.');
             setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 });
        };
        reader.readAsText(file);
    };
    input.click();
  };

  const handleOpenRefinementModal = (docId: string, blockIndex: number, text: string, itemIndex?: number) => {
    setRefinementModalState({ isOpen: true, docId, blockIndex, initialText: text, itemIndex });
  };

  const handleSubmitRefinement = async (instruction: string, includeContext: boolean) => {
    const { docId, blockIndex, itemIndex, initialText } = refinementModalState;
    if (docId === null || blockIndex === null || !initialText) return;

    setRefinementModalState({ ...refinementModalState, isOpen: false });
    setAppError(null);
    
    const estimatedOutputTokens = Math.round(estimateTokens(initialText) * 1.5);

    setLoadingState({
        isLoading: true,
        message: 'A IA está aprimorando o texto...',
        currentTokens: 0,
        estimatedTokens: estimatedOutputTokens
    });
    
    const onProgress = (tokens: number) => {
        setLoadingState(prev => ({ ...prev, currentTokens: tokens }));
    };

    try {
        const documentsForContext = (viewMode === 'gdd' ? documents : scriptDocuments) || [];
        const contextDocs = includeContext ? documentsForContext : undefined;
        const newText = await refineText(initialText, instruction, contextDocs, onProgress);
        handleUpdateBlock(docId, blockIndex, newText, itemIndex);
    } catch (err) {
        console.error("Falha ao aprimorar o texto", err);
        setAppError(err instanceof Error ? err.message : 'Falha ao aprimorar o texto.');
    } finally {
        setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 });
    }
  };

  const handleFindReferences = (docId: string) => {
      const allDocs = [...(documents || []), ...(scriptDocuments || [])];
      const targetDoc = allDocs.find(d => d.id === docId);
      if (!targetDoc) return;

      const references: Reference[] = [];
      const linkRegex = new RegExp(`(\\[\\[${targetDoc.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\]\\])`, 'gi');

      const highlight = (text: string) => {
          return text.split(linkRegex).map((part, i) =>
              linkRegex.test(part) ? <strong key={i} className="bg-yellow-400/30 text-yellow-200">{part}</strong> : part
          );
      };
      
      allDocs.forEach(doc => {
          if (doc.id === targetDoc.id) return;

          doc.content.forEach(block => {
              let texts: string[] = [];
              if ((block.type === 'heading' || block.type === 'paragraph') && block.text) {
                  texts.push(block.text);
              } else if (block.type === 'list' && block.items) {
                  texts.push(...block.items.filter(Boolean));
              } else if (block.type === 'image' && block.caption) {
                  texts.push(block.caption);
              }

              texts.forEach(text => {
                  if (linkRegex.test(text)) {
                      references.push({
                          docId: doc.id,
                          docTitle: doc.title,
                          category: doc.category,
                          snippet: <>{highlight(text)}</>,
                      });
                  }
              });
          });
      });

      setReferenceFinderState({
          isOpen: true,
          targetDoc: targetDoc,
          references: references,
      });
  };

  const handleCloseReferenceFinder = () => {
      setReferenceFinderState({ isOpen: false, targetDoc: null, references: [] });
  };

  const handleToggleQueryWidget = () => {
      setIsQueryWidgetOpen(prev => !prev);
  };

  const handleClearChat = () => {
      setChatMessages([]);
      geminiChat.current = null;
  };

  const handleSendChatMessage = async (message: string) => {
      if (!documents || !scriptDocuments) return;

      const newUserMessage: ChatMessage = { role: 'user', text: message };
      setChatMessages(prev => [...prev, newUserMessage]);
      setIsChatLoading(true);

      try {
          if (!geminiChat.current) {
              geminiChat.current = startAdvancedChatQuery(documents, scriptDocuments);
          }
          
          const response = await geminiChat.current.sendMessage({ message });
          const aiResponse: ChatMessage = { role: 'model', text: response.text };
          setChatMessages(prev => [...prev, aiResponse]);

      } catch (err) {
          console.error("Erro na consulta avançada do chat:", err);
          const errorMessage: ChatMessage = {
              role: 'model',
              text: "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente."
          };
          setChatMessages(prev => [...prev, errorMessage]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const handleOpenImageGenerationModal = (docId: string, insertionIndex: number) => {
    setImageGenState({ docId, insertionIndex });
    setIsImageGenModalOpen(true);
  };

  const handleSubmitImageGeneration = async (userPrompt: string) => {
    if (!imageGenState) return;
    const { docId, insertionIndex } = imageGenState;
    const isGddDoc = (documents || []).some(d => d.id === docId);
    const docsForContext = (isGddDoc ? documents : scriptDocuments) || [];
    const targetDoc = docsForContext.find(d => d.id === docId);
    
    if (!targetDoc) {
      setAppError('Documento alvo para geração de imagem não encontrado.');
      return;
    }
    
    setIsImageGenModalOpen(false);
    setAppError(null);

    try {
      setLoadingState({
        isLoading: true,
        message: 'A IA está criando um prompt de imagem detalhado...',
        currentTokens: 0,
        estimatedTokens: 0
      });
      
      const detailedPrompt = await generateImagePrompt(targetDoc, insertionIndex, [...(documents || []), ...(scriptDocuments || [])], userPrompt);
      
      setLoadingState(prev => ({ ...prev, message: 'A IA está gerando a imagem...' }));
      
      const { base64, mimeType } = await generateImageFromPrompt(detailedPrompt);
      
      const newImageBlock: ContentBlock = {
        type: 'image',
        id: `img-ai-${Date.now()}`,
        src: `data:${mimeType};base64,${base64}`,
        caption: detailedPrompt,
      };
      
      const newContent = [...targetDoc.content];
      newContent.splice(insertionIndex, 0, newImageBlock);
      
      const setDocs = isGddDoc ? setDocuments : setScriptDocuments;
      const now = new Date().toISOString();
      setDocs(prevDocs => (prevDocs || []).map(doc => doc.id === docId ? { ...doc, content: newContent, lastEdited: now } : doc));
      
      setLoadingState(prev => ({...prev, message: 'Imagem gerada e inserida com sucesso!'}));

    } catch (err) {
      console.error("Falha ao gerar a imagem com IA", err);
      setAppError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido durante a geração da imagem.');
    } finally {
      setImageGenState(null);
      setTimeout(() => setLoadingState({ isLoading: false, message: '', currentTokens: 0, estimatedTokens: 0 }), 1500);
    }
  };


  return (
    <div className="flex h-screen font-sans relative">
      {(loadingState.isLoading || isDBLoading) && (
          <LoadingOverlay 
              message={isDBLoading ? "Carregando documentos..." : loadingState.message}
              currentTokens={loadingState.currentTokens}
              estimatedTokens={loadingState.estimatedTokens}
          />
      )}
      <Sidebar 
        width={sidebarWidth}
        title={viewMode === 'gdd' ? 'GDD Explorer' : 'Roteiro Explorer'}
        documents={activeDocuments} 
        categories={categories}
        activeDocumentId={activeDocumentId} 
        onSelectDocument={handleSelectDocument}
        onUpdateCategoryName={handleUpdateCategoryName}
        onUpdateDocumentTitle={handleUpdateDocumentTitle}
        onReorderDocuments={handleReorderDocuments}
        onReorderCategories={handleReorderCategories}
        onFindReferences={handleFindReferences}
        totalWordCount={totalWordCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={handleSelectSearchResult}
      />
      {!isSidebarCollapsed && (
        <div
            onMouseDown={handleMouseDownOnResizer}
            className="w-1.5 flex-shrink-0 bg-gray-700 hover:bg-indigo-500 transition-colors duration-200"
            style={{ cursor: 'col-resize' }}
        />
      )}
      <button
        onClick={handleToggleSidebar}
        className="absolute top-1/2 -translate-y-1/2 bg-gray-800 hover:bg-indigo-600 border border-gray-700 text-white rounded-full p-1 z-40 transition-all duration-200 shadow-lg"
        style={{ left: isSidebarCollapsed ? '8px' : `${sidebarWidth - 16}px` }}
        title={isSidebarCollapsed ? "Expandir" : "Recolher"}
        aria-label={isSidebarCollapsed ? "Expandir painel lateral" : "Recolher painel lateral"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <main className="flex-1 flex flex-col bg-gray-900 overflow-y-auto min-w-0">
         <header className="sticky top-0 z-30 flex items-center justify-between p-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700">
             <div className="flex items-center">
                <h1 className="text-2xl font-bold text-white flex items-center">
                    <BrainIcon />
                    GDD Interativo com IA
                </h1>
                <div className="ml-4 bg-gray-800 p-1 rounded-lg flex items-center">
                    <button
                        onClick={() => setViewMode('gdd')}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${viewMode === 'gdd' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    >
                        GDD
                    </button>
                    <button
                        onClick={() => setViewMode('script')}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${viewMode === 'script' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    >
                        Roteiro
                    </button>
                </div>
             </div>
             <div className="flex items-center space-x-2">
                <button
                    onClick={handleUpload}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg flex items-center transition-colors duration-200"
                    title="Carregar GDD e Roteiro do computador"
                >
                    <UploadIcon />
                </button>
                <button
                    onClick={handleDownload}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg flex items-center transition-colors duration-200"
                    title="Salvar GDD e Roteiro no computador"
                >
                    <DownloadIcon />
                </button>
                <button
                    onClick={handleGoogleAuthClick}
                    disabled={!!googleAccessToken}
                    className={`font-bold py-2 px-3 rounded-lg flex items-center transition-colors duration-200 ${
                        googleAccessToken
                            ? 'bg-green-700 text-white cursor-not-allowed'
                            : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                    title={googleAccessToken ? "Conectado ao Google Drive" : "Conectar ao Google Drive para salvar backups"}
                >
                    <GoogleDriveIcon />
                </button>
                <button
                    onClick={handleGenerateDocs}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-3 rounded-lg flex items-center transition-colors duration-200"
                    title="Gerar e baixar o documento completo"
                >
                    <DocumentIcon />
                </button>
                <button
                    onClick={() => setIsInsightModalOpen(true)}
                    disabled={!lastAiInsight}
                    className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    title="Ver o processo de raciocínio da última ação da IA"
                    >
                    <AiInsightIcon />
                    Ver Raciocínio da IA
                </button>
                 <button
                    onClick={() => setIsGlobalUpdateModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors duration-200"
                    title={`Atualizar todo o ${viewMode.toUpperCase()} com uma instrução`}
                    >
                    <MagicWandIcon />
                    Atualização Global
                </button>
                <button
                    onClick={() => setIsIdeaModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors duration-200"
                    >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Integrar Nova Ideia
                </button>
             </div>
         </header>

         {appError && (
            <div className="m-4 p-4 bg-red-800/50 border border-red-600 text-red-200 rounded-md">
                <h3 className="font-bold">Ocorreu um Erro</h3>
                <p>{appError}</p>
            </div>
         )}

         <ContentView 
            document={activeDocument} 
            allDocuments={[...(documents || []), ...(scriptDocuments || [])]}
            onNavigate={handleNavigate}
            onRefineRequest={handleOpenRefinementModal}
            onFindReferences={handleFindReferences}
            onUpdateBlock={handleUpdateBlock}
            onUpdateBlockContent={handleUpdateBlockContent}
            onSetContent={handleSetContent}
            scrollToHeading={scrollToHeading}
            onDidScrollToHeading={handleDidScrollToHeading}
            onOpenImageGenerationModal={handleOpenImageGenerationModal}
         />
      </main>
      <IdeaInputModal 
        isOpen={isIdeaModalOpen}
        onClose={() => setIsIdeaModalOpen(false)}
        onSubmit={handleSubmitIdea}
        contextType={viewMode === 'gdd' ? 'GDD' : 'Roteiro'}
      />
      <GlobalUpdateModal 
        isOpen={isGlobalUpdateModalOpen}
        onClose={() => setIsGlobalUpdateModalOpen(false)}
        onSubmit={handleGlobalUpdate}
        contextType={viewMode === 'gdd' ? 'GDD' : 'Roteiro'}
      />
      <ImageGenerationModal
        isOpen={isImageGenModalOpen}
        onClose={() => setIsImageGenModalOpen(false)}
        onSubmit={handleSubmitImageGeneration}
      />
      <RefinementModal
        isOpen={refinementModalState.isOpen}
        onClose={() => setRefinementModalState({ ...refinementModalState, isOpen: false })}
        onSubmit={handleSubmitRefinement}
        initialText={refinementModalState.initialText}
        contextType={viewMode === 'gdd' ? 'GDD' : 'Roteiro'}
      />
      <ReferenceFinderModal
        isOpen={referenceFinderState.isOpen}
        onClose={handleCloseReferenceFinder}
        targetDocTitle={referenceFinderState.targetDoc?.title || ''}
        references={referenceFinderState.references}
        onNavigate={handleNavigate}
      />
       <AiInsightModal
        isOpen={isInsightModalOpen}
        onClose={() => setIsInsightModalOpen(false)}
        insight={lastAiInsight}
      />
      <AdvancedQueryWidget
        isOpen={isQueryWidgetOpen}
        onToggle={handleToggleQueryWidget}
        messages={chatMessages}
        isLoading={isChatLoading}
        onSendMessage={handleSendChatMessage}
        onClearChat={handleClearChat}
      />
    </div>
  );
}
