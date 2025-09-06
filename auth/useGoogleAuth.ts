import { useState, useEffect } from 'react';

const GOOGLE_CLIENT_ID = 'nil';

declare global {
  interface Window {
    handleGoogleAuthCallback: (token: string) => void;
  }
}

export const useGoogleAuth = () => {
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        if (window.opener && window.location.hash.includes('access_token')) {
            try {
                const params = new URLSearchParams(window.location.hash.substring(1));
                const token = params.get('access_token');
                
                if (token && window.opener.handleGoogleAuthCallback) {
                    window.opener.handleGoogleAuthCallback(token);
                }
            } catch (e) {
                console.error('Erro ao processar o callback de autenticação do Google:', e);
            } finally {
                window.close();
            }
            return; 
        }

        window.handleGoogleAuthCallback = (token: string) => {
            if (token) {
                setGoogleAccessToken(token);
            }
        };

        return () => {
            delete (window as any).handleGoogleAuthCallback;
        };
    }, []);

    const handleGoogleAuthClick = () => {
        setAuthError(null);
        if (GOOGLE_CLIENT_ID.startsWith('SEU_ID_DE_CLIENTE_AQUI')) {
            setAuthError("Por favor, configure o ID de Cliente do Google para usar a integração com o Google Drive.");
            return;
        }

        let redirectUri;
        try {
            const topLocation = window.top!.location;
            redirectUri = `${topLocation.protocol}//${topLocation.host}${topLocation.pathname}`;
        } catch (e) {
            console.warn("Não foi possível acessar window.top.location para determinar a URI de redirecionamento, recorrendo a window.location.", e);
            const ownLocation = window.location;
            redirectUri = `${ownLocation.protocol}//${ownLocation.host}${ownLocation.pathname}`;
        }
        
        const scope = 'https://www.googleapis.com/auth/drive.file';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `scope=${encodeURIComponent(scope)}&` +
          `include_granted_scopes=true&` +
          `response_type=token&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `client_id=${GOOGLE_CLIENT_ID}`;
    
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        window.open(
            authUrl,
            'googleAuth',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
        );
    };

    return {
        googleAccessToken,
        authError,
        handleGoogleAuthClick,
    };
};
