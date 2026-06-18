// ============================================
// CONFIGURAÇÃO DINÂMICA DE AMBIENTE
// ============================================

const CONFIG = {
    // Detectar ambiente automaticamente
    get basePath() {
        // Verificar se está no GitHub Pages
        if (window.location.hostname.includes('github.io')) {
            const pathParts = window.location.pathname.split('/');
            // Se tiver mais de 2 partes (ex: /TripPlanner/), usar a primeira
            if (pathParts.length > 1 && pathParts[1]) {
                return `/${pathParts[1]}/`;
            }
            return '/';
        }
        // Live Server ou localhost
        return '/';
    },
    
    get isGitHubPages() {
        return window.location.hostname.includes('github.io');
    },
    
    get isLocalhost() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1';
    },
    
    // URLs base para diferentes ambientes
    get appUrl() {
        if (this.isGitHubPages) {
            const base = window.location.origin;
            const path = this.basePath;
            return `${base}${path}`;
        }
        // Localhost
        return `${window.location.origin}/`;
    }
};

// Função utilitária para construir URLs
function buildUrl(path) {
    // Remove barras duplicadas
    const base = CONFIG.appUrl.endsWith('/') ? CONFIG.appUrl : CONFIG.appUrl + '/';
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return base + cleanPath;
}

// Exportar para uso global
window.CONFIG = CONFIG;
window.buildUrl = buildUrl;