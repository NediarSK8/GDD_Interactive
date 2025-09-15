export const APP_VERSION = '0.0.1';

// Lista de versões em ordem decrescente (mais nova primeiro)
export const CHANGELOG_VERSIONS = ['0.0.1'];

/**
 * Busca o conteúdo do arquivo de changelog para uma versão específica.
 * @param version A versão do changelog a ser buscada.
 * @returns Uma promessa que resolve para o conteúdo do arquivo em texto.
 */
export const getChangelogContent = async (version: string): Promise<string> => {
    try {
        // Assume que os arquivos de changelog estão na pasta public/changelog
        const response = await fetch(`/changelog/${version}.md`);
        if (!response.ok) {
            throw new Error(`Não foi possível buscar o changelog da versão ${version}. Status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error(error);
        return 'Falha ao carregar as notas da versão.';
    }
};
