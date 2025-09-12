import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Document, ContentBlock, GeminiUpdatePayload, ImageBlock, ListBlock } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

type ContextType = 'GDD' | 'Roteiro' | 'Secreta';

const sanitizeContentForAI = (content: ContentBlock[]) => {
    return content.map(block => {
        // Para blocos de imagem, removemos o campo 'src' (que contém os dados da imagem em base64)
        // antes de enviar para a IA. A IA só precisa do ID para referência e da legenda.
        if (block.type === 'image') {
            const { src, ...rest } = block as ImageBlock;
            return rest;
        }
        return block;
    });
};

const sanitizeDocumentsForAI = (documents: Document[]) => {
    return documents.map(doc => ({
        ...doc,
        content: sanitizeContentForAI(doc.content)
    }));
};

const estimateTokens = (text: string): number => Math.round((text || '').length / 3.5);

/**
 * Corrige blocos de conteúdo que podem ter sido malformados pela IA.
 * Ex: Converte blocos de lista com 'text' em vez de 'items'.
 */
const fixMalformedBlocks = (content: ContentBlock[]): ContentBlock[] => {
    if (!Array.isArray(content)) return [];
    return content.map(block => {
        if (block.type === 'list') {
            const listBlock = block as any; // Cast para verificar propriedades não padrão
            if (typeof listBlock.text === 'string' && !Array.isArray(listBlock.items)) {
                // Bloco malformado encontrado. Converte 'text' para 'items'.
                return {
                    type: 'list',
                    style: listBlock.style || 'unordered',
                    items: [listBlock.text]
                } as ListBlock;
            }
        }
        return block;
    });
};

/**
 * Aplica correções a todo o payload de resposta da Gemini.
 */
const sanitizeGeminiResponse = (payload: GeminiUpdatePayload): GeminiUpdatePayload => {
    if (payload.newDocuments) {
        payload.newDocuments = payload.newDocuments.map(doc => ({
            ...doc,
            content: fixMalformedBlocks(doc.content)
        }));
    }
    if (payload.updatedDocuments) {
        payload.updatedDocuments = payload.updatedDocuments.map(doc => ({
            ...doc,
            content: fixMalformedBlocks(doc.content)
        }));
    }
    return payload;
};

const documentSchema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      category: { type: Type.STRING },
      content: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['heading', 'paragraph', 'list', 'image', 'blockquote', 'definition_list'] },
            level: { type: Type.INTEGER, description: "Apenas para blocos 'heading'. Níveis 1, 2 ou 3." },
            text: { type: Type.STRING, description: "O conteúdo de texto para blocos 'heading', 'paragraph' e 'blockquote'." },
            style: { type: Type.STRING, enum: ['unordered', 'ordered'], description: "Apenas para blocos 'list'." },
            items: { 
                oneOf: [
                    { type: Type.ARRAY, items: { type: Type.STRING }, description: "Uma array de strings de itens para blocos 'list'." },
                    { 
                        type: Type.ARRAY, 
                        items: { 
                            type: Type.OBJECT, 
                            properties: {
                                term: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                             required: ['term', 'description']
                        }, 
                        description: "Apenas para blocos 'definition_list'. Uma array de objetos com 'term' e 'description'."
                    }
                ]
            },
            id: { type: Type.STRING, description: "O ID único para blocos 'image'." },
            caption: { type: Type.STRING, description: "A legenda para blocos 'image'." },
          },
          required: ['type']
        }
      }
    },
    required: ['id', 'title', 'category', 'content']
};

const updatePayloadSchema = {
    type: Type.OBJECT,
    properties: {
        newDocuments: {
            type: Type.ARRAY,
            description: "Array de documentos inteiramente novos. Se nenhum for criado, retorne um array vazio [].",
            items: documentSchema
        },
        updatedDocuments: {
            type: Type.ARRAY,
            description: "Array de documentos existentes que foram modificados. Retorne o objeto completo para cada documento modificado. Se nenhum for modificado, retorne um array vazio [].",
            items: documentSchema
        },
        deletedDocumentIds: {
            type: Type.ARRAY,
            description: "Array de IDs de documentos a serem excluídos. Se nenhum for removido, retorne um array vazio [].",
            items: { type: Type.STRING }
        },
        summary: {
            type: Type.STRING,
            description: "Um breve resumo em uma frase das mudanças feitas."
        },
        thinkingProcess: {
            type: Type.ARRAY,
            description: "Uma lista passo a passo em Português Brasileiro descrevendo o raciocínio para as mudanças feitas.",
            items: { type: Type.STRING }
        }
    },
    required: ['newDocuments', 'updatedDocuments', 'deletedDocumentIds', 'summary', 'thinkingProcess']
};

/**
 * Chama a API Gemini com uma lógica de repetição para lidar com JSONs incompletos.
 */
async function callGeminiWithRetryForUpdates(
    initialPrompt: string,
    config: any,
    onProgress: (tokens: number) => void,
    onStatusUpdate: (message: string) => void
): Promise<{ payload: GeminiUpdatePayload; rawJson: string }> {

    const executeStream = async (prompt: string, initialTokenCount: number = 0) => {
        const responseStream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: config,
        });

        let accumulatedText = "";
        for await (const chunk of responseStream) {
            if (chunk.text) {
                accumulatedText += chunk.text;
                onProgress(initialTokenCount + estimateTokens(accumulatedText));
            }
        }
        return accumulatedText; // Não usar trim() para não remover espaços que podem ser necessários na concatenação
    };

    // Primeira Tentativa
    let jsonText = await executeStream(initialPrompt);

    try {
        let parsedResponse = JSON.parse(jsonText) as GeminiUpdatePayload;
        if (!parsedResponse.newDocuments || !parsedResponse.updatedDocuments || !parsedResponse.deletedDocumentIds || !parsedResponse.summary || !parsedResponse.thinkingProcess) {
            throw new Error("A resposta da IA está faltando campos obrigatórios.");
        }
        parsedResponse = sanitizeGeminiResponse(parsedResponse);
        return { payload: parsedResponse, rawJson: jsonText };
    } catch (error) {
        console.warn("Falha ao analisar o JSON da primeira tentativa, tentando continuar.", { error, partialJson: jsonText });
        
        onStatusUpdate('A resposta da IA foi longa e foi cortada. Solicitando a continuação para completar a tarefa...');

        // Extrai o processo de raciocínio parcial para fornecer como contexto na próxima chamada
        let thinkingProcessContext = "Nenhum processo de raciocínio foi capturado na resposta parcial.";
        try {
            const thinkingMatch = jsonText.match(/"thinkingProcess"\s*:\s*\[\s*([^\]]*)/);
            if (thinkingMatch && thinkingMatch[1]) {
                const completeStrings = thinkingMatch[1].match(/"(.*?)"/g);
                if (completeStrings) {
                    thinkingProcessContext = completeStrings.map(s => ` - ${JSON.parse(s)}`).join('\n');
                }
            }
        } catch (e) { console.error("Não foi possível extrair o processo de raciocínio.", e); }

        // Constrói o prompt para a nova tentativa, incluindo todo o contexto anterior, como solicitado.
        const retryPrompt = `${initialPrompt}

---
CONTEXTO DA SUA TENTATIVA ANTERIOR (que foi interrompida):
Seu processo de raciocínio parcial foi:
${thinkingProcessContext}

Sua resposta JSON parcial foi:
${jsonText}
---

Continue o que estava fazendo.`;
        
        const initialTokensForRetry = estimateTokens(jsonText);
        const continuationText = await executeStream(retryPrompt, initialTokensForRetry);
        
        const combinedJsonText = jsonText + continuationText;
        
        try {
            let parsedResponse = JSON.parse(combinedJsonText) as GeminiUpdatePayload;
             if (!parsedResponse.newDocuments || !parsedResponse.updatedDocuments || !parsedResponse.deletedDocumentIds || !parsedResponse.summary || !parsedResponse.thinkingProcess) {
                throw new Error("A resposta da IA na segunda tentativa também está faltando campos obrigatórios.");
            }
            console.log("Continuação bem-sucedida! JSON combinado analisado com sucesso.");
            parsedResponse = sanitizeGeminiResponse(parsedResponse);
            return { payload: parsedResponse, rawJson: combinedJsonText };
        } catch (retryError) {
             console.error("Falha ao analisar o JSON mesmo após a continuação.", { retryError, finalJson: combinedJsonText });
             throw new Error("Falha ao obter uma resposta JSON válida da IA, mesmo após uma nova tentativa. A resposta combinada era inválida. Por favor, tente simplificar sua instrução.");
        }
    }
}

export async function analyzeAndIntegrateIdea(
    idea: string,
    documents: Document[],
    contextType: ContextType,
    onProgress: (tokens: number) => void,
    onStatusUpdate: (message: string) => void,
    config: { maxOutputTokens: number; thinkingBudget: number }
): Promise<{ payload: GeminiUpdatePayload; rawJson: string }> {
  const sanitizedDocuments = sanitizeDocumentsForAI(documents);

  const promptContext = contextType === 'GDD'
    ? 'Você é um game designer especialista gerenciando um Documento de Design de Jogo (GDD) interligado.'
    : 'Você é um roteirista sênior gerenciando um Roteiro de Jogo cronológico interligado.';

  const prompt = `
    ${promptContext}
    Sua tarefa é integrar de forma inteligente e focada uma nova ideia/texto fornecida por um usuário na estrutura do documento existente.
    O objetivo principal é manter cada documento coeso e focado em seu próprio assunto, evitando a saturação de links e informações tangenciais.

    **REGRAS CRÍTicas:**
    1.  **Princípio do Foco do Documento:** Cada documento deve ter um propósito claro e se concentrar em seu próprio tópico. Não adicione detalhes extensos sobre um conceito se ele já tiver seu próprio documento dedicado. A integração deve ocorrer no local mais apropriado.
    2.  **Integração Direta:** Analise a ideia do usuário e determine o melhor local para integrá-la. Isso pode significar criar um novo documento para uma nova mecânica ou adicionar um parágrafo a um documento existente.
    3.  **Links Internos com Moderação:** Ao adicionar conteúdo, crie um link para outro documento (usando [[Título do Documento]]) SOMENTE se a referência for **essencial e direta** para a compreensão do texto atual. Evite links para documentos com relação apenas indireta. NÃO sature o texto com links; a clareza é mais importante que a interconexão exaustiva. Se você renomear um documento, atualize os links existentes para ele.
    4.  **Edições Precisas:** Faça apenas as alterações estritamente necessárias. NÃO reescreva partes de um documento que não foram afetadas pela ideia. Modifique apenas o texto relevante para incorporar a nova ideia.
    5.  **Formato de Saída:** Sua resposta DEVE ser um único objeto JSON com as chaves especificadas no esquema.
    6.  **Raciocínio (thinkingProcess):** Forneça uma lista passo a passo descrevendo seu raciocínio. Explique por que você está criando ou atualizando documentos específicos, justificando a relevância da alteração para aquele documento. Este campo é OBRIGATÓRIO.
    7.  **Preservar IDs:** Você DEVE preservar o 'id' dos documentos e blocos de imagem existentes.
    8.  **Novos IDs:** Para novos documentos, gere um ID único usando o timestamp atual como uma string (ex: "${Date.now()}").
    9.  **Idioma:** Toda a sua saída (títulos, conteúdo, resumo) DEVE ESTAR EM PORTUGUÊS BRASILEIRO.
    10. **Estrutura do Conteúdo:** Adira à estrutura de blocos de conteúdo.

    **Novos Blocos de Conteúdo:**
    - **Blockquote (\`blockquote\`):** Use para citações, diálogos, ou para destacar um parágrafo que necessita de ênfase especial, separando-o visualmente do texto principal.
    - **Lista de Definição (\`definition_list\`):** Use para pares de termo-definição. Ideal para explicar mecânicas, atributos, ou glossários. Exemplo: 'Mecânica: [descrição]' deve se tornar um item em uma lista de definição.

    **DOCUMENTO ATUAL (${contextType}):**
    ---
    ${JSON.stringify(sanitizedDocuments, null, 2)}
    ---

    **NOVA IDEIA PARA INTEGRAR:**
    ---
    ${idea}
    ---

    Agora, execute a integração focada e retorne APENAS AS ALTERAÇÕES no formato JSON especificado.
  `;

  const geminiConfig = {
      responseMimeType: "application/json",
      responseSchema: updatePayloadSchema,
      maxOutputTokens: config.maxOutputTokens,
      thinkingConfig: { thinkingBudget: config.thinkingBudget },
  };

  try {
    return await callGeminiWithRetryForUpdates(prompt, geminiConfig, onProgress, onStatusUpdate);
  } catch (error) {
    console.error("Erro final ao chamar a API Gemini para integração de ideia:", error);
    throw new Error(error instanceof Error ? error.message : "Falha ao obter uma resposta válida da IA.");
  }
}

export async function analyzeAndIntegrateScriptIdea(
    idea: string,
    scriptDocuments: Document[],
    gddContext: Document[],
    onProgress: (tokens: number) => void,
    onStatusUpdate: (message: string) => void,
    config: { maxOutputTokens: number; thinkingBudget: number }
): Promise<{ payload: GeminiUpdatePayload; rawJson: string }> {
    const sanitizedScript = sanitizeDocumentsForAI(scriptDocuments);
    const sanitizedGdd = sanitizeDocumentsForAI(gddContext);

    const prompt = `
    Você é um roteirista sênior gerenciando um Roteiro de Jogo cronológico. Você tem acesso de LEITURA ao Game Design Document (GDD) completo para ter contexto.
    Sua tarefa é integrar de forma inteligente e focada uma nova ideia/texto fornecida por um usuário na estrutura do Roteiro existente.

    **REGRAS CRÍTicas:**
    1.  **ESCOPO DE MODIFICAÇÃO:** Você SÓ PODE modificar, criar ou deletar documentos do 'Roteiro'. O GDD é apenas para referência e NÃO PODE ser alterado nesta tarefa.
    2.  **Princípio do Foco do Documento:** Cada documento de roteiro deve ter um propósito claro (uma missão, uma cutscene, etc.). A integração deve ocorrer no local mais apropriado.
    3.  **SEM Links Novos:** NÃO CRIE novos links internos (usando [[Título do Documento]]) no Roteiro. O roteiro deve ser um documento linear sem links para o GDD. Você pode referenciar conceitos do GDD por nome (ex: 'Amuletos'), mas não crie um link para eles.
    4.  **Edições Precisas:** Faça apenas as alterações estritamente necessárias. NÃO reescreva partes de um documento que não foram afetadas pela ideia.
    5.  **Formato de Saída:** Sua resposta DEVE ser um único objeto JSON com as chaves especificadas no esquema, afetando APENAS a coleção de documentos do Roteiro.
    6.  **Raciocínio (thinkingProcess):** Forneça uma lista passo a passo descrevendo seu raciocínio.
    7.  **Preservar IDs:** Você DEVE preservar o 'id' dos documentos existentes.
    8.  **Novos IDs:** Para novos documentos, gere um ID único usando o timestamp (ex: "${Date.now()}").
    9.  **Idioma:** Toda a sua saída DEVE ESTAR EM PORTUGUÊS BRASILEIRO.
    10. **Estrutura do Conteúdo:** Adira à estrutura de blocos de conteúdo.

    **Novos Blocos de Conteúdo:**
    - **Blockquote (\`blockquote\`):** Use para citações, diálogos, ou para destacar um parágrafo que necessita de ênfase especial, separando-o visualmente do texto principal.
    - **Lista de Definição (\`definition_list\`):** Use para pares de termo-definição. Ideal para explicar mecânicas, atributos, ou glossários. Exemplo: 'Mecânica: [descrição]' deve se tornar um item em uma lista de definição.

    **CONTEXTO DE LEITURA - GDD:**
    ---
    ${JSON.stringify(sanitizedGdd, null, 2)}
    ---

    **DOCUMENTOS DO ROTEIRO (Seu escopo de trabalho):**
    ---
    ${JSON.stringify(sanitizedScript, null, 2)}
    ---

    **NOVA IDEIA PARA INTEGRAR:**
    ---
    ${idea}
    ---

    Agora, execute a integração focada no Roteiro e retorne APENAS AS ALTERAÇÕES no formato JSON especificado.
  `;

    const geminiConfig = {
        responseMimeType: "application/json",
        responseSchema: updatePayloadSchema,
        maxOutputTokens: config.maxOutputTokens,
        thinkingConfig: { thinkingBudget: config.thinkingBudget },
    };

    try {
        return await callGeminiWithRetryForUpdates(prompt, geminiConfig, onProgress, onStatusUpdate);
    } catch (error) {
        console.error("Erro final ao chamar a API Gemini para a ideia de roteiro:", error);
        throw new Error(error instanceof Error ? error.message : "Falha ao obter uma resposta válida da IA.");
    }
}

export async function analyzeAndIntegrateSecretIdea(
    idea: string,
    secretDocuments: Document[],
    gddContext: Document[],
    scriptContext: Document[],
    onProgress: (tokens: number) => void,
    onStatusUpdate: (message: string) => void,
    config: { maxOutputTokens: number; thinkingBudget: number }
): Promise<{ payload: GeminiUpdatePayload; rawJson: string }> {
    const sanitizedSecret = sanitizeDocumentsForAI(secretDocuments);
    const sanitizedGdd = sanitizeDocumentsForAI(gddContext);
    const sanitizedScript = sanitizeDocumentsForAI(scriptContext);

    const prompt = `
    Você é um diretor de jogo sênior e estrategista. Sua tarefa é gerenciar um conjunto de documentos secretos e de alto nível.
    Você tem acesso de LEITURA ao Game Design Document (GDD) e ao Roteiro completos para ter contexto total sobre o jogo.

    **REGRAS CRÍTicas:**
    1.  **ESCOPO DE MODIFICAÇÃO:** Você SÓ PODE modificar, criar ou deletar os 'DOCUMENTOS SECRETOS'. O GDD e o Roteiro são apenas para referência e NÃO PODEM ser alterados nesta tarefa.
    2.  **Integração Estratégica:** Analise a nova 'IDEIA ESTRATÉGICA' e integre-a de forma inteligente nos 'DOCUMENTOS SECRETOS'. Isso pode envolver a criação de novos documentos secretos ou a atualização dos existentes.
    3.  **Links:** Você pode criar links dos documentos secretos para os documentos do GDD ou Roteiro (usando [[Título do Documento]]), mas não o contrário.
    4.  **Formato de Saída:** Sua resposta DEVE ser um único objeto JSON afetando APENAS a coleção de documentos secretos.
    5.  **Raciocínio (thinkingProcess):** Explique seu raciocínio estratégico para as mudanças.
    6.  **IDs:** Preserve os IDs existentes. Crie novos IDs para novos documentos usando o timestamp.
    7.  **Idioma:** Toda a sua saída DEVE ESTAR EM PORTUGUÊS BRASILEIRO.

    **CONTEXTO DE LEITURA - GDD:**
    ---
    ${JSON.stringify(sanitizedGdd, null, 2)}
    ---

    **CONTEXTO DE LEITURA - Roteiro:**
    ---
    ${JSON.stringify(sanitizedScript, null, 2)}
    ---

    **DOCUMENTOS SECRETOS (Seu escopo de trabalho):**
    ---
    ${JSON.stringify(sanitizedSecret, null, 2)}
    ---

    **NOVA IDEIA ESTRATÉGICA PARA INTEGRAR:**
    ---
    ${idea}
    ---

    Agora, execute a integração estratégica nos documentos secretos e retorne APENAS AS ALTERAÇÕES no formato JSON especificado.
  `;

    const geminiConfig = {
        responseMimeType: "application/json",
        responseSchema: updatePayloadSchema,
        maxOutputTokens: config.maxOutputTokens,
        thinkingConfig: { thinkingBudget: config.thinkingBudget },
    };

    try {
        return await callGeminiWithRetryForUpdates(prompt, geminiConfig, onProgress, onStatusUpdate);
    } catch (error) {
        console.error("Erro final ao chamar a API Gemini para a ideia secreta:", error);
        throw new Error(error instanceof Error ? error.message : "Falha ao obter uma resposta válida da IA.");
    }
}


export async function refineText(
    textToRefine: string, 
    instruction: string, 
    documents: Document[] | undefined,
    onProgress: (tokens: number) => void
): Promise<string> {
    const contextPrompt = documents ? `
      CONTEXTO DO DOCUMENTO (APENAS DOCUMENTOS RELEVANTES):
      ---
      ${JSON.stringify(sanitizeDocumentsForAI(documents).map(d => ({title: d.title, category: d.category, content: d.content})), null, 2)}
      ---
    ` : '';
    
    const prompt = `
      Você é um assistente de escrita. Sua tarefa é reescrever o texto fornecido com base na instrução dada.
      ${contextPrompt}
      Responda APENAS com o texto reescrito, dentro de um objeto JSON com uma única chave "rewrittenText". Não adicione nenhuma explicação ou formatação extra.
      Todos os links internos no formato [[Título do Documento]], [[Título do Documento#Texto do Título]] ou [[img:id-da-imagem]] devem ser preservados.

      INSTRUÇÃO:
      "${instruction}"

      TEXTO ORIGINAL A SER REESCRITO:
      ---
      ${textToRefine}
      ---
    `;

    try {
        const responseStream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        rewrittenText: {
                            type: Type.STRING,
                            description: "O texto reescrito."
                        }
                    },
                    required: ['rewrittenText']
                },
                maxOutputTokens: 65000,
                thinkingConfig: { thinkingBudget: 10000 },
            }
        });
        
        let accumulatedText = "";
        for await (const chunk of responseStream) {
            if (chunk.text) {
                accumulatedText += chunk.text;
                onProgress(estimateTokens(accumulatedText));
            }
        }
        const jsonText = accumulatedText.trim();
        const parsedResponse = JSON.parse(jsonText) as { rewrittenText: string };
        
        if (typeof parsedResponse.rewrittenText !== 'string') {
            throw new Error("A resposta da IA não continha o texto reescrito esperado.");
        }
        
        return parsedResponse.rewrittenText;

    } catch (error) {
        console.error("Erro ao chamar a API Gemini para aprimorar o texto:", error);
        throw new Error("Falha ao obter uma resposta válida da IA para o aprimoramento do texto.");
    }
}

export async function updateDocumentsWithInstruction(
    instruction: string, 
    documents: Document[], 
    contextType: ContextType,
    onProgress: (tokens: number) => void,
    onStatusUpdate: (message: string) => void,
    config: { maxOutputTokens: number; thinkingBudget: number }
): Promise<{ payload: GeminiUpdatePayload; rawJson: string }> {
    const contextName = contextType === 'GDD' ? 'Documento de Design de Jogo (GDD)' : 'Roteiro de Jogo';
    const sanitizedDocuments = sanitizeDocumentsForAI(documents);

    const prompt = `
    Você é um especialista encarregado de gerenciar um ${contextName} interligado.
    Sua tarefa é realizar uma atualização de alto nível em todo o documento com base na instrução de um usuário.

    **REGRAS CRÍTICAS:**
    1.  **Formato de Saída:** Sua resposta DEVE ser um único objeto JSON com as chaves especificadas no esquema.
    2.  **Raciocínio (thinkingProcess):** Forneça uma lista passo a passo descrevendo seu raciocínio para as mudanças. Explique por que você está criando, atualizando ou excluindo documentos. Este campo é OBRIGATÓRIO.
    3.  **Preservar IDs:** Ao atualizar um documento existente, você DEVE preservar seu 'id' original. Para blocos de imagem, você DEVE preservar seu 'id' original.
    4.  **IDs de Novos Documentos:** Para quaisquer novos documentos que você criar, gere um ID único usando o timestamp atual como uma string (ex: "${Date.now()}").
    5.  **Edições Focadas:** Faça apenas as alterações estritamente necessárias para cumprir a instrução. Não reescreva ou reorganize partes do documento que não estão diretamente relacionadas à instrução do usuário.
    6.  **Blocos de Imagem:** Você NÃO PODE criar novos blocos de imagem ou inventar IDs de imagem. Você pode mover blocos de imagem existentes, alterar suas legendas ('caption') ou excluí-los, mas o campo 'id' de uma imagem existente DEVE ser preservado.
    7.  **Sem Deleções de Documentos:** Por segurança, não delete nenhum documento. Você pode atualizar o conteúdo para ficar vazio ou marcar o documento como obsoleto no título, mas não o remova do array de saída.
    8.  **Links Internos:** Mantenha e atualize meticulosamente todos os links internos. Use o formato [[Título do Documento]] para vincular a um documento. Para vincular a um título específico dentro de um documento, use o formato [[Título do Documento#Texto do Título]]. Se você renomear um documento ou um título, atualize TODOS os links que apontam para ele em todo o GDD/Roteiro. Links de imagem usam [[img:id-da-imagem]].
    9.  **Idioma:** Toda a sua saída (títulos, conteúdo, etc.) DEVE ESTAR EM PORTUGUÊS BRASILEIRO.
    
    **Novos Blocos de Conteúdo:**
    - **Blockquote (\`blockquote\`):** Use para citações, diálogos, ou para destacar um parágrafo que necessita de ênfase especial, separando-o visualmente do texto principal.
    - **Lista de Definição (\`definition_list\`):** Use para pares de termo-definição. Ideal para explicar mecânicas, atributos, ou glossários. Exemplo: 'Mecânica: [descrição]' deve se tornar um item em uma lista de definição.

    **DOCUMENTO ATUAL (${contextType}):**
    ---
    ${JSON.stringify(sanitizedDocuments, null, 2)}
    ---

    **INSTRUÇÃO DO USUÁRIO:**
    ---
    ${instruction}
    ---

    Agora, execute as atualizações solicitadas e retorne APENAS AS ALTERAÇÕES no formato JSON especificado.
  `;

    const geminiConfig = {
        responseMimeType: "application/json",
        responseSchema: updatePayloadSchema,
        maxOutputTokens: config.maxOutputTokens,
        thinkingConfig: { thinkingBudget: config.thinkingBudget },
    };

    try {
        return await callGeminiWithRetryForUpdates(prompt, geminiConfig, onProgress, onStatusUpdate);
    } catch (error) {
        console.error("Erro final ao chamar a API Gemini para atualização global:", error);
        throw new Error(error instanceof Error ? error.message : "Falha ao obter uma resposta válida da IA.");
    }
}

export function startAdvancedChatQuery(
    gddDocuments: Document[],
    scriptDocuments: Document[]
): Chat {
    const combinedContext = {
        GDD: sanitizeDocumentsForAI(gddDocuments),
        Roteiro: sanitizeDocumentsForAI(scriptDocuments)
    };

    const systemInstruction = `
        Você é um assistente especialista em design de jogos. Sua finalidade é responder a perguntas sobre o Documento de Design de Jogo (GDD) e o Roteiro fornecidos. 
        Você NÃO DEVE inventar informações. Baseie todas as suas respostas estritamente no contexto fornecido.
        NÃO se ofereça para modificar os documentos. Seu papel é apenas consultivo.
        Seja conciso e direto em suas respostas.

        Aqui está o contexto completo:
        ---
        ${JSON.stringify(combinedContext, null, 2)}
        ---
    `;
    
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
            maxOutputTokens: 65000,
            thinkingConfig: { thinkingBudget: 10000 },
        },
    });

    return chat;
}

export async function generateImagePrompt(
    documentContext: Document,
    insertionIndex: number,
    allDocuments: Document[],
    userPrompt?: string
): Promise<string> {
    
    let specificContext = '';
    const relevantBlocks = documentContext.content.slice(Math.max(0, insertionIndex - 2), insertionIndex + 1);
    relevantBlocks.forEach(block => {
        if ('text' in block && block.text) specificContext += block.text + '\n';
        if ('items' in block && Array.isArray(block.items)) specificContext += (block.items as string[]).join('\n') + '\n';
    });
    if (!specificContext) {
        specificContext = documentContext.content.map(b => 'text' in b ? b.text : '').join('\n');
    }

    const sanitizedDocuments = sanitizeDocumentsForAI(allDocuments);

    const prompt = `
        Você é um diretor de arte e artista conceitual trabalhando em um jogo. Sua tarefa é escrever um prompt de geração de imagem detalhado e vívido para o modelo de imagem 'Imagen'.

        **REGRAS CRÍTICAS:**
        1.  **Contexto Completo:** Use o JSON 'DOCUMENTO COMPLETO' abaixo para entender o estilo visual geral, design de personagens, ambientação e lore do jogo. Sua imagem DEVE ser consistente com este contexto.
        2.  **Contexto Específico:** O 'CONTEXTO ESPECÍFICO DA CENA' descreve onde a imagem será inserida. Use-o para entender a cena imediata, a ação e o humor.
        3.  **Instrução do Usuário:** Se uma 'INSTRUÇÃO DO USUÁRIO' for fornecida, ela tem a MAIOR prioridade para o conteúdo da cena. Integre a instrução do usuário de forma criativa, mas AINDA mantenha a consistência com o estilo visual do 'DOCUMENTO COMPLETO'.
        4.  **Formato do Prompt:** O prompt que você escrever deve ser em inglês, altamente descritivo, focado em detalhes visuais e usar termos artísticos. Pense em composição, iluminação, paleta de cores, estilo artístico e emoção.
        5.  **Saída:** Sua resposta DEVE ser um único objeto JSON com uma única chave "image_prompt".

        **DOCUMENTO COMPLETO (GDD/Roteiro):**
        ---
        ${JSON.stringify(sanitizedDocuments, null, 2)}
        ---

        **CONTEXTO ESPECÍFICO DA CENA:**
        ---
        ${specificContext.trim()}
        ---

        **INSTRUÇÃO DO USUÁRIO (se houver):**
        ---
        ${userPrompt || "Nenhuma. Crie a imagem com base no contexto da cena e no GDD."}
        ---

        Agora, escreva o prompt para o modelo de imagem e retorne-o no formato JSON especificado.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        image_prompt: {
                            type: Type.STRING,
                            description: "O prompt de geração de imagem detalhado em inglês."
                        }
                    },
                    required: ['image_prompt']
                },
                thinkingConfig: { thinkingBudget: 5000 },
            }
        });
        
        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText) as { image_prompt: string };

        if (typeof parsedResponse.image_prompt !== 'string' || !parsedResponse.image_prompt) {
            throw new Error("A IA não gerou um prompt de imagem válido.");
        }

        return parsedResponse.image_prompt;

    } catch (error) {
        console.error("Erro ao chamar a API Gemini para gerar o prompt de imagem:", error);
        throw new Error("Falha ao criar um prompt para a imagem. O serviço pode estar indisponível.");
    }
}

export async function generateImageFromPrompt(
    prompt: string
): Promise<{ base64: string; mimeType: string }> {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '16:9',
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0 || !response.generatedImages[0].image.imageBytes) {
            throw new Error("A API de imagem não retornou dados de imagem.");
        }

        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return {
            base64: base64ImageBytes,
            mimeType: 'image/png'
        };
    } catch (error) {
        console.error("Erro ao chamar a API Imagen para gerar imagem:", error);
        throw new Error("Falha ao gerar a imagem. Verifique o prompt ou a disponibilidade do serviço.");
    }
}