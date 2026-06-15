// ============================================
// TRIP PLANNER - APP.JS (VERSÃO COMPLETA)
// Lógica Principal com todas as telas integradas
// ============================================

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let currentUser = null;
let currentProfile = null;
let currentTripId = null;
let selectedRating = 0;
let selectedImageFile = null;
let currentNav = 'timeline';

// ============================================
// UTILITÁRIOS
// ============================================
function showLoading() {
    const loading = document.getElementById('loading-screen');
    if (loading) loading.style.display = 'flex';
}

function hideLoading() {
    const loading = document.getElementById('loading-screen');
    if (loading) loading.style.display = 'none';
}

function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 10);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
    selectedImageFile = null;
    const imageInput = document.getElementById('postImage');
    if (imageInput) imageInput.value = '';
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) imagePreview.style.display = 'none';
    selectedRating = 0;
    const stars = document.querySelectorAll('#postRating i');
    stars.forEach(star => {
        star.className = 'far fa-star';
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

// ============================================
// RATING STARS
// ============================================
function setupRating() {
    const stars = document.querySelectorAll('#postRating i');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            selectedRating = rating;
            stars.forEach((s, index) => {
                if (index < rating) {
                    s.className = 'fas fa-star active';
                } else {
                    s.className = 'far fa-star';
                }
            });
        });
    });
}

// ============================================
// IMAGE PREVIEW
// ============================================
const imageInput = document.getElementById('postImage');
if (imageInput) {
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedImageFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                const preview = document.getElementById('imagePreview');
                const img = document.getElementById('previewImg');
                if (preview && img) {
                    img.src = event.target.result;
                    preview.style.display = 'block';
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

// ============================================
// AUTH CHECK
// ============================================
async function checkAuthAndLoad() {
    console.log('🔐 Verificando autenticação...');
    
    const session = await checkAuth();
    if (!session) return;
    
    currentUser = session.user;
    console.log('✅ Usuário autenticado:', currentUser.email);
    
    await loadUserProfile();
    await loadSidebarInfo();
    await loadTripsForSidebar();
    await loadTimeline();
    setupEventListeners();
    setupRating();
    
    console.log('🎉 App inicializado com sucesso!');
}

async function loadUserProfile() {
    currentProfile = await getUserProfile(currentUser.id);
    if (!currentProfile) {
        const { error } = await db.from('profiles').insert([
            { id: currentUser.id, name: currentUser.user_metadata?.name || 'Viajante', created_at: new Date() }
        ]);
        if (!error) {
            currentProfile = await getUserProfile(currentUser.id);
        }
    }
}

async function loadSidebarInfo() {
    const nameEl = document.getElementById('sidebarName');
    const emailEl = document.getElementById('sidebarEmail');
    const avatarEls = document.querySelectorAll('#sidebarAvatar, #profileAvatar, #postAvatar');
    
    if (nameEl) nameEl.textContent = currentProfile?.name || 'Viajante';
    if (emailEl) emailEl.textContent = currentUser.email;
    
    avatarEls.forEach(el => {
        if (el) el.src = currentProfile?.avatar_url || 'https://via.placeholder.com/40';
    });
}

// ============================================
// LOAD TRIPS FOR SIDEBAR
// ============================================
async function loadTripsForSidebar() {
    console.log('🔄 Carregando viagens para o sidebar...');
    
    if (!currentUser) {
        const session = await checkAuth();
        if (!session) return;
        currentUser = session.user;
    }
    
    console.log('👤 ID do usuário:', currentUser.id);
    
    try {
        const { data, error } = await db
            .from('trips')
            .select('*')
            .eq('user_id', currentUser.id);
        
        console.log('📊 Resultado da busca:', data);
        
        if (error) {
            console.error('❌ Erro na busca:', error);
            const container = document.getElementById('sidebarTripsList');
            if (container) {
                container.innerHTML = `
                    <div class="sidebar-item" style="color: var(--danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>Erro: ${error.message}</span>
                    </div>
                `;
            }
            return;
        }
        
        const container = document.getElementById('sidebarTripsList');
        if (!container) return;
        
        if (!data || data.length === 0) {
            console.log('📭 Nenhuma viagem encontrada');
            container.innerHTML = `
                <div class="sidebar-item" data-action="create-trip">
                    <i class="fas fa-plus-circle"></i>
                    <span>Criar primeira viagem</span>
                </div>
            `;
            return;
        }
        
        const sortedTrips = [...data].sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        console.log(`✅ ${sortedTrips.length} viagens encontradas`);
        
        container.innerHTML = sortedTrips.map(trip => `
            <div class="sidebar-item" data-trip-id="${trip.id}" data-action="select-trip" style="cursor: pointer;">
                <i class="fas fa-map-marker-alt"></i>
                <div style="flex: 1;">
                    <div><strong>${escapeHtml(trip.title)}</strong></div>
                    <div style="font-size: 11px; color: var(--gray-500);">
                        ${trip.start_date ? formatDate(trip.start_date) : 'Data não definida'} 
                        ${trip.end_date ? `- ${formatDate(trip.end_date)}` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        document.querySelectorAll('.sidebar-item[data-action="select-trip"]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const tripId = item.dataset.tripId;
                if (tripId) {
                    currentTripId = tripId;
                    const trip = sortedTrips.find(t => t.id === tripId);
                    showToast(`Viagem "${trip?.title}" selecionada!`, 'success');
                    closeSidebar();
                }
            });
        });
        
        if (sortedTrips.length > 0 && !currentTripId) {
            currentTripId = sortedTrips[0].id;
            console.log('🎯 Viagem atual selecionada:', currentTripId);
        }
        
    } catch (err) {
        console.error('❌ Erro inesperado:', err);
        const container = document.getElementById('sidebarTripsList');
        if (container) {
            container.innerHTML = `
                <div class="sidebar-item" style="color: var(--danger);">
                    <i class="fas fa-bug"></i>
                    <span>Erro: ${err.message}</span>
                </div>
            `;
        }
    }
}

// ============================================
// TIMELINE
// ============================================
async function loadTimeline() {
    showLoading();
    
    const { data: posts, error } = await db
        .from('social_posts')
        .select(`
            *,
            profiles:user_id (name, avatar_url),
            trips:trips (title)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
    
    const container = document.getElementById('timelineContainer');
    
    if (error || !posts || posts.length === 0) {
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-plane-departure"></i>
                    <p>Nenhuma postagem ainda</p>
                    <p style="font-size: 12px; margin-top: 8px;">Clique no botão 📸 para fazer sua primeira postagem!</p>
                </div>
            `;
        }
        hideLoading();
        return;
    }
    
    if (container) {
        container.innerHTML = posts.map(post => `
            <div class="timeline-item">
                <div class="timeline-header">
                    <img src="${post.profiles?.avatar_url || 'https://via.placeholder.com/40'}" class="avatar-sm">
                    <div class="timeline-header-info">
                        <strong>${escapeHtml(post.profiles?.name || 'Usuário')}</strong>
                        <small>${post.trips?.title ? `📍 ${post.trips.title} • ` : ''}${formatRelativeTime(post.created_at)}</small>
                    </div>
                </div>
                ${post.image_url ? `<img src="${post.image_url}" class="timeline-image">` : ''}
                <div class="timeline-caption">
                    ${escapeHtml(post.caption || '')}
                </div>
                ${post.actual_cost ? `<div class="timeline-cost">💰 ${formatCurrency(post.actual_cost)}</div>` : ''}
                ${post.rating ? `<div class="timeline-cost" style="color: var(--warning);">⭐ ${'★'.repeat(post.rating)}${'☆'.repeat(5-post.rating)}</div>` : ''}
                <div class="timeline-actions">
                    <button class="action-btn" data-post-id="${post.id}" data-action="like">
                        <i class="far fa-heart"></i> <span>${post.likes || 0}</span>
                    </button>
                    <button class="action-btn" data-post-id="${post.id}" data-action="comment">
                        <i class="far fa-comment"></i> Comentar
                    </button>
                </div>
                <div class="comments-section" id="comments-${post.id}">
                    <div class="comment-input">
                        <input type="text" placeholder="Adicionar comentário..." id="comment-input-${post.id}">
                        <button class="btn-secondary" onclick="addComment('${post.id}')">Enviar</button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    hideLoading();
}

// ============================================
// CREATE POST
// ============================================
async function submitPost() {
    const caption = document.getElementById('postCaption')?.value || '';
    const tripId = document.getElementById('postTrip')?.value || null;
    const cost = document.getElementById('postCost')?.value;
    const rating = selectedRating;
    
    if (!caption && !selectedImageFile) {
        showToast('Adicione uma foto ou uma descrição', 'error');
        return;
    }
    
    showLoading();
    
    let imageUrl = null;
    if (selectedImageFile) {
        try {
            imageUrl = await uploadImage(selectedImageFile, 'post-images', currentUser.id);
        } catch (error) {
            hideLoading();
            showToast('Erro ao fazer upload da imagem', 'error');
            return;
        }
    }
    
    const { error } = await db.from('social_posts').insert({
        user_id: currentUser.id,
        trip_id: tripId,
        image_url: imageUrl,
        caption: caption || null,
        actual_cost: cost ? parseFloat(cost) : null,
        rating: rating || null,
        created_at: new Date()
    });
    
    hideLoading();
    
    if (error) {
        showToast('Erro ao publicar postagem', 'error');
        return;
    }
    
    showToast('Postagem publicada com sucesso!', 'success');
    closeModal('createPostModal');
    
    const captionInput = document.getElementById('postCaption');
    const costInput = document.getElementById('postCost');
    if (captionInput) captionInput.value = '';
    if (costInput) costInput.value = '';
    selectedRating = 0;
    selectedImageFile = null;
    if (imageInput) imageInput.value = '';
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) imagePreview.style.display = 'none';
    
    await loadTimeline();
}

// ============================================
// CREATE TRIP
// ============================================
async function createTrip() {
    const title = prompt('Título da viagem:');
    if (!title) return;
    
    const destination = prompt('Destino (cidade, país):');
    const startDate = prompt('Data de início (DD/MM/AAAA):');
    const endDate = prompt('Data de fim (DD/MM/AAAA):');
    
    if (!startDate || !endDate) {
        showToast('Datas são obrigatórias', 'error');
        return;
    }
    
    const [startDay, startMonth, startYear] = startDate.split('/');
    const [endDay, endMonth, endYear] = endDate.split('/');
    const startISO = `${startYear}-${startMonth}-${startDay}`;
    const endISO = `${endYear}-${endMonth}-${endDay}`;
    
    showLoading();
    
    if (!currentUser) {
        const session = await checkAuth();
        if (!session) {
            hideLoading();
            showToast('Usuário não autenticado', 'error');
            return;
        }
        currentUser = session.user;
    }
    
    const { error } = await db.from('trips').insert({
        user_id: currentUser.id,
        title: title,
        destination: destination || null,
        start_date: startISO,
        end_date: endISO,
        created_at: new Date()
    });
    
    hideLoading();
    
    if (error) {
        showToast('Erro ao criar viagem: ' + error.message, 'error');
        return;
    }
    
    showToast('Viagem criada com sucesso!', 'success');
    await loadTripsForSidebar();
}

// ============================================
// EVENT LISTENERS (COM TODOS OS REDIRECIONAMENTOS)
// ============================================
function setupEventListeners() {
    // Menu lateral
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            if (sidebar) sidebar.classList.add('open');
            if (overlay) overlay.classList.add('active');
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }
    
    // Bottom navigation - CORRIGIDO COM REDIRECIONAMENTOS
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', async () => {
            const nav = item.dataset.nav;
            currentNav = nav;
            
            document.querySelectorAll('.nav-item').forEach(navItem => {
                navItem.classList.remove('active');
            });
            item.classList.add('active');
            
            if (nav === 'timeline') {
                await loadTimeline();
            } 
            else if (nav === 'register') {
                // Carregar viagens para o select
                const { data: trips } = await db
                    .from('trips')
                    .select('id, title')
                    .eq('user_id', currentUser.id);
                
                const select = document.getElementById('postTrip');
                if (select) {
                    select.innerHTML = '<option value="">Sem viagem (postagem avulsa)</option>' +
                        (trips || []).map(t => `<option value="${t.id}">✈️ ${escapeHtml(t.title)}</option>`).join('');
                }
                openModal('createPostModal');
            }
            else if (nav === 'details') {
                // REDIRECIONA PARA DETALHES DA VIAGEM
                if (currentTripId) {
                    window.location.href = `trip-detail.html?id=${currentTripId}`;
                } else {
                    showToast('Selecione uma viagem no menu lateral', 'warning');
                }
            }
            else if (nav === 'costs') {
                // REDIRECIONA PARA TELA DE CUSTOS
                if (currentTripId) {
                    window.location.href = `costs.html?id=${currentTripId}`;
                } else {
                    showToast('Selecione uma viagem no menu lateral', 'warning');
                }
            }
            else if (nav === 'chat') {
                // REDIRECIONA PARA CHAT
                if (currentTripId) {
                    window.location.href = `chat.html?id=${currentTripId}`;
                } else {
                    showToast('Selecione uma viagem no menu lateral', 'warning');
                }
            }
        });
    });
    
    // Sidebar actions - CORRIGIDO COM REDIRECIONAMENTOS
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', async () => {
            const action = item.dataset.action;
            const tripId = item.dataset.tripId;
            
            if (action === 'profile') {
                // REDIRECIONA PARA PERFIL
                window.location.href = 'profile.html';
            } 
            else if (action === 'create-trip') {
                await createTrip();
            } 
            else if (action === 'select-trip' && tripId) {
                currentTripId = tripId;
                const { data: trips } = await db.from('trips').select('title').eq('id', tripId);
                const tripTitle = trips?.[0]?.title || 'Viagem';
                showToast(`Viagem "${tripTitle}" selecionada!`, 'success');
                closeSidebar();
            } 
            else if (action === 'search-friends') {
                showToast('Buscar amigos - Em breve!', 'info');
            } 
            else if (action === 'logout') {
                await db.auth.signOut();
                window.location.href = 'index.html';
            }
        });
    });
    
    // Profile avatar click
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }
}

// ============================================
// INIT
// ============================================
checkAuthAndLoad();