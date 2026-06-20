// ============================================
// TRIP PLANNER - APP.JS (VERSÃO COMPLETA)
// Com sistema de convites e colaboração
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
// ============================================
// AUTH CHECK (COM REDIRECIONAMENTO DE CONVITE)
// ============================================
async function checkAuthAndLoad() {
    console.log('🔐 Verificando autenticação...');
    
    const session = await checkAuth();
    if (!session) return;
    
    currentUser = session.user;
    console.log('✅ Usuário autenticado:', currentUser.email);
    
    // Verificar se há convite pendente
    const pendingToken = sessionStorage.getItem('pendingInviteToken');
    if (pendingToken) {
        sessionStorage.removeItem('pendingInviteToken');
        // USANDO buildUrl para redirecionar para join.html
        window.location.href = buildUrl(`join.html?token=${pendingToken}`);
        return;
    }
    
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
// ============================================
// LOAD TRIPS FOR SIDEBAR (COM APAGAR E SAIR)
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
        // Buscar viagens onde o usuário é DONO
        const { data: ownTrips, error: ownError } = await db
            .from('trips')
            .select('*')
            .eq('user_id', currentUser.id);
        
        if (ownError) {
            console.error('❌ Erro ao buscar viagens próprias:', ownError);
        }
        
        // Buscar viagens onde o usuário é MEMBRO APROVADO
        const { data: memberTrips, error: memberError } = await db
            .from('trip_members')
            .select(`
                trip_id,
                trips:trips (*)
            `)
            .eq('user_id', currentUser.id)
            .eq('status', 'approved');
        
        if (memberError) {
            console.error('❌ Erro ao buscar viagens como membro:', memberError);
        }
        
        // Combinar viagens
        let allTrips = [];
        
        if (ownTrips && ownTrips.length > 0) {
            allTrips = [...allTrips, ...ownTrips.map(t => ({ ...t, role: 'owner' }))];
        }
        
        if (memberTrips && memberTrips.length > 0) {
            const memberTripData = memberTrips.map(m => ({ ...m.trips, role: 'member' }));
            allTrips = [...allTrips, ...memberTripData];
        }
        
        // Remover duplicatas
        const uniqueTrips = [];
        const seenIds = new Set();
        for (const trip of allTrips) {
            if (trip && trip.id && !seenIds.has(trip.id)) {
                seenIds.add(trip.id);
                uniqueTrips.push(trip);
            }
        }
        
        // Ordenar por data de criação
        const sortedTrips = uniqueTrips.sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        console.log(`✅ ${sortedTrips.length} viagens encontradas`);
        
        const container = document.getElementById('sidebarTripsList');
        if (!container) return;
        
        if (sortedTrips.length === 0) {
            container.innerHTML = `
                <div class="sidebar-item" data-action="create-trip">
                    <i class="fas fa-plus-circle"></i>
                    <span>Criar primeira viagem</span>
                </div>
            `;
            return;
        }
        
        container.innerHTML = sortedTrips.map(trip => {
            const isOwner = trip.role === 'owner';
            return `
                <div class="sidebar-trip-item" style="margin-bottom: 4px;">
                    <div class="sidebar-item" data-trip-id="${trip.id}" data-action="select-trip" style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--gray-50);">
                        <i class="fas fa-map-marker-alt"></i>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <strong style="font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(trip.title)}</strong>
                                <span style="font-size: 11px;">${isOwner ? '👑' : '🤝'}</span>
                            </div>
                            <div style="font-size: 11px; color: var(--gray-500);">
                                ${trip.start_date ? formatDate(trip.start_date) : 'Data não definida'} 
                                ${trip.end_date ? `- ${formatDate(trip.end_date)}` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 4px; padding: 0 12px 8px 12px;">
                        ${isOwner ? `
                            <button class="btn-danger" style="flex: 1; padding: 4px 8px; font-size: 11px; border: none; border-radius: var(--radius-sm); cursor: pointer;" 
                                    onclick="event.stopPropagation(); confirmDeleteTrip('${trip.id}', '${escapeHtml(trip.title)}')">
                                <i class="fas fa-trash"></i> Apagar
                            </button>
                        ` : `
                            <button class="btn-secondary" style="flex: 1; padding: 4px 8px; font-size: 11px; border: none; border-radius: var(--radius-sm); cursor: pointer; background: var(--gray-200);" 
                                    onclick="event.stopPropagation(); confirmLeaveTrip('${trip.id}', '${escapeHtml(trip.title)}')">
                                <i class="fas fa-sign-out-alt"></i> Sair
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
        
        // Adicionar event listeners para selecionar viagem
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
// LOAD TIMELINE (COM ROTEIRO VINCULADO)
// ============================================
async function loadTimeline() {
    showLoading();
    
    // Buscar posts com informações do roteiro
    const { data: posts, error } = await db
        .from('social_posts')
        .select(`
            *,
            profiles:user_id (name, avatar_url),
            trips:trips (title),
            itinerary_items:itinerary_item_id (title, day_number)
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
        container.innerHTML = posts.map(post => {
            const itineraryTitle = post.itinerary_items?.title || null;
            const itineraryDay = post.itinerary_items?.day_number || null;
            
            return `
                <div class="timeline-item">
                    <div class="timeline-header">
                        <img src="${post.profiles?.avatar_url || 'https://via.placeholder.com/40'}" class="avatar-sm">
                        <div class="timeline-header-info">
                            <strong>${escapeHtml(post.profiles?.name || 'Usuário')}</strong>
                            <small>
                                ${post.trips?.title ? `📍 ${post.trips.title}` : '📝 Postagem avulsa'}
                                ${itineraryTitle ? ` • 📋 ${escapeHtml(itineraryTitle)}${itineraryDay ? ` (Dia ${itineraryDay})` : ''}` : ''}
                                <br>
                                <span style="font-size: 11px; color: var(--gray-400);">${formatRelativeTime(post.created_at)}</span>
                            </small>
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
            `;
        }).join('');
    }
    
    hideLoading();
}
// ============================================
// CREATE POST (COM ROTEIRO VINCULADO)
// ============================================
async function submitPost() {
    const caption = document.getElementById('postCaption')?.value || '';
    const tripId = document.getElementById('postTrip')?.value || null;
    const itineraryItemId = document.getElementById('postItineraryItem')?.value || null;
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
        itinerary_item_id: itineraryItemId,
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
    const tripSelect = document.getElementById('postTrip');
    const itinerarySelect = document.getElementById('postItineraryItem');
    
    if (captionInput) captionInput.value = '';
    if (costInput) costInput.value = '';
    if (tripSelect) tripSelect.value = '';
    if (itinerarySelect) {
        itinerarySelect.innerHTML = '<option value="">Selecione um roteiro</option>';
        itinerarySelect.disabled = true;
    }
    selectedRating = 0;
    selectedImageFile = null;
    if (imageInput) imageInput.value = '';
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) imagePreview.style.display = 'none';
    const stars = document.querySelectorAll('#postRating i');
    stars.forEach(star => {
        star.className = 'far fa-star';
    });
    
    await loadTimeline();
}

// ============================================
// CREATE TRIP
// ============================================
// ============================================
// CREATE TRIP (COM buildUrl)
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
    
    const { data, error } = await db.from('trips').insert({
        user_id: currentUser.id,
        title: title,
        destination: destination || null,
        start_date: startISO,
        end_date: endISO,
        created_at: new Date()
    }).select();
    
    hideLoading();
    
    if (error) {
        showToast('Erro ao criar viagem: ' + error.message, 'error');
        return;
    }
    
    showToast('Viagem criada com sucesso!', 'success');
    
    if (data && data[0]) {
        await db.from('trip_members').insert({
            trip_id: data[0].id,
            user_id: currentUser.id,
            status: 'approved',
            invited_at: new Date()
        });
        currentTripId = data[0].id;
    }
    
    await loadTripsForSidebar();
    
    // Redirecionar para detalhes da viagem usando buildUrl
    if (currentTripId) {
        window.location.href = buildUrl(`trip-detail.html?id=${currentTripId}`);
    }
}

// ============================================
// ADD COMMENT
// ============================================
// ============================================
// ADD COMMENT
// ============================================
async function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input) return;
    
    const comment = input.value.trim();
    if (!comment) {
        showToast('Digite um comentário', 'warning');
        return;
    }
    
    showLoading();
    
    const { error } = await db.from('post_comments').insert({
        post_id: postId,
        user_id: currentUser.id,
        comment: comment,
        created_at: new Date()
    });
    
    hideLoading();
    
    if (error) {
        showToast('Erro ao comentar', 'error');
        return;
    }
    
    input.value = '';
    showToast('Comentário adicionado!', 'success');
    await loadTimeline();
}

// ============================================
// LIKE POST
// ============================================
async function likePost(postId) {
    showLoading();
    
    // Verificar se já curtiu
    const { data: existing } = await db
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();
    
    if (existing) {
        // Remover like
        await db
            .from('post_likes')
            .delete()
            .eq('id', existing.id);
        
        // Decrementar likes no post
        await db.rpc('decrement_post_likes', { post_id: postId });
    } else {
        // Adicionar like
        await db.from('post_likes').insert({
            post_id: postId,
            user_id: currentUser.id,
            created_at: new Date()
        });
        
        // Incrementar likes no post
        await db.rpc('increment_post_likes', { post_id: postId });
    }
    
    hideLoading();
    await loadTimeline();
}

// ============================================
// EVENT LISTENERS (COM ROTEIRO VINCULADO)
// ============================================
function setupEventListeners() {
    console.log('🎯 Configurando event listeners...');
    
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
    
    // Listener para quando a viagem for alterada no modal de postagem
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'postTrip') {
            const tripId = e.target.value;
            loadItineraryItemsForPost(tripId);
        }
    });
    
    // Bottom navigation
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
                const { data: ownTrips } = await db
                    .from('trips')
                    .select('id, title')
                    .eq('user_id', currentUser.id);
                
                const { data: memberTrips } = await db
                    .from('trip_members')
                    .select('trip_id, trips:trips (id, title)')
                    .eq('user_id', currentUser.id)
                    .eq('status', 'approved');
                
                let allTrips = [];
                if (ownTrips) allTrips = [...allTrips, ...ownTrips];
                if (memberTrips) {
                    memberTrips.forEach(m => {
                        if (m.trips) allTrips.push(m.trips);
                    });
                }
                
                // Preencher select de viagens
                const tripSelect = document.getElementById('postTrip');
                if (tripSelect) {
                    tripSelect.innerHTML = '<option value="">Sem viagem (postagem avulsa)</option>' +
                        (allTrips || []).map(t => `<option value="${t.id}">✈️ ${escapeHtml(t.title)}</option>`).join('');
                }
                
                // Resetar select de roteiro
                const itinerarySelect = document.getElementById('postItineraryItem');
                if (itinerarySelect) {
                    itinerarySelect.innerHTML = '<option value="">Selecione um roteiro</option>';
                    itinerarySelect.disabled = true;
                }
                
                openModal('createPostModal');
            }
            else if (nav === 'details') {
                if (currentTripId) {
                    window.location.href = buildUrl('trip-detail.html?id=' + currentTripId);
                } else {
                    showToast('Selecione uma viagem no menu lateral', 'warning');
                }
            }
            else if (nav === 'costs') {
                if (currentTripId) {
                    window.location.href = buildUrl('costs.html?id=' + currentTripId);
                } else {
                    showToast('Selecione uma viagem no menu lateral', 'warning');
                }
            }
            else if (nav === 'chat') {
                if (currentTripId) {
                    window.location.href = buildUrl('chat.html?id=' + currentTripId);
                } else {
                    showToast('Selecione uma viagem no menu lateral', 'warning');
                }
            }
        });
    });
    
    // Sidebar actions
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', async () => {
            const action = item.dataset.action;
            const tripId = item.dataset.tripId;
            
            if (action === 'profile') {
                window.location.href = buildUrl('profile.html');
            } 
            else if (action === 'create-trip') {
                await createTrip();
            } 
            else if (action === 'select-trip' && tripId) {
                currentTripId = tripId;
                const { data: trips } = await db.from('trips').select('title').eq('id', tripId);
                const tripTitle = trips?.[0]?.title || 'Viagem';
                showToast('Viagem "' + tripTitle + '" selecionada!', 'success');
                closeSidebar();
            } 
            else if (action === 'search-friends') {
                showToast('Buscar amigos - Em breve!', 'info');
            } 
            else if (action === 'logout') {
                await db.auth.signOut();
                window.location.href = buildUrl('index.html');
            }
        });
    });
    
    // Profile avatar click
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.addEventListener('click', () => {
            window.location.href = buildUrl('profile.html');
        });
    }
}

// ============================================
// RPC FUNCTIONS (para likes)
// ============================================
// Estas funções precisam ser criadas no Supabase SQL Editor

// ============================================
// INIT
// ============================================
checkAuthAndLoad();

// Expor funções globalmente
window.submitPost = submitPost;
window.addComment = addComment;
window.likePost = likePost;
window.createTrip = createTrip;
window.loadTimeline = loadTimeline;

// ============================================
// CONFIRMAR APAGAR VIAGEM (ADMIN)
// ============================================
function confirmDeleteTrip(tripId, tripTitle) {
    // Criar modal de confirmação dinâmico
    const modal = document.createElement('div');
    modal.className = 'modal open';
    modal.style.display = 'flex';
    modal.id = 'deleteTripModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header" style="border-bottom-color: var(--danger);">
                <h3 style="color: var(--danger);">⚠️ Apagar Viagem</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 16px;">
                    Tem certeza que deseja apagar a viagem <strong>"${escapeHtml(tripTitle)}"</strong>?
                </p>
                <div style="background: var(--gray-50); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                    <p style="font-size: 13px; color: var(--gray-600);">
                        <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                        Esta ação irá:
                    </p>
                    <ul style="font-size: 13px; color: var(--gray-600); margin-left: 20px; margin-top: 4px;">
                        <li>Apagar a viagem e todos os dados relacionados</li>
                        <li>Remover todos os membros</li>
                        <li>Excluir roteiro, posts e mensagens</li>
                    </ul>
                    <p style="font-size: 13px; color: var(--danger); margin-top: 8px; font-weight: 600;">
                        Esta ação NÃO pode ser desfeita!
                    </p>
                </div>
                <div class="flex gap-1">
                    <button class="btn-secondary" style="flex: 1;" onclick="this.closest('.modal').remove()">Cancelar</button>
                    <button class="btn-danger" style="flex: 1;" onclick="deleteTrip('${tripId}')">
                        <i class="fas fa-trash"></i> Sim, Apagar
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ============================================
// APAGAR VIAGEM (ADMIN)
// ============================================
async function deleteTrip(tripId) {
    showLoading();
    
    // Fechar modal
    const modal = document.getElementById('deleteTripModal');
    if (modal) modal.remove();
    
    // Buscar todas as imagens para deletar do storage
    try {
        // Buscar posts com imagens
        const { data: posts } = await db
            .from('social_posts')
            .select('image_url')
            .eq('trip_id', tripId)
            .not('image_url', 'is', null);
        
        // Buscar itens do roteiro com imagens
        const { data: itineraryItems } = await db
            .from('itinerary_items')
            .select('planned_photo_url, actual_photo_url')
            .eq('trip_id', tripId);
        
        // Coletar todas as URLs de imagem
        const imageUrls = [];
        if (posts) {
            posts.forEach(p => {
                if (p.image_url) imageUrls.push(p.image_url);
            });
        }
        if (itineraryItems) {
            itineraryItems.forEach(item => {
                if (item.planned_photo_url) imageUrls.push(item.planned_photo_url);
                if (item.actual_photo_url) imageUrls.push(item.actual_photo_url);
            });
        }
        
        // Excluir imagens do storage
        for (const url of imageUrls) {
            try {
                // Extrair o caminho da URL
                const urlParts = url.split('/');
                const bucketIndex = urlParts.indexOf('post-images') !== -1 ? 'post-images' : 
                                   urlParts.indexOf('itinerary-photos') !== -1 ? 'itinerary-photos' : null;
                if (bucketIndex) {
                    const startIdx = urlParts.indexOf(bucketIndex);
                    const filePath = urlParts.slice(startIdx + 1).join('/');
                    if (filePath) {
                        await db.storage.from(bucketIndex).remove([filePath]);
                    }
                }
            } catch (storageError) {
                console.warn('Erro ao excluir imagem do storage:', storageError);
            }
        }
    } catch (err) {
        console.warn('Erro ao processar imagens:', err);
    }
    
    // Excluir a viagem (ON DELETE CASCADE vai remover tudo)
    const { error } = await db
        .from('trips')
        .delete()
        .eq('id', tripId)
        .eq('user_id', currentUser.id); // Garantir que só o admin pode apagar
    
    hideLoading();
    
    if (error) {
        showToast('Erro ao apagar viagem: ' + error.message, 'error');
        return;
    }
    
    showToast('Viagem apagada com sucesso!', 'success');
    
    // Limpar currentTripId se for a viagem atual
    if (currentTripId === tripId) {
        currentTripId = null;
    }
    
    // Recarregar lista de viagens
    await loadTripsForSidebar();
}

// ============================================
// CONFIRMAR SAIR DA VIAGEM (MEMBRO)
// ============================================
function confirmLeaveTrip(tripId, tripTitle) {
    // Criar modal de confirmação dinâmico
    const modal = document.createElement('div');
    modal.className = 'modal open';
    modal.style.display = 'flex';
    modal.id = 'leaveTripModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header" style="border-bottom-color: var(--warning);">
                <h3 style="color: var(--warning);">🚪 Sair da Viagem</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 16px;">
                    Tem certeza que deseja sair da viagem <strong>"${escapeHtml(tripTitle)}"</strong>?
                </p>
                <div style="background: var(--gray-50); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                    <p style="font-size: 13px; color: var(--gray-600);">
                        <i class="fas fa-info-circle" style="color: var(--warning);"></i>
                        Você será removido da viagem, mas ela continuará para os outros membros.
                    </p>
                </div>
                <div class="flex gap-1">
                    <button class="btn-secondary" style="flex: 1;" onclick="this.closest('.modal').remove()">Cancelar</button>
                    <button class="btn-danger" style="flex: 1;" onclick="leaveTrip('${tripId}')">
                        <i class="fas fa-sign-out-alt"></i> Sim, Sair
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ============================================
// SAIR DA VIAGEM (MEMBRO)
// ============================================
async function leaveTrip(tripId) {
    showLoading();
    
    // Fechar modal
    const modal = document.getElementById('leaveTripModal');
    if (modal) modal.remove();
    
    // Remover o usuário da trip_members
    const { error } = await db
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', currentUser.id);
    
    hideLoading();
    
    if (error) {
        showToast('Erro ao sair da viagem: ' + error.message, 'error');
        return;
    }
    
    showToast('Você saiu da viagem!', 'success');
    
    // Limpar currentTripId se for a viagem atual
    if (currentTripId === tripId) {
        currentTripId = null;
    }
    
    // Recarregar lista de viagens
    await loadTripsForSidebar();
}
// ============================================
// CARREGAR ROTEIROS DA VIAGEM SELECIONADA
// ============================================
async function loadItineraryItemsForPost(tripId) {
    const select = document.getElementById('postItineraryItem');
    if (!select) return;
    
    if (!tripId) {
        select.innerHTML = '<option value="">Selecione um roteiro</option>';
        select.disabled = true;
        return;
    }
    
    showLoading();
    
    const { data, error } = await db
        .from('itinerary_items')
        .select('id, title, day_number')
        .eq('trip_id', tripId)
        .order('day_number', { ascending: true });
    
    hideLoading();
    
    if (error || !data || data.length === 0) {
        select.innerHTML = '<option value="">Nenhum roteiro cadastrado</option>';
        select.disabled = true;
        return;
    }
    
    select.innerHTML = '<option value="">Selecione um roteiro</option>' +
        data.map(item => `<option value="${item.id}">📅 Dia ${item.day_number} - ${escapeHtml(item.title)}</option>`).join('');
    select.disabled = false;
}