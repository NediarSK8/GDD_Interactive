import { Document, CloudVersions, Version } from '../types';

interface CloudData {
    gdd: Document[];
    script: Document[];
}

/**
 * Converts a data URL string into a Blob object.
 * @param dataurl The data URL to convert.
 * @returns A Blob object.
 */
function dataURLtoBlob(dataurl: string): Blob {
    const arr = dataurl.split(',');
    if (arr.length < 2) {
        throw new Error('Invalid data URL format for blob conversion');
    }
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
      throw new Error('Could not parse MIME type from data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}


export async function saveVersionToCloud(url: string, adminKey: string, data: CloudData, options: { type: 'manual' | 'automatic', name?: string }): Promise<Version> {
    const sanitizedUrl = url.replace(/\/$/, '');

    // 1. Deep clone the data to avoid mutating the application's state directly.
    const dataToProcess: CloudData = JSON.parse(JSON.stringify(data));

    // 2. Collect all upload promises for new images (base64).
    const imageUploadPromises: Promise<void>[] = [];
    const allDocuments = [...dataToProcess.gdd, ...dataToProcess.script];

    for (const doc of allDocuments) {
        if (!doc.content || !Array.isArray(doc.content)) continue;
        
        for (const block of doc.content) {
            // Check if it's an image block with a base64 source
            if (block.type === 'image' && block.src && block.src.startsWith('data:image')) {
                
                const uploadPromise = (async () => {
                    try {
                        const blob = dataURLtoBlob(block.src);
                        const file = new File([blob], `image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });

                        const formData = new FormData();
                        formData.append('file', file);

                        const response = await fetch(`${sanitizedUrl}/upload-imagem`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${adminKey}`,
                            },
                            body: formData,
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Falha no upload da imagem: ${response.status} - ${errorText}`);
                        }

                        const result = await response.json();
                        if (!result.url) {
                            throw new Error('A resposta do upload de imagem não continha uma URL.');
                        }
                        
                        // Replace the base64 src with the returned URL in our cloned data object
                        block.src = result.url;
                        
                    } catch (uploadError) {
                        console.error("Erro ao processar e fazer upload de uma imagem:", uploadError);
                        throw uploadError; // Propagate the error to Promise.all
                    }
                })();
                imageUploadPromises.push(uploadPromise);
            }
        }
    }

    try {
        // 3. Wait for all image uploads to complete before proceeding.
        await Promise.all(imageUploadPromises);
    
        // 4. With images uploaded and src's updated, save the cleaned GDD data as a new version.
        const versionResponse = await fetch(`${sanitizedUrl}/versions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: options.type,
                name: options.name,
                gddData: dataToProcess
            }),
        });

        if (!versionResponse.ok) {
            const errorText = await versionResponse.text();
            throw new Error(`Erro do servidor ao salvar a versão: ${versionResponse.status} - ${errorText}`);
        }

        return await versionResponse.json();

    } catch (error) {
        console.error("Falha ao salvar versão na nuvem:", error);
        throw new Error(`Falha na comunicação com o servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
}

export async function getVersions(url: string, accessKey: string): Promise<CloudVersions> {
    const sanitizedUrl = url.replace(/\/$/, '');
    try {
        const response = await fetch(`${sanitizedUrl}/versions`, {
            method: 'GET',
            headers: {
                'X-Access-Key': accessKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();

        if (!data || !Array.isArray(data.manual) || !Array.isArray(data.automatic)) {
            throw new Error("Dados de versões recebidos da nuvem estão em um formato inválido.");
        }

        return data as CloudVersions;

    } catch (error) {
        console.error("Falha ao buscar versões da nuvem:", error);
        throw new Error(`Falha na comunicação com o servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
}

export async function loadVersion(url: string, accessKey: string, versionId: string): Promise<CloudData> {
    const sanitizedUrl = url.replace(/\/$/, '');
     try {
        const response = await fetch(`${sanitizedUrl}/versions/${versionId}`, {
            method: 'GET',
            headers: {
                'X-Access-Key': accessKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Simple validation
        if (!data || !Array.isArray(data.gdd) || !Array.isArray(data.script)) {
            throw new Error("Dados da versão recebidos da nuvem estão em um formato inválido.");
        }

        return data as CloudData;
    } catch (error) {
        console.error("Falha ao carregar versão da nuvem:", error);
        throw new Error(`Falha na comunicação com o servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
}

export async function getLatestVersionMeta(url: string, accessKey: string): Promise<Version | null> {
    const sanitizedUrl = url.replace(/\/$/, '');
    try {
        const response = await fetch(`${sanitizedUrl}/versions/latest/meta`, {
            method: 'GET',
            headers: {
                'X-Access-Key': accessKey,
            },
        });

        if (response.status === 404) {
            // No versions found on the server, which is not an error.
            return null;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();

        if (!data || !data.id || !data.timestamp) {
            throw new Error("Metadados da versão mais recente recebidos em formato inválido.");
        }

        return data as Version;

    } catch (error) {
        console.error("Falha ao buscar metadados da versão mais recente:", error);
        // Re-throw to be handled by the caller, as it's an actual network/parse error
        throw new Error(`Falha na comunicação com o servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
}