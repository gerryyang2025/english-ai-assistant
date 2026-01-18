/**
 * 英语单词记忆网站 - 主应用程序
 * 专为英语学习者设计的英语单词学习工具
 */

// ========== 全局状态管理 ==========
const AppState = {
    wordData: [],          // 单词数据（词书列表）
    currentWordBook: null, // 当前选中的词书
    selectedUnits: [],     // 选中的单元
    currentUnit: null,     // 当前查看的单元
    flashcardSession: null,// 闪卡测试会话
    flashcardWordBook: null, // 闪卡当前选中的词书
    flashcardSelectedUnits: [], // 闪卡选中的单元
    userProgress: null,    // 用户学习进度
    wordListPage: 1,       // 单词列表当前页码
    wordsPerPage: 20       // 每页显示单词数量
};

// ========== DOM 元素缓存 ==========
const DOM = {};

// ========== 初始化应用 ==========
document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    // 先检查服务健康状态
    checkServiceHealth().then(healthy => {
        if (!healthy) {
            showServiceError();
            return;
        }
        showLoading();
        loadWordData().then(() => {
            loadUserProgress();
            bindEvents();
            renderHomePage();
            hideLoading();
        });
    });
});

// 初始化 DOM 元素引用
function initDOMElements() {
    DOM.pages = document.querySelectorAll('.page');
    DOM.navBtns = document.querySelectorAll('.nav-btn');
    DOM.unitTabs = document.getElementById('unit-tabs');
    DOM.wordList = document.getElementById('word-list');
    DOM.wrongbookWords = document.getElementById('wrongbook-words');
    DOM.unitSelectGrid = document.getElementById('unit-select-grid');
    DOM.flashcard = document.getElementById('flashcard');
    DOM.loading = document.getElementById('loading');
    DOM.serviceError = document.getElementById('service-error');
}

// 检查服务健康状态
async function checkServiceHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch('/api/health', {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        return data.status === 'ok';
    } catch (error) {
        console.error('Service health check failed:', error);
        return false;
    }
}

// 显示服务错误提示
function showServiceError() {
    if (DOM.serviceError) {
        DOM.serviceError.classList.add('show');
    }
    // 隐藏主内容
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.style.display = 'none';
    }
    const footer = document.querySelector('.footer');
    if (footer) {
        footer.style.display = 'none';
    }
}

// 显示加载动画
function showLoading() {
    DOM.loading.classList.add('show');
}

// 隐藏加载动画
function hideLoading() {
    DOM.loading.classList.remove('show');
}

// ========== 事件绑定 ==========
function bindEvents() {
    // 导航按钮
    DOM.navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
    
    // 功能卡片点击
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('click', () => {
            const action = card.dataset.action;
            if (action === 'go-flashcard') switchPage('flashcard');
            else if (action === 'go-words') switchPage('words');
            else if (action === 'go-progress') switchPage('progress');
        });
    });
    
    // 单词搜索
    const searchInput = document.getElementById('word-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleWordSearch, 300));
    }
    
    // 词书选择
    document.getElementById('wordbook-select')?.addEventListener('change', handleWordBookChange);
    
    // 单元选择
    document.getElementById('select-all-units')?.addEventListener('click', selectAllUnits);
    document.getElementById('clear-unit-selection')?.addEventListener('click', clearUnitSelection);
    
    // 闪卡词书选择
    document.getElementById('flashcard-wordbook-select')?.addEventListener('change', handleFlashcardWordBookChange);
    
    // 闪卡单元选择
    document.getElementById('flashcard-select-all-units')?.addEventListener('click', flashcardSelectAllUnits);
    document.getElementById('flashcard-clear-unit-selection')?.addEventListener('click', flashcardClearUnitSelection);
    
    // 开始测试
    document.getElementById('start-test-btn')?.addEventListener('click', startFlashcardTest);
    
    // 闪卡操作
    document.getElementById('btn-reveal')?.addEventListener('click', revealAnswer);
    document.getElementById('btn-known')?.addEventListener('click', () => markAnswer(true));
    document.getElementById('btn-unknown')?.addEventListener('click', () => markAnswer(false));
    document.getElementById('btn-review')?.addEventListener('click', () => markAnswer(null, true));
    
    // 退出测试
    document.getElementById('btn-exit-test')?.addEventListener('click', exitFlashcardTest);
    
    // 结果页操作
    document.getElementById('retry-test-btn')?.addEventListener('click', retryTest);
    document.getElementById('review-wrong-btn')?.addEventListener('click', reviewWrongWords);
    document.getElementById('back-home-btn')?.addEventListener('click', () => switchPage('home'));
    
    // 错词本操作
    document.getElementById('review-all-wrong-btn')?.addEventListener('click', reviewAllWrongWords);
    // 注意：clearWrongbook 通过 HTML 内联 onclick 绑定
}

// ========== 页面切换 ==========
function switchPage(pageName) {
    // 更新导航按钮状态
    DOM.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === pageName);
    });
    
    // 切换页面显示
    DOM.pages.forEach(page => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });
    
    // 页面特定初始化
    switch (pageName) {
        case 'home':
            renderHomePage();
            break;
        case 'words':
            // 清空搜索框
            const searchInput = document.getElementById('word-search');
            if (searchInput) searchInput.value = '';
            renderWordListPage();
            break;
        case 'flashcard':
            renderFlashcardSetup();
            break;
        case 'wrongbook':
            renderWrongbookPage();
            break;
        case 'favorites':
            renderFavoritesPage();
            break;
        case 'progress':
            renderProgressPage();
            break;
    }
}

// ========== 数据加载 ==========
async function loadWordData() {
    try {
        // 从服务器加载数据
        const response = await fetch('data/words.json');
        if (!response.ok) throw new Error('加载单词数据失败');
        AppState.wordData = await response.json();
        console.log('从服务器加载单词数据成功，共 ' + AppState.wordData.length + ' 个词书');
    } catch (error) {
        // 如果 fetch 失败（可能是 file:// 协议）
        console.error('加载单词数据失败:', error.message);
        alert('加载单词数据失败，请确保使用本地服务器（如 http-server）或在线环境访问。');
    }
}

// ========== 用户进度管理 ==========
function loadUserProgress() {
    const saved = localStorage.getItem('wordLearningProgress');
    if (saved) {
        AppState.userProgress = JSON.parse(saved);
    } else {
        AppState.userProgress = {
            wordProgress: {},
            wrongWords: [],
            favoriteWords: [],
            stats: {
                totalReviewed: 0,
                totalCorrect: 0,
                totalWrong: 0,
                currentStreak: 0,
                longestStreak: 0,
                lastStudyDate: null
            },
            dailyStats: {}
        };
    }
    updateStreak();
}

function saveUserProgress() {
    localStorage.setItem('wordLearningProgress', JSON.stringify(AppState.userProgress));
}

function updateWordProgress(wordId, isCorrect, markReview = false) {
    const progress = AppState.userProgress;
    
    // 初始化单词进度
    if (!progress.wordProgress[wordId]) {
        progress.wordProgress[wordId] = {
            reviewCount: 0,
            correctCount: 0,
            wrongCount: 0,
            masteryLevel: 0,
            lastReviewed: null,
            reviewDates: []
        };
    }
    
    const wordProgress = progress.wordProgress[wordId];
    wordProgress.reviewCount += 1;
    wordProgress.lastReviewed = new Date().toISOString();
    wordProgress.reviewDates.push(new Date().toISOString());
    
    // 更新正确/错误计数
    if (isCorrect) {
        wordProgress.correctCount += 1;
        wordProgress.masteryLevel = Math.min(5, wordProgress.masteryLevel + 1);
        progress.stats.totalCorrect += 1;
    } else {
        wordProgress.wrongCount += 1;
        wordProgress.masteryLevel = Math.max(0, wordProgress.masteryLevel - 1);
        progress.stats.totalWrong += 1;
        
        // 添加到错词本
        if (!progress.wrongWords.includes(wordId)) {
            progress.wrongWords.push(wordId);
        }
    }
    
    // 标记复习
    if (markReview) {
        if (!progress.wrongWords.includes(wordId)) {
            progress.wrongWords.push(wordId);
        }
    }
    
    // 更新总体统计
    progress.stats.totalReviewed += 1;
    
    // 更新每日统计
    const today = new Date().toISOString().split('T')[0];
    if (!progress.dailyStats[today]) {
        progress.dailyStats[today] = { reviewed: 0, correct: 0, wrong: 0 };
    }
    progress.dailyStats[today].reviewed += 1;
    if (isCorrect) {
        progress.dailyStats[today].correct += 1;
    } else {
        progress.dailyStats[today].wrong += 1;
    }
    
    // 更新连续学习天数
    updateStreak();
    
    saveUserProgress();
}

function updateStreak() {
    const progress = AppState.userProgress;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (progress.stats.lastStudyDate === today) {
        // 今天已经学习
        return;
    } else if (progress.stats.lastStudyDate === yesterday) {
        // 昨天学习过，连续天数+1
        progress.stats.currentStreak += 1;
    } else {
        // 中断了，重新开始
        progress.stats.currentStreak = 1;
    }
    
    // 更新最长连续记录
    if (progress.stats.currentStreak > progress.stats.longestStreak) {
        progress.stats.longestStreak = progress.stats.currentStreak;
    }
    
    progress.stats.lastStudyDate = today;
    saveUserProgress();
}

function getTodayStats() {
    const progress = AppState.userProgress;
    const today = new Date().toISOString().split('T')[0];
    const todayStats = progress.dailyStats[today] || { reviewed: 0, correct: 0, wrong: 0 };
    const accuracy = todayStats.reviewed > 0 
        ? Math.round((todayStats.correct / todayStats.reviewed) * 100) 
        : 0;
    
    return {
        reviewed: todayStats.reviewed,
        correct: todayStats.correct,
        wrong: todayStats.wrong,
        accuracy
    };
}

// ========== 首页渲染 ==========
function renderHomePage() {
    // 显示当前日期和星期
    displayCurrentDate();
    
    const todayStats = getTodayStats();
    
    document.getElementById('today-reviewed').textContent = todayStats.reviewed;
    document.getElementById('today-correct').textContent = todayStats.correct;
    document.getElementById('today-accuracy').textContent = todayStats.accuracy + '%';
    document.getElementById('streak-days').textContent = AppState.userProgress.stats.currentStreak;
}

// 显示当前日期和星期几
function displayCurrentDate() {
    const dateElement = document.getElementById('current-date');
    if (!dateElement) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekDay = weekDays[now.getDay()];
    
    dateElement.textContent = ` —— ${year}年${month}月${day}日 ${weekDay}`;
    dateElement.style.cssText = 'display: block; font-size: 1rem; font-weight: normal; margin-top: 8px; opacity: 0.9;';
}

// ========== 单词列表页 ==========
function renderWordListPage() {
    // 初始化词书选择器
    initWordBookSelector();
    
    // 渲染单元标签
    renderUnitTabs();
    
    // 重置页码并渲染单词列表
    resetWordListPage();
    renderWordList();
}

// 初始化词书选择器
function initWordBookSelector() {
    const wordbookSelect = document.getElementById('wordbook-select');
    if (!wordbookSelect) return;
    
    // 如果已经有选项，直接使用
    if (wordbookSelect.options.length > 1) return;
    
    // 从数据中获取词书列表并填充选择器
    AppState.wordData.forEach((wordbook, index) => {
        const option = document.createElement('option');
        option.value = wordbook.id || index;
        option.textContent = wordbook.name;
        wordbookSelect.appendChild(option);
    });
    
    // 选择第一个词书
    if (AppState.wordData.length > 0) {
        const firstBookId = AppState.wordData[0].id || 0;
        wordbookSelect.value = firstBookId;
        AppState.currentWordBook = firstBookId;
    }
}

// 词书选择变化处理
function handleWordBookChange(e) {
    AppState.currentWordBook = e.target.value;
    // 重置页码并重新渲染
    resetWordListPage();
    renderUnitTabs();
    renderWordList();
}

// ========== 闪卡词书选择 ==========

// 初始化闪卡词书选择器
function initFlashcardWordBookSelector() {
    const wordbookSelect = document.getElementById('flashcard-wordbook-select');
    if (!wordbookSelect) return;
    
    // 如果已经有选项，直接使用
    if (wordbookSelect.options.length > 1) return;
    
    // 从数据中获取词书列表并填充选择器
    AppState.wordData.forEach((wordbook, index) => {
        const option = document.createElement('option');
        option.value = wordbook.id || index;
        option.textContent = wordbook.name;
        wordbookSelect.appendChild(option);
    });
    
    // 选择第一个词书
    if (AppState.wordData.length > 0) {
        const firstBookId = AppState.wordData[0].id || 0;
        wordbookSelect.value = firstBookId;
        AppState.flashcardWordBook = firstBookId;
    }
}

// 闪卡词书选择变化处理
function handleFlashcardWordBookChange(e) {
    AppState.flashcardWordBook = e.target.value;
    // 重置单元选择并重新渲染
    AppState.flashcardSelectedUnits = [];
    renderFlashcardUnitGrid();
}

// 渲染闪卡单元选择网格
function renderFlashcardUnitGrid() {
    const grid = document.getElementById('flashcard-unit-select-grid');
    if (!grid) return;
    
    // 获取当前选中的词书
    let currentWordBook = AppState.flashcardWordBook;
    
    // 如果没有选中词书，默认选择第一个
    if (!currentWordBook && AppState.wordData.length > 0) {
        const firstWordBook = AppState.wordData[0];
        currentWordBook = firstWordBook.id || firstWordBook.name;
        AppState.flashcardWordBook = currentWordBook;
        
        // 更新选择器
        const wordbookSelect = document.getElementById('flashcard-wordbook-select');
        if (wordbookSelect) wordbookSelect.value = currentWordBook;
    }
    
    // 查找当前词书
    const currentBook = AppState.wordData.find(book => 
        (book.id && book.id === currentWordBook) || 
        (book.name && book.name === currentWordBook)
    );
    
    if (!currentBook || !currentBook.units) {
        grid.innerHTML = '<p class="empty-message">暂无单元数据</p>';
        return;
    }
    
    // 渲染单元选项
    grid.innerHTML = currentBook.units.map((unit, index) => {
        const unitNum = unit.unit || index + 1;
        const unitNumStr = String(unitNum);
        const isSelected = AppState.flashcardSelectedUnits.includes(unitNumStr);
        return `
            <label class="unit-select-item ${isSelected ? 'selected' : ''}">
                <input type="checkbox" 
                    value="${unitNumStr}" 
                    ${isSelected ? 'checked' : ''}
                    onchange="toggleFlashcardUnit('${unitNumStr.replace(/'/g, "\\'")}')">
                <span>${unitNumStr}</span>
            </label>
        `;
    }).join('');
}

// 切换闪卡单元选择
function toggleFlashcardUnit(unitNum) {
    const unitNumStr = String(unitNum);
    const index = AppState.flashcardSelectedUnits.indexOf(unitNumStr);
    if (index > -1) {
        AppState.flashcardSelectedUnits.splice(index, 1);
    } else {
        AppState.flashcardSelectedUnits.push(unitNumStr);
    }
    // 更新样式
    renderFlashcardUnitGrid();
}

// 闪卡全选单元
function flashcardSelectAllUnits() {
    let currentWordBook = AppState.flashcardWordBook;
    
    if (!currentWordBook && AppState.wordData.length > 0) {
        const firstWordBook = AppState.wordData[0];
        currentWordBook = firstWordBook.id || firstWordBook.name;
    }
    
    const currentBook = AppState.wordData.find(book => 
        (book.id && book.id === currentWordBook) || 
        (book.name && book.name === currentWordBook)
    );
    
    if (currentBook && currentBook.units) {
        AppState.flashcardSelectedUnits = currentBook.units.map((unit, index) => unit.unit || index + 1);
        renderFlashcardUnitGrid();
    }
}

// 闪卡清空单元选择
function flashcardClearUnitSelection() {
    AppState.flashcardSelectedUnits = [];
    renderFlashcardUnitGrid();
}

function renderUnitTabs() {
    // 获取当前选中的词书
    let currentWordBook = AppState.currentWordBook;
    
    // 如果没有选中词书，默认选择第一个
    if (!currentWordBook && AppState.wordData.length > 0) {
        const firstWordBook = AppState.wordData[0];
        currentWordBook = firstWordBook.id || firstWordBook.name;
        AppState.currentWordBook = currentWordBook;
        
        // 更新选择器显示
        const wordbookSelect = document.getElementById('wordbook-select');
        if (wordbookSelect) {
            wordbookSelect.value = currentWordBook;
        }
    }
    
    // 获取当前词书的单元
    const currentBook = AppState.wordData.find(book => 
        (book.id && book.id === currentWordBook) || 
        (book.name && book.name === currentWordBook)
    );
    
    const units = currentBook ? currentBook.units : [];
    
    let html = '<button class="unit-tab active" data-unit="all">全部</button>';
    
    units.forEach(unit => {
        html += `
            <button class="unit-tab" data-unit="${unit.unit}">
                ${unit.unit}
            </button>
        `;
    });
    
    DOM.unitTabs.innerHTML = html;
    
    // 绑定单元标签点击事件
    DOM.unitTabs.querySelectorAll('.unit-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            DOM.unitTabs.querySelectorAll('.unit-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            AppState.currentUnit = tab.dataset.unit === 'all' ? null : tab.dataset.unit;
            // 重置页码并渲染
            resetWordListPage();
            renderWordList();
        });
    });
}

function renderWordList(filterText = '') {
    let words = [];
    
    // 获取当前选中的词书
    const currentWordBookId = AppState.currentWordBook;
    const currentBook = AppState.wordData.find(book => 
        (book.id && book.id === currentWordBookId) || 
        (book.name && book.name === currentWordBookId)
    );
    
    // 获取当前词书的单元列表
    const units = currentBook ? currentBook.units : [];
    
    if (AppState.currentUnit) {
        const unit = units.find(u => u.unit === AppState.currentUnit);
        if (unit) words = unit.words;
    } else {
        units.forEach(unit => {
            words = words.concat(unit.words);
        });
    }
    
    // 搜索过滤
    if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        words = words.filter(word => 
            word.word.toLowerCase().includes(lowerFilter) ||
            word.meaning.toLowerCase().includes(lowerFilter)
        );
    }
    
    // 计算分页
    const totalWords = words.length;
    const totalPages = Math.ceil(totalWords / AppState.wordsPerPage);
    
    // 确保当前页码有效
    if (AppState.wordListPage > totalPages) {
        AppState.wordListPage = totalPages > 0 ? 1 : 0;
    }
    
    // 获取当前页的单词
    const startIndex = (AppState.wordListPage - 1) * AppState.wordsPerPage;
    const endIndex = startIndex + AppState.wordsPerPage;
    const currentPageWords = words.slice(startIndex, endIndex);
    
    // 渲染单词卡片
    DOM.wordList.innerHTML = currentPageWords.map(word => `
        <div class="word-card" data-word-id="${word.id}">
            <div class="word-main">
                <div class="word-text">
                    ${word.word}
                    ${word.phonetic ? `<span class="word-phonetic">${word.phonetic}</span>` : ''}
                </div>
                <div class="word-meaning">${word.meaning}</div>
                ${word.example ? `
                    <div class="word-example">
                        ${word.example}
                        <button class="audio-btn small" title="播放例句" onclick="speakExample('${escapeHtml(word.example.replace(/'/g, "\\'"))}')">🔊</button>
                        ${word.translation ? ' — ' + word.translation : ''}
                    </div>
                ` : ''}
                ${word.memoryTip ? `<div class="word-tip">💡 ${word.memoryTip}</div>` : ''}
            </div>
            <div class="word-actions">
                <button class="word-action-btn audio-btn" title="播放英音" onclick="speakWord('${word.word}')">
                    🇬🇧
                </button>
                <button class="word-action-btn audio-btn" title="播放美音" onclick="speakWordUS('${word.word}')">
                    🇺🇸
                </button>
                <button class="word-action-btn favorite-btn ${AppState.userProgress.favoriteWords.includes(word.id) ? 'favorited' : ''}" 
                        title="收藏" onclick="toggleFavorite('${word.id}')">
                    ${AppState.userProgress.favoriteWords.includes(word.id) ? '❤️' : '🤍'}
                </button>
            </div>
        </div>
    `).join('');
    
    // 渲染分页控件
    renderWordListPagination(totalWords, totalPages);
}

// 渲染单词列表分页控件
function renderWordListPagination(totalWords, totalPages) {
    // 检查是否存在分页容器，如果不存在则创建
    let paginationEl = document.getElementById('word-list-pagination');
    if (!paginationEl) {
        paginationEl = document.createElement('div');
        paginationEl.id = 'word-list-pagination';
        paginationEl.className = 'pagination';
        DOM.wordList.parentNode.insertBefore(paginationEl, DOM.wordList.nextSibling);
    }
    
    // 如果没有单词或只有一页，不显示分页
    if (totalWords === 0 || totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    const currentPage = AppState.wordListPage;
    
    paginationEl.innerHTML = `
        <div class="pagination-info">
            共 ${totalWords} 个单词，${totalPages} 页
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" onclick="goToWordListPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                ← 上一页
            </button>
            ${generatePageNumbers(currentPage, totalPages)}
            <button class="pagination-btn" onclick="goToWordListPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                下一页 →
            </button>
        </div>
    `;
}

// 生成分页页码
function generatePageNumbers(currentPage, totalPages) {
    let pages = [];
    const maxVisiblePages = 5; // 最多显示5个页码
    
    if (totalPages <= maxVisiblePages) {
        // 如果总页数少于最大显示数，显示所有页码
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        // 显示当前页附近的页码
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);
        
        // 确保始终显示5个页码（如果可能）
        if (endPage - startPage < maxVisiblePages - 1) {
            if (startPage === 1) {
                endPage = Math.min(maxVisiblePages, totalPages);
            } else if (endPage === totalPages) {
                startPage = Math.max(1, totalPages - maxVisiblePages + 1);
            }
        }
        
        // 添加第一页和省略号
        if (startPage > 1) {
            pages.push(1);
            if (startPage > 2) {
                pages.push('...');
            }
        }
        
        // 添加中间页码
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        
        // 添加最后一页和省略号
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pages.push('...');
            }
            pages.push(totalPages);
        }
    }
    
    return pages.map(page => {
        if (page === '...') {
            return `<span class="pagination-ellipsis">...</span>`;
        }
        return `<button class="pagination-num ${page === currentPage ? 'active' : ''}" onclick="goToWordListPage(${page})">${page}</button>`;
    }).join('');
}

// 跳转到指定页
function goToWordListPage(page) {
    const currentWordBookId = AppState.currentWordBook;
    const currentBook = AppState.wordData.find(book => 
        (book.id && book.id === currentWordBookId) || 
        (book.name && book.name === currentWordBookId)
    );
    const units = currentBook ? currentBook.units : [];
    
    let words = [];
    if (AppState.currentUnit) {
        const unit = units.find(u => u.unit === AppState.currentUnit);
        if (unit) words = unit.words;
    } else {
        units.forEach(unit => {
            words = words.concat(unit.words);
        });
    }
    
    const totalPages = Math.ceil(words.length / AppState.wordsPerPage);
    
    if (page >= 1 && page <= totalPages) {
        AppState.wordListPage = page;
        renderWordList();
    }
}

// 重置单词列表页码
function resetWordListPage() {
    AppState.wordListPage = 1;
}

function handleWordSearch(e) {
    const filterText = e.target.value.trim();
    console.log('搜索关键词:', filterText);
    renderWordList(filterText);
}

// ========== 闪卡测试 ==========
function renderFlashcardSetup() {
    // 初始化词书选择器
    initFlashcardWordBookSelector();
    
    // 渲染单元网格
    renderFlashcardUnitGrid();
    
    // 确保显示设置页面
    document.getElementById('flashcard-setup').style.display = 'block';
    document.getElementById('flashcard-test').style.display = 'none';
    document.getElementById('flashcard-result').style.display = 'none';
}

function selectAllUnits() {
    DOM.unitSelectGrid.querySelectorAll('.unit-select-item').forEach(item => {
        item.classList.add('selected');
    });
    AppState.selectedUnits = AppState.wordData.map(u => u.unit);
}

function clearUnitSelection() {
    DOM.unitSelectGrid.querySelectorAll('.unit-select-item').forEach(item => {
        item.classList.remove('selected');
    });
    AppState.selectedUnits = [];
}

function startFlashcardTest() {
    if (AppState.flashcardSelectedUnits.length === 0) {
        alert('请至少选择一个单元');
        return;
    }
    
    // 获取测试模式
    const mode = document.querySelector('input[name="test-mode"]:checked').value;
    
    // 收集选中单元的单词
    let words = [];
    AppState.wordData.forEach(wordbook => {
        // 只处理当前选中的词书
        const bookId = wordbook.id || wordbook.name;
        if (bookId !== AppState.flashcardWordBook) return;
        
        // 遍历当前词书的单元
        wordbook.units.forEach(unit => {
            if (AppState.flashcardSelectedUnits.includes(unit.unit)) {
                // 为每个单词添加课本和单元信息
                unit.words.forEach(word => {
                    words.push({
                        ...word,
                        _bookName: wordbook.name,
                        _unitName: unit.unit,
                        _unitTitle: unit.title || unit.unit,
                        _unitCategory: unit.category || ''
                    });
                });
            }
        });
    });
    
    // 随机打乱顺序
    words = shuffleArray(words);
    
    // 生成测试题目
    const questions = words.map((word, index) => {
        let questionType = mode;
        if (mode === 'mixed') {
            questionType = Math.random() > 0.5 ? 'en-to-zh' : 'zh-to-en';
        }
        
        return {
            id: `q-${index}`,
            wordId: word.id,
            questionType,
            question: questionType === 'en-to-zh' ? word.word : word.meaning,
            answer: {
                word: word.word,
                phonetic: word.phonetic,
                meaning: word.meaning,
                example: word.example,
                translation: word.translation,
                memoryTip: word.memoryTip
            },
            source: {
                bookName: word._bookName || '',
                unitName: word._unitName || '',
                unitTitle: word._unitTitle || '',
                unitCategory: word._unitCategory || ''
            }
        };
    });
    
    // 创建测试会话
    AppState.flashcardSession = {
        questions,
        currentIndex: 0,
        startTime: Date.now(),
        correctCount: 0,
        wrongCount: 0,
        markedWords: [],
        wrongWordIds: []
    };
    
    // 切换到测试界面
    document.getElementById('flashcard-setup').style.display = 'none';
    document.getElementById('flashcard-result').style.display = 'none';
    document.getElementById('flashcard-test').style.display = 'block';
    
    // 显示第一题
    showQuestion();
}

function showQuestion() {
    const session = AppState.flashcardSession;
    const question = session.questions[session.currentIndex];
    
    // 重置闪卡状态
    DOM.flashcard.classList.remove('flipped');
    
    // 更新进度
    const progress = ((session.currentIndex + 1) / session.questions.length) * 100;
    document.getElementById('test-progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = 
        `${session.currentIndex + 1} / ${session.questions.length}`;
    
    // 更新问题
    document.getElementById('question-label').textContent = 
        question.questionType === 'en-to-zh' ? '英文' : '中文';
    document.getElementById('question-text').textContent = question.question;
    
    // 更新答案
    document.getElementById('answer-word').textContent = question.answer.word;
    document.getElementById('answer-phonetic').textContent = question.answer.phonetic || '';
    document.getElementById('answer-meaning').textContent = question.answer.meaning;
    
    // 更新来源信息
    const sourceEl = document.getElementById('answer-source');
    if (question.source && (question.source.bookName || question.source.unitName)) {
        let sourceHtml = '';
        if (question.source.bookName) {
            sourceHtml += `<span class="source-item"><span class="source-label">课本：</span><span class="source-value">${escapeHtml(question.source.bookName)}</span></span>`;
        }
        if (question.source.unitName) {
            const unitDisplay = question.source.unitTitle && question.source.unitTitle !== question.source.unitName
                ? `${question.source.unitName} (${question.source.unitTitle})`
                : question.source.unitName;
            sourceHtml += `<span class="source-item"><span class="source-label">单元：</span><span class="source-value">${escapeHtml(unitDisplay)}</span></span>`;
        }
        if (question.source.unitCategory) {
            sourceHtml += `<span class="source-item"><span class="source-label">分类：</span><span class="source-value">${escapeHtml(question.source.unitCategory)}</span></span>`;
        }
        sourceEl.innerHTML = sourceHtml;
        sourceEl.style.display = 'flex';
    } else {
        sourceEl.style.display = 'none';
    }
    
    const exampleEl = document.getElementById('answer-example');
    if (question.answer.example) {
        const safeExample = escapeHtml(question.answer.example).replace(/'/g, "\\'");
        exampleEl.innerHTML = `
            <p class="example-en">
                ${question.answer.example}
                <button class="audio-btn small" title="播放例句" onclick="speakExample('${safeExample}')">🔊</button>
            </p>
            <p class="example-zh">${question.answer.translation || ''}</p>
        `;
        exampleEl.style.display = 'block';
    } else {
        exampleEl.style.display = 'none';
    }
    
    const tipEl = document.getElementById('answer-tip');
    if (question.answer.memoryTip) {
        tipEl.textContent = '💡 ' + question.answer.memoryTip;
        tipEl.style.display = 'block';
    } else {
        tipEl.style.display = 'none';
    }
}

// 播放当前闪卡单词发音
function speakCurrentWord() {
    const session = AppState.flashcardSession;
    if (session && session.questions[session.currentIndex]) {
        const question = session.questions[session.currentIndex];
        // 获取单词（根据问题类型决定播放哪个）
        const wordToSpeak = question.questionType === 'en-to-zh' 
            ? question.answer.word 
            : question.answer.word;
        speakWord(wordToSpeak);
    }
}

// 播放当前闪卡单词发音（美音）
function speakCurrentWordUS() {
    const session = AppState.flashcardSession;
    if (session && session.questions[session.currentIndex]) {
        const question = session.questions[session.currentIndex];
        // 获取单词（根据问题类型决定播放哪个）
        const wordToSpeak = question.questionType === 'en-to-zh' 
            ? question.answer.word 
            : question.answer.word;
        speakWordUS(wordToSpeak);
    }
}

function revealAnswer() {
    DOM.flashcard.classList.add('flipped');
}

function markAnswer(isCorrect, markReview = false) {
    const session = AppState.flashcardSession;
    const question = session.questions[session.currentIndex];
    const wordId = question.wordId;
    
    // 更新进度
    updateWordProgress(wordId, isCorrect, markReview);
    
    // 如果回答正确且单词在错词本中，从错词本移除
    if (isCorrect) {
        session.correctCount++;
        const wrongbookIndex = AppState.userProgress.wrongWords.indexOf(wordId);
        if (wrongbookIndex > -1) {
            AppState.userProgress.wrongWords.splice(wrongbookIndex, 1);
            saveUserProgress();
            console.log('从错词本移除:', wordId);
        }
    } else {
        session.wrongCount++;
        // 记录错词ID（用于添加到错词本）
        if (!session.wrongWordIds.includes(wordId)) {
            session.wrongWordIds.push(wordId);
        }
        if (markReview) {
            session.markedWords.push(wordId);
        }
    }
    
    // 下一题或结束
    if (session.currentIndex < session.questions.length - 1) {
        session.currentIndex++;
        showQuestion();
    } else {
        finishTest();
    }
}

function finishTest() {
    const session = AppState.flashcardSession;
    const total = session.questions.length;
    const correct = session.correctCount;
    const wrong = session.wrongCount;
    const accuracy = Math.round((correct / total) * 100);
    const duration = Math.round((Date.now() - session.startTime) / 1000);
    
    // 格式化时间
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const timeStr = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}秒`;
    
    // 隐藏测试界面
    document.getElementById('flashcard-test').style.display = 'none';
    
    // 显示结果
    document.getElementById('flashcard-result').style.display = 'block';
    
    // 更新结果数据
    document.getElementById('result-total').textContent = total;
    document.getElementById('result-correct').textContent = correct;
    document.getElementById('result-wrong').textContent = wrong;
    document.getElementById('result-time').textContent = timeStr;
    document.getElementById('result-percent').textContent = accuracy + '%';
    
    // 将本次测试的错词添加到全局错词本
    if (session.wrongWordIds && session.wrongWordIds.length > 0) {
        const progress = AppState.userProgress;
        let addedCount = 0;
        session.wrongWordIds.forEach(wordId => {
            if (!progress.wrongWords.includes(wordId)) {
                progress.wrongWords.push(wordId);
                addedCount++;
            }
        });
        if (addedCount > 0) {
            saveUserProgress();
            console.log('已将本次测试的', addedCount, '个错词添加到错词本');
        }
    }
    
    // 更新圆形进度条
    const circle = document.getElementById('result-circle');
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (accuracy / 100) * circumference;
    setTimeout(() => {
        circle.style.strokeDashoffset = offset;
    }, 100);
    
    // 根据正确率改变颜色
    if (accuracy >= 80) {
        circle.style.stroke = 'var(--success-color)';
    } else if (accuracy >= 60) {
        circle.style.stroke = 'var(--warning-color)';
    } else {
        circle.style.stroke = 'var(--danger-color)';
    }
    
    // 根据本次测试的错词数量显示/隐藏复习按钮
    const reviewWrongBtn = document.getElementById('review-wrong-btn');
    if (wrong > 0) {
        reviewWrongBtn.style.display = 'inline-block';
        reviewWrongBtn.textContent = `复习错词 (${wrong}个)`;
    } else {
        reviewWrongBtn.style.display = 'none';
    }
}

function exitFlashcardTest() {
    if (confirm('确定要退出测试吗？本次测试将不会被记录。')) {
        document.getElementById('flashcard-test').style.display = 'none';
        document.getElementById('flashcard-result').style.display = 'none';
        document.getElementById('flashcard-setup').style.display = 'block';
        AppState.flashcardSession = null;
    }
}

function retryTest() {
    // 返回到单元选择页面，让用户重新选择
    document.getElementById('flashcard-result').style.display = 'none';
    document.getElementById('flashcard-setup').style.display = 'block';
    // 清空已选单元
    flashcardClearUnitSelection();
    AppState.flashcardSession = null;
}

// ========== 错词本页面 ==========
function renderWrongbookPage() {
    // 确保数据已加载
    if (!AppState.wordData || AppState.wordData.length === 0) {
        console.log('单词数据未加载，跳过错词本渲染');
        return;
    }
    
    if (!AppState.userProgress) {
        console.log('用户进度未加载，跳过错词本渲染');
        return;
    }
    
    const progress = AppState.userProgress;
    
    // 收集所有单词
    const allWords = [];
    AppState.wordData.forEach(wordbook => {
        if (wordbook.units) {
            wordbook.units.forEach(unit => {
                if (unit.words) {
                    allWords.push(...unit.words);
                }
            });
        }
    });
    
    console.log('renderWrongbookPage - wrongWords:', progress.wrongWords);
    console.log('renderWrongbookPage - allWords count:', allWords.length);
    
    // 确保 wrongWords 是数组
    if (!Array.isArray(progress.wrongWords)) {
        progress.wrongWords = [];
    }
    
    // 获取所有有效的单词ID
    const validWordIds = new Set(allWords.map(w => w.id));
    
    // 清理无效的错词记录
    const originalCount = progress.wrongWords.length;
    progress.wrongWords = progress.wrongWords.filter(id => validWordIds.has(id));
    
    // 如果有清理掉的记录，更新localStorage
    if (progress.wrongWords.length !== originalCount) {
        const removedCount = originalCount - progress.wrongWords.length;
        console.log(`清理了 ${removedCount} 个无效的错词记录`);
        saveUserProgress();
    }
    
    // 获取错词详情
    const wrongWordDetails = progress.wrongWords.map(id => {
        const word = allWords.find(w => w.id === id);
        const wp = progress.wordProgress ? progress.wordProgress[id] : null;
        console.log(`Found word for ${id}:`, word ? word.word : 'NOT FOUND');
        return { word, wp, id };
    });
    
    // 更新统计
    document.getElementById('wrongbook-count').textContent = wrongWordDetails.length;
    const masteredCount = wrongWordDetails.filter(item => item.wp && item.wp.masteryLevel >= 4).length;
    document.getElementById('wrongbook-mastery').textContent = masteredCount;
    
    // 渲染错词列表
    const wrongbookWordsEl = DOM.wrongbookWords || document.getElementById('wrongbook-words');
    
    console.log('wrongWordDetails:', wrongWordDetails);
    console.log('wrongbookWordsEl:', wrongbookWordsEl);
    console.log('wrongWordDetails.length:', wrongWordDetails.length);
    
    if (wrongWordDetails.length === 0) {
        wrongbookWordsEl.innerHTML = '<p class="empty-message">🎉 恭喜！错词本为空，继续保持！</p>';
    } else {
        let html = '';
        wrongWordDetails.forEach(item => {
            const { word, wp, id } = item;
            
            // 确保word存在
            if (!word) {
                console.warn('Word not found for ID:', id);
                return;
            }
            
            const masteryLevel = wp ? wp.masteryLevel : 0;
            const masteryText = masteryLevel >= 4 ? '已掌握' : (masteryLevel >= 2 ? '学习中' : '待复习');
            const wrongCount = wp ? wp.wrongCount : 0;
            
            html += `
                <div class="wrongbook-word-item" data-word-id="${id}">
                    <div class="word-main">
                        <div>
                            <div class="word-text">
                                ${escapeHtml(word.word)}
                                <button class="audio-btn" title="播放英音" onclick="speakWord('${escapeHtml(word.word)}')">🇬🇧</button>
                                <button class="audio-btn" title="播放美音" onclick="speakWordUS('${escapeHtml(word.word)}')">🇺🇸</button>
                            </div>
                            <div class="word-phonetic">${escapeHtml(word.phonetic)}</div>
                            <div class="word-meaning">${escapeHtml(word.meaning)}</div>
                            ${word.example ? `<div class="wrongbook-example">${escapeHtml(word.example)}${word.translation ? ' — ' + escapeHtml(word.translation) : ''}</div>` : ''}
                            ${word.memoryTip ? `<div class="wrongbook-memory-tip">💡 ${escapeHtml(word.memoryTip)}</div>` : ''}
                        </div>
                    </div>
                    <div class="word-actions">
                        <span class="mastery-badge">${masteryText}</span>
                        ${wrongCount > 0 ? `<span style="color: var(--danger-color); font-size: 0.85rem; margin-right: 8px;">错${wrongCount}次</span>` : ''}
                        <button class="remove-btn" onclick="removeFromWrongbook('${id}')" title="从错词本移除">✕</button>
                    </div>
                </div>
            `;
        });
        
        console.log('Generated HTML length:', html.length);
        console.log('Setting innerHTML...');
        
        if (html === '') {
            // 所有错词都找不到对应的单词
            const missingIds = wrongWordDetails.map(item => item.id).join(', ');
            wrongbookWordsEl.innerHTML = `
                <p class="empty-message">⚠️ 错词记录与当前单词数据不匹配</p>
                <p style="text-align: center; color: #999; font-size: 0.85rem; margin-top: 8px;">
                    可能原因：单词数据已更新，这些错词已不在当前数据中<br>
                    记录的数量: ${wrongWordDetails.length} 个<br>
                    缺失的ID: ${missingIds}
                </p>
                <button class="btn-primary" style="margin-top: 16px;" onclick="clearWrongbook()">
                    🗑️ 清空错词本
                </button>
            `;
        } else {
            wrongbookWordsEl.innerHTML = html;
        }
        console.log('innerHTML set successfully');
    }
}

// ========== 收藏单词页面 ==========
function renderFavoritesPage() {
    // 确保数据已加载
    if (!AppState.wordData || AppState.wordData.length === 0) {
        console.log('单词数据未加载，跳过收藏页渲染');
        return;
    }
    
    const progress = AppState.userProgress;
    const favoriteIds = progress.favoriteWords || [];
    
    // 更新计数
    document.getElementById('favorites-count').textContent = favoriteIds.length;
    
    const favoritesListEl = document.getElementById('favorites-list');
    
    if (favoriteIds.length === 0) {
        favoritesListEl.innerHTML = '<p class="empty-message">📝 还没有收藏任何单词</p>';
        return;
    }
    
    // 收集所有单词
    let allWords = [];
    AppState.wordData.forEach(wordbook => {
        if (wordbook.units) {
            wordbook.units.forEach(unit => {
                if (unit.words) {
                    unit.words.forEach(word => {
                        allWords.push(word);
                    });
                }
            });
        }
    });
    
    // 筛选收藏的单词
    const favoriteWords = allWords.filter(word => favoriteIds.includes(word.id));
    
    if (favoriteWords.length === 0) {
        favoritesListEl.innerHTML = '<p class="empty-message">📝 收藏的单词不在当前数据中，请重新收藏</p>';
        return;
    }
    
    // 按字母顺序排序
    favoriteWords.sort((a, b) => a.word.localeCompare(b.word));
    
    // 渲染收藏单词列表
    favoritesListEl.innerHTML = favoriteWords.map(word => `
        <div class="word-card" data-word-id="${word.id}">
            <div class="word-main">
                <div class="word-text">
                    ${word.word}
                    ${word.phonetic ? `<span class="word-phonetic">${word.phonetic}</span>` : ''}
                </div>
                <div class="word-meaning">${word.meaning}</div>
                ${word.example ? `
                    <div class="word-example">
                        ${word.example}
                        <button class="audio-btn small" title="播放例句" onclick="speakExample('${escapeHtml(word.example.replace(/'/g, "\\'"))}')">🔊</button>
                        ${word.translation ? ' — ' + word.translation : ''}
                    </div>
                ` : ''}
                ${word.memoryTip ? `<div class="word-tip">💡 ${word.memoryTip}</div>` : ''}
            </div>
            <div class="word-actions">
                <button class="word-action-btn audio-btn" title="播放英音" onclick="speakWord('${word.word}')">
                    🇬🇧
                </button>
                <button class="word-action-btn audio-btn" title="播放美音" onclick="speakWordUS('${word.word}')">
                    🇺🇸
                </button>
                <button class="word-action-btn favorite-btn favorited" 
                        title="取消收藏" onclick="toggleFavorite('${word.id}')">
                    ❤️
                </button>
            </div>
        </div>
    `).join('');
}

function reviewAllWrongWords() {
    console.log('reviewAllWrongWords called');
    console.log('wrongWords:', AppState.userProgress.wrongWords);
    // 复用 reviewWrongWords 的逻辑
    reviewWrongWords();
}

function clearWrongbook() {
    if (confirm('确定要清空错词本吗？此操作不可恢复。')) {
        AppState.userProgress.wrongWords = [];
        saveUserProgress();
        renderWrongbookPage();
        
        // 同时隐藏闪卡结果页的复习错词按钮
        const reviewWrongBtn = document.getElementById('review-wrong-btn');
        if (reviewWrongBtn) {
            reviewWrongBtn.style.display = 'none';
        }
        
        alert('错词本已清空');
    }
}

function removeFromWrongbook(wordId) {
    const index = AppState.userProgress.wrongWords.indexOf(wordId);
    if (index > -1) {
        AppState.userProgress.wrongWords.splice(index, 1);
        saveUserProgress();
        renderWrongbookPage();
    }
}

function reviewWrongWords() {
    console.log('reviewWrongWords called');
    
    // 切换到闪卡测试，只测试错词
    if (!AppState.userProgress.wrongWords || AppState.userProgress.wrongWords.length === 0) {
        console.log('No wrong words to review');
        alert('错词本为空，没有需要复习的单词');
        return;
    }
    
    console.log('Number of wrong words:', AppState.userProgress.wrongWords.length);
    
    // 收集所有单词（同时记录课本和单元信息）
    let allWords = [];
    AppState.wordData.forEach(wordbook => {
        if (wordbook.units) {
            wordbook.units.forEach(unit => {
                if (unit.words) {
                    // 为每个单词添加课本和单元信息
                    unit.words.forEach(word => {
                        allWords.push({
                            ...word,
                            _bookName: wordbook.name,
                            _unitTitle: unit.title || unit.unit,
                            _unitCategory: unit.category || ''
                        });
                    });
                }
            });
        }
    });
    
    console.log('Total words loaded:', allWords.length);
    
    // 筛选错词
    const wrongWordIds = AppState.userProgress.wrongWords;
    const wrongWords = allWords.filter(word => wrongWordIds.includes(word.id));
    
    console.log('Filtered wrong words:', wrongWords.length);
    
    if (wrongWords.length === 0) {
        alert('错词本为空，或所有错词都已从数据中移除');
        return;
    }
    
    console.log('Starting flashcard test with', wrongWords.length, 'words');
    
    // 生成测试题目（默认使用中译英模式）
    const mode = 'zh-to-en';
    const questions = shuffleArray(wrongWords).map((word, index) => {
        let questionType = mode;
        if (mode === 'mixed') {
            questionType = Math.random() > 0.5 ? 'en-to-zh' : 'zh-to-en';
        }
        
        return {
            id: `q-${index}`,
            wordId: word.id,
            questionType,
            question: questionType === 'en-to-zh' ? word.word : word.meaning,
            answer: {
                word: word.word,
                phonetic: word.phonetic,
                meaning: word.meaning,
                example: word.example,
                translation: word.translation,
                memoryTip: word.memoryTip
            },
            source: {
                bookName: word._bookName || '',
                unitName: word._unitName || '',
                unitTitle: word._unitTitle || '',
                unitCategory: word._unitCategory || ''
            }
        };
    });
    
    // 创建测试会话
    AppState.flashcardSession = {
        questions,
        currentIndex: 0,
        startTime: Date.now(),
        correctCount: 0,
        wrongCount: 0,
        markedWords: [],
        wrongWordIds: []
    };
    
    // 先切换到闪卡测试页面
    switchPage('flashcard');
    
    // 延迟一下确保页面切换完成
    setTimeout(() => {
        // 隐藏设置界面和结果界面，显示测试界面
        document.getElementById('flashcard-setup').style.display = 'none';
        document.getElementById('flashcard-result').style.display = 'none';
        document.getElementById('flashcard-test').style.display = 'block';
        
        // 显示第一道题
        showQuestion();
    }, 50);
}

// ========== 学习进度页 ==========
function renderProgressPage() {
    const progress = AppState.userProgress;
    
    // 计算总体统计（wordData 是词书数组，每个词书有 units，每个单元有 words）
    const totalWords = AppState.wordData.reduce((acc, book) => {
        return acc + book.units.reduce((acc2, unit) => acc2 + unit.words.length, 0);
    }, 0);
    const masteredWords = Object.values(progress.wordProgress).filter(w => w.masteryLevel >= 4).length;
    const overallAccuracy = progress.stats.totalReviewed > 0
        ? Math.round((progress.stats.totalCorrect / progress.stats.totalReviewed) * 100)
        : 0;
    
    // 更新统计卡片
    document.getElementById('total-words').textContent = totalWords;
    document.getElementById('mastered-words').textContent = masteredWords;
    document.getElementById('overall-accuracy').textContent = overallAccuracy + '%';
    document.getElementById('total-streak').textContent = progress.stats.longestStreak;
    
    // 渲染单元进度
    const unitProgressList = document.getElementById('unit-progress-list');
    let unitHtml = '';
    
    AppState.wordData.forEach(wordbook => {
        wordbook.units.forEach(unit => {
            const learnedWords = unit.words.filter(w => {
                const wp = progress.wordProgress[w.id];
                return wp && wp.reviewCount > 0;
            }).length;
            const percent = Math.round((learnedWords / unit.words.length) * 100);
            
            unitHtml += `
                <div class="unit-progress-item">
                    <span class="unit-progress-name">${unit.unit}</span>
                    <div class="unit-progress-bar">
                        <div class="unit-progress-fill" style="width: ${percent}%"></div>
                    </div>
                    <span class="unit-progress-count">${learnedWords}/${unit.words.length}</span>
                </div>
            `;
        });
    });
    
    unitProgressList.innerHTML = unitHtml;
}

// ========== 工具函数 ==========

// 防抖函数
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

// HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 数组随机打乱
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// 单词发音（英音）
function speakWord(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成');
        return;
    }
    
    // 取消之前的朗读
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.8;
    utterance.pitch = 1.0;
    
    // 尝试选择英语语音
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => 
        voice.lang.startsWith('en') && voice.name.includes('Female')
    );
    if (englishVoice) {
        utterance.voice = englishVoice;
    }
    
    window.speechSynthesis.speak(utterance);
}

// 单词发音（美音）
function speakWordUS(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成');
        return;
    }
    
    // 取消之前的朗读
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    utterance.pitch = 1.0;
    
    // 尝试选择美式英语语音
    const voices = window.speechSynthesis.getVoices();
    const americanVoice = voices.find(voice => 
        voice.lang.startsWith('en-US') && voice.name.includes('Female')
    );
    if (americanVoice) {
        utterance.voice = americanVoice;
    }
    
    window.speechSynthesis.speak(utterance);
}

// 例句发音
function speakExample(text) {
    if (!text) return;
    
    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成');
        return;
    }
    
    // 取消之前的朗读
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9; // 稍微放慢语速，便于理解
    
    // 尝试选择美式英语语音
    const voices = window.speechSynthesis.getVoices();
    const americanVoice = voices.find(voice => 
        voice.lang.startsWith('en-US') && voice.name.includes('Female')
    );
    if (americanVoice) {
        utterance.voice = americanVoice;
    }
    
    window.speechSynthesis.speak(utterance);
}

// 切换收藏
function toggleFavorite(wordId) {
    const progress = AppState.userProgress;
    const index = progress.favoriteWords.indexOf(wordId);
    const wasFavorite = index > -1;
    
    if (wasFavorite) {
        progress.favoriteWords.splice(index, 1);
    } else {
        progress.favoriteWords.push(wordId);
    }
    
    saveUserProgress();
    
    // 如果在收藏页面，取消收藏后刷新页面
    const favoritesPage = document.getElementById('page-favorites');
    if (favoritesPage && favoritesPage.classList.contains('active')) {
        if (wasFavorite) {
            // 取消收藏，刷新页面
            renderFavoritesPage();
        }
    }
    
    // 更新按钮状态
    const btn = document.querySelector(`.word-card[data-word-id="${wordId}"] .favorite-btn`);
    if (btn) {
        btn.textContent = progress.favoriteWords.includes(wordId) ? '❤️' : '🤍';
        btn.classList.toggle('favorited', progress.favoriteWords.includes(wordId));
    }
}

// ========== AI 知识问答 ==========

// API 配置（调用本地服务器，由 server.py 代理保护 API Key）
const API_BASE_URL = '/api';

async function submitQA() {
    const inputEl = document.getElementById('qa-input');
    const submitBtn = document.getElementById('qa-submit-btn');
    const loadingEl = document.getElementById('qa-loading');
    const resultEl = document.getElementById('qa-result');
    const answerEl = resultEl.querySelector('.qa-answer');
    
    const question = inputEl.value.trim();
    if (!question) {
        alert('请输入问题');
        return;
    }
    
    // 显示加载状态
    submitBtn.disabled = true;
    loadingEl.style.display = 'flex';
    resultEl.style.display = 'none';
    
    try {
        // 获取是否启用联网搜索
        const enableWebSearch = document.getElementById('web-search-toggle').checked;
        
        // 调用本地 API 服务器（server.py），由后端代理调用 MiniMax
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                question,
                enable_web_search: enableWebSearch
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.answer) {
            // 使用 marked.js 解析 Markdown
            if (typeof marked !== 'undefined') {
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    headerIds: false,
                    mangle: false
                });
                answerEl.innerHTML = marked.parse(data.answer);
            } else {
                answerEl.innerHTML = data.answer.replace(/\n/g, '<br>');
            }
        } else {
            answerEl.innerHTML = '<p>抱歉，AI 回答生成失败，请稍后重试。</p>';
        }
        
        resultEl.style.display = 'block';
    } catch (error) {
        console.error('AI Q&A Error:', error);
        answerEl.innerHTML = `
            <p><strong>请求失败：</strong>${escapeHtml(error.message)}</p>
            <p>请检查：</p>
            <ul>
                <li>服务器是否正在运行（运行 ./server.py）</li>
                <li>API Key 是否正确配置</li>
                <li>网络连接是否正常</li>
            </ul>
        `;
        resultEl.style.display = 'block';
    } finally {
        loadingEl.style.display = 'none';
        submitBtn.disabled = false;
    }
}

// 导出供全局使用
window.speakWord = speakWord;
window.speakWordUS = speakWordUS;
window.speakExample = speakExample;
window.goToWordListPage = goToWordListPage;
window.toggleFavorite = toggleFavorite;
window.removeFromWrongbook = removeFromWrongbook;
window.speakCurrentWord = speakCurrentWord;
window.speakCurrentWordUS = speakCurrentWordUS;
window.submitQA = submitQA;