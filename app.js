const API_BASE = '/.netlify/functions';
let currentUser = null;
let currentUserData = null;
let allArticles = [];
let currentFilter = 'all';
let currentSearch = '';
let uploadedPdfUrl = null;
let uploadedPdfFileName = null;

async function init() {
    setupEventListeners();
    await loadArticles();
    renderHomePage();
    renderArticlesPage();
}

function setupEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            if (page === 'admin' && !currentUser) {
                showModal('loginModal');
                return;
            }
            showPage(page);
        });
    });

    document.getElementById('loginNavBtn').addEventListener('click', () => showModal('loginModal'));
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('loginSubmit').addEventListener('click', handleLogin);
    document.getElementById('loginModalClose').addEventListener('click', () => closeModal('loginModal'));
    document.getElementById('articleModalClose').addEventListener('click', () => closeModal('articleModal'));

    document.getElementById('searchInput').addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase();
        renderArticlesPage();
    });

    document.querySelectorAll('.category-filter').forEach(filter => {
        filter.addEventListener('click', () => {
            document.querySelectorAll('.category-filter').forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            currentFilter = filter.dataset.category;
            renderArticlesPage();
        });
    });

    const uploadArea = document.getElementById('pdfUploadArea');
    const fileInput = document.getElementById('pdfFileInput');
    
    fileInput.addEventListener('change', handleFileSelect);

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            fileInput.files = files;
            handleFileSelect({ target: fileInput });
        }
    });

    document.getElementById('publishBtn').addEventListener('click', handlePublishArticle);
    document.getElementById('heroReadMore').addEventListener('click', () => showPage('articles'));
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a PDF file');
        return;
    }

    const uploadStatus = document.getElementById('uploadStatus');
    const uploadPrompt = document.getElementById('uploadPrompt');
    
    uploadPrompt.classList.add('hidden');
    uploadStatus.classList.remove('hidden');
    uploadStatus.innerHTML = '<p>Uploading PDF...</p>';

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE}/upload-pdf`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            uploadedPdfUrl = result.url;
            uploadedPdfFileName = result.fileName;
            uploadStatus.innerHTML = `<p style="color:#059669">PDF uploaded: ${file.name}</p>`;
            document.getElementById('articleFormSection').classList.remove('hidden');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Upload error:', error);
        uploadStatus.innerHTML = `<p style="color:#dc2626">Upload failed: ${error.message}</p>`;
        uploadPrompt.classList.remove('hidden');
    }
}

async function loadArticles() {
    try {
        const response = await fetch(`${API_BASE}/firebase-api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getArticles' })
        });

        const result = await response.json();
        allArticles = result.success ? result.articles : [];
    } catch (error) {
        console.error('Error loading articles:', error);
        allArticles = [];
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!email || !password) {
        errorDiv.textContent = 'Please enter email and password';
        errorDiv.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/firebase-api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'login',
                data: { email, password }
            })
        });

        const result = await response.json();

        if (result.success) {
            currentUser = { token: result.token };
            currentUserData = result.user;
            updateUIForUser();
            closeModal('loginModal');
            showPage('admin');
            renderAdminPage();
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
            errorDiv.classList.add('hidden');
        } else {
            errorDiv.textContent = 'Invalid email or password';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Login failed';
        errorDiv.classList.remove('hidden');
    }
}

function handleLogout() {
    currentUser = null;
    currentUserData = null;
    updateUIForUser();
    showPage('home');
}

function updateUIForUser() {
    const loginBtn = document.getElementById('loginNavBtn');
    const userDisplay = document.getElementById('userDisplay');
    const userBadge = document.getElementById('userBadge');
    const adminNavLink = document.getElementById('adminNavLink');

    if (currentUser && currentUserData) {
        loginBtn.classList.add('hidden');
        userDisplay.classList.remove('hidden');
        adminNavLink.classList.remove('hidden');
        const roleEmoji = currentUserData.role === 'admin' ? '👑' : '✍️';
        userBadge.textContent = `${roleEmoji} ${currentUserData.fullName}`;
        userBadge.className = `user-badge ${currentUserData.role}`;
    } else {
        loginBtn.classList.remove('hidden');
        userDisplay.classList.add('hidden');
        adminNavLink.classList.add('hidden');
    }
}

async function handlePublishArticle() {
    if (!uploadedPdfUrl) {
        alert('Please upload a PDF first');
        return;
    }

    const title = document.getElementById('articleTitle').value;
    const category = document.getElementById('articleCategory').value;
    const author = document.getElementById('articleAuthor').value;
    const excerpt = document.getElementById('articleExcerpt').value;
    const featured = document.getElementById('articleFeatured').checked;

    if (!title || !author || !excerpt) {
        alert('Please fill in all required fields');
        return;
    }

    const article = {
        title,
        category,
        author,
        authorName: author,
        authorUid: currentUserData?.uid || 'unknown',
        date: new Date().toISOString().split('T')[0],
        excerpt,
        content: '',
        featured,
        pdfUrl: uploadedPdfUrl,
        pdfFileName: uploadedPdfFileName
    };

    try {
        const response = await fetch(`${API_BASE}/firebase-api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'addArticle',
                data: {
                    userToken: currentUser.token,
                    article
                }
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Article published successfully!');
            
            document.getElementById('articleTitle').value = '';
            document.getElementById('articleAuthor').value = '';
            document.getElementById('articleExcerpt').value = '';
            document.getElementById('articleFeatured').checked = false;
            document.getElementById('articleFormSection').classList.add('hidden');
            document.getElementById('uploadPrompt').classList.remove('hidden');
            document.getElementById('uploadStatus').classList.add('hidden');
            document.getElementById('pdfFileInput').value = '';
            uploadedPdfUrl = null;
            uploadedPdfFileName = null;
            
            await loadArticles();
            renderHomePage();
            renderArticlesPage();
            renderAdminPage();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Publish error:', error);
        alert('Failed to publish article');
    }
}

async function deleteArticle(articleId) {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
        const response = await fetch(`${API_BASE}/firebase-api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'deleteArticle',
                data: {
                    userToken: currentUser.token,
                    articleId
                }
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Article deleted successfully!');
            await loadArticles();
            renderHomePage();
            renderArticlesPage();
            renderAdminPage();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete article');
    }
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`[data-page="${pageId}"]`);
    if (activeLink) activeLink.classList.add('active');
    window.scrollTo(0, 0);
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function renderHomePage() {
    const featured = allArticles.find(a => a.featured) || allArticles[0];
    
    if (featured) {
        document.getElementById('heroTitle').textContent = featured.title;
        document.getElementById('heroExcerpt').textContent = featured.excerpt;
    }

    const grid = document.getElementById('homeArticlesGrid');
    const latestArticles = allArticles.slice(0, 6);
    
    if (latestArticles.length === 0) {
        grid.innerHTML = '<div class="loading">No articles yet</div>';
        return;
    }

    grid.innerHTML = latestArticles.map(article => createArticleCard(article)).join('');
    attachArticleCardListeners();
}

function renderArticlesPage() {
    let filtered = allArticles;

    if (currentFilter !== 'all') {
        filtered = filtered.filter(a => a.category === currentFilter);
    }

    if (currentSearch) {
        filtered = filtered.filter(a => 
            a.title.toLowerCase().includes(currentSearch) ||
            a.excerpt.toLowerCase().includes(currentSearch)
        );
    }

    document.getElementById('articleCount').textContent = `Showing ${filtered.length} article${filtered.length !== 1 ? 's' : ''}`;

    const grid = document.getElementById('articlesGrid');
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="loading">No articles found</div>';
        return;
    }

    grid.innerHTML = filtered.map(article => createArticleCard(article)).join('');
    attachArticleCardListeners();
}

function renderAdminPage() {
    const list = document.getElementById('articleList');
    
    if (allArticles.length === 0) {
        list.innerHTML = '<div class="loading">No articles published yet</div>';
        return;
    }

    list.innerHTML = allArticles.map(article => `
        <div class="article-list-item">
            <div>
                <h4 style="font-weight:600">${article.title} ${article.featured ? '⭐' : ''}</h4>
                <p style="font-size:0.875rem;color:#666">
                    ${article.category} • ${article.authorName || article.author} • ${formatDate(article.date)}
                </p>
            </div>
            <div class="article-actions">
                <button class="btn btn-primary" onclick="openArticleModal('${article.id}')">View</button>
                <button class="btn btn-danger" onclick="deleteArticle('${article.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function createArticleCard(article) {
    const icon = getCategoryIcon(article.category);
    return `
        <div class="article-card" data-article-id="${article.id}">
            <div class="article-image">${icon}</div>
            <div class="article-content">
                <span class="article-category">${article.category}</span>
                <h3 class="article-title">${article.title}</h3>
                <p class="article-excerpt">${article.excerpt}</p>
                <div class="article-meta">
                    <span>By ${article.authorName || article.author}</span>
                    <span>${formatDate(article.date)}</span>
                </div>
            </div>
        </div>
    `;
}

function attachArticleCardListeners() {
    document.querySelectorAll('.article-card').forEach(card => {
        card.addEventListener('click', () => {
            const articleId = card.dataset.articleId;
            openArticleModal(articleId);
        });
    });
}

function openArticleModal(articleId) {
    const article = allArticles.find(a => a.id === articleId);
    if (!article) return;

    document.getElementById('modalCategory').textContent = article.category;
    document.getElementById('modalTitle').textContent = article.title;
    document.getElementById('modalMeta').textContent = `By ${article.authorName || article.author} • ${formatDate(article.date)}`;
    
    if (article.pdfUrl) {
        document.getElementById('pdfViewer').src = article.pdfUrl;
    }

    showModal('articleModal');
}

function getCategoryIcon(category) {
    const icons = {
        news: '📰',
        sports: '🏀',
        arts: '🎭',
        academics: '📚',
        opinion: '💭'
    };
    return icons[category] || '📰';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

document.addEventListener('DOMContentLoaded', init);