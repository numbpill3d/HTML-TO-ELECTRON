// Script block 1
// Application State
const AppState = {
    currentTab: 'files',
    files: [
        { name: 'project-proposal.pdf', size: '2.1 MB', type: 'pdf', icon: '📄' },
        { name: 'presentation.pptx', size: '5.3 MB', type: 'pptx', icon: '📊' },
        { name: 'budget-2024.xlsx', size: '1.8 MB', type: 'xlsx', icon: '📈' },
        { name: 'meeting-notes.docx', size: '234 KB', type: 'docx', icon: '📝' },
        { name: 'photo-album.zip', size: '12.4 MB', type: 'zip', icon: '📦' },
        { name: 'backup-data.sql', size: '8.9 MB', type: 'sql', icon: '💾' },
        { name: 'website-mockup.psd', size: '15.2 MB', type: 'psd', icon: '🎨' },
        { name: 'source-code.zip', size: '3.7 MB', type: 'zip', icon: '💻' }
    ],
    searchTerm: ''
};

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');
const searchInput = document.getElementById('searchInput');
const fileGrid = document.getElementById('fileGrid');
const sidebarItems = document.querySelectorAll('.sidebar-item');

// Initialize Application
function initializeApp() {
    console.log('🚀 File Manager Pro - Initializing...');
    
    setupEventListeners();
    renderFiles();
    updateStorageProgress();
    startAnimations();
    
    console.log('✅ Application initialized successfully');
}

// Event Listeners Setup
function setupEventListeners() {
    // Tab navigation
    navTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        AppState.searchTerm = e.target.value.toLowerCase();
        renderFiles();
    });

    // Sidebar navigation
    sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            sidebarItems.forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // File card interactions
    document.addEventListener('click', (e) => {
        if (e.target.closest('.file-card')) {
            const fileName = e.target.closest('.file-card').querySelector('.file-name').textContent;
            handleFileClick(fileName);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'f':
                    e.preventDefault();
                    searchInput.focus();
                    break;
                case 'n':
                    e.preventDefault();
                    createNewFolder();
                    break;
            }
        }
    });
}

// Tab Switching
function switchTab(tabName) {
    // Update nav tabs
    navTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });

    // Update tab content
    tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabName) {
            content.classList.add('active');
        }
    });

    AppState.currentTab = tabName;
    console.log(`📂 Switched to ${tabName} tab`);
}

// File Rendering
function renderFiles() {
    const filteredFiles = AppState.files.filter(file => 
        file.name.toLowerCase().includes(AppState.searchTerm)
    );

    fileGrid.innerHTML = '';

    filteredFiles.forEach((file, index) => {
        const fileCard = createFileCard(file, index);
        fileGrid.appendChild(fileCard);
    });

    // Add loading animation
    setTimeout(() => {
        const cards = fileGrid.querySelectorAll('.file-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                card.style.transition = 'all 0.3s ease';
                
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 50);
            }, index * 50);
        });
    }, 10);
}

// Create File Card Element
function createFileCard(file, index) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
        <div class="file-icon">${file.icon}</div>
        <div class="file-name">${file.name}</div>
        <div class="file-size">${file.size}</div>
    `;

    // Add hover effects
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px) scale(1.02)';
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) scale(1)';
    });

    return card;
}

// File Click Handler
function handleFileClick(fileName) {
    console.log(`📁 Opening file: ${fileName}`);
    
    // Simulate file opening with animation
    const notification = createNotification(`Opening ${fileName}...`, 'info');
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
        createNotification(`${fileName} opened successfully!`, 'success');
    }, 1500);
}

// Create Notification
function createNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? 'var(--success-color)' : 'var(--primary-color)'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        font-weight: 500;
    `;
    notification.textContent = message;

    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);

    return notification;
}

// Create New Folder
function createNewFolder() {
    const folderName = prompt('Enter folder name:');
    if (folderName) {
        const newFolder = {
            name: folderName,
            size: '0 KB',
            type: 'folder',
            icon: '📁'
        };
        AppState.files.unshift(newFolder);
        renderFiles();
        createNotification(`Folder "${folderName}" created!`, 'success');
    }
}

// Update Storage Progress
function updateStorageProgress() {
    const progressBar = document.querySelector('.progress-bar');
    let currentWidth = 0;
    const targetWidth = 65;
    
    const animateProgress = () => {
        if (currentWidth < targetWidth) {
            currentWidth += 2;
            progressBar.style.width = currentWidth + '%';
            requestAnimationFrame(animateProgress);
        }
    };
    
    setTimeout(animateProgress, 500);
}

// Start Animations
function startAnimations() {
    // Animate logo
    const logo = document.querySelector('.logo span');
    setInterval(() => {
        logo.classList.add('bounce');
        setTimeout(() => logo.classList.remove('bounce'), 1000);
    }, 5000);

    // Pulse status indicators
    const statusIndicators = document.querySelectorAll('.status-online');
    statusIndicators.forEach(indicator => {
        indicator.classList.add('pulse');
    });

    // Random file updates simulation
    setInterval(() => {
        if (Math.random() > 0.8) {
            const randomIndex = Math.floor(Math.random() * AppState.files.length);
            const file = AppState.files[randomIndex];
            console.log(`📊 File accessed: ${file.name}`);
        }
    }, 3000);
}

// Utility Functions
const Utils = {
    formatFileSize: (bytes) => {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },

    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    generateId: () => {
        return Math.random().toString(36).substr(2, 9);
    }
};

// Performance Monitoring
const PerformanceMonitor = {
    startTime: performance.now(),
    
    logLoadTime: () => {
        const loadTime = performance.now() - PerformanceMonitor.startTime;
        console.log(`⚡ App loaded in ${Math.round(loadTime)}ms`);
    },

    trackInteraction: (action) => {
        console.log(`👆 User interaction: ${action} at ${new Date().toLocaleTimeString()}`);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Log performance after everything loads
window.addEventListener('load', PerformanceMonitor.logLoadTime);

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppState, Utils, PerformanceMonitor };
}
