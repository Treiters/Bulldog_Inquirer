import { auth, onAuthChange, login, logout, getArticles, addArticle, deleteArticle } from './firebase-config.js';

let currentUser = null;
let allArticles = [];
let currentFilter = 'all';
let currentSearch = '';
let archiveData = null;

async function init() {
    setupEventListeners();
    
    // Listen for auth state changes
    onAuthChange((user) => {
        currentUser = user;
        updateUIForUser();
        if (user && document.getElementById('admin').classList.contains('active')) {
            renderAdminPage();
        }
    });
    
    await loadArticles();
    await loadArchives();
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

    document.getElementById('publishBtn').addEventListener('click', handlePublishArticle);
    document.getElementById('heroReadMore').addEventListener('click', () => showPage('articles'));
    
    // Remove PDF upload functionality - manual upload only
    const uploadArea = document.getElementById('pdfUploadArea');
    uploadArea.innerHTML = `
        <p style="font-size:1.2rem;margin-bottom:1rem;color:#666">📁 Manual PDF Upload Required</p>
        <ol style="text-align:left;max-width:600px;margin:0 auto;color:#666;line-height:1.8">
            <li>Save your PDF to: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">pdfs/your-article.pdf</code></li>
            <li>Commit and push to GitHub</li>
            <li>Enter the filename below (e.g., <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">your-article.pdf</code>)</li>
        </ol>
        <div style="margin-top:2rem">
            <input type="text" id="pdfFileName" placeholder="Enter PDF filename (e.g., spring-2025.pdf)" 
                   style="width:100%;max-width:400px;padding:0.75rem;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:1rem">
            <button class="btn btn-primary" onclick="validatePdfFile()">Verify PDF</button>
        </div>
        <div id="pdfStatus" style="margin-top:1rem"></div>
    `;
    
    // Show form immediately
    document.getElementById('articleFormSection').classList.remove('hidden');
}

// Validate PDF exists in pdfs/ folder
window.validatePdfFile = async function() {
    const fileName = document.getElementById('pdfFileName').value.trim();
    const statusDiv = document.getElementById('pdfStatus');
    
    if (!fileName) {
        statusDiv.innerHTML = '<p style="color:#dc2626">Please enter a PDF filename</p>';
        return;
    }
    
    // Check if file exists
    const pdfUrl = `pdfs/${fileName}`;
    
    try {
        const response = await fetch(pdfUrl, { method: 'HEAD' });
        if (response.ok) {
            statusDiv.innerHTML = `<p style="color:#059669">✓ PDF found: ${fileName}</p>`;
            document.getElementById('pdfFileName').dataset.verified = pdfUrl;
        } else {
            statusDiv.innerHTML = `<p style="color:#dc2626">✗ PDF not found. Make sure "${fileName}" is uploaded to the pdfs/ folder in GitHub</p>`;
        }
    } catch (error) {
        statusDiv.innerHTML = `<p style="color:#dc2626">✗ Could not verify PDF. Make sure it's uploaded to GitHub first.</p>`;
    }
}

async function loadArticles() {
    try {
        allArticles = await getArticles();
    } catch (error) {
        console.error('Error loading articles:', error);
        allArticles = [];
    }
}

async function loadArchives() {
    try {
        const response = await fetch('archive-index.json');
        archiveData = await response.json();
        renderArchives();
    } catch (error) {
        console.error('Error loading archives:', error);
        document.getElementById('archiveTree').innerHTML = '<p style="color:#dc2626">Failed to load archives</p>';
    }
}

function renderArchives() {
    const container = document.getElementById('archiveTree');
    if (!archiveData) {
        container.innerHTML = '<p>No archives available</p>';
        return;
    }
    
    container.innerHTML = renderFolder(archiveData);
    attachArchiveListeners();
}

function renderFolder(folder, level = 0) {
    let html = '<div class="folder">';
    
    if (level > 0) {
        html += `
            <div class="folder-header" data-folder-id="${folder.name}">
                <span class="folder-icon">📁</span>
                <span class="folder-name">${folder.name}</span>
            </div>
        `;
    }
    
    html += `<div class="folder-content ${level === 0 ? 'open' : ''}" id="folder-${folder.name}">`;
    
    if (folder.children) {
        folder.children.forEach(child => {
            if (child.type === 'folder') {
                html += renderFolder(child, level + 1);
            } else if (child.type === 'file') {
                const isPdf = child.name.toLowerCase().endsWith('.pdf');
                const icon = isPdf ? '📄' : '📝';
                html += `
                    <div class="file-item" data-file-path="${child.path}">
                        <span class="file-icon">${icon}</span>
                        <span class="file-name">${child.name}</span>
                    </div>
                `;
            }
        });
    }
    
    html += '</div></div>';
    return html;
}

function attachArchiveListeners() {
    // Folder toggle
    document.querySelectorAll('.folder-header').forEach(header => {
        header.addEventListener('click', () => {
            const folderId = header.dataset.folderId;
            const content = document.getElementById(`folder-${folderId}`);
            if (content) {
                content.classList.toggle('open');
                const icon = header.querySelector('.folder-icon');
                icon.textContent = content.classList.contains('open') ? '📂' : '📁';
            }
        });
    });
    
    // File click
    document.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', () => {
            const filePath = item.dataset.filePath;
            const fileName = item.querySelector('.file-name').textContent;
            
            if (fileName.toLowerCase().endsWith('.pdf')) {
                openArchivePDF(filePath, fileName);
            } else {
                alert('Only PDF files can be viewed directly. This appears to be a Word document.');
            }
        });
    });
}

function openArchivePDF(filePath, fileName) {
    document.getElementById('modalCategory').textContent = 'Archive';
    document.getElementById('modalTitle').textContent = fileName;
    document.getElementById('modalMeta').textContent = 'From the archives';
    document.getElementById('modalExcerpt').textContent = 'View this archived article from our past issues.';
    
    const pdfUrl = `${window.location.origin}/${filePath}`;
    
    // Set up button to open PDF in new tab
    const openPdfBtn = document.getElementById('openPdfBtn');
    openPdfBtn.onclick = () => {
        window.open(pdfUrl, '_blank');
    };
    
    showModal('articleModal');
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
        await login(email, password);
        closeModal('loginModal');
        // Stay on current page instead of forcing to admin
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        errorDiv.classList.add('hidden');
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = error.message || 'Invalid email or password';
        errorDiv.classList.remove('hidden');
    }
}

async function handleLogout() {
    await logout();
    showPage('home');
}

function updateUIForUser() {
    const loginBtn = document.getElementById('loginNavBtn');
    const userDisplay = document.getElementById('userDisplay');
    const userBadge = document.getElementById('userBadge');
    const adminNavLink = document.getElementById('adminNavLink');

    if (currentUser) {
        loginBtn.classList.add('hidden');
        userDisplay.classList.remove('hidden');
        adminNavLink.classList.remove('hidden');
        userBadge.textContent = `👑 ${currentUser.email}`;
        userBadge.className = 'user-badge admin';
    } else {
        loginBtn.classList.remove('hidden');
        userDisplay.classList.add('hidden');
        adminNavLink.classList.add('hidden');
    }
}

async function handlePublishArticle() {
    const pdfFileInput = document.getElementById('pdfFileName');
    const pdfUrl = pdfFileInput?.dataset.verified;
    
    if (!pdfUrl) {
        alert('Please verify your PDF file first');
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
        authorUid: currentUser?.uid || 'unknown',
        date: new Date().toISOString().split('T')[0],
        excerpt,
        content: '',
        featured,
        pdfUrl: pdfUrl,
        pdfFileName: pdfFileInput.value
    };

    try {
        await addArticle(article);
        alert('Article published successfully!');
        
        // Reset form
        document.getElementById('articleTitle').value = '';
        document.getElementById('articleAuthor').value = '';
        document.getElementById('articleExcerpt').value = '';
        document.getElementById('articleFeatured').checked = false;
        document.getElementById('pdfFileName').value = '';
        document.getElementById('pdfFileName').dataset.verified = '';
        document.getElementById('pdfStatus').innerHTML = '';
        
        await loadArticles();
        renderHomePage();
        renderArticlesPage();
        renderAdminPage();
    } catch (error) {
        console.error('Publish error:', error);
        alert('Failed to publish article: ' + error.message);
    }
}

async function deleteArticleHandler(articleId) {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
        await deleteArticle(articleId);
        alert('Article deleted successfully!');
        await loadArticles();
        renderHomePage();
        renderArticlesPage();
        renderAdminPage();
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete article: ' + error.message);
    }
}

// Make functions available globally
window.deleteArticle = deleteArticleHandler;
window.openArticleModal = openArticleModal;

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
    document.getElementById('modalExcerpt').textContent = article.excerpt || 'Read the full article to learn more.';
    
    if (article.pdfUrl) {
        const pdfUrl = article.pdfUrl.startsWith('http') ? article.pdfUrl : `${window.location.origin}/${article.pdfUrl}`;
        
        // Set up button to open PDF in new tab
        const openPdfBtn = document.getElementById('openPdfBtn');
        openPdfBtn.onclick = () => {
            window.open(pdfUrl, '_blank');
        };
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