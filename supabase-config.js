// ============================================
// SUPABASE CONFIGURATION
// ============================================

// SUBSTITUA PELAS SUAS CREDENCIAIS DO SUPABASE!
const SUPABASE_URL = 'https://forpfassxqfjwqhaotod.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jYYdY6U6W7CnUCHJPcyu-Q_NGN-S3u5';

// Criar cliente Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// UTILITÁRIOS GLOBAIS
// ============================================

// Formatar data
function formatDate(date, format = 'dd/mm/yyyy') {
    if (!date) return '';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    
    if (format === 'dd/mm/yyyy') return `${day}/${month}/${year}`;
    if (format === 'dd/mm') return `${day}/${month}`;
    return `${day}/${month}/${year} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// Formatar moeda
function formatCurrency(value) {
    if (!value && value !== 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Formatar tempo relativo (há 2 horas, ontem, etc)
function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Agora mesmo';
    if (minutes < 60) return `Há ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    if (hours < 24) return `Há ${hours} hora${hours !== 1 ? 's' : ''}`;
    if (days < 7) return `Há ${days} dia${days !== 1 ? 's' : ''}`;
    
    return formatDate(date, 'dd/mm/yyyy');
}

// Escapar HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Debounce para pesquisa
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Verificar autenticação
async function checkAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}

// Pegar usuário atual
async function getCurrentUser() {
    const { data: { user } } = await db.auth.getUser();
    return user;
}

// Pegar perfil do usuário
async function getUserProfile(userId = null) {
    const id = userId || (await getCurrentUser())?.id;
    if (!id) return null;
    
    const { data, error } = await db
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) return null;
    return data;
}

// Upload de imagem
async function uploadImage(file, bucket, folder = '') {
    const user = await getCurrentUser();
    const fileName = `${folder ? folder + '/' : ''}${user.id}_${Date.now()}.jpg`;
    const filePath = `${fileName}`;
    
    const { error } = await db.storage
        .from(bucket)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });
    
    if (error) throw error;
    
    const { data } = db.storage
        .from(bucket)
        .getPublicUrl(filePath);
    
    return data.publicUrl;
}

// ============================================
// EXPORTAR PARA USO GLOBAL
// ============================================
window.db = db;
window.formatDate = formatDate;
window.formatCurrency = formatCurrency;
window.formatRelativeTime = formatRelativeTime;
window.escapeHtml = escapeHtml;
window.debounce = debounce;
window.checkAuth = checkAuth;
window.getCurrentUser = getCurrentUser;
window.getUserProfile = getUserProfile;
window.uploadImage = uploadImage;