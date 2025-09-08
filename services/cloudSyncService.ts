import { Document, CloudVersions, Version } from '../types';

interface CloudData {
    gdd: Document[];
    script: Document[];
}

export async function saveToCloud(url: string, adminKey: string, versionName: string, data: CloudData): Promise<Version> {
    const sanitizedUrl = url.replace(/\/$/, ''); // Remove trailing slash
    try {
        const response = await fetch(`${sanitizedUrl}/versions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'manual',
                name: versionName,
                gddData: data
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro do servidor: ${response.status} - ${errorText}`);
        }

        return await response.json();
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
