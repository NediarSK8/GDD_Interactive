import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Document, ContentBlock, GeminiUpdatePayload, ImageBlock, ListBlock } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

type ContextType = 'GDD' | 'Roteiro';

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

export async function analyzeAndIntegrateIdea(
    idea: string,
    documents: Document[],
    contextType: ContextType,
    onProgress: (tokens: number) => void,
    config: { maxOutputTokens: number; thinkingBudget: number }
): Promise<{ payload: GeminiUpdatePayload; rawJson: string }> {
  const sanitizedDocuments = sanitizeDocumentsForAI(documents);

  const promptContext = contextType === 'GDD'
    ? 'Você é um game designer especialista gerenciando um Documento de Design de Jogo (GDD) interligado.'
    : 'Você é um roteirista sênior gerenciando um Roteiro de Jogo cronológico interligado.';

  const prompt = `
    ${promptContext}
    Sua tarefa é integrar de forma inteligente uma nova ideia/texto fornecida por um usuário na estrutura do documento existente.
    Você tem o contexto completo do documento atual. Você DEVE realizar uma atualização abrangente para incorporar a nova ideia da forma mais coesa e inteligente possível.

    **REGRAS CRÍTicas:**
    1.  **Integração Completa:** Analise a ideia do usuário e determine TODAS as alterações necessárias no documento. Isso pode envolver criar documentos, atualizar documentos existentes ou movê-los.
    2.  **Edições Focadas:** Faça apenas as alterações estritamente necessárias. Se uma ideia afeta apenas uma frase em um parágrafo, modifique apenas essa frase e mantenha o restante do parágrafo. Se a ideia é renomear um documento, altere apenas seu título e atualize os links para ele; não modifique seu conteúdo desnecessariamente. NÃO reescreva partes de um documento que não foram afetadas pela ideia.
    3.  **Formato de Saída:** Sua resposta DEVE ser um único objeto JSON com as chaves especificadas no esquema.
    4.  **Raciocínio (thinkingProcess):** Forneça uma lista passo a passo descrevendo seu raciocínio. Explique por que você está criando, atualizando ou excluindo documentos com base na ideia do usuário. Seja claro e conciso. Este campo é OBRIGATÓRIO.
    5.  **Preservar IDs:** Você DEVE preservar o 'id' dos documentos e blocos de imagem existentes.
    6.  **Novos IDs:** Para novos documentos, gere um ID único usando o timestamp atual como uma string (ex: "${Date.now()}").
    7.  **Links Internos:** Mantenha e atualize meticulosamente todos os links internos. Use o formato [[Título do Documento]] para vincular a um documento. Para vincular a um título específico dentro de um documento, use o formato [[Título do Documento#Texto do Título]]. Se você renomear um documento ou um título, atualize TODOS os links que apontam para ele em todo o GDD/Roteiro. Links de imagem usam [[img:id-da-imagem]].
    8.  **Idioma:** Toda a sua saída (títulos, conteúdo, resumo) DEVE ESTAR EM PORTUGÊS BRASILEIRO.
    9.  **Estrutura do Conteúdo:** Adira à estrutura de blocos de conteúdo.

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

    Agora, execute a integração e retorne APENAS AS ALTERAÇÕES no formato JSON especificado.
  `;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: updatePayloadSchema,
        maxOutputTokens: config.maxOutputTokens,
        thinkingConfig: { thinkingBudget: config.thinkingBudget },
      },
    });
    
    let accumulatedText = "";
    for await (const chunk of responseStream) {
        if (chunk.text) {
            accumulatedText += chunk.text;
            onProgress(estimateTokens(accumulatedText));
        }
    }
    const jsonText = accumulatedText.trim();
    let parsedResponse = JSON.parse(jsonText) as GeminiUpdatePayload;

    if (!parsedResponse.newDocuments || !parsedResponse.updatedDocuments || !parsedResponse.deletedDocumentIds || !parsedResponse.summary || !parsedResponse.thinkingProcess) {
        throw new Error("A resposta da IA está faltando campos obrigatórios.");
    }
    
    parsedResponse = sanitizeGeminiResponse(parsedResponse);

    return { payload: parsedResponse, rawJson: jsonText };

  } catch (error) {
    console.error("Erro ao chamar a API Gemini para integração de ideia:", error);
    throw new Error("Falha ao obter uma resposta válida da IA. A ideia pode ser muito complexa ou o serviço pode estar indisponível.");
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

    try {
        const responseStream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: updatePayloadSchema,
                maxOutputTokens: config.maxOutputTokens,
                thinkingConfig: { thinkingBudget: config.thinkingBudget },
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
        let parsedResponse = JSON.parse(jsonText) as GeminiUpdatePayload;

        if (!parsedResponse.newDocuments || !parsedResponse.updatedDocuments || !parsedResponse.deletedDocumentIds || !parsedResponse.summary || !parsedResponse.thinkingProcess) {
            throw new Error("A resposta da IA está faltando campos obrigatórios.");
        }
        
        parsedResponse = sanitizeGeminiResponse(parsedResponse);

        return { payload: parsedResponse, rawJson: jsonText };

    } catch (error) {
        console.error("Erro ao chamar a API Gemini para atualização global:", error);
        throw new Error("Falha ao obter uma resposta válida da IA para a atualização global. A instrução pode ser muito complexa ou o serviço pode estar indisponível.");
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