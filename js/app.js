/**
 * 英语单词记忆网站 - 主应用程序
 * 专为英语学习者设计的英语单词学习工具
 */

// ========== 全局状态管理 ==========
const AppState = {
    wordData: [],          // 单词数据（词书列表）
    readings: [],          // 阅读数据（阅读材料列表）
    speechData: [],        // 朗读数据（朗读材料列表）
    currentReading: null,  // 当前阅读材料
    currentSpeech: null,   // 当前朗读材料
    currentSpeechChapter: null, // 当前朗读章节
    currentWordBook: null, // 当前选中的词书
    selectedUnits: [],     // 选中的单元
    currentUnit: null,     // 当前查看的单元
    flashcardSession: null,// 闪卡测试会话
    flashcardWordBook: null, // 闪卡当前选中的词书
    flashcardSelectedUnits: [], // 闪卡选中的单元
    userProgress: null,    // 用户学习进度
    wordListPage: 1,       // 单词列表当前页码
    wordsPerPage: 20,      // 每页显示单词数量
    currentDialogueIndex: 0, // 当前播放到第几句
    isPlaying: false,       // 是否正在播放
    sentencesSession: null,  // 语句练习会话
    speechUtterance: null,   // 当前语音合成实例
    speechIsPlaying: false,   // 朗读是否正在播放
    speechPaused: false,      // 朗读是否暂停
    speechPlaybackSpeed: 1.0,   // 朗读播放速度
    speechVoiceMode: 'system',   // 朗读语音模式: 'system' 或 'clone'
    speechCloneAudioUrl: null,   // 音色复刻生成的音频 URL
    speechCloneVoices: [],       // 可用的音色复刻语音列表（从服务器获取）
    speechCloneSelectedVoice: null, // 当前选择的音色复刻语音
    speechCloneVoiceId: null,    // 音色复刻 voice_id（从服务器获取）
    speechCloneCurrentTime: 0,   // 音色复刻音频的播放位置（秒）
    speechPaused: false,          // 朗读是否暂停
    speechCloneAudioCache: new Map(), // 音色复刻音频缓存：key=内容hash, value={url, timestamp}
    speechCloneReady: false,      // 音色复刻音频是否已准备就绪（等待用户点击播放）
};

// ========== DOM 元素缓存 ==========
const DOM = {};

// ========== 初始化应用 ==========
document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();

    // 初始化语音列表（处理异步加载）
    initSpeechVoices();

    // 添加页面可见性变化处理（减少语音播放导致的错误）
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // 页面隐藏时取消所有语音播放
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        }
    });

    // 页面卸载前取消语音播放
    window.addEventListener('beforeunload', () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    });

    // 先检查服务健康状态
    checkServiceHealth().then(healthy => {
        if (!healthy) {
            showServiceError();
            return;
        }
    // 获取服务器配置
    fetchVoiceCloneConfig();
    showLoading();
    loadWordData().then(() => {
            loadReadingData(); // 加载阅读数据
            loadSpeechData(); // 加载听书数据
        loadUserProgress();
        bindEvents();
        renderHomePage();
            loadHomeDailyWord(); // 首页今日一词（词库轮换 + 墨小灵引导）
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

// 播放点击音效（简单的提示音）
function playClickSound() {
    // 使用 Web Audio API 播放简单的提示音
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        // 忽略音频播放错误
    }
}

// 初始化语音列表
function initSpeechVoices() {
    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成');
        return;
    }

    const synthesis = window.speechSynthesis;

    // 立即尝试获取语音列表（某些浏览器会同步返回）
    const loadVoices = () => {
        const voices = synthesis.getVoices();
        if (voices.length === 0) {
            // Safari：空列表时用一次 speak+cancel 触发加载；须异步执行，避免 Chrome 在 cancel 同帧内丢队列
            setTimeout(() => {
                try {
                    const testUtterance = new SpeechSynthesisUtterance('\u00a0');
                    synthesis.speak(testUtterance);
                    synthesis.cancel();
                } catch (e) {
                    /* ignore */
                }
            }, 0);
        }
    };

    // 立即尝试一次
    loadVoices();

    // 监听语音列表变化（处理异步加载的情况）
    synthesis.onvoiceschanged = loadVoices;

    // Safari 兼容：延迟再次尝试加载语音
    setTimeout(() => {
        loadVoices();
    }, 1000);
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

// 获取服务器配置
async function fetchVoiceCloneConfig() {
    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error('获取配置失败');

        const data = await response.json();

        // 更新音色复刻配置
        if (data.voice_clone) {
            // 保存可用的语音列表
            AppState.speechCloneVoices = data.voice_clone.voices || [];

            // 选择默认语音
            if (data.voice_clone.default_voice) {
                AppState.speechCloneSelectedVoice = data.voice_clone.default_voice;
            } else if (AppState.speechCloneVoices.length > 0) {
                AppState.speechCloneSelectedVoice = AppState.speechCloneVoices[0];
            }

            console.log('[Voice Clone] 配置已加载:');
            console.log('  - 可用语音数量:', AppState.speechCloneVoices.length);
            console.log('  - 当前选择:', AppState.speechCloneSelectedVoice);
            console.log('  - configured:', data.voice_clone.configured);

            // 初始化语音选择下拉框
            initSpeechVoiceDropdown();
        }
    } catch (error) {
        console.error('获取音色复刻配置失败:', error);
    }
}

// 初始化语音选择下拉框
function initSpeechVoiceDropdown() {
    const selectEl = document.getElementById('speech-voice-mode-select');
    if (!selectEl) return;

    // 保留第一个"系统"选项，移除其他复刻选项
    const systemOption = selectEl.querySelector('option[value="system"]');
    selectEl.innerHTML = '';
    if (systemOption) {
        selectEl.appendChild(systemOption);
    }

    // 添加音色选项
    AppState.speechCloneVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = `clone-${index}`;
        option.textContent = `音色 (${voice.description || '未知'})`;
        option.dataset.fileId = voice.file_id;
        selectEl.appendChild(option);
    });

    // 默认选择系统模式
    selectEl.value = 'system';
    // 同步更新 AppState
    AppState.speechVoiceMode = 'system';
    AppState.speechCloneSelectedVoice = null;
}

/** 从词书数据展平为单词列表（附词书、单元名，供展示出处） */
function flattenAllWordsFromBooks(wordData) {
    const out = [];
    if (!wordData || !Array.isArray(wordData)) return out;
    for (const book of wordData) {
        const bookName = book.name || '';
        if (!book.units) continue;
        for (const unit of book.units) {
            const unitLabel = unit.unit || unit.title || '';
            if (!unit.words) continue;
            for (const w of unit.words) {
                if (w && typeof w.word === 'string' && w.word.trim()) {
                    out.push({ ...w, _bookName: bookName, _unitLabel: unitLabel });
                }
            }
        }
    }
    return out;
}

/** 东八区（Asia/Shanghai）日历日序号，用于「今日一词」与展示日期一致 */
function getShanghaiDayKey() {
    const s = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
    const [y, m, d] = s.split('-').map(Number);
    return y * 10000 + m * 100 + d;
}

/** 首页标题旁：东八区完整日期与星期（中文） */
function updateHeroShanghaiDate() {
    const el = document.getElementById('hero-daily-shanghai-date');
    if (!el) return;
    const line = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    }).format(new Date());
    el.textContent = ` · ${line}`;
}

/** 按东八区日期确定性选取一词，避免简单取模导致连续多日过于相近 */
function pickWordOfTheDay(words) {
    if (!words.length) return null;
    let h = getShanghaiDayKey();
    h = (Math.imul(h, 7919) + 104729) >>> 0;
    return words[h % words.length];
}

/** 首页 Hero：今日一词 +「问墨小灵」预填问题（替代外链笑话） */
function loadHomeDailyWord() {
    updateHeroShanghaiDate();

    const statusEl = document.getElementById('daily-word-status');
    const innerEl = document.getElementById('daily-word-inner');
    if (!statusEl || !innerEl) return;

    const all = flattenAllWordsFromBooks(AppState.wordData);
    if (!all.length) {
        statusEl.hidden = false;
        statusEl.textContent = '暂无词书数据，请稍后在「单词」页学习。';
        innerEl.hidden = true;
        return;
    }

    const w = pickWordOfTheDay(all);
    if (!w) {
        statusEl.hidden = false;
        statusEl.textContent = '暂时选不出今日一词。';
        innerEl.hidden = true;
        return;
    }

    statusEl.textContent = '';
    statusEl.hidden = true;
    innerEl.hidden = false;

    const plainWord = stripMdForSpeech(w.word) || (w.word || '').replace(/\*\*/g, '').trim();

    const source = [w._bookName, w._unitLabel].filter(Boolean).join(' · ');
    const sourceEl = document.getElementById('daily-word-source');
    if (sourceEl) {
        sourceEl.textContent = source;
        sourceEl.hidden = !source;
    }

    const termEl = document.getElementById('daily-word-term');
    const phEl = document.getElementById('daily-word-phonetic');
    const meanEl = document.getElementById('daily-word-meaning');
    const exEn = document.getElementById('daily-word-example-en');
    const exZh = document.getElementById('daily-word-example-zh');
    const exBlock = document.getElementById('daily-word-example-block');
    const tipEl = document.getElementById('daily-word-tip');
    const hintEl = document.getElementById('daily-word-cta-hint');
    const askBtn = document.getElementById('daily-word-ask-btn');
    const speakUk = document.getElementById('daily-word-speak-uk');
    const speakUs = document.getElementById('daily-word-speak-us');
    const exSpeakWrap = document.getElementById('daily-word-example-speak-wrap');
    const exSpeakUk = document.getElementById('daily-word-example-speak-uk');
    const exSpeakUs = document.getElementById('daily-word-example-speak-us');

    if (termEl) termEl.innerHTML = renderMdInline(w.word || '');
    if (phEl) {
        const ph = (w.phonetic || '').trim();
        phEl.textContent = ph;
        phEl.hidden = !ph;
    }
    if (meanEl) meanEl.innerHTML = renderMdInline(w.meaning || '');

    const hasEn = w.example && String(w.example).trim();
    const hasZh = w.translation && String(w.translation).trim();
    const plainExample = hasEn
        ? stripMdForSpeech(w.example.trim()) || w.example.trim().replace(/\*\*/g, '').trim()
        : '';

    if (exEn) exEn.innerHTML = hasEn ? `「${renderMdInline(w.example.trim())}」` : '';
    if (exZh) exZh.innerHTML = hasZh ? renderMdInline(w.translation.trim()) : '';
    if (exBlock) exBlock.hidden = !hasEn && !hasZh;

    if (exSpeakWrap) {
        exSpeakWrap.hidden = !plainExample;
    }
    if (exSpeakUk) {
        exSpeakUk.disabled = !plainExample;
        exSpeakUk.onclick = () => {
            if (plainExample) speakExample(plainExample, 'gb');
        };
    }
    if (exSpeakUs) {
        exSpeakUs.disabled = !plainExample;
        exSpeakUs.onclick = () => {
            if (plainExample) speakExample(plainExample, 'us');
        };
    }

    if (tipEl) {
        const tip = (w.memoryTip || '').trim();
        if (tip) {
            tipEl.innerHTML = `小提示：${renderMdInline(tip)}`;
            tipEl.hidden = false;
        } else {
            tipEl.textContent = '';
            tipEl.hidden = true;
        }
    }

    const q = `${plainWord} 是什么意思？`;

    if (speakUk) {
        speakUk.disabled = !plainWord;
        speakUk.onclick = () => {
            if (plainWord) speakWord(plainWord);
        };
    }
    if (speakUs) {
        speakUs.disabled = !plainWord;
        speakUs.onclick = () => {
            if (plainWord) speakWordUS(plainWord);
        };
    }
    if (hintEl) hintEl.textContent = '点击后帮你填好问题，并滑到墨小灵';

    if (askBtn) {
        askBtn.onclick = () => {
            const input = document.getElementById('qa-input');
            if (input) {
                input.value = q;
                input.focus();
            }
            const heading = document.getElementById('moxiaoling-heading');
            if (heading) {
                heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };
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
            else if (action === 'go-sentences') switchPage('sentences');
            else if (action === 'go-readings') switchPage('readings');
            else if (action === 'go-wrongbook') switchPage('wrongbook');
            else if (action === 'go-favorites') switchPage('favorites');
        });
    });

    document.getElementById('qa-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            submitQA();
        }
    });

    initMoxiaolingMascotInteraction();

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
/** 同步导航高亮与无障碍属性；pageName 为空则全部取消高亮 */
function setActiveNavPage(pageName) {
    const match = pageName != null && pageName !== '' ? pageName : null;
    DOM.navBtns.forEach(btn => {
        const active = match !== null && btn.dataset.page === match;
        btn.classList.toggle('active', active);
        if (active) {
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.removeAttribute('aria-current');
        }
    });
    scrollActiveNavIntoView();
}

/** 窄屏横向导航时，将当前项滚入可视区域 */
function scrollActiveNavIntoView() {
    const active = document.querySelector('.nav-btn.active');
    const sc = document.querySelector('.nav-scroll');
    if (!active || !sc) return;
    if (sc.scrollWidth <= sc.clientWidth + 1) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    active.scrollIntoView({
        inline: 'center',
        block: 'nearest',
        behavior: reduced ? 'auto' : 'smooth'
    });
}

function switchPage(pageName) {
    setActiveNavPage(pageName);

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
            initDictationPage();
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
        case 'readings':
            showReadingsPage();
            break;
        case 'speech':
            showSpeechPage();
            break;
        case 'dictation':
        case 'dictation-result':
            // 这两个页面通过函数内部调用 switchPage，无需特殊初始化
            break;
        case 'progress':
            renderProgressPage();
            break;
        case 'tool':
            initToolPage();
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
        // 向后兼容：确保 wrongSentences 字段存在
        if (!AppState.userProgress.wrongSentences) {
            AppState.userProgress.wrongSentences = [];
        }
    } else {
        AppState.userProgress = {
            wordProgress: {},
            wrongWords: [],
            wrongSentences: [],  // 错句列表（v2.9+）
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
    updateHeroShanghaiDate();

    const todayStats = getTodayStats();

    document.getElementById('today-reviewed').textContent = todayStats.reviewed;
    document.getElementById('today-correct').textContent = todayStats.correct;
    document.getElementById('today-accuracy').textContent = todayStats.accuracy + '%';
    document.getElementById('streak-days').textContent = AppState.userProgress.stats.currentStreak;

    // 今日阅读统计
    const todayReadings = getTodayReadingCount();
    document.getElementById('today-readings').textContent = todayReadings;
}

// 获取今日阅读数量
function getTodayReadingCount() {
    const today = new Date().toISOString().split('T')[0];
    const completedReadings = JSON.parse(localStorage.getItem('completedReadings') || '[]');
    const readingDates = JSON.parse(localStorage.getItem('readingDates') || '{}');

    // 如果今天的日期有记录，返回记录的数量
    if (readingDates[today]) {
        return readingDates[today].length;
    }

    // 否则返回 0
    return 0;
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

// ========== 单词听写页 ==========

// 听写会话状态
AppState.dictationSession = null;

// 初始化单词听写页面
function initDictationPage() {
    // 初始化书本选择器
    initWordBookSelector();

    // 绑定输入框事件
    const dictationInput = document.getElementById('dictation-input');
    if (dictationInput) {
        dictationInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                checkDictationAnswer();
            }
        });
    }

    // 绑定按钮事件
    const playBtn = document.getElementById('dictation-play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', playDictationWord);
    }

    // 绑定查看答案按钮
    const showAnswerBtn = document.getElementById('dictation-show-answer-btn');
    if (showAnswerBtn) {
        showAnswerBtn.addEventListener('click', showDictationAnswer);
    }

    const checkBtn = document.getElementById('dictation-check-btn');
    if (checkBtn) {
        checkBtn.addEventListener('click', checkDictationAnswer);
    }

    const skipBtn = document.getElementById('dictation-skip-btn');
    if (skipBtn) {
        skipBtn.addEventListener('click', skipDictationWord);
    }

    // 绑定结果页按钮
    const retryBtn = document.getElementById('dictation-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            if (AppState.dictationSession) {
                startDictationWithSession(AppState.dictationSession);
            }
        });
    }

    const backBtn = document.getElementById('dictation-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => switchPage('words'));
    }
}

// 初始化词书选择器
function initWordBookSelector() {
    const wordbookSelect = document.getElementById('wordbook-select');
    if (!wordbookSelect) return;

    // 清空并重新填充
    wordbookSelect.innerHTML = '';

    AppState.wordData.forEach((wordbook, index) => {
        const option = document.createElement('option');
        option.value = wordbook.id || index;
        option.textContent = wordbook.name;
        wordbookSelect.appendChild(option);
    });

    // 绑定选择变化事件
    wordbookSelect.onchange = function(e) {
        handleWordBookChange(e.target.value);
    };

    // 自动选择第一个书本
    if (AppState.wordData.length > 0) {
        const firstBookId = AppState.wordData[0].id || 0;
        wordbookSelect.value = firstBookId;
        handleWordBookChange(firstBookId);
    }
}

// 处理书本选择变化
function handleWordBookChange(bookId) {
    const unitSelect = document.getElementById('word-unit-select');
    if (!unitSelect) return;

    const book = AppState.wordData.find(b => (b.id || AppState.wordData.indexOf(b)) == bookId);
    if (!book || !book.units) {
        unitSelect.innerHTML = '<option value="">该书本下暂无数据</option>';
        unitSelect.disabled = true;
        return;
    }

    // 清空并填充单元选择器
    unitSelect.innerHTML = '';

    // 添加"全部单元"选项
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '全部单元';
    defaultOption.selected = true;
    unitSelect.appendChild(defaultOption);

    book.units.forEach(unit => {
        const option = document.createElement('option');
        option.value = unit.unit;
        option.textContent = unit.unit;
        unitSelect.appendChild(option);
    });
    unitSelect.disabled = false;
}

// 开始听写
function startDictation() {
    const wordbookSelect = document.getElementById('wordbook-select');
    const unitSelect = document.getElementById('word-unit-select');

    const bookId = wordbookSelect?.value;
    const unitName = unitSelect?.value;

    if (!bookId) {
        showToast('请先选择书本');
        return;
    }

    const book = AppState.wordData.find(b => (b.id || AppState.wordData.indexOf(b)) == bookId);
    if (!book || !book.units) {
        showToast('没有找到单词数据');
        return;
    }

    // 收集所有单词
    let allWords = [];
    book.units.forEach(unit => {
        // 如果选择了具体单元，只收集该单元的单词
        if (unitName && unit.unit !== unitName) return;

        if (unit.words && Array.isArray(unit.words)) {
            unit.words.forEach(word => {
                allWords.push({
                    ...word,
                    unitName: unit.unit
                });
            });
        }
    });

    if (allWords.length === 0) {
        showToast('没有找到单词');
        return;
    }

    // 随机打乱顺序
    allWords = allWords.sort(() => Math.random() - 0.5);

    // 创建会话
    AppState.dictationSession = {
        words: allWords,
        currentIndex: 0,
        correctCount: 0,
        wrongCount: 0,
        wrongWordIds: [],
        startTime: Date.now(),
        isPaused: false
    };

    // 跳转到听写页面
    switchPage('dictation');
    showCurrentWord();
}

// 显示当前单词
/**
 * 问题背景：
 * 1. 当用户从听写页面切换到其他页面后，如果 still 有 AppState.dictationSession 存在，
 *    点击"跳过"按钮会触发 skipDictationWord，进而调用 showCurrentWord。
 *    但此时听写页面（#page-dictation）不是激活状态，DOM 元素可能不存在或不可见，
 *    导致 document.getElementById() 返回 null。
 *
 * 2. HTML 模板中只定义了部分 DOM 元素（如 dictation-word），而代码中可能尝试访问
 *    不存在的元素（如之前尝试访问的 dictation-phonetic 和 dictation-meaning），
 *    导致 Cannot set properties of null 错误。
 *
 * 解决方案：
 * 1. 在 showCurrentWord 和 skipDictationWord 中检查听写页面是否激活，
 *    如果页面未激活则直接返回，不执行后续操作。
 * 2. 先获取所有需要的 DOM 元素，检查是否存在后再使用，
 *    如果任何必要元素不存在，直接返回并记录日志。
 *
 * 注意事项：
 * - HTML 模板（index.html）中只有 dictation-word 元素，没有单独的 phonetic 和 meaning 元素
 * - 如果需要访问某个元素，必须先在 HTML 中定义，或者在代码中进行空值检查
 */
function showCurrentWord() {
    const session = AppState.dictationSession;
    if (!session) return;

    // 确保听写页面是激活的
    const dictationPage = document.getElementById('page-dictation');
    if (!dictationPage || !dictationPage.classList.contains('active')) {
        console.log('[Dictation] Skip showCurrentWord - page not active');
        return;
    }

    const { words, currentIndex } = session;

    if (currentIndex >= words.length) {
        endDictation();
        return;
    }

    const word = words[currentIndex];
    const total = words.length;

    // 更新进度
    const progressText = document.getElementById('dictation-progress-text');
    const progressFill = document.getElementById('dictation-progress-fill');
    const dictationWord = document.getElementById('dictation-word');
    const dictationInput = document.getElementById('dictation-input');
    const feedbackEl = document.getElementById('dictation-feedback');

    // 检查必要元素是否存在
    if (!progressText || !progressFill || !dictationWord || !dictationInput || !feedbackEl) {
        console.log('[Dictation] Required elements not found, aborting showCurrentWord');
        return;
    }

    progressText.textContent = `${currentIndex + 1} / ${total}`;
    const progressPercent = ((currentIndex) / total) * 100;
    progressFill.style.width = `${progressPercent}%`;

    // 只显示中文含义，不显示英文单词和音标（听写时只看中文写英文）
    dictationWord.textContent = word.meaning || '';

    // 清空输入框和反馈，重置边框颜色
    dictationInput.value = '';
    dictationInput.focus();
    dictationInput.classList.remove('input-error');
    dictationInput.classList.remove('input-correct');
    feedbackEl.style.display = 'none';

    // 清除答案显示区域
    const answerDisplay = document.getElementById('dictation-answer-display');
    answerDisplay.style.display = 'none';
    answerDisplay.innerHTML = '';

    // 自动播放单词发音（延迟执行，确保页面渲染完成）
    setTimeout(() => {
        speakWord(word.word);
    }, 300);
}

// 播放当前单词发音
function playDictationWord() {
    const session = AppState.dictationSession;
    if (!session) return;

    const { words, currentIndex } = session;
    if (currentIndex < words.length) {
        speakWord(words[currentIndex].word);
    }
}

// 显示答案
function showDictationAnswer() {
    const session = AppState.dictationSession;
    if (!session) return;

    const { words, currentIndex } = session;
    if (currentIndex >= words.length) return;

    const word = words[currentIndex];
    const input = document.getElementById('dictation-input');
    const feedbackEl = document.getElementById('dictation-feedback');
    const answerDisplay = document.getElementById('dictation-answer-display');

    // 显示答案
    answerDisplay.innerHTML = `
        <div class="answer-label">参考答案：</div>
        <div class="answer-word">${word.word}</div>
        ${word.phonetic ? `<div class="answer-phonetic">${word.phonetic}</div>` : ''}
    `;
    answerDisplay.style.display = 'block';

    // 隐藏反馈，重置边框颜色
    feedbackEl.style.display = 'none';
    input.classList.remove('input-error');
    input.classList.remove('input-correct');
}

// 检查答案
function checkDictationAnswer() {
    const session = AppState.dictationSession;
    if (!session) return;

    const { words, currentIndex } = session;
    if (currentIndex >= words.length) return;

    const word = words[currentIndex];
    const input = document.getElementById('dictation-input');
    const userAnswer = input.value.trim().toLowerCase();
    const correctAnswer = word.word.toLowerCase();

    const feedbackEl = document.getElementById('dictation-feedback');

    if (userAnswer === correctAnswer) {
        // 正确答案
        session.correctCount++;
        feedbackEl.innerHTML = '<span class="feedback-correct">太棒了！</span>';
        feedbackEl.style.display = 'block';
        input.classList.add('input-correct');
        input.classList.remove('input-error');

        setTimeout(() => {
            session.currentIndex++;
            showCurrentWord();
        }, 1000);
    } else {
        // 错误答案
        session.wrongCount++;
        // 使用纯 word.id（不带索引），以便能正确匹配到错词本中的单词
        const wordId = word.id;

        if (!session.wrongWordIds.includes(wordId)) {
            session.wrongWordIds.push(wordId);
        }

        // 添加到错词本
        const progress = AppState.userProgress;
        if (!progress.wrongWords.includes(wordId)) {
            progress.wrongWords.push(wordId);
            saveUserProgress();
        }

        input.classList.add('input-error');
        input.classList.remove('input-correct');
        feedbackEl.innerHTML = '<span class="feedback-wrong">加油！</span>';
        feedbackEl.style.display = 'block';
    }
}

// 跳过当前单词
function skipDictationWord() {
    const session = AppState.dictationSession;
    if (!session) return;

    // 确保听写页面是激活的
    const dictationPage = document.getElementById('page-dictation');
    if (!dictationPage || !dictationPage.classList.contains('active')) {
        console.log('[Dictation] Skip skipDictationWord - page not active');
        return;
    }

    session.currentIndex++;

    showCurrentWord();
}

// 结束听写
function endDictation() {
    const session = AppState.dictationSession;
    if (!session) return;

    const { correctCount, wrongCount, startTime, words, wrongWordIds } = session;
    const total = correctCount + wrongCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // 计算用时
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // 更新结果页面
    document.getElementById('dictation-accuracy').textContent = accuracy + '%';
    document.getElementById('dictation-correct').textContent = correctCount;
    document.getElementById('dictation-wrong').textContent = wrongCount;
    document.getElementById('dictation-time').textContent = timeStr;

    // 显示错误单词列表
    const wrongWordsSection = document.getElementById('dictation-wrong-words');
    const wrongList = document.getElementById('dictation-wrong-list');

    if (wrongWordIds.length > 0) {
        wrongWordsSection.style.display = 'block';
        wrongList.innerHTML = wrongWordIds.map(wordId => {
            // 通过 word.id 查找对应的单词
            const word = words.find(w => w.id === wordId);
            if (!word) return '';
            return `
                <div class="wrong-word-item">
                    <div class="wrong-word-en">${word.word}</div>
                    <div class="wrong-word-cn">${word.meaning}</div>
                </div>
            `;
        }).join('');
    } else {
        wrongWordsSection.style.display = 'none';
    }

    // 跳转到结果页面
    switchPage('dictation-result');
}

// 重新开始听写
function startDictationWithSession(session) {
    AppState.dictationSession = {
        words: session.words,
        currentIndex: 0,
        correctCount: 0,
        wrongCount: 0,
        wrongWordIds: [],
        startTime: Date.now(),
        isPaused: false
    };
    switchPage('dictation');
    showCurrentWord();
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
                id: word.id,
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

    // 更新问题（支持 ** 粗体等简单 Markdown）
    document.getElementById('question-label').textContent =
        question.questionType === 'en-to-zh' ? '英文' : '中文';
    const questionTextEl = document.getElementById('question-text');
    questionTextEl.innerHTML = renderMdInline(question.question);

    // 更新答案（支持 ** 粗体等简单 Markdown）；发音用下方英音/美音按钮，不再在单词后显示图标
    const answerWordEl = document.getElementById('answer-word');
    const wordText = (question.answer.word || '').trim();
    answerWordEl.innerHTML = renderMdInline(wordText);
    document.getElementById('answer-phonetic').textContent = question.answer.phonetic || '';
    const answerMeaningEl = document.getElementById('answer-meaning');
    answerMeaningEl.innerHTML = renderMdInline(question.answer.meaning);

    // 更新收藏按钮状态
    updateFavoriteButton(question.answer.id);

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
        const exampleForSpeech = stripMdForSpeech(question.answer.example);
        const safeExample = exampleForSpeech.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        exampleEl.innerHTML = `
            <p class="example-en">
                ${renderMdInline(question.answer.example)}
                <button class="audio-btn small" title="播放例句" onclick="speakExample('${safeExample}')">🔊</button>
            </p>
            <p class="example-zh">${renderMdInline(question.answer.translation || '')}</p>
        `;
        exampleEl.style.display = 'block';
    } else {
        exampleEl.style.display = 'none';
    }

    const tipEl = document.getElementById('answer-tip');
    if (question.answer.memoryTip) {
        tipEl.innerHTML = '💡 ' + renderMdInline(question.answer.memoryTip);
        tipEl.style.display = 'block';
    } else {
        tipEl.style.display = 'none';
    }
}

// 播放当前闪卡单词发音（去掉 Markdown 标记后再朗读）
function speakCurrentWord() {
    const session = AppState.flashcardSession;
    if (session && session.questions[session.currentIndex]) {
        const question = session.questions[session.currentIndex];
        const wordToSpeak = stripMdForSpeech(question.answer.word);
        speakWord(wordToSpeak);
    }
}

// 播放当前闪卡单词发音（美音，去掉 Markdown 标记后再朗读）
function speakCurrentWordUS() {
    const session = AppState.flashcardSession;
    if (session && session.questions[session.currentIndex]) {
        const question = session.questions[session.currentIndex];
        const wordToSpeak = stripMdForSpeech(question.answer.word);
        speakWordUS(wordToSpeak);
    }
}

// 更新收藏按钮状态
function updateFavoriteButton(wordId) {
    const favoriteBtn = document.getElementById('favorite-btn');
    if (!favoriteBtn) return;

    const progress = AppState.userProgress;
    const isFavorited = progress.favoriteWords && progress.favoriteWords.includes(wordId);

    if (isFavorited) {
        favoriteBtn.classList.add('favorited');
        favoriteBtn.querySelector('.favorite-icon').textContent = '❤️';
    } else {
        favoriteBtn.classList.remove('favorited');
        favoriteBtn.querySelector('.favorite-icon').textContent = '🤍';
    }
}

// 切换收藏当前单词
function toggleFavoriteCurrentWord() {
    const session = AppState.flashcardSession;
    if (!session || !session.questions[session.currentIndex]) return;

    const question = session.questions[session.currentIndex];
    const wordId = question.answer.id;

    toggleFavorite(wordId);
    updateFavoriteButton(wordId);

    // 播放收藏音效反馈
    const isFavorited = AppState.userProgress.favoriteWords.includes(wordId);
    if (isFavorited) {
        playClickSound();
    }
}

function revealAnswer() {
    DOM.flashcard.classList.add('flipped');

    // 检测内容是否溢出，添加滚动样式
    setTimeout(() => {
        const flashcardBack = DOM.flashcard.querySelector('.flashcard-back');
        if (flashcardBack) {
            // 检查内容是否溢出
            if (flashcardBack.scrollHeight > flashcardBack.clientHeight) {
                flashcardBack.classList.add('scrolling');
            } else {
                flashcardBack.classList.remove('scrolling');
            }
        }

        // 自动播放当前单词发音
        const session = AppState.flashcardSession;
        if (session && session.questions[session.currentIndex]) {
            const question = session.questions[session.currentIndex];
            speakWord(question.answer.word);
        }
    }, 100);
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

// ========== 错题本页面 ==========
function renderWrongbookPage() {
    renderWrongbookWordsTab();
    renderWrongbookSentencesTab();
}

// ========== 错题本页面 ==========
function renderWrongbookPage() {
    renderWrongbookWordsTab();
    renderWrongbookSentencesTab();
}

// 切换错题本标签页
function switchWrongbookTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.wrongbook-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // 更新内容显示
    document.querySelectorAll('.wrongbook-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById('tab-' + tabName).classList.add('active');

    // 切换时刷新当前标签页内容
    if (tabName === 'words') {
        renderWrongbookWordsTab();
    } else {
        renderWrongbookSentencesTab();
    }
}

// 渲染错词标签页
function renderWrongbookWordsTab() {
    // 确保数据已加载
    if (!AppState.wordData || AppState.wordData.length === 0) {
        console.log('单词数据未加载，跳过错词标签页渲染');
        return;
    }

    if (!AppState.userProgress) {
        console.log('用户进度未加载，跳过错词标签页渲染');
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

    // 确保 wrongWords 是数组
    if (!Array.isArray(progress.wrongWords)) {
        progress.wrongWords = [];
    }

    // 先清理无效的ID（null, undefined, 空字符串）
    const originalCount = progress.wrongWords.length;
    progress.wrongWords = progress.wrongWords.filter(id => id && typeof id === 'string');

    // 如果有清理掉的无效ID，更新localStorage
    if (progress.wrongWords.length !== originalCount) {
        const removedCount = originalCount - progress.wrongWords.length;
        saveUserProgress();
    }

    // 获取所有有效的单词ID
    const validWordIds = new Set(allWords.map(w => w.id));

    // 清理无效的错词记录
    const afterCleanupCount = progress.wrongWords.length;
    progress.wrongWords = progress.wrongWords.filter(id => validWordIds.has(id));

    // 如果有清理掉的记录，更新localStorage
    if (progress.wrongWords.length !== afterCleanupCount) {
        const removedCount = afterCleanupCount - progress.wrongWords.length;
        saveUserProgress();
    }

    // 获取错词详情
    const wrongWordDetails = progress.wrongWords.map(id => {
        const word = allWords.find(w => w.id === id);
        const wp = progress.wordProgress ? progress.wordProgress[id] : null;
        return { word, wp, id };
    });

    // 更新统计
    document.getElementById('wrongbook-count').textContent = wrongWordDetails.length;

    // 渲染错词列表
    const wrongbookWordsEl = document.getElementById('wrongbook-words');

    if (wrongWordDetails.length === 0) {
        wrongbookWordsEl.innerHTML = '<p class="empty-message">🎉 恭喜！错词列表为空，继续保持！</p>';
        return;
    }

    // 分页设置
    const ITEMS_PER_PAGE = 8;
    const totalPages = Math.ceil(wrongWordDetails.length / ITEMS_PER_PAGE);

    // 获取当前页码（从 sessionStorage 或 URL 参数获取）
    let currentPage = 1;
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('wrongbook_page');
    if (pageParam) {
        currentPage = Math.max(1, Math.min(parseInt(pageParam) || 1, totalPages));
    }

    // 获取当前页的错词
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, wrongWordDetails.length);
    const currentPageItems = wrongWordDetails.slice(startIndex, endIndex);

    let html = '';
    let missingCount = 0;
    let renderError = null;

    try {
        // 渲染分页信息
        html += `
            <div class="wrongbook-pagination-info">
                <span>显示 ${startIndex + 1}-${endIndex} 条，共 ${wrongWordDetails.length} 条错词</span>
            </div>
        `;

        // 渲染单词卡片网格
        html += '<div class="wrongbook-word-grid">';

        currentPageItems.forEach((item, index) => {
            const { word, wp, id } = item;

                if (!word) {
                    missingCount++;
                    return;
                }

            try {
                const masteryLevel = wp ? wp.masteryLevel : 0;
                const masteryText = masteryLevel >= 4 ? '已掌握' : (masteryLevel >= 2 ? '学习中' : '待复习');
                const wrongCount = wp ? wp.wrongCount : 0;

                // 根据熟练度设置不同的边框颜色
                let cardClass = 'wrongbook-word-card';
                if (masteryLevel >= 4) cardClass += ' mastered';
                else if (masteryLevel >= 2) cardClass += ' learning';

                html += `
                    <div class="${cardClass}" data-word-id="${id}">
                        <div class="word-card-header">
                            <span class="word-index">${startIndex + index + 1}</span>
                            <button class="remove-btn-small" onclick="removeFromWrongbook('${id}')" title="从错词本移除">✕</button>
                        </div>
                        <div class="word-card-content">
                            <div class="word-card-main">
                                <div class="word-text">
                                    ${escapeHtml(word.word || '')}
                                    <button class="audio-btn-small" title="播放英音" onclick="speakWord('${escapeHtml(word.word || '').replace(/'/g, "\\'")}')">🔊</button>
                                </div>
                                <div class="word-phonetic">${escapeHtml(word.phonetic || '')}</div>
                                <div class="word-meaning">${escapeHtml(word.meaning || '')}</div>
                            </div>
                            ${word.example ? `
                                <div class="word-card-example">
                                    <span class="example-label">例句：</span>
                                    <div class="example-content">${escapeHtml(word.example)}</div>
                                    ${word.translation ? `<div class="example-translation">${escapeHtml(word.translation)}</div>` : ''}
                                </div>
                            ` : ''}
                            ${word.memoryTip ? `
                                <div class="word-card-tip">
                                    <span class="tip-icon">💡</span>
                                    <span>${escapeHtml(word.memoryTip)}</span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="word-card-footer">
                            <span class="mastery-badge ${masteryLevel >= 4 ? 'mastered' : (masteryLevel >= 2 ? 'learning' : 'review')}">${masteryText}</span>
                            ${wrongCount > 0 ? `<span class="wrong-count-badge">错${wrongCount}次</span>` : ''}
                        </div>
                    </div>
                `;
            } catch (e) {
                console.error('[Wrongbook] 渲染单词出错:', id, e);
            }
        });

        html += '</div>';

        // 渲染分页导航
        if (totalPages > 1) {
            html += `
                <div class="wrongbook-pagination">
                    <button class="page-btn" onclick="goToWrongbookPage(1)" ${currentPage === 1 ? 'disabled' : ''}>首页</button>
                    <button class="page-btn" onclick="goToWrongbookPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>
                    <span class="page-info">${currentPage} / ${totalPages}</span>
                    <button class="page-btn" onclick="goToWrongbookPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>
                    <button class="page-btn" onclick="goToWrongbookPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>末页</button>
                </div>
            `;
        }

        // 如果有缺失的错词ID，显示警告信息
        if (missingCount > 0) {
            const missingIds = wrongWordDetails
                .filter(item => !item.word)
                .map(item => item.id)
                .join(', ');
            html += `
                <div class="wrongbook-warning" style="margin-top: 16px; padding: 12px; background: #fff3cd; border-radius: 8px; color: #856404;">
                    <p style="margin: 0 0 8px 0; font-weight: bold;">⚠️ 部分错词无法显示</p>
                    <p style="margin: 0; font-size: 0.85rem;">
                        有 ${missingCount} 个错词ID在当前单词数据中找不到匹配的单词。<br>
                        缺失的ID: ${missingIds}
                    </p>
                </div>
            `;
        }
    } catch (e) {
        renderError = e;
        console.error('[Wrongbook] 渲染错词列表出错:', e);
    }

    if (renderError) {
        wrongbookWordsEl.innerHTML = '<p class="empty-message">⚠️ 渲染出错: ' + renderError.message + '</p>';
    } else if (html === '') {
        wrongbookWordsEl.innerHTML = '<p class="empty-message">⚠️ 没有可显示的错词</p>';
    } else {
        wrongbookWordsEl.innerHTML = html;
    }
}

// 渲染错句标签页
function renderWrongbookSentencesTab() {
    if (!AppState.userProgress) {
        console.log('用户进度未加载，跳过错句标签页渲染');
        return;
    }

    const progress = AppState.userProgress;

    // 确保 wrongSentences 是数组
    if (!Array.isArray(progress.wrongSentences)) {
        progress.wrongSentences = [];
    }

    // 更新统计
    document.getElementById('wrongsentence-count').textContent = progress.wrongSentences.length;

    // 渲染错句列表
    const wrongbookSentencesEl = document.getElementById('wrongbook-sentences');

    if (progress.wrongSentences.length === 0) {
        wrongbookSentencesEl.innerHTML = '<p class="empty-message">🎉 恭喜！错句列表为空，继续保持！</p>';
        return;
    }

    // 创建阅读材料映射，用于根据 ID 查找标题
    const readingsMap = {};
    if (AppState.readings) {
        AppState.readings.forEach(reading => {
            readingsMap[reading.id] = reading;
        });
    }

    // 分页设置
    const ITEMS_PER_PAGE = 6;
    const totalPages = Math.ceil(progress.wrongSentences.length / ITEMS_PER_PAGE);

    // 获取当前页码
    let currentPage = 1;
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('wrongsentence_page');
    if (pageParam) {
        currentPage = Math.max(1, Math.min(parseInt(pageParam) || 1, totalPages));
    }

    // 获取当前页的错句
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, progress.wrongSentences.length);
    const currentPageItems = progress.wrongSentences.slice(startIndex, endIndex);

    let html = '';

    // 渲染分页信息
    html += `
        <div class="wrongbook-pagination-info">
            <span>显示 ${startIndex + 1}-${endIndex} 条，共 ${progress.wrongSentences.length} 条错句</span>
        </div>
    `;

    // 渲染错句卡片网格
    html += '<div class="wrongsentence-card-grid">';

    currentPageItems.forEach((item, index) => {
        const globalIndex = startIndex + index;

        // 获取标题：优先使用 readingTitleCn，如果是以 reading- 开头则尝试查找
        let displayTitle = item.readingTitleCn || '';
        if (displayTitle && displayTitle.startsWith('reading-')) {
            // 旧数据格式，尝试从阅读材料中查找标题
            const reading = readingsMap[item.readingId] || readingsMap[item.readingTitleCn];
            if (reading) {
                displayTitle = reading.titleCn || reading.title || displayTitle;
            } else {
                // 如果找不到，提取单元编号显示更友好的格式
                const unitNum = displayTitle.replace('reading-', '');
                displayTitle = `阅读材料 ${unitNum}`;
            }
        }

        html += `
            <div class="wrongsentence-card" data-sentence-id="${item.id}">
                <div class="sentence-card-header">
                    <span class="sentence-index">${globalIndex + 1}</span>
                    <div class="sentence-card-actions">
                        <button class="audio-btn-small" title="朗读句子" onclick="playWrongSentence(${globalIndex})">🔊</button>
                        <button class="remove-btn-small" onclick="removeFromWrongSentences('${item.id}')" title="从错句本移除">✕</button>
                    </div>
                </div>
                <div class="sentence-card-content">
                    <div class="sentence-english">${escapeHtml(item.english)}</div>
                    <div class="sentence-chinese">${escapeHtml(item.chinese)}</div>
                </div>
                <div class="sentence-card-footer">
                    <span class="reading-badge">《${escapeHtml(displayTitle)}》</span>
                    <span class="wrong-count-badge">错${item.wrongCount}次</span>
                </div>
            </div>
        `;
    });

    html += '</div>';

    // 渲染分页导航
    if (totalPages > 1) {
        html += `
            <div class="wrongbook-pagination">
                <button class="page-btn" onclick="goToWrongbookSentencesPage(1)" ${currentPage === 1 ? 'disabled' : ''}>首页</button>
                <button class="page-btn" onclick="goToWrongbookSentencesPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>
                <span class="page-info">${currentPage} / ${totalPages}</span>
                <button class="page-btn" onclick="goToWrongbookSentencesPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>
                <button class="page-btn" onclick="goToWrongbookSentencesPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>末页</button>
            </div>
        `;
    }

    wrongbookSentencesEl.innerHTML = html;
}

// 错句本分页跳转
function goToWrongbookSentencesPage(page) {
    const url = new URL(window.location);
    url.searchParams.set('wrongsentence_page', page);
    window.history.pushState({}, '', url);
    renderWrongbookSentencesTab();
}

// 播放错句本中的句子（通过索引）
function playWrongSentence(globalIndex) {
    const progress = AppState.userProgress;
    if (!progress.wrongSentences || globalIndex >= progress.wrongSentences.length) {
        return;
    }
    const sentence = progress.wrongSentences[globalIndex];
    if (sentence && sentence.english) {
        speakSentence(sentence.english);
    }
}

// 朗读句子
function speakSentence(english) {
    if (!english) return;

    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成');
        return;
    }

    // 取消之前的朗读
    try {
        window.speechSynthesis.cancel();
    } catch (e) {
        // 忽略取消时的错误
    }

    const utterance = new SpeechSynthesisUtterance(english);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;

    // 添加错误处理
    utterance.onerror = (event) => {
        // 对于 'canceled' 和 'interrupted' 错误，不做处理
    };

    // 尝试选择美式英语语音
    try {
        const voices = window.speechSynthesis.getVoices();
        const americanVoice = voices.find(voice =>
            voice.lang.startsWith('en-US') && voice.name.includes('Female')
        );
        if (americanVoice) {
            utterance.voice = americanVoice;
        }

        window.speechSynthesis.speak(utterance);
    } catch (e) {
        // 忽略语音播放时的错误
    }
}

// ========== 错句管理函数 ==========
function addWrongSentence(sentenceData) {
    const progress = AppState.userProgress;

    if (!progress.wrongSentences) {
        progress.wrongSentences = [];
    }

    const existing = progress.wrongSentences.find(s => s.id === sentenceData.id);

    if (existing) {
        existing.wrongCount += 1;
        existing.lastWrongDate = new Date().toISOString().split('T')[0];
    } else {
        progress.wrongSentences.push({
            ...sentenceData,
            wrongCount: 1,
            lastWrongDate: new Date().toISOString().split('T')[0]
        });
    }

    saveUserProgress();
    console.log('添加/更新错句:', sentenceData.id);
}

function removeFromWrongSentences(sentenceId) {
    const progress = AppState.userProgress;
    const index = progress.wrongSentences.findIndex(s => s.id === sentenceId);

    if (index > -1) {
        progress.wrongSentences.splice(index, 1);
        saveUserProgress();
        renderWrongbookSentencesTab();
        console.log('从错句本移除:', sentenceId);
    }
}

function clearWrongSentences() {
    if (!confirm('确定要清空错句列表中的所有记录吗？此操作不可恢复。')) {
        return;
    }
    AppState.userProgress.wrongSentences = [];
    saveUserProgress();
    renderWrongbookSentencesTab();
    alert('错句列表已清空');
}

function reviewAllWrongSentences() {
    console.log('reviewAllWrongSentences called');

    const progress = AppState.userProgress;
    if (!progress.wrongSentences || progress.wrongSentences.length === 0) {
        alert('错句列表为空，没有需要复习的句子');
        return;
    }

    console.log('Number of wrong sentences:', progress.wrongSentences.length);

    // 将错句转换为对话格式，用于复用现有的句子练习界面
    const dialogues = progress.wrongSentences.map((sentence) => ({
        id: sentence.id,  // 保留原始错句 ID，用于排重
        content: sentence.english,
        contentCn: sentence.chinese,
        speaker: '',
        speakerCn: '',
        sourceId: sentence.readingTitleCn || ''
    }));

    // 创建练习会话
    AppState.sentencesSession = {
        dialogues: shuffleArray(dialogues),
        currentIndex: 0,
        correctCount: 0,
        wrongCount: 0,
        wrongSentenceIds: [],
        startTime: Date.now(),
        isPaused: false
    };

    // 切换到语句练习页面
    switchPage('sentence-practice');

    // 延迟一下确保页面切换完成
    setTimeout(() => {
        showCurrentSentence();
    }, 100);
}

// ========== 原有错词本函数（保持兼容）==========
function reviewAllWrongWords() {
    console.log('reviewAllWrongWords called');
    reviewWrongWords();
}

function clearWrongbook(type = 'words') {
    if (type === 'sentences') {
        clearWrongSentences();
        return;
    }

    if (confirm('确定要清空错词列表中的所有记录吗？此操作不可恢复。')) {
        AppState.userProgress.wrongWords = [];
        saveUserProgress();
        renderWrongbookWordsTab();

        const reviewWrongBtn = document.getElementById('review-wrong-btn');
        if (reviewWrongBtn) {
            reviewWrongBtn.style.display = 'none';
        }

        alert('错词列表已清空');
    }
}

function removeFromWrongbook(wordId) {
    const index = AppState.userProgress.wrongWords.indexOf(wordId);
    if (index > -1) {
        AppState.userProgress.wrongWords.splice(index, 1);
        saveUserProgress();
        renderWrongbookWordsTab();
    }
}

// 错词本分页跳转
function goToWrongbookPage(page) {
    const url = new URL(window.location);
    url.searchParams.set('wrongbook_page', page);
    window.history.pushState({}, '', url);
    renderWrongbookWordsTab();
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

    // 清理无效的收藏ID
    const validFavoriteIds = favoriteIds.filter(id => id && typeof id === 'string');
    if (validFavoriteIds.length !== favoriteIds.length) {
        progress.favoriteWords = validFavoriteIds;
        saveUserProgress();
    }

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
    try {
        const html = favoriteWords.map(word => `
            <div class="word-card" data-word-id="${escapeHtml(word.id)}">
                <div class="word-main">
                    <div class="word-text">
                        ${escapeHtml(word.word)}
                        ${word.phonetic ? `<span class="word-phonetic">${escapeHtml(word.phonetic)}</span>` : ''}
                    </div>
                    <div class="word-meaning">${escapeHtml(word.meaning)}</div>
                    ${word.example ? `
                        <div class="word-example">
                            ${escapeHtml(word.example)}
                            <button class="audio-btn small" title="播放例句" onclick="speakExample('${escapeHtml(word.example.replace(/'/g, "\\'"))}')">🔊</button>
                            ${word.translation ? ' — ' + escapeHtml(word.translation) : ''}
                        </div>
                    ` : ''}
                    ${word.memoryTip ? `<div class="word-tip">💡 ${escapeHtml(word.memoryTip)}</div>` : ''}
                </div>
                <div class="word-actions">
                    <button class="word-action-btn audio-btn" title="播放英音" onclick="speakWord('${escapeHtml(word.word).replace(/'/g, "\\'")}')">
                        🇬🇧
                    </button>
                    <button class="word-action-btn audio-btn" title="播放美音" onclick="speakWordUS('${escapeHtml(word.word).replace(/'/g, "\\'")}')">
                        🇺🇸
                    </button>
                    <button class="word-action-btn favorite-btn favorited"
                            title="取消收藏" onclick="toggleFavorite('${escapeHtml(word.id)}')">
                        ❤️
                    </button>
                </div>
            </div>
        `).join('');

        favoritesListEl.innerHTML = html;
    } catch (e) {
        console.error('[Favorites] 渲染出错:', e);
        favoritesListEl.innerHTML = '<p class="empty-message">⚠️ 渲染收藏列表出错</p>';
    }
}

function reviewAllWrongWords() {
    // 复用 reviewWrongWords 的逻辑
    reviewWrongWords();
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
        alert('错词列表为空，没有需要复习的单词');
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
        alert('错词列表为空，或所有错词都已从数据中移除');
        return;
    }

    console.log('Starting flashcard test with', wrongWords.length, 'words to review');

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

// ========== 阅读模块 ==========
async function loadReadingData() {
    try {
        const response = await fetch('data/readings.json');
        if (!response.ok) throw new Error('加载阅读数据失败');
        const data = await response.json();
        // 清理临时字段
        AppState.readings = (data.readings || []).map(reading => {
            const clean = { ...reading };
            delete clean.isParsingPatterns;
            return clean;
        });
        console.log('加载阅读数据成功，共 ' + AppState.readings.length + ' 篇阅读材料');

        // 数据加载完成后，刷新语句页面
        setTimeout(() => {
            renderSentencesPage();
        }, 100);
    } catch (error) {
        console.error('加载阅读数据失败:', error);
        AppState.readings = [];
    }
}

// 加载听书数据
async function loadSpeechData() {
    try {
        const response = await fetch('data/listen.json');
        if (!response.ok) throw new Error('加载听书数据失败');
        const data = await response.json();

        // 兼容新旧格式：新格式是 books 数组，旧格式是 speeches 数组
        if (data.books && Array.isArray(data.books)) {
            // 新格式：合并所有书中的 speeches
            AppState.speechData = [];
            data.books.forEach(book => {
                if (book.speeches && Array.isArray(book.speeches)) {
                    // 为每个 speech 添加 bookName
                    book.speeches.forEach(speech => {
                        speech.bookName = book.name;
                        AppState.speechData.push(speech);
                    });
                }
            });
        } else {
            // 旧格式：直接使用 speeches
            AppState.speechData = data.speeches || [];
        }

        console.log('加载听书数据成功，共 ' + AppState.speechData.length + ' 篇听书材料');
    } catch (error) {
        console.error('加载听书数据失败:', error);
        AppState.speechData = [];
    }
}

function showReadingsPage() {
    // 直接切换页面显示，避免与 switchPage 形成递归调用
    DOM.pages.forEach(page => {
        page.classList.toggle('active', page.id === 'page-readings');
    });

    // 重置页码并初始化
    resetReadingsListPage();

    // 初始化书本选择器
    initReadingsWordbookSelector();

    renderReadingsList();
}

function showReadingDetail(readingId) {
    const reading = AppState.readings.find(r => r.id === readingId);
    if (!reading) return;

    AppState.currentReading = reading;
    AppState.currentDialogueIndex = 0;
    AppState.isPlaying = false;

    // 直接切换页面显示，避免与 switchPage 形成递归调用
    DOM.pages.forEach(page => {
        page.classList.toggle('active', page.id === 'page-reading-detail');
    });

    setActiveNavPage('readings');

    renderReadingDetail(reading);
}

// 每页显示的阅读材料数量
const READINGS_PAGE_SIZE = 10;

// 阅读列表当前页码
AppState.readingsPage = 1;

function renderReadingsList() {
    const container = document.getElementById('readings-list');
    const wordbookSelect = document.getElementById('readings-wordbook-select');
    const unitSelect = document.getElementById('readings-unit-select');
    const readings = AppState.readings || [];

    // 获取选中的书本和单元
    const selectedBook = wordbookSelect?.value || '';
    const selectedUnit = unitSelect?.value || '';

    // 过滤阅读材料
    let filteredReadings = readings;
    if (selectedBook) {
        filteredReadings = filteredReadings.filter(r =>
            (r.bookName || '默认词书') === selectedBook
        );
    }
    if (selectedUnit) {
        filteredReadings = filteredReadings.filter(r =>
            (r.unitName || '未分类') === selectedUnit
        );
    }

    if (readings.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无阅读材料</p>';
        renderReadingsPagination(0, 0);
        return;
    }

    if (filteredReadings.length === 0) {
        container.innerHTML = '<p class="empty-message">该选择下暂无阅读材料</p>';
        renderReadingsPagination(0, 0);
        return;
    }

    // 计算分页
    const totalReadings = filteredReadings.length;
    const totalPages = Math.ceil(totalReadings / READINGS_PAGE_SIZE);
    const currentPage = AppState.readingsPage || 1;
    const startIndex = (currentPage - 1) * READINGS_PAGE_SIZE;
    const endIndex = startIndex + READINGS_PAGE_SIZE;
    const pageReadings = filteredReadings.slice(startIndex, endIndex);

    // 按单元分组显示
    const unitMap = new Map();
    pageReadings.forEach(reading => {
        const unitName = reading.unitName || '未分类';
        if (!unitMap.has(unitName)) {
            unitMap.set(unitName, []);
        }
        unitMap.get(unitName).push(reading);
    });

    let html = '';
    unitMap.forEach((unitReadings, unitName) => {
        html += `<div class="readings-unit-section">`;
        html += `<h3 class="readings-unit-title">${unitName}</h3>`;
        html += `<div class="readings-grid">`;
        html += unitReadings.map(reading => `
            <div class="reading-card" onclick="showReadingDetail('${reading.id}')">
                <div class="reading-card-icon">📖</div>
                <div class="reading-card-info">
                    <h3 class="reading-card-title">${reading.title}</h3>
                    <p class="reading-card-title-cn">${reading.titleCn}</p>
                    <p class="reading-card-meta">
                        ${reading.dialogues.length} 句对话
                    </p>
                </div>
                <div class="reading-card-arrow">›</div>
            </div>
        `).join('');
        html += `</div>`;
        html += `</div>`;
    });

    container.innerHTML = html;

    // 渲染分页控件
    renderReadingsPagination(totalReadings, totalPages);
}

// 渲染阅读列表分页控件
function renderReadingsPagination(totalReadings, totalPages) {
    // 检查是否存在分页容器，如果不存在则创建
    let paginationEl = document.getElementById('readings-list-pagination');
    if (!paginationEl) {
        paginationEl = document.createElement('div');
        paginationEl.id = 'readings-list-pagination';
        paginationEl.className = 'pagination';
        const container = document.getElementById('readings-list');
        container.parentNode.insertBefore(paginationEl, container.nextSibling);
    }

    // 如果没有阅读材料或只有一页，不显示分页
    if (totalReadings === 0 || totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }

    const currentPage = AppState.readingsPage || 1;

    paginationEl.innerHTML = `
        <div class="pagination-info">
            共 ${totalReadings} 篇阅读，${totalPages} 页
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" onclick="goToReadingsPage(1)" ${currentPage <= 1 ? 'disabled' : ''}>首页</button>
            <button class="pagination-btn" onclick="goToReadingsPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>
            <span class="pagination-nums">
                ${generateReadingsPaginationNumbers(currentPage, totalPages)}
            </span>
            <button class="pagination-btn" onclick="goToReadingsPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
            <button class="pagination-btn" onclick="goToReadingsPage(${totalPages})" ${currentPage >= totalPages ? 'disabled' : ''}>末页</button>
        </div>
    `;
}

// 生成阅读列表分页数字
function generateReadingsPaginationNumbers(currentPage, totalPages) {
    let html = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-num ${i === currentPage ? 'active' : ''}" onclick="goToReadingsPage(${i})">${i}</button>`;
    }

    return html;
}

// 跳转到阅读列表指定页
function goToReadingsPage(page) {
    const wordbookSelect = document.getElementById('readings-wordbook-select');
    const unitSelect = document.getElementById('readings-unit-select');
    const readings = AppState.readings || [];

    const selectedBook = wordbookSelect?.value || '';
    const selectedUnit = unitSelect?.value || '';

    let filteredReadings = readings;
    if (selectedBook) {
        filteredReadings = filteredReadings.filter(r =>
            (r.bookName || '默认词书') === selectedBook
        );
    }
    if (selectedUnit) {
        filteredReadings = filteredReadings.filter(r =>
            (r.unitName || '未分类') === selectedUnit
        );
    }

    const totalPages = Math.ceil(filteredReadings.length / READINGS_PAGE_SIZE);

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    AppState.readingsPage = page;
    renderReadingsList();
}

// 重置阅读列表页码
function resetReadingsListPage() {
    AppState.readingsPage = 1;
}

function initReadingsWordbookSelector() {
    const wordbookSelect = document.getElementById('readings-wordbook-select');
    if (!wordbookSelect) return;

    // 从 readings 数据中获取词书列表
    const readings = AppState.readings || [];
    if (readings.length === 0) {
        wordbookSelect.innerHTML = '<option value="">暂无数据</option>';
        return;
    }

    // 按词书分组阅读材料
    const bookMap = new Map();
    readings.forEach(reading => {
        const bookName = reading.bookName || '默认词书';
        if (!bookMap.has(bookName)) {
            bookMap.set(bookName, { id: bookName, name: bookName, readings: [] });
        }
        bookMap.get(bookName).readings.push(reading);
    });

    // 清空并重新填充选择器
    wordbookSelect.innerHTML = '';

    // 添加默认选项
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '请选择书本';
    wordbookSelect.appendChild(defaultOption);

    // 填充选择器
    bookMap.forEach((book, bookName) => {
        const option = document.createElement('option');
        option.value = bookName;
        option.textContent = bookName;
        wordbookSelect.appendChild(option);
    });

    // 绑定选择变化事件
    wordbookSelect.onchange = function(e) {
        handleReadingsWordBookChange(e.target.value);
    };

    // 自动选择第一个书本并加载单元列表
    const firstBook = bookMap.keys().next().value;
    if (firstBook) {
        wordbookSelect.value = firstBook;
        handleReadingsWordBookChange(firstBook);
    }
}

function handleReadingsWordBookChange(bookName) {
    // 重置页码
    resetReadingsListPage();

    const unitSelect = document.getElementById('readings-unit-select');

    // 如果没有选择书本，禁用单元选择器
    if (!bookName) {
        if (unitSelect) {
            unitSelect.innerHTML = '<option value="">请先选择书本</option>';
            unitSelect.disabled = true;
        }
        renderReadingsList();
        return;
    }

    // 获取该词书下的所有阅读材料
    const readings = AppState.readings || [];
    const bookReadings = readings.filter(r => (r.bookName || '默认词书') === bookName);

    if (bookReadings.length === 0) {
        if (unitSelect) {
            unitSelect.innerHTML = '<option value="">该书本下暂无数据</option>';
            unitSelect.disabled = true;
        }
        renderReadingsList();
        return;
    }

    // 按单元分组
    const unitMap = new Map();
    bookReadings.forEach(reading => {
        const unitName = reading.unitName || '未分类';
        if (!unitMap.has(unitName)) {
            unitMap.set(unitName, []);
        }
        unitMap.get(unitName).push(reading);
    });

    // 启用并填充单元选择器
    if (unitSelect) {
        // 清空并添加"全部单元"默认选项
        unitSelect.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '全部单元';
        defaultOption.selected = true;  // 默认选中
        unitSelect.appendChild(defaultOption);

        unitMap.forEach((readings, unitName) => {
            const option = document.createElement('option');
            option.value = unitName;
            option.textContent = unitName;
            unitSelect.appendChild(option);
        });
        unitSelect.disabled = false;

        // 绑定单元选择变化事件
        unitSelect.onchange = function(e) {
            resetReadingsListPage();
            renderReadingsList();
        };
    }

    renderReadingsList();
}

function renderReadingDetail(reading) {
    document.getElementById('reading-title').textContent =
        `${reading.title} (${reading.titleCn})`;
    document.getElementById('reading-scene').textContent = reading.scene;

    // 渲染重点句型
    const patternsSection = document.getElementById('key-patterns-section');
    const patternsList = document.getElementById('key-patterns-list');

    if (reading.keySentencePatterns && reading.keySentencePatterns.length > 0) {
        patternsSection.style.display = 'block';
        patternsList.innerHTML = reading.keySentencePatterns.map(pattern => `
            <div class="key-pattern-item">
                <span class="pattern-en">${pattern.pattern}</span>
                <span class="pattern-cn">${pattern.meaning}</span>
            </div>
        `).join('');
    } else {
        patternsSection.style.display = 'none';
    }

    // 渲染知识点
    const knowledgeSection = document.getElementById('knowledge-points-section');
    const knowledgeList = document.getElementById('knowledge-points-list');

    if (reading.knowledgePoints && reading.knowledgePoints.length > 0) {
        knowledgeSection.style.display = 'block';
        knowledgeList.innerHTML = reading.knowledgePoints.map(point => `
            <div class="knowledge-point-item">
                <div class="knowledge-point-content">${parseMarkdown(point)}</div>
            </div>
        `).join('');
    } else {
        knowledgeSection.style.display = 'none';
    }

    // 渲染对话内容
    const container = document.getElementById('reading-content');
    container.innerHTML = reading.dialogues.map((dialogue, index) => `
        <div class="dialogue-item" data-index="${index}">
            <div class="dialogue-header">
                <span class="dialogue-speaker">${dialogue.speaker}</span>
                <span class="dialogue-speaker-cn">${dialogue.speakerCn}</span>
            </div>
            <div class="dialogue-content">
                <p class="dialogue-en">${dialogue.content}</p>
                <p class="dialogue-cn">${dialogue.contentCn}</p>
            </div>
            <button class="play-btn" onclick="playDialogue(${index})" title="播放">
                🔊
            </button>
        </div>
    `).join('');

    // 检查阅读完成状态并更新按钮
    const completedReadings = JSON.parse(localStorage.getItem('completedReadings') || '[]');
    const markBtn = document.getElementById('mark-read-btn');
    if (markBtn) {
        if (completedReadings.includes(reading.id)) {
            markBtn.textContent = '✅ 已完成';
            markBtn.disabled = true;
            markBtn.style.opacity = '0.6';
        } else {
            markBtn.textContent = '✅ 标记已读';
            markBtn.disabled = false;
            markBtn.style.opacity = '1';
        }
    }
}

/**
 * 播放指定索引的对话
 *
 * 问题背景：
 * 项目中存在多个使用 .play-btn 类名的元素（如听写页面和阅读页面），
 * 如果使用 document.querySelectorAll('.play-btn') 获取所有播放按钮，
 * 会导致索引偏移，点击第 N 个对话的按钮时实际上获取到了错误的按钮。
 *
 * 解决方案：
 * 只在阅读详情页面 (#reading-content) 范围内查找 .play-btn 元素，
 * 避免与其他页面的播放按钮冲突。
 *
 * @param {number} index - 对话列表中的索引
 */
function playDialogue(index) {
    const reading = AppState.currentReading;

    if (!reading || index >= reading.dialogues.length) {
        return;
    }

    const dialogue = reading.dialogues[index];
    highlightDialogue(index);
    speakText(dialogue.content, 'en-US');
}

function playAllDialogues() {
    const reading = AppState.currentReading;
    if (!reading) return;

    AppState.isPlaying = true;
    AppState.currentDialogueIndex = 0;
    playNextDialogue();
}

function playNextDialogue() {
    const reading = AppState.currentReading;
    if (!reading || !AppState.isPlaying) return;

    if (AppState.currentDialogueIndex >= reading.dialogues.length) {
        AppState.isPlaying = false;
        clearHighlights();
        showToast('播放完成');
        return;
    }

    const dialogue = reading.dialogues[AppState.currentDialogueIndex];
    highlightDialogue(AppState.currentDialogueIndex);

    speakText(dialogue.content, 'en-US', () => {
        AppState.currentDialogueIndex++;
        setTimeout(playNextDialogue, 500);
    });
}

/**
 * 播放文本语音
 *
 * 问题背景：
 * 1. Chrome 中 speechSynthesis.speaking 状态不会立即更新
 * 2. 如果在 synthesis.speaking 仍为 true 时立即调用 doSpeak()，会导致:
 *    - 前一个语音的 onerror 事件被触发 (error: 'interrupted')
 *    - 新的语音还没开始播放就被中断
 * 3. 快速连续点击播放按钮时，这个问题尤为明显
 *
 * 解决方案：
 * 使用递归等待机制，直到 synthesis.speaking 变为 false 后才开始播放
 * 最多等待 200ms，如果超时则强制 cancel 后再播放
 *
 * @param {string} text - 要播放的文本
 * @param {string} lang - 语言代码，如 'en-US'
 * @param {Function} onEnd - 播放完成后的回调
 */
function speakText(text, lang, onEnd) {
    if (!('speechSynthesis' in window)) {
        showToast('您的浏览器不支持语音播放');
        return;
    }

    const synthesis = window.speechSynthesis;

    // 递归等待直到 synthesis 准备好
    const trySpeak = (attempts = 0) => {
        const maxAttempts = 20; // 最多等待 200ms (20 * 10ms)
        const delay = 10;

        if (!synthesis.speaking) {
            // synthesis 已经准备好，直接播放
            doSpeak(text, lang, onEnd);
            return;
        }

        if (attempts >= maxAttempts) {
            // 等待超时，强制 cancel 后播放
            synthesis.cancel();
            setTimeout(() => {
                doSpeak(text, lang, onEnd);
            }, 20);
            return;
        }

        // 继续等待
        attempts++;
        setTimeout(() => trySpeak(attempts), delay);
    };

    // 开始等待
    trySpeak(0);
}

/**
 * 执行实际的语音播放
 *
 * 注意事项：
 * 1. 不要在此函数中调用 cancel()，因为 speakText 已经等待 synthesis 准备好
 * 2. onerror 事件处理中，对于 'canceled' 和 'interrupted' 错误：
 *    - 不要调用 onEnd()，避免干扰下一个播放任务
 *    - 这两个错误是用户主动停止或快速切换导致的，属于正常行为
 *    - 只有其他类型的错误才需要显示提示
 *
 * @param {string} text - 要播放的文本
 * @param {string} lang - 语言代码，如 'en-US'
 * @param {Function} onEnd - 播放完成后的回调
 */
function doSpeak(text, lang, onEnd) {
    try {
        const synthesis = window.speechSynthesis;

        // 强制刷新语音列表
        const voices = synthesis.getVoices();

        // 找到可用的英语语音
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.pitch = 1;

        // 优先选择美式英语女性语音，如果没有则使用任何英语语音
        let selectedVoice = englishVoices.find(v =>
            v.lang.startsWith('en-US') && v.name.toLowerCase().includes('female')
        );

        if (!selectedVoice) {
            selectedVoice = englishVoices.find(v => v.lang.startsWith('en-US'));
        }

        if (!selectedVoice) {
            selectedVoice = englishVoices[0]; // 使用第一个英语语音
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onend = () => {
            if (onEnd) {
                try {
                    onEnd();
                } catch (e) {
                    // 忽略回调中的错误
                }
            }
        };

        utterance.onerror = (event) => {
            // canceled 和 interrupted 错误是用户主动停止或快速切换导致的，不需要显示提示
            // 也不要调用 onEnd，避免干扰下一个播放任务
            if (event.error !== 'canceled' && event.error !== 'interrupted') {
                // 只在非交互模式下显示提示
                if (!AppState.isPlaying) {
                    showToast('语音播放失败，请检查浏览器设置');
                }
            }
        };

        synthesis.speak(utterance);
    } catch (e) {
        // 忽略语音播放时的任何错误
    }
}

function stopPlayback() {
    AppState.isPlaying = false;
    window.speechSynthesis.cancel();
    clearHighlights();
    showToast('已停止播放');
}

function markCurrentReadingCompleted() {
    const reading = AppState.currentReading;
    if (!reading) {
        showToast('请先选择一篇阅读材料');
        return;
    }

    const completedReadings = JSON.parse(localStorage.getItem('completedReadings') || '[]');
    if (completedReadings.includes(reading.id)) {
        showToast('这篇阅读已经标记为已读');
        return;
    }

    completedReadings.push(reading.id);
    localStorage.setItem('completedReadings', JSON.stringify(completedReadings));

    // 记录阅读日期
    const today = new Date().toISOString().split('T')[0];
    const readingDates = JSON.parse(localStorage.getItem('readingDates') || '{}');
    if (!readingDates[today]) {
        readingDates[today] = [];
    }
    readingDates[today].push(reading.id);
    localStorage.setItem('readingDates', JSON.stringify(readingDates));

    showToast(`《${reading.titleCn}》已标记为已读`);

    // 更新按钮状态
    const markBtn = document.getElementById('mark-read-btn');
    if (markBtn) {
        markBtn.textContent = '✅ 已完成';
        markBtn.disabled = true;
        markBtn.style.opacity = '0.6';
    }

    // 刷新首页统计
    const todayReadings = getTodayReadingCount();
    document.getElementById('today-readings').textContent = todayReadings;
}

// ========== 听书模块 ==========
const SPEECH_PAGE_SIZE = 6;

// 听书列表当前页码
AppState.speechPage = 1;
function showSpeechPage() {
    // 直接切换页面显示，避免与 switchPage 形成递归调用
    DOM.pages.forEach(page => {
        page.classList.toggle('active', page.id === 'page-speech');
    });

    // 重置页码并初始化
    resetSpeechListPage();

    // 初始化文章选择器
    initSpeechArticleSelector();

    // 重置章节选择器
    initSpeechChapterSelector('');

    // 渲染听书列表
    renderSpeechList();
}

// 初始化文章选择器
function initSpeechArticleSelector() {
    const select = document.getElementById('speech-article-select');
    if (!select) return;

    // 获取所有文章
    const options = AppState.speechData.map(speech =>
        `<option value="${speech.id}">${speech.title}</option>`
    ).join('');

    select.innerHTML = options
        ? `<option value="">-- 请选择书本 --</option>${options}`
        : '<option value="">暂无可用听书材料</option>';

    select.disabled = AppState.speechData.length === 0;
}

// 初始化章节选择器
function initSpeechChapterSelector(articleId) {
    const select = document.getElementById('speech-chapter-select');
    const articleSelect = document.getElementById('speech-article-select');

    if (!select) return;

    // 如果没有选择书本，禁用章节选择器
    if (!articleId) {
        select.innerHTML = '<option value="">-- 请选择章节 --</option>';
        select.disabled = true;
        return;
    }

    const speech = AppState.speechData.find(s => s.id === articleId);
    if (!speech) {
        select.innerHTML = '<option value="">-- 请选择章节 --</option>';
        select.disabled = true;
        return;
    }

    // 构建章节选项
    let options = '<option value="">-- 请选择章节 --</option>';

    // 如果有概要，添加概要作为第一个选项
    if (speech.summary) {
        options += `<option value="summary">文章概要</option>`;
    }

    // 添加所有章节
    speech.chapters.forEach((chapter, index) => {
        options += `<option value="${index}">${chapter.title}</option>`;
    });

    select.innerHTML = options;
    select.disabled = false;
}

// 处理文章选择变化
function handleSpeechArticleChange() {
    const articleSelect = document.getElementById('speech-article-select');
    const chapterSelect = document.getElementById('speech-chapter-select');

    if (!articleSelect) return;

    const selectedArticleId = articleSelect.value;

    // 初始化章节选择器
    initSpeechChapterSelector(selectedArticleId);

    // 重置章节选择
    if (chapterSelect) {
        chapterSelect.value = '';
    }

    // 如果选择了文章，更新列表显示
    if (selectedArticleId) {
        // 高亮选中的文章卡片
        highlightSpeechCard(selectedArticleId);
        // 滚动到选中的卡片
        scrollToSpeechCard(selectedArticleId);
    }
}

// 处理章节选择变化
function handleSpeechChapterChange() {
    const articleSelect = document.getElementById('speech-article-select');
    const chapterSelect = document.getElementById('speech-chapter-select');

    if (!articleSelect || !chapterSelect) {
        console.error('handleSpeechChapterChange: 选择器元素不存在');
        return;
    }

    const articleId = articleSelect.value;
    const chapterValue = chapterSelect.value;

    if (!articleId || !chapterValue) {
        // 如果没有选择完整，返回，不显示详情页
        return;
    }

    // 跳转到详情页并显示内容
    showSpeechDetailWithChapter(articleId, chapterValue);
}

// 高亮选中的文章卡片
function highlightSpeechCard(articleId) {
    // 移除所有卡片的选中状态
    document.querySelectorAll('.speech-card').forEach(card => {
        card.classList.remove('selected');
    });

    // 高亮选中的卡片
    const selectedCard = document.querySelector(`.speech-card[data-id="${articleId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
}

// 滚动到选中的卡片
function scrollToSpeechCard(articleId) {
    const selectedCard = document.querySelector(`.speech-card[data-id="${articleId}"]`);
    if (selectedCard) {
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// 根据选择的文章筛选
function filterSpeechByArticle(articleId) {
    if (!articleId) {
        // 未选择文章，显示空状态
        const container = document.getElementById('speech-list');
        if (container) {
            container.innerHTML = '<p class="speech-empty">请先选择一篇文章</p>';
        }
        return;
    }

    // 直接跳转到文章详情
    showSpeechDetail(articleId);
}

// 跳转到文章详情页并显示指定章节
function showSpeechDetailWithChapter(articleId, chapterValue) {
    console.log('showSpeechDetailWithChapter:', articleId, chapterValue);

    const speech = AppState.speechData.find(s => s.id === articleId);
    if (!speech) {
        console.error('未找到文章:', articleId);
        return;
    }

    AppState.currentSpeech = speech;

    // 设置当前章节
    if (chapterValue === 'summary' && speech.summary) {
        AppState.currentSpeechChapter = {
            title: `${speech.title} - 概要`,
            content: speech.summary
        };
    } else {
        const chapterIndex = parseInt(chapterValue, 10);
        if (speech.chapters[chapterIndex]) {
            AppState.currentSpeechChapter = speech.chapters[chapterIndex];
        } else if (speech.chapters.length > 0) {
            AppState.currentSpeechChapter = speech.chapters[0];
        } else {
            AppState.currentSpeechChapter = null;
            console.warn('文章没有章节内容:', speech.title);
        }
    }

    // 停止当前播放
    stopSpeech();

    // 切换到详情页面
    DOM.pages.forEach(page => {
        page.classList.toggle('active', page.id === 'page-speech-detail');
    });

    setActiveNavPage('speech');

    // 更新页面标题
    const titleEl = document.getElementById('speech-title');
    if (titleEl) {
        titleEl.textContent = speech.title;
    }

    // 渲染章节导航
    renderSpeechChapterNav();

    // 渲染章节内容
    renderSpeechChapter();

    // 滚动到页面顶部
    window.scrollTo(0, 0);
}

function renderSpeechList() {
    const container = document.getElementById('speech-list');
    if (!container) return;

    const speeches = AppState.speechData || [];

    if (speeches.length === 0) {
        container.innerHTML = '<p class="speech-empty">暂无可用听书材料</p>';
        // 移除分页容器
        const paginationEl = document.getElementById('speech-list-pagination');
        if (paginationEl) paginationEl.remove();
        return;
    }

    // 计算分页
    const totalSpeeches = speeches.length;
    const totalPages = Math.ceil(totalSpeeches / SPEECH_PAGE_SIZE);
    const currentPage = AppState.speechPage || 1;
    const startIndex = (currentPage - 1) * SPEECH_PAGE_SIZE;
    const endIndex = startIndex + SPEECH_PAGE_SIZE;
    const pageSpeeches = speeches.slice(startIndex, endIndex);

    container.innerHTML = pageSpeeches.map(speech => `
        <div class="speech-card" data-id="${speech.id}" onclick="showSpeechDetail('${speech.id}')">
            <div class="speech-card-icon">🎧</div>
            <div class="speech-card-info">
                <h3 class="speech-card-title">${speech.title}</h3>
                <p class="speech-card-meta">
                    ${speech.chapters.length} 个章节
                </p>
            </div>
            <div class="speech-card-arrow">›</div>
        </div>
    `).join('');

    // 渲染分页控件
    renderSpeechPagination(totalSpeeches, totalPages);
}

// 渲染听书列表分页控件
function renderSpeechPagination(totalSpeeches, totalPages) {
    // 检查是否存在分页容器，如果不存在则创建
    let paginationEl = document.getElementById('speech-list-pagination');
    if (!paginationEl) {
        paginationEl = document.createElement('div');
        paginationEl.id = 'speech-list-pagination';
        paginationEl.className = 'pagination';
        const container = document.getElementById('speech-list');
        container.parentNode.insertBefore(paginationEl, container.nextSibling);
    }

    // 如果没有听书材料或只有一页，不显示分页
    if (totalSpeeches === 0 || totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }

    const currentPage = AppState.speechPage || 1;

    paginationEl.innerHTML = `
        <div class="pagination-info">
            共 ${totalSpeeches} 篇听书，${totalPages} 页
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" onclick="goToSpeechPage(1)" ${currentPage <= 1 ? 'disabled' : ''}>首页</button>
            <button class="pagination-btn" onclick="goToSpeechPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>
            <span class="pagination-nums">
                ${generateSpeechPaginationNumbers(currentPage, totalPages)}
            </span>
            <button class="pagination-btn" onclick="goToSpeechPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
            <button class="pagination-btn" onclick="goToSpeechPage(${totalPages})" ${currentPage >= totalPages ? 'disabled' : ''}>末页</button>
        </div>
    `;
}

// 生成听书列表分页数字
function generateSpeechPaginationNumbers(currentPage, totalPages) {
    let html = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<span class="pagination-num active">${i}</span>`;
        } else {
            html += `<button class="pagination-num" onclick="goToSpeechPage(${i})">${i}</button>`;
        }
    }

    return html;
}

// 跳转到听书列表指定页
function goToSpeechPage(page) {
    const speeches = AppState.speechData || [];
    const totalPages = Math.ceil(speeches.length / SPEECH_PAGE_SIZE);

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    AppState.speechPage = page;
    renderSpeechList();

    // 滚动到列表顶部
    const container = document.getElementById('speech-list');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// 重置听书列表页码
function resetSpeechListPage() {
    AppState.speechPage = 1;
}

function showSpeechDetail(speechId) {
    const speech = AppState.speechData.find(s => s.id === speechId);
    if (!speech) return;

    AppState.currentSpeech = speech;

    // 如果有概要，设置为概要；否则设置为第一个章节
    if (speech.summary) {
        AppState.currentSpeechChapter = {
            title: '文章概要',
            content: speech.summary,
            isSummary: true
        };
    } else if (speech.chapters.length > 0) {
        AppState.currentSpeechChapter = speech.chapters[0];
    } else {
        AppState.currentSpeechChapter = null;
    }

    // 停止当前的朗读
    stopSpeech();

    // 直接切换页面显示
    DOM.pages.forEach(page => {
        page.classList.toggle('active', page.id === 'page-speech-detail');
    });

    setActiveNavPage(null);

    // 更新标题
    document.getElementById('speech-title').textContent = speech.title;

    // 渲染章节导航
    renderSpeechChapterNav();

    // 渲染章节内容
    renderSpeechChapter();

    // 初始化调试开关状态
    initSpeechDebugToggle();
}

function renderSpeechChapterNav() {
    const nav = document.getElementById('speech-chapter-nav');
    const speech = AppState.currentSpeech;
    if (!nav || !speech) return;

    // 构建章节列表（包含概要和所有章节）
    const chapters = [];

    // 添加概要作为第一个选项
    if (speech.summary) {
        chapters.push({
            title: '文章概要',
            content: speech.summary,
            isSummary: true
        });
    }

    // 添加所有章节
    speech.chapters.forEach((chapter, index) => {
        chapters.push({
            ...chapter,
            isSummary: false,
            originalIndex: index
        });
    });

    nav.innerHTML = chapters.map((chapter, index) => `
        <button class="speech-chapter-btn ${chapter === AppState.currentSpeechChapter ? 'active' : ''}"
                onclick="selectSpeechChapter('${speech.id}', ${index})">
            ${chapter.title}
        </button>
    `).join('');
}

function selectSpeechChapter(speechId, chapterIndex) {
    const speech = AppState.speechData.find(s => s.id === speechId);
    if (!speech) return;

    // 停止当前朗读
    stopSpeech();

    AppState.currentSpeech = speech;

    // 构建章节列表（包含概要和所有章节）
    const chapters = [];

    // 添加概要作为第一个选项
    if (speech.summary) {
        chapters.push({
            title: '文章概要',
            content: speech.summary,
            isSummary: true
        });
    }

    // 添加所有章节
    speech.chapters.forEach((chapter, index) => {
        chapters.push({
            ...chapter,
            isSummary: false,
            originalIndex: index
        });
    });

    // 设置当前选中的章节
    AppState.currentSpeechChapter = chapters[chapterIndex];

    // 更新章节导航状态
    document.querySelectorAll('.speech-chapter-btn').forEach((btn, index) => {
        btn.classList.toggle('active', index === chapterIndex);
    });

    // 渲染章节内容
    renderSpeechChapter();
}

function renderSpeechChapter() {
    const content = document.getElementById('speech-content');
    const chapter = AppState.currentSpeechChapter;

    // 如果没有内容元素，直接返回
    if (!content) {
        console.error('renderSpeechChapter: speech-content 元素不存在');
        return;
    }

    // 如果没有章节数据，显示提示信息
    if (!chapter) {
        content.innerHTML = `
            <h2 class="speech-chapter-title">暂无内容</h2>
            <div class="speech-text">请选择一篇文章和章节来查看内容</div>
        `;
        return;
    }

    // 正常渲染章节内容
    content.innerHTML = `
        <h2 class="speech-chapter-title">${chapter.title}</h2>
        <div class="speech-text">${chapter.content}</div>
    `;
}

// 听书播放控制
function toggleSpeechPlayback() {
    addVoiceCloneLog('toggleSpeechPlayback', `模式: ${AppState.speechVoiceMode}, 就绪: ${AppState.speechCloneReady}`);

    // 如果是音色复刻模式且有 Audio 对象
    if (AppState.speechVoiceMode === 'clone' && AppState.speechUtterance instanceof Audio) {
        const audio = AppState.speechUtterance;

        // iOS 设备：检查是否是已准备就绪状态（等待用户点击播放）
        if (AppState.speechCloneReady) {
            addVoiceCloneLog('用户点击播放', 'speechCloneReady=true，尝试播放');

            // 清除准备就绪状态
            AppState.speechCloneReady = false;

            // 尝试播放音频
            audio.play().then(() => {
                addVoiceCloneLog('播放成功', '音频已开始播放');
                AppState.speechIsPlaying = true;
                AppState.speechPaused = false;
                updatePlayButton();
            }).catch((e) => {
                addVoiceCloneLog('播放失败', e.name);

                // 检查是否是自动播放限制
                const isAutoplayError = e.name === 'NotAllowedError' ||
                    e.name === 'AbortError' ||
                    e.message?.includes('user gesture') ||
                    e.message?.includes('not allowed');

                if (isAutoplayError) {
                    // 尝试解锁
                    unlockAudioContext().then((unlocked) => {
                        if (unlocked) {
                            showToast('请再次点击播放按钮', 2000);
                            addVoiceCloneLog('解锁成功', '请再次点击播放');
                        } else {
                            showToast('请点击屏幕任意位置激活音频', 3000);
                            addVoiceCloneLog('解锁失败', '需要用户交互');
                        }
                    });
                } else {
                    showToast('播放失败，请重试');
                }

                AppState.speechIsPlaying = false;
                AppState.speechPaused = false;
                updatePlayButton();
            });
            return;
        }

        // 根据音频的实际状态来决定是暂停还是恢复
        if (audio.paused) {
            // 音频已暂停，尝试恢复播放
            try {
                audio.play();
                AppState.speechIsPlaying = true;
                AppState.speechPaused = false;
                updatePlayButton();
                return;
            } catch (e) {
                console.error('[Voice Clone] play error:', e);
                // 播放失败，继续执行正常的播放流程
            }
        } else {
            // 音频正在播放，暂停它
            AppState.speechIsPlaying = false;
            AppState.speechPaused = true;
            AppState.speechCloneCurrentTime = audio.currentTime;
            audio.pause();
            updatePlayButton();
            return;
        }
    }

    // 系统语音模式或音色复刻模式但没有 Audio 对象的处理
    if (AppState.speechIsPlaying) {
        pauseSpeech();
    } else {
        playSpeech();
    }
}

function playSpeech() {
    const chapter = AppState.currentSpeechChapter;
    if (!chapter) {
        showToast('请先选择一篇听书材料');
        return;
    }

    // 检查语音模式
    if (AppState.speechVoiceMode === 'clone') {
        // 使用音色复刻模式
        playSpeechWithVoiceClone(chapter.content);
        return;
    }

    // 使用系统默认语音
    playSpeechWithSystem(chapter.content);
}

// 使用系统默认语音播放
function playSpeechWithSystem(content) {
    // 检查是否可以恢复已暂停的语音（用户主动暂停）
    // 注意：cancel() 后 paused 状态不可靠，所以还需要检查 speaking 状态
    if (window.speechSynthesis.paused && window.speechSynthesis.speaking) {
        try {
            window.speechSynthesis.resume();
            AppState.speechIsPlaying = true;
            AppState.speechPaused = false;
            updatePlayButton();
            console.log('[System Voice] resumed from paused state');
            return;
        } catch (e) {
            console.error('[System Voice] resume error:', e);
        }
    }

    // 如果不是暂停状态，创建新的语音实例
    // 取消之前的播放
    if (AppState.speechUtterance) {
        window.speechSynthesis.cancel();
    }

    // 重置暂停状态
    AppState.speechPaused = false;
    AppState.speechIsPlaying = false;

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'zh-CN';
    utterance.rate = AppState.speechPlaybackSpeed;
    utterance.pitch = 1;

    // 尝试获取中文语音
    const voices = window.speechSynthesis.getVoices();
    const chineseVoice = voices.find(voice =>
        voice.lang.includes('zh') || voice.lang.includes('cmn')
    );
    if (chineseVoice) {
        utterance.voice = chineseVoice;
    }

    utterance.onstart = () => {
        AppState.speechIsPlaying = true;
        AppState.speechPaused = false;
        updatePlayButton();
        showToast('开始播放');
    };

    utterance.onend = () => {
        AppState.speechIsPlaying = false;
        AppState.speechPaused = false;
        updatePlayButton();
        showToast('播放完成');
    };

    utterance.onerror = (event) => {
        // canceled 和 interrupted 错误是用户主动停止或快速切换导致的，属于正常行为
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
            console.error('语音播放错误:', event);
            AppState.speechIsPlaying = false;
            AppState.speechPaused = false;
            updatePlayButton();
            showToast('播放出错');
        } else {
            // 对于取消和中断错误，只更新状态，不显示提示
            AppState.speechIsPlaying = false;
            AppState.speechPaused = false;
            updatePlayButton();
        }
    };

    utterance.onpause = () => {
        AppState.speechIsPlaying = false;
        AppState.speechPaused = true;
        updatePlayButton();
        console.log('[System Voice] paused');
    };

    utterance.onresume = () => {
        AppState.speechIsPlaying = true;
        AppState.speechPaused = false;
        updatePlayButton();
        console.log('[System Voice] resumed');
    };

    AppState.speechUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

// 检测是否为 Safari 浏览器
function isSafari() {
    const ua = navigator.userAgent;
    return /Safari/i.test(ua) && !/Chrome/i.test(ua);
}

// 检测是否为 iOS Safari
function isIOSSafari() {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && /Safari/i.test(ua) && !/CriOS/.test(ua);
}

// 检测是否为 iOS Chrome
function isIOSChrome() {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && /CriOS/.test(ua);
}

// 检测是否为任何 iOS 浏览器（Safari 或 Chrome）
function isIOSBrowser() {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua);
}

// 带超时的 Promise 包装
function withTimeout(promise, ms, name) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${name} 超时 (${ms}ms)`)), ms)
        )
    ]);
}

// 解锁浏览器的自动播放限制
async function unlockAudioContext() {
    const isSafariBrowser = isSafari();
    const isIOSSafariBrowser = isIOSSafari();
    const isIOSChromeBrowser = isIOSChrome();
    const isIOSAnyBrowser = isIOSBrowser();

    addVoiceCloneLog('unlockAudioContext', `iOS: ${isIOSAnyBrowser}, Chrome: ${isIOSChromeBrowser}`);

    // iOS 设备（无论是 Safari 还是 Chrome）都需要特殊的解锁方式
    // 因为 iOS 有严格的自动播放策略

    // iOS 设备优化：跳过方法1（静音音频），直接使用方法2（AudioContext）
    // 方法1在iOS上一定会失败并等待2秒超时，影响用户体验
    if (isIOSAnyBrowser) {
        addVoiceCloneLog('iOS优化', '跳过方法1，直接使用 AudioContext');

        // 方法 2：使用 AudioContext（这是 iOS 设备最可靠的方法）
        addVoiceCloneLog('方法2', '尝试 AudioContext...');
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                addVoiceCloneLog('方法2', '创建 AudioContext...');
                const audioCtx = new AudioContext();

                // iOS 设备需要多次 resume 尝试
                if (audioCtx.state === 'suspended') {
                    addVoiceCloneLog('方法2', `state=suspended, 尝试 resume...`);
                    try {
                        await withTimeout(audioCtx.resume(), 2000, 'AudioContext.resume');
                        addVoiceCloneLog('方法2成功', `AudioContext.state: ${audioCtx.state}`);
                        return true;
                    } catch (resumeError) {
                        addVoiceCloneLog('方法2失败', resumeError.message || resumeError.name);

                        // iOS 上使用振荡器作为备选
                        addVoiceCloneLog('方法2备选', '尝试振荡器...');
                        try {
                            const oscillator = audioCtx.createOscillator();
                            const gainNode = audioCtx.createGain();
                            oscillator.connect(gainNode);
                            gainNode.connect(audioCtx.destination);
                            oscillator.frequency.value = 0;
                            gainNode.gain.value = 0;
                            oscillator.start();
                            oscillator.stop(audioCtx.currentTime + 0.01);
                            addVoiceCloneLog('方法2备选成功', '振荡器解锁成功');
                            return true;
                        } catch (oscError) {
                            addVoiceCloneLog('方法2备选失败', oscError.name);
                        }
                    }
                } else {
                    addVoiceCloneLog('方法2', `state=${audioCtx.state}, 无需 resume`);
                    return true;
                }
            }
        } catch (e) {
            addVoiceCloneLog('方法2异常', e.name);
        }

        // 如果方法2也失败，尝试方法3
        addVoiceCloneLog('方法3', '方法2失败，尝试 Safari/iOS 特定方式...');
    } else {
        // 非 iOS 设备：尝试方法1
        addVoiceCloneLog('方法1', '尝试静音音频...');
        try {
            const silentAudio = new Audio();
            silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAAAAAA==';
            silentAudio.volume = 0;
            silentAudio.muted = true;
            silentAudio.preload = 'none';

            await withTimeout(silentAudio.play(), 2000, '静音音频播放');
            addVoiceCloneLog('方法1成功', '静音音频播放成功');
            silentAudio.src = '';
            return true;
        } catch (e) {
            addVoiceCloneLog('方法1失败', e.message || e.name);
        }

        // 方法 2：使用 AudioContext（非 iOS 设备）
        addVoiceCloneLog('方法2', '尝试 AudioContext...');
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                addVoiceCloneLog('方法2', '创建 AudioContext...');
                const audioCtx = new AudioContext();

                if (audioCtx.state === 'suspended') {
                    try {
                        await withTimeout(audioCtx.resume(), 2000, 'AudioContext.resume');
                        addVoiceCloneLog('方法2成功', `AudioContext.state: ${audioCtx.state}`);
                    } catch (resumeError) {
                        addVoiceCloneLog('方法2失败', resumeError.message || resumeError.name);

                        if (isSafariBrowser || isIOSAnyBrowser) {
                            addVoiceCloneLog('方法2备选', '尝试振荡器...');
                            try {
                                const oscillator = audioCtx.createOscillator();
                                const gainNode = audioCtx.createGain();
                                oscillator.connect(gainNode);
                                gainNode.connect(audioCtx.destination);
                                oscillator.frequency.value = 0;
                                gainNode.gain.value = 0;
                                oscillator.start();
                                oscillator.stop(audioCtx.currentTime + 0.01);
                                addVoiceCloneLog('方法2备选成功', '振荡器解锁成功');
                                return true;
                            } catch (oscError) {
                                addVoiceCloneLog('方法2备选失败', oscError.name);
                            }
                        }
                    }
                }

                return audioCtx.state === 'running';
            }
        } catch (e) {
            addVoiceCloneLog('方法2异常', e.name);
        }
    }

    // 方法 3：Safari 或 iOS 特定的解锁方式
    addVoiceCloneLog('方法3', '尝试 Safari/iOS 特定方式...');
    if (isSafariBrowser || isIOSAnyBrowser) {
        try {
            const safariAudio = new Audio();
            safariAudio.controls = false;
            safariAudio.preload = 'auto';

            // 尝试加载一个小音频文件来解锁
            safariAudio.src = 'data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
            safariAudio.volume = 0.01;

            addVoiceCloneLog('方法3', '加载音频...');
            await withTimeout(safariAudio.load(), 3000, '音频加载');
            addVoiceCloneLog('方法3', '播放音频...');
            await withTimeout(safariAudio.play(), 2000, '音频播放');
            safariAudio.pause();
            safariAudio.src = '';
            addVoiceCloneLog('方法3成功', 'iOS/Safari 音频解锁成功');
            return true;
        } catch (safariError) {
            addVoiceCloneLog('方法3失败', safariError.message || safariError.name);
        }
    }

    addVoiceCloneLog('unlockAudioContext', '所有方法都失败，返回 false');
    return false;
}

// 使用音色复刻播放
async function playSpeechWithVoiceClone(content) {
    addVoiceCloneLog('playSpeechWithVoiceClone', `内容长度: ${content.length} 字符`);

    // 停止系统语音
    window.speechSynthesis.cancel();

    // 检查是否有保存的 Audio 对象
    if (AppState.speechUtterance instanceof Audio) {
        const audio = AppState.speechUtterance;
        const startTime = AppState.speechCloneCurrentTime;

        console.log('[Voice Clone] ===== 检查恢复播放 =====');
        console.log('[Voice Clone] speechCloneAudioUrl:', AppState.speechCloneAudioUrl);
        console.log('[Voice Clone] audio.src:', audio.src);
        console.log('[Voice Clone] URL 相等:', audio.src === AppState.speechCloneAudioUrl);
        console.log('[Voice Clone] speechCloneCurrentTime:', startTime);
        console.log('[Voice Clone] audio.paused:', audio.paused);
        console.log('[Voice Clone] audio.duration:', audio.duration);

        // 检查是否是同一个内容（通过比较 URL）
        // 如果是同一个内容且有保存的位置（大于 0），恢复播放
        if (AppState.speechCloneAudioUrl &&
            audio.src === AppState.speechCloneAudioUrl &&
            startTime > 0 &&
            startTime < audio.duration) {

            console.log('[Voice Clone] 从保存的位置恢复播放:', startTime);
            audio.currentTime = startTime;

            try {
                audio.play();
                AppState.speechIsPlaying = true;
                AppState.speechPaused = false;
                updatePlayButton();
                return;
            } catch (e) {
                console.error('[Voice Clone] resume error:', e);
                // 恢复失败，继续尝试其他方式
            }
        }

        // 如果没有恢复成功，检查是否是同一个内容（可以继续播放但不使用保存的位置）
        if (AppState.speechCloneAudioUrl && audio.src === AppState.speechCloneAudioUrl) {
            // 内容相同，直接从当前位置播放（不从头开始）
            console.log('[Voice Clone] 从当前位置继续播放');
            try {
                audio.play();
                AppState.speechIsPlaying = true;
                AppState.speechPaused = false;
                updatePlayButton();
                return;
            } catch (e) {
                console.error('[Voice Clone] play error:', e);
                // 如果播放失败，清除对象重新生成
            }
        }

        // 内容已改变或无法恢复，停止并清除旧的 Audio 对象
        console.log('[Voice Clone] 内容已改变或无法恢复，清除旧的 Audio 对象');
        audio.pause();
        audio.currentTime = 0;
        AppState.speechUtterance = null;
        // 注意：保留 speechCloneCurrentTime，因为可能用户切换章节后还想从之前的位置开始
    }

    // 重置暂停状态
    AppState.speechPaused = false;

    // 显示持久提示（30秒后自动隐藏）
    showPersistentToast('正在生成克隆声音...', {
        autoHide: true,
        hideAfter: 30000 // 30秒超时
    });

    try {
        // 先解锁浏览器自动播放限制
        addVoiceCloneLog('开始 unlockAudioContext', '等待解锁...');
        const unlocked = await unlockAudioContext();
        addVoiceCloneLog('unlockAudioContext 完成', `结果: ${unlocked}`);

        // 生成内容的 hash 作为缓存键
        const contentHash = hashString(content);
        addVoiceCloneLog('计算缓存 key', `hash: ${contentHash.substring(0, 8)}..., 缓存数: ${AppState.speechCloneAudioCache.size}`);

        // 检查缓存中是否已有该内容的音频
        const cachedResult = AppState.speechCloneAudioCache.get(contentHash);
        let audioUrl;

        if (cachedResult) {
            // 使用缓存的音频 URL
            console.log('[Voice Clone] ✓ 缓存命中，使用已有音频 URL:', cachedResult.url);
            audioUrl = cachedResult.url;
        } else {
            // 调用音色复刻 API
            console.log('[Voice Clone] ✗ 缓存未命中，调用 API 生成新音频');
            console.log('[Voice Clone] content 长度:', content.length);
            console.log('[Voice Clone] content 前 50 字:', content.substring(0, 50));

            // 创建 AbortController 用于超时控制
            const abortController = new AbortController();

            // 设置超时警告（15秒后显示）
            const timeoutWarningId = setTimeout(() => {
                if (persistentToast) {
                    const messageEl = persistentToast.querySelector('.toast-message');
                    if (messageEl) {
                        messageEl.textContent = '正在生成克隆声音... 较慢，请稍候';
                    }
                }
            }, 15000);

            try {
                addVoiceCloneLog('调用 callVoiceCloneAPI', 'timeout=30秒');

                audioUrl = await callVoiceCloneAPI(content, {
                    signal: abortController.signal,
                    timeout: 30000 // 30秒超时
                });

                addVoiceCloneLog('API 返回', audioUrl ? `URL长度: ${audioUrl.length}` : 'URL为空');

                // 清除超时警告
                clearTimeout(timeoutWarningId);
                hidePersistentToast();

                // 缓存结果（设置 30 分钟过期时间）
                const cacheTimeout = 30 * 60 * 1000;
                AppState.speechCloneAudioCache.set(contentHash, {
                    url: audioUrl,
                    timestamp: Date.now(),
                    timeout: cacheTimeout
                });
                addVoiceCloneLog('缓存已保存', `key: ${contentHash}`);

                // 定期清理过期缓存（每 10 次播放检查一次）
                if (Math.random() < 0.1) {
                    cleanupExpiredCache();
                }
            } catch (error) {
                // 关闭持久提示和超时警告
                clearTimeout(timeoutWarningId);
                hidePersistentToast();

                addVoiceCloneLog('API 错误', error.message || error.name);

                // 处理超时
                if (error.name === 'AbortError' || error.message.includes('超时')) {
                    showToast('生成超时，请重试');
                    addVoiceCloneLog('请求超时', '30秒内未响应，请重试');
                    return;
                }

                throw error;
            }
        }

        AppState.speechCloneAudioUrl = audioUrl;

        // 播放音频（提示会在 onplay 事件中自动关闭）
        playVoiceCloneAudio(audioUrl);
    } catch (error) {
        // 关闭持久提示
        hidePersistentToast();

        console.error('音色复刻失败:', error);

        // 检查是否是配置问题
        const errorMessage = error.message || '未知错误';
        const isConfigError = errorMessage.includes('未配置') || errorMessage.includes('未提供');

        if (isConfigError) {
            // 配置问题，不自动切换，给用户提示
            showToast('音色复刻未配置，请切换到系统模式使用');
            // 重置为系统模式但不自动播放
            AppState.speechVoiceMode = 'system';
            document.getElementById('speech-voice-mode-select').value = 'system';
        } else {
            // 其他错误，询问用户是否切换
            const userConfirmed = confirm(`音色复刻失败: ${errorMessage}\n\n是否切换到系统语音继续播放？`);

            if (userConfirmed) {
                AppState.speechVoiceMode = 'system';
                document.getElementById('speech-voice-mode-select').value = 'system';
                playSpeechWithSystem(content);
            }
        }
    }
}

// 停止语音播放
function stopSpeech() {
    // 停止系统语音合成
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    // 停止 Audio 对象（音色复刻）
    if (AppState.speechUtterance instanceof Audio) {
        try {
            AppState.speechUtterance.pause();
            AppState.speechUtterance.currentTime = 0;
            // 完全清除 Audio 对象，防止章节切换后恢复旧内容
            AppState.speechUtterance = null;
        } catch (e) {
            console.error('stopSpeech audio error:', e);
            AppState.speechUtterance = null;
        }
    }

    // 清除音色复刻相关的状态，防止恢复旧内容
    AppState.speechCloneAudioUrl = null;
    AppState.speechCloneCurrentTime = 0;
    AppState.speechCloneReady = false;

    // 隐藏调试状态显示
    hideVoiceCloneDebug();

    // 不在这里清除缓存，因为 stopSpeech 也可能在播放新内容前被调用
    // 缓存由 playSpeechWithVoiceClone 中的逻辑管理

    // 重置播放状态 - 关键：必须将 paused 状态也重置为 false
    // 这样下次点击播放时不会错误地尝试"恢复"已取消的语音
    AppState.speechIsPlaying = false;
    AppState.speechPaused = false;
    AppState.speechUtterance = null;

    // 更新播放按钮
    updatePlayButton();
}

function pauseSpeech() {
    // 如果是 Audio 对象（音色复刻）
    if (AppState.speechUtterance instanceof Audio) {
        try {
            const audio = AppState.speechUtterance;
            console.log('[Voice Clone] pauseSpeech called, audio.paused:', audio.paused);

            if (audio.paused) {
                // 暂停中，恢复播放
                AppState.speechIsPlaying = true;
                AppState.speechPaused = false;
                updatePlayButton();
                audio.play();
                console.log('[Voice Clone] resumed playback');
            } else {
                // 播放中，暂停
                // 立即保存位置，确保状态同步
                AppState.speechCloneCurrentTime = audio.currentTime;
                audio.pause();
                // 状态更新由 onpause 事件处理
                console.log('[Voice Clone] pause requested, saved position:', AppState.speechCloneCurrentTime);
            }
        } catch (e) {
            console.error('pauseSpeech error:', e);
        }
        return;
    }

    // 系统语音合成
    if (window.speechSynthesis.speaking) {
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
            AppState.speechIsPlaying = true;
            AppState.speechPaused = false;
            updatePlayButton();
        } else {
            window.speechSynthesis.pause();
            AppState.speechIsPlaying = false;
            AppState.speechPaused = true;
            updatePlayButton();
        }
    }
}

function changeSpeechSpeed(speed) {
    AppState.speechPlaybackSpeed = parseFloat(speed);

    // 停止当前播放（如果有）
    if (AppState.speechIsPlaying || AppState.speechPaused) {
        stopSpeech();
    }

    // 只更新速度设置，不自动播放
    showToast(`播放速度: ${speed}x (点击播放按钮开始)`);
}

// 切换调试区域显示
function toggleSpeechDebug(show) {
    // 保存用户偏好到 localStorage
    localStorage.setItem('speechDebugVisible', show ? 'true' : 'false');

    // 显示或隐藏调试区域
    const debugEl = document.getElementById('voice-clone-debug');
    if (debugEl) {
        debugEl.style.display = show ? 'block' : 'none';
    }

    if (show) {
        showToast('调试区域已显示');
    } else {
        showToast('调试区域已隐藏');
    }
}

// 初始化调试开关状态
function initSpeechDebugToggle() {
    const debugToggle = document.getElementById('speech-debug-check');
    const debugEl = document.getElementById('voice-clone-debug');

    if (!debugToggle || !debugEl) return;

    // 从 localStorage 读取用户偏好，默认为隐藏
    const savedPref = localStorage.getItem('speechDebugVisible');
    const isVisible = savedPref === 'true';

    // 设置开关状态
    debugToggle.checked = isVisible;

    // 显示或隐藏调试区域
    debugEl.style.display = isVisible ? 'block' : 'none';
}

// 切换语音模式
function changeVoiceMode(mode) {
    const statusEl = document.getElementById('voice-clone-status');

    if (mode === 'system') {
        // 系统语音模式
        AppState.speechVoiceMode = 'system';
        AppState.speechCloneSelectedVoice = null;
        statusEl.innerHTML = '';
        showToast('已切换到系统默认语音');
    } else if (mode.startsWith('clone-')) {
        // 复刻语音模式
        AppState.speechVoiceMode = 'clone';

        // 解析选中的语音索引
        const voiceIndex = parseInt(mode.replace('clone-', ''), 10);

        if (isNaN(voiceIndex) || voiceIndex < 0 || voiceIndex >= AppState.speechCloneVoices.length) {
            statusEl.innerHTML = '<span class="warning">⚠️ 无效的语音选择</span>';
            showToast('无效的语音选择');
            return;
        }

        // 获取之前选择的语音
        const previousVoice = AppState.speechCloneSelectedVoice;
        const newVoice = AppState.speechCloneVoices[voiceIndex];

        // 如果切换到不同的语音，清除缓存
        if (previousVoice && newVoice && previousVoice.file_id !== newVoice.file_id) {
            console.log('[Voice Clone] 切换语音，清除缓存');
            AppState.speechCloneAudioCache.clear();
            AppState.speechCloneAudioUrl = null;
        }

        // 更新选中的语音
        AppState.speechCloneSelectedVoice = newVoice;

        // 检查是否配置了 file_id
        if (!AppState.speechCloneSelectedVoice || !AppState.speechCloneSelectedVoice.file_id) {
            statusEl.innerHTML = '<span class="warning">⚠️ 请在 api_config.py 中配置</span>';
            showToast('音色复刻未配置');

            // 在控制台显示配置说明
            console.log('%c音色复刻配置说明', 'font-size: 16px; font-weight: bold; color: #667eea;');
            console.log('要使用音色复刻功能，请：');
            console.log('1. 在 https://platform.minimaxi.com/user-center/files 上传参考音频');
            console.log('2. 获取 file_id');
            console.log('3. 在 api_config.py 中设置 MINIMAX_VOICE_CLONE_VOICES');
        } else {
            const description = AppState.speechCloneSelectedVoice.description || '未知';
            statusEl.innerHTML = `<span class="success">🎙️ 音色复刻: ${description}</span>`;
            showToast(`已切换到音色复刻模式: ${description}`);
        }
    }

    // 切换模式时，只停止当前播放，不自动播放
    // 用户点击播放按钮时才会开始转换
    const chapter = AppState.currentSpeechChapter;
    if (chapter) {
        // 重置播放状态
        AppState.speechIsPlaying = false;
        AppState.speechPaused = false;
        AppState.speechCloneCurrentTime = 0;

        // 清除 Audio 对象
        if (AppState.speechUtterance) {
            if (AppState.speechUtterance instanceof Audio) {
                // 先移除所有事件监听器，防止触发 error 等事件
                AppState.speechUtterance.oncanplay = null;
                AppState.speechUtterance.onplay = null;
                AppState.speechUtterance.onpause = null;
                AppState.speechUtterance.onended = null;
                AppState.speechUtterance.onerror = null;
                // 暂停并清除 src
                AppState.speechUtterance.pause();
                AppState.speechUtterance.src = '';
                // 延迟清除对象，确保事件不会触发
                setTimeout(() => {
                    AppState.speechUtterance = null;
                }, 100);
            } else {
                AppState.speechUtterance = null;
            }
        }

        // 停止系统语音
        window.speechSynthesis.cancel();

        updatePlayButton();

        // 只更新提示，告知用户已切换模式
        if (mode === 'system') {
            showToast('已切换到系统默认语音');
        } else if (mode.startsWith('clone-')) {
            const description = AppState.speechCloneSelectedVoice?.description || '未知';
            showToast(`已切换到音色复刻: ${description}，点击播放开始转换`);
        }
    }
}

// 生成字符串的哈希值（用于缓存键）
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为 32 位整数
    }
    return hash.toString(16);
}

// 清理过期的缓存条目
function cleanupExpiredCache() {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, value] of AppState.speechCloneAudioCache) {
        if (now - value.timestamp > value.timeout) {
            AppState.speechCloneAudioCache.delete(key);
            removedCount++;
        }
    }

    if (removedCount > 0) {
        console.log(`[Voice Clone] 清理了 ${removedCount} 个过期的音频缓存`);
    }
}

// 清除所有音频缓存
function clearAudioCache() {
    AppState.speechCloneAudioCache.clear();
    console.log('[Voice Clone] 已清除所有音频缓存');
}

// 调用音色复刻 API
async function callVoiceCloneAPI(text, options = {}) {
    const { timeout = 60000, signal } = options; // 默认 60 秒超时

    addVoiceCloneLog('API 开始', `timeout=${timeout/1000}秒`);

    // 创建 AbortController（如果未提供）
    const controller = signal || new AbortController();
    const timeoutId = setTimeout(() => {
        addVoiceCloneLog('API 超时', `已等待 ${timeout/1000} 秒`);
        controller.abort();
    }, timeout);

    try {
        addVoiceCloneLog('fetch 开始', '请求 /api/voice-clone');

        // 构建请求数据，包含选中的 file_id
        const requestData = {
            text: text
        };

        // 如果选择了复刻语音，添加 file_id
        if (AppState.speechVoiceMode === 'clone' && AppState.speechCloneSelectedVoice) {
            requestData.file_id = AppState.speechCloneSelectedVoice.file_id;
            addVoiceCloneLog('语音选择', AppState.speechCloneSelectedVoice.description || '未知');
        }

        const response = await fetch('/api/voice-clone', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        addVoiceCloneLog('fetch 完成', `status=${response.status}`);

        if (!response.ok) {
            const error = await response.json();
            addVoiceCloneLog('API 响应错误', error.error || '请求失败');
            throw new Error(error.error || '音色复刻请求失败');
        }

        const data = await response.json();
        addVoiceCloneLog('解析响应', data.audio_url ? 'audio_url 存在' : 'audio_url 为空');
        return data.audio_url;
    } catch (error) {
        clearTimeout(timeoutId);
        addVoiceCloneLog('API 异常', error.name);

        // 处理超时错误
        if (error.name === 'AbortError') {
            throw new Error('请求超时，请稍后重试');
        }

        // 处理网络错误
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('网络连接失败，请检查网络设置');
        }

        throw error;
    }
}

// 播放音色复刻音频
function playVoiceCloneAudio(audioUrl) {
    addVoiceCloneLog('playVoiceCloneAudio', `URL长度: ${audioUrl ? audioUrl.length : 0}`);
    addVoiceCloneLog('设备检测', `iOS: ${isIOSBrowser()}, Chrome: ${isIOSChrome()}`);

    // 如果已经有 Audio 对象
    if (AppState.speechUtterance instanceof Audio) {
        const audio = AppState.speechUtterance;

        // 检查是否是同一个内容（通过比较 URL）
        if (audio.src === audioUrl) {
            // 同一个内容，复用现有 Audio 对象
            console.log('[Voice Clone] 复用已有的 Audio 对象，URL:', audioUrl);

            const startTime = AppState.speechCloneCurrentTime;
            if (startTime > 0 && startTime < audio.duration) {
                audio.currentTime = startTime;
            }

            // 确保 playbackRate 正确设置
            audio.playbackRate = AppState.speechPlaybackSpeed;

            try {
                audio.play();
                AppState.speechIsPlaying = true;
                AppState.speechPaused = false;
                updatePlayButton();
                console.log('[Voice Clone] 从位置播放:', audio.currentTime);
                return;
            } catch (e) {
                // 处理浏览器自动播放限制
                const isAutoplayError = e.name === 'NotAllowedError' ||
                    e.name === 'AbortError' ||
                    e.message?.includes('user gesture') ||
                    e.message?.includes('not allowed');

                if (isAutoplayError) {
                    console.warn('[Voice Clone] 播放被浏览器自动播放策略限制:', e.message);

                    // 检测是否是 iOS 设备
                    const isIOS = isIOSBrowser();
                    const isIOSChrome = isIOSChrome();

                    // iOS 设备需要更详细的提示
                    if (isIOS) {
                        console.log('[Voice Clone] iOS 设备检测到自动播放限制');
                        showToast('iOS 限制音频自动播放，请点击播放按钮开始', 4000);
                    } else {
                        // 再次尝试解锁音频上下文
                        unlockAudioContext().then((unlocked) => {
                            if (unlocked) {
                                // 解锁成功，提示用户再次点击
                                showToast('请再次点击播放按钮', 2000);
                            } else {
                                // 无法解锁，提示用户需要在页面交互后播放
                                showToast('请点击页面任意位置后再播放', 3000);
                            }
                        });
                    }
                } else {
                    console.error('[Voice Clone] play error:', e);
                }

                // 不清除 Audio 对象，保留状态
                AppState.speechIsPlaying = false;
                AppState.speechPaused = false;
                updatePlayButton();
                return;
            }
        }

        // 内容不同，停止旧的播放
        console.log('[Voice Clone] 内容不同，停止旧的 Audio 对象');
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (e) {
            console.error('[Voice Clone] 停止旧音频失败:', e);
        }
    }

    // 重置暂停状态
    AppState.speechPaused = false;

    // 停止之前的播放（如果还有旧的 Audio 对象）
    if (AppState.speechUtterance instanceof Audio) {
        try {
            AppState.speechUtterance.pause();
            AppState.speechUtterance.currentTime = 0;
        } catch (e) {
            console.error('[Voice Clone] 停止旧音频失败:', e);
        }
    }

    const audio = new Audio();
    audio.src = audioUrl;
    AppState.speechUtterance = audio;
    audio.playbackRate = AppState.speechPlaybackSpeed;

    // iOS 设备需要特殊处理
    const isIOS = isIOSBrowser();
    const isIOSChromeBrowser = isIOSChrome();

    console.log('[Voice Clone] iOS设备检测:', {
        isIOS: isIOS,
        isIOSChrome: isIOSChromeBrowser,
        isIOSSafari: isIOSSafari()
    });

    // 标记音频正在加载
    let audioLoaded = false;

    audio.oncanplay = () => {
        console.log('[Voice Clone] audio can play');
        console.log('[Voice Clone] audio.src:', audio.src);
        console.log('[Voice Clone] isIOS:', isIOS);

        // iOS 设备：音频准备好后不需要做任何事情
        // 因为我们已经在前面设置了 speechCloneReady 状态并显示了提示
        // 这里不做任何操作，等待用户点击播放
        if (isIOS) {
            console.log('[Voice Clone] iOS 设备：音频已准备好，等待用户点击');
            return;
        }

        // 非 iOS 设备：音频准备好后立即播放
        // 状态由后续的 audio.play() 调用管理
        console.log('[Voice Clone] 非 iOS 设备：音频已准备好，将自动播放');
    };

    audio.onerror = (e) => {
        const isSafariBrowser = isSafari();
        const isIOSSafariBrowser = isIOSSafari();

        console.error('[Voice Clone] audio load error:', e);
        console.error('[Voice Clone] audio.error:', audio.error);
        console.error('[Voice Clone] audio.errorCode:', audio.error ? audio.error.code : 'N/A');
        console.error('[Voice Clone] audio.errorMessage:', audio.error ? audio.error.message : 'N/A');
        console.error('[Voice Clone] audio.src:', audio.src);
        console.error('[Voice Clone] audio.readyState:', audio.readyState);
        console.error('[Voice Clone] 浏览器检测:', {
            isSafari: isSafariBrowser,
            isIOSSafari: isIOSSafariBrowser,
            isIOSChrome: isIOSChromeBrowser
        });

        // 根据错误代码提供更详细的错误信息
        let errorMsg = '音频加载失败';
        let errorDetails = '';

        if (audio.error) {
            switch (audio.error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    errorMsg = '音频加载被中断';
                    break;
                case MediaError.MEDIA_ERR_NETWORK:
                    errorMsg = '网络错误，无法加载音频';
                    errorDetails = '可能是 HTTP/HTTPS 混合内容问题，或 CORS 限制';
                    if (isSafariBrowser || isIOSSafariBrowser || isIOSChromeBrowser) {
                        errorDetails = 'iOS 设备对音频格式要求更严格，请尝试切换到系统语音';
                    }
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                    errorMsg = '音频解码失败';
                    errorDetails = '音频格式可能不被支持';
                    if (isSafariBrowser || isIOSSafariBrowser || isIOSChromeBrowser) {
                        errorMsg = 'iOS 不支持此音频格式';
                        errorDetails = 'MiniMax 返回的音频格式可能与 iOS 不兼容，建议切换到系统语音';
                    }
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMsg = '音频格式不支持';
                    errorDetails = '检查 URL 是否为 HTTPS';
                    if (isSafariBrowser || isIOSSafariBrowser || isIOSChromeBrowser) {
                        errorDetails = 'iOS 设备可能需要特定的音频编码格式';
                    }
                    break;
                default:
                    errorMsg = `音频加载错误 (代码: ${audio.error.code})`;
            }
        }

        console.error('[Voice Clone] 错误详情:', errorDetails);
        showToast(errorMsg);
        AppState.speechIsPlaying = false;
        AppState.speechPaused = false;
        updatePlayButton();

        // iOS 设备（Safari 或 Chrome）的特定处理建议
        if (isSafariBrowser || isIOSSafariBrowser || isIOSChromeBrowser) {
            console.log('[Voice Clone] iOS 用户建议切换到系统语音');
            // 提示用户切换到系统语音模式
            if (AppState.speechMode === 'voice_clone') {
                showToast('iOS 设备不支持此音频格式，请切换到系统语音', 4000);
            }
        }
    };

    audio.onplay = () => {
        AppState.speechIsPlaying = true;
        AppState.speechPaused = false;
        updatePlayButton();

        // 关闭持久提示并显示成功提示
        hidePersistentToast('正在生成克隆声音');
        showSuccessToast('开始播放');
    };

    audio.onpause = () => {
        AppState.speechIsPlaying = false;
        AppState.speechPaused = true;
        AppState.speechCloneCurrentTime = audio.currentTime;
        updatePlayButton();
        console.log('[Voice Clone] paused at:', AppState.speechCloneCurrentTime);
    };

    audio.onresume = () => {
        AppState.speechIsPlaying = true;
        AppState.speechPaused = false;
        updatePlayButton();
    };

    audio.onended = () => {
        AppState.speechIsPlaying = false;
        AppState.speechPaused = false;
        updatePlayButton();

        // 不重置播放位置，保留当前位置以便用户可以继续从结束位置播放
        // 如果需要从头开始播放，用户可以点击停止按钮
        console.log('[Voice Clone] 播放完成，保留位置:', AppState.speechCloneCurrentTime);

        // 听书模块直接提示播放完成，不自动切换章节
        showToast('播放完成');
    };

    audio.onerror = (e) => {
        console.error('音频播放错误:', e);
        AppState.speechIsPlaying = false;
        AppState.speechPaused = false;
        updatePlayButton();
        showToast('音频播放失败');
    };

    AppState.speechUtterance = audio;

    // iOS 设备：立即设置状态并显示提示，等待用户点击播放
    // 注意：我们不在这里调用 audio.play()，因为这不在用户手势上下文中
    if (isIOS) {
        addVoiceCloneLog('iOS 特殊处理', '设置 speechCloneReady=true');

        // 设置状态为已准备就绪
        AppState.speechIsPlaying = false;
        AppState.speechPaused = false;
        AppState.speechCloneReady = true;
        updatePlayButton();

        // 提示用户音频已准备好（如果还没有显示过）
        hidePersistentToast();
        showToast('音频已生成，点击播放按钮开始', 3000);
        addVoiceCloneLog('等待用户点击', '请点击播放按钮开始');

        return;
    }

    // 非 iOS 设备：自动播放
    // 在播放前先更新状态，确保图标显示为暂停样式
    AppState.speechIsPlaying = true;
    AppState.speechPaused = false;
    updatePlayButton();

    try {
        audio.play().catch(e => {
            console.error('播放失败:', e);

            // 检查是否是自动播放限制
            const isAutoplayError = e.name === 'NotAllowedError' ||
                e.name === 'AbortError' ||
                e.message?.includes('user gesture') ||
                e.message?.includes('not allowed') ||
                e.message?.includes('The request is not allowed');

            if (isAutoplayError) {
                console.warn('[Voice Clone] 自动播放被限制:', e.message);

                // 尝试解锁音频上下文
                unlockAudioContext().then((unlocked) => {
                    if (unlocked) {
                        showToast('请再次点击播放按钮', 2000);
                    } else {
                        showToast('请点击页面任意位置后再播放', 3000);
                    }
                });
            } else {
                showToast('播放失败，请重试');
            }

            // 如果播放失败，恢复状态
            AppState.speechIsPlaying = false;
            AppState.speechPaused = false;
            updatePlayButton();
        });
    } catch (e) {
        console.error('播放异常:', e);

        // 检查是否是自动播放限制
        const isAutoplayError = e.name === 'NotAllowedError' ||
            e.message?.includes('user gesture') ||
            e.message?.includes('not allowed');

        if (isAutoplayError) {
            showToast('请点击页面任意位置后再播放', 3000);
        } else {
            showToast('播放异常，请重试');
        }

        // 如果播放异常，恢复状态
        AppState.speechIsPlaying = false;
        AppState.speechPaused = false;
        updatePlayButton();
    }
}

function updatePlayButton() {
    const btn = document.getElementById('speech-play-btn');
    if (!btn) return;

    const playIcon = btn.querySelector('.play-icon');
    const pauseIcon = btn.querySelector('.pause-icon');

    if (AppState.speechIsPlaying) {
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
        btn.classList.add('playing');
    } else {
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
        btn.classList.remove('playing');
    }
}

function highlightDialogue(index) {
    clearHighlights();
    const items = document.querySelectorAll('.dialogue-item');
    if (items[index]) {
        items[index].classList.add('playing');
        items[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        // 备用方案：使用 data-index 属性查找
        const targetItem = document.querySelector(`.dialogue-item[data-index="${index}"]`);
        if (targetItem) {
            targetItem.classList.add('playing');
            targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function clearHighlights() {
    document.querySelectorAll('.dialogue-item.playing')
        .forEach(item => item.classList.remove('playing'));
}

// ========== 调试状态显示 ==========
// 存储日志历史
const voiceCloneLogHistory = [];

function addVoiceCloneLog(message, details = '') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
        time: timestamp,
        message: message,
        details: details
    };
    voiceCloneLogHistory.push(logEntry);

    // 保留最近 20 条日志
    if (voiceCloneLogHistory.length > 20) {
        voiceCloneLogHistory.shift();
    }

    // 更新显示
    updateVoiceCloneDebugDisplay();
}

function updateVoiceCloneDebugDisplay() {
    const debugEl = document.getElementById('voice-clone-debug');
    const debugToggle = document.getElementById('speech-debug-check');
    if (!debugEl) return;

    // 检查用户是否开启了调试显示
    const savedPref = localStorage.getItem('speechDebugVisible');
    const isDebugVisible = savedPref === 'true';

    // 如果调试开关未开启，不显示调试区域
    if (!isDebugVisible) {
        debugEl.style.display = 'none';
        return;
    }

    const deviceInfo = isIOSBrowser() ? '📱 iOS设备' : '🖥️ 非iOS设备';
    const status = AppState.speechCloneReady ? '✅ 已就绪' : '⏳ 进行中';

    // 构建日志历史 HTML
    const logHtml = voiceCloneLogHistory.map(log => {
        return `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.15); font-size: 12px;">
            <span style="opacity: 0.6;">[${log.time}]</span>
            <strong>${log.message}</strong>
            ${log.details ? `<div style="opacity: 0.7; margin-left: 10px; font-size: 11px; word-break: break-all;">${log.details}</div>` : ''}
        </div>`;
    }).join('');

    debugEl.innerHTML = `
        <div style="margin-bottom: 10px; font-size: 16px; font-weight: bold;">
            <strong>${deviceInfo}</strong> | <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px;">${status}</span>
        </div>
        <div style="font-size: 13px; line-height: 1.6;">
            ${logHtml}
        </div>
    `;
    debugEl.style.display = 'block';
}

// 简化的调试状态更新（兼容旧代码）
function updateVoiceCloneDebug(message, details = '') {
    addVoiceCloneLog(message, details);
}

function hideVoiceCloneDebug() {
    const debugEl = document.getElementById('voice-clone-debug');
    if (debugEl) {
        debugEl.style.display = 'none';
        voiceCloneLogHistory.length = 0; // 清空日志历史
    }
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
                    <div class="unit-progress-info">
                        <span class="unit-progress-book">${wordbook.name}</span>
                    <span class="unit-progress-name">${unit.unit}</span>
                    </div>
                    <div class="unit-progress-bar">
                        <div class="unit-progress-fill" style="width: ${percent}%"></div>
                    </div>
                    <span class="unit-progress-count">${learnedWords}/${unit.words.length}</span>
                </div>
            `;
        });
    });

    unitProgressList.innerHTML = unitHtml;

    // 渲染阅读进度
    renderReadingProgress();
}

// 渲染阅读进度
function renderReadingProgress() {
    const readings = AppState.readings || [];
    const totalReadings = readings.length;

    // 从 localStorage 获取已完成的阅读
    const completedReadings = JSON.parse(localStorage.getItem('completedReadings') || '[]');
    const completedCount = completedReadings.length;

    // 计算完成率
    const progressPercent = totalReadings > 0
        ? Math.round((completedCount / totalReadings) * 100)
        : 0;

    // 更新阅读统计卡片
    const totalReadingsEl = document.getElementById('total-readings');
    const completedReadingsEl = document.getElementById('completed-readings');
    const progressPercentEl = document.getElementById('reading-progress-percent');

    if (totalReadingsEl) totalReadingsEl.textContent = totalReadings;
    if (completedReadingsEl) completedReadingsEl.textContent = completedCount;
    if (progressPercentEl) progressPercentEl.textContent = progressPercent + '%';
}

// 标记阅读为完成
function markReadingCompleted(readingId) {
    const completedReadings = JSON.parse(localStorage.getItem('completedReadings') || '[]');
    if (!completedReadings.includes(readingId)) {
        completedReadings.push(readingId);
        localStorage.setItem('completedReadings', JSON.stringify(completedReadings));
        renderReadingProgress();
    }
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

/** 将简单 Markdown（如 **粗体**）转为 HTML，先转义再替换，保证安全 */
function renderMdInline(text) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    return escaped.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
}

/** 去掉 Markdown 标记，用于语音朗读等纯文本场景 */
function stripMdForSpeech(text) {
    if (!text) return '';
    return String(text).replace(/\*\*/g, '').trim();
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

// Toast 提示
function showToast(message, duration = 2000) {
    // 创建 toast 元素
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    // 添加到页面
    document.body.appendChild(toast);

    // 显示动画
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 设置定时器移除
    toast.timer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);

    return toast;
}

// 持久提示（带自动超时）
let persistentToast = null;
let persistentToastTimeout = null; // 超时定时器

function showPersistentToast(message, options = {}) {
    const { autoHide = false, hideAfter = 0 } = options;

    // 如果已有持久提示，先关闭
    if (persistentToast) {
        hidePersistentToast();
    }

    // 创建 toast 元素
    const toast = document.createElement('div');
    toast.className = 'toast toast-loading toast-persistent';
    toast.innerHTML = `
        <div class="toast-loading-content">
            <span class="toast-spinner"></span>
            <span class="toast-message">${message}</span>
        </div>
    `;

    // 添加到页面
    document.body.appendChild(toast);

    // 显示动画
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    persistentToast = toast;

    // 如果设置了自动隐藏
    if (autoHide && hideAfter > 0) {
        persistentToastTimeout = setTimeout(() => {
            hidePersistentToast();
        }, hideAfter);
    }

    return toast;
}

function hidePersistentToast(message = null) {
    if (!persistentToast) return;

    // 如果指定了消息，检查是否匹配
    if (message && !persistentToast.textContent.includes(message)) {
        return;
    }

    // 清除超时定时器
    if (persistentToastTimeout) {
        clearTimeout(persistentToastTimeout);
        persistentToastTimeout = null;
    }

    persistentToast.classList.remove('show');
    setTimeout(() => {
        if (persistentToast) {
            persistentToast.remove();
            persistentToast = null;
        }
    }, 300);
}

function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = message;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2000);
}

// 简单的 Markdown 解析函数
function parseMarkdown(text) {
    if (!text) return '';

    let result = text;

    // 代码反引号：`code`
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 粗体：**text**
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    return result;
}

/** Blink（Chrome / Edge 等）：speech 调度与 Safari 差异大，用于延迟与排查 */
function isLikelyChromiumBrowser() {
    return typeof navigator !== 'undefined' && /Chrome|Chromium|Edg\//u.test(navigator.userAgent);
}

/** 是否为本机可视为「相对安全」的主机名（与 isSecureContext 无关，用于提示文案） */
function isLocalhostLikeHostname() {
    const h = (typeof location !== 'undefined' && location.hostname ? location.hostname : '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');
}

/**
 * Chrome 在「HTTP + 非本机主机名」（常见 http://192.168.x.x）下 isSecureContext 为 false，
 * 语音合成常无声或极不稳定；Safari 往往仍可用。
 */
function isSpeechRestrictedHttpContext() {
    if (typeof location === 'undefined') return false;
    if (location.protocol !== 'http:') return false;
    if (typeof isSecureContext !== 'undefined' && isSecureContext) return false;
    return !isLocalhostLikeHostname();
}

/** cancel 之后到 speak 的延迟：受限 HTTP 下 Chrome 需要更长间隔 */
function speechDeferMsAfterCancel() {
    if (!isLikelyChromiumBrowser()) return 0;
    return isSpeechRestrictedHttpContext() ? 150 : 50;
}

/**
 * 选择英音/美音音色（仅选与目标口音一致的 lang），不依赖名字含 "Female"。
 * 不再降级到任意 en-*：在 Chrome 上把 en-US 音色绑到 utterance.lang=en-GB 会导致常无声。
 */
function pickEnglishSpeechVoice(preferGb) {
    const voices = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [];
    if (!voices.length) return null;
    const female = (v) => /female/i.test(v.name);
    if (preferGb) {
        return (
            voices.find((v) => v.lang.startsWith('en-GB') && female(v)) ||
            voices.find((v) => v.lang.startsWith('en-GB')) ||
            null
        );
    }
    return (
        voices.find((v) => v.lang.startsWith('en-US') && female(v)) ||
        voices.find((v) => v.lang.startsWith('en-US')) ||
        null
    );
}

/**
 * Chrome 等浏览器中 getVoices() 常异步填充；若初次为空就 speak，可能无声。
 * 在 voiceschanged 或短延迟后再选音色并朗读（只执行一次）。
 */
function speakUtteranceWithVoice(utterance, preferGb) {
    const synth = window.speechSynthesis;
    let spoke = false;
    const applyAndSpeak = () => {
        if (spoke) return;
        spoke = true;
        const picked = pickEnglishSpeechVoice(preferGb);
        if (picked) {
            utterance.voice = picked;
            // Chrome：voice.lang 须与 utterance.lang 一致，否则易静默失败
            if (picked.lang) utterance.lang = picked.lang;
        }
        // Chrome：cancel 后需异步 speak；受限 HTTP 上下文需更长延迟
        const deferMs = speechDeferMsAfterCancel();
        setTimeout(() => {
            try {
                try {
                    synth.resume();
                } catch (e) {
                    /* ignore */
                }
                synth.speak(utterance);
            } catch (e) {
                /* ignore */
            }
        }, deferMs);
    };

    if (synth.getVoices().length > 0) {
        applyAndSpeak();
        return;
    }

    let timeoutId = null;
    const onVoices = () => {
        if (timeoutId != null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        synth.removeEventListener('voiceschanged', onVoices);
        applyAndSpeak();
    };

    timeoutId = setTimeout(() => {
        timeoutId = null;
        synth.removeEventListener('voiceschanged', onVoices);
        applyAndSpeak();
    }, 400);

    synth.addEventListener('voiceschanged', onVoices);
}

// 单词发音（英音）
function speakWord(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成');
        return;
    }

    const clean = stripMdForSpeech(text) || String(text).replace(/\*\*/g, '').trim();
    if (!clean) return;

    // Chrome：合成器初始可能为 paused，需在用户手势内 resume（与后续 speak 同一次点击链中尽早调用）
    try {
        window.speechSynthesis.resume();
    } catch (e) {
        /* ignore */
    }

    // 取消之前的朗读
    try {
        window.speechSynthesis.cancel();
    } catch (e) {
        // 忽略取消时的错误
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'en-GB';
    utterance.rate = 0.8;
    utterance.pitch = 1.0;

    utterance.onerror = () => {
        // canceled / interrupted 等为正常情况
    };

    speakUtteranceWithVoice(utterance, true);
}

// 单词发音（美音）
function speakWordUS(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成');
        return;
    }

    const clean = stripMdForSpeech(text) || String(text).replace(/\*\*/g, '').trim();
    if (!clean) return;

    try {
        window.speechSynthesis.resume();
    } catch (e) {
        /* ignore */
    }

    try {
        window.speechSynthesis.cancel();
    } catch (e) {
        // 忽略取消时的错误
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    utterance.pitch = 1.0;

    utterance.onerror = () => {};

    speakUtteranceWithVoice(utterance, false);
}

/**
 * 例句朗读；自动去掉 ** 等 Markdown，避免读星号
 * @param {string} text
 * @param {'us'|'gb'} accent 美音或英音（默认 us，兼容旧调用）
 */
function speakExample(text, accent = 'us') {
    const clean = stripMdForSpeech(text) || String(text).replace(/\*\*/g, '').trim();
    if (!clean) return;

    if (!('speechSynthesis' in window)) {
        console.warn('浏览器不支持语音合成');
        return;
    }

    try {
        window.speechSynthesis.resume();
    } catch (e) {
        /* ignore */
    }

    try {
        window.speechSynthesis.cancel();
    } catch (e) {
        /* ignore */
    }

    const isGB = accent === 'gb' || accent === 'uk';
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = isGB ? 'en-GB' : 'en-US';
    utterance.rate = 0.9;

    utterance.onerror = () => {};

    speakUtteranceWithVoice(utterance, isGB);
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

// ========== AI 知识问答（首页墨小灵） ==========

// API 配置（调用本地服务器，由 server.py 代理保护 API Key）
const API_BASE_URL = '/api';

let mascotHappyTimer = null;
let mascotBubbleTimer = null;
let moxiaolingLottieInst = null;
/** 与当前 `moxiaolingLottieInst` 对应的 JSON 路径（用于热切换形象） */
let moxiaolingLottieLoadedPath = null;

/** 可切换的墨小灵 Lottie：`?mascot=` 当次生效；`localStorage.moxiaolingLottieVariant` 持久。默认使用 lascot-bot2；`blob` 为原 bot 形象；`lottiefiles` 为 LottieFiles 公开包角色；`lascot-bot2` 与默认同源 */
const MOXIAOLING_LOTTIE_BY_KEY = {
    default: 'lottie/lascot-bot2.json',
    blob: 'lottie/mascot-bot.json',
    lottiefiles: 'lottie/mascot-character.json',
    'lascot-bot2': 'lottie/lascot-bot2.json'
};

function resolveMoxiaolingLottiePath() {
    try {
        const q = new URLSearchParams(window.location.search).get('mascot');
        if (q && MOXIAOLING_LOTTIE_BY_KEY[q]) return MOXIAOLING_LOTTIE_BY_KEY[q];
    } catch (_) {
        /* ignore */
    }
    try {
        const k = localStorage.getItem('moxiaolingLottieVariant');
        if (k && MOXIAOLING_LOTTIE_BY_KEY[k]) return MOXIAOLING_LOTTIE_BY_KEY[k];
    } catch (_) {
        /* ignore */
    }
    return MOXIAOLING_LOTTIE_BY_KEY.default;
}

/** 纯 Lottie 角色（无位图），资源见 lottie/ 与 lottie/README.md */
function initMoxiaolingMainLottie() {
    if (typeof lottie === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const container = document.getElementById('moxiaoling-lottie');
    if (!container) return;
    const path = resolveMoxiaolingLottiePath();
    if (moxiaolingLottieInst) {
        if (moxiaolingLottieLoadedPath === path) return;
        moxiaolingLottieInst.destroy();
        moxiaolingLottieInst = null;
        moxiaolingLottieLoadedPath = null;
        container.innerHTML = '';
    }
    moxiaolingLottieLoadedPath = path;
    moxiaolingLottieInst = lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path,
        rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet'
        }
    });
    moxiaolingLottieInst.addEventListener('DOMLoaded', () => {
        const st = document.getElementById('moxiaoling-mascot')?.dataset?.state || 'idle';
        syncMoxiaolingLottiePlayback(st);
    });
}

function syncMoxiaolingLottiePlayback(state) {
    if (!moxiaolingLottieInst) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let sp = 1;
    if (state === 'thinking') sp = 1.55;
    else if (state === 'happy') sp = 1.3;
    moxiaolingLottieInst.setSpeed(sp);
}

/** 根据系统「减少动态效果」在 Lottie 与静态占位之间切换 */
function syncMoxiaolingLottieForUserSettings() {
    const container = document.getElementById('moxiaoling-lottie');
    if (!container) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (moxiaolingLottieInst) {
            moxiaolingLottieInst.destroy();
            moxiaolingLottieInst = null;
            moxiaolingLottieLoadedPath = null;
        }
        container.innerHTML = '';
        container.classList.add('moxiaoling-lottie-reduced');
        container.textContent = '📚';
        return;
    }
    container.classList.remove('moxiaoling-lottie-reduced');
    if (container.textContent === '📚') {
        container.textContent = '';
    }
    if (typeof lottie === 'undefined') {
        container.classList.add('moxiaoling-lottie-reduced');
        container.textContent = '📚';
        return;
    }
    initMoxiaolingMainLottie();
    syncMoxiaolingLottiePlayback(document.getElementById('moxiaoling-mascot')?.dataset?.state || 'idle');
}
let mascotSfxCtx = null;

/** 点击墨小灵时的轻快提示音（Web Audio，需用户手势触发以通过浏览器策略） */
function playMoxiaolingTapSound() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!mascotSfxCtx || mascotSfxCtx.state === 'closed') {
            mascotSfxCtx = new AC();
        }
        const ctx = mascotSfxCtx;
        const ding = () => {
            const t0 = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, t0);
            osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.07);
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + 0.19);
        };
        if (ctx.state === 'suspended') {
            ctx.resume().then(ding).catch(() => {});
        } else {
            ding();
        }
    } catch (_) {
        /* 忽略不支持或策略限制 */
    }
}

function clearMascotBubbleTimer() {
    if (mascotBubbleTimer) {
        clearTimeout(mascotBubbleTimer);
        mascotBubbleTimer = null;
    }
}

function setMascotBubbleText(text, autoHideMs) {
    const bubble = document.getElementById('moxiaoling-bubble');
    if (!bubble) return;
    clearMascotBubbleTimer();
    if (!text) {
        bubble.textContent = '';
        bubble.classList.remove('is-visible');
        return;
    }
    bubble.textContent = text;
    bubble.classList.add('is-visible');
    if (autoHideMs > 0) {
        mascotBubbleTimer = setTimeout(() => {
            const root = document.getElementById('moxiaoling-mascot');
            if (root?.dataset.state === 'idle') {
                bubble.classList.remove('is-visible');
                bubble.textContent = '';
            }
            mascotBubbleTimer = null;
        }, autoHideMs);
    }
}

function initMoxiaolingMascotInteraction() {
    const root = document.getElementById('moxiaoling-mascot');
    const tiltEl = document.getElementById('moxiaoling-lottie-tilt');
    if (!root || !tiltEl) return;

    syncMoxiaolingLottieForUserSettings();

    const idlePhrases = [
        '今天也要加油学英语哦！',
        '有单词不会？尽管问我～',
        '你提问的样子超认真！',
        '我们一起把英语变简单吧！',
        '在下面输入英文或中文都可以～',
        '坚持就是胜利，小灵给你点赞！'
    ];

    function showIdleEncourage() {
        if (root.dataset.state !== 'idle') return;
        playMoxiaolingTapSound();
        const phrase = idlePhrases[Math.floor(Math.random() * idlePhrases.length)];
        setMascotBubbleText(phrase, 3800);
    }

    root.addEventListener('click', e => {
        e.preventDefault();
        if (root.dataset.state === 'thinking') return;
        showIdleEncourage();
    });

    root.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (root.dataset.state === 'thinking') return;
        showIdleEncourage();
    });

    let rafTilt = null;
    function applyTilt(e) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (!window.matchMedia('(pointer: fine)').matches) return;
        if (root.dataset.state === 'thinking') {
            tiltEl.style.transform = '';
            return;
        }
        const r = tiltEl.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (e.clientX - cx) / Math.max(r.width / 2, 1);
        const dy = (e.clientY - cy) / Math.max(r.height / 2, 1);
        const max = 6;
        tiltEl.style.transform = `perspective(520px) rotateY(${dx * max}deg) rotateX(${-dy * max}deg)`;
    }

    root.addEventListener('mousemove', e => {
        if (rafTilt) cancelAnimationFrame(rafTilt);
        rafTilt = requestAnimationFrame(() => applyTilt(e));
    });

    root.addEventListener('mouseleave', () => {
        if (rafTilt) cancelAnimationFrame(rafTilt);
        tiltEl.style.transform = '';
    });

    syncMoxiaolingLottiePlayback(document.getElementById('moxiaoling-mascot')?.dataset?.state || 'idle');
}

function setMoxiaolingMascotState(state) {
    const el = document.getElementById('moxiaoling-mascot');
    if (!el) return;
    clearMascotBubbleTimer();
    el.dataset.state = state;
    if (state === 'thinking') {
        setMascotBubbleText('让我好好想一想…', 0);
    } else if (state === 'happy') {
        setMascotBubbleText('太棒啦！答案来啦～', 0);
    } else {
        setMascotBubbleText('', 0);
    }
    syncMoxiaolingLottiePlayback(state);
}

async function submitQA() {
    const inputEl = document.getElementById('qa-input');
    const submitBtn = document.getElementById('qa-submit-btn');
    const loadingEl = document.getElementById('qa-loading');
    const resultEl = document.getElementById('qa-result');
    const answerEl = resultEl.querySelector('.qa-answer');

    const question = inputEl.value.trim();
    if (!question) {
        alert('先写一个字再问小灵吧～');
        return;
    }

    if (mascotHappyTimer) {
        clearTimeout(mascotHappyTimer);
        mascotHappyTimer = null;
    }
    setMoxiaolingMascotState('thinking');

    // 显示加载状态
    submitBtn.disabled = true;
    loadingEl.style.display = 'flex';
    loadingEl.setAttribute('aria-busy', 'true');
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
            setMoxiaolingMascotState('happy');
            mascotHappyTimer = setTimeout(() => {
                setMoxiaolingMascotState('idle');
                mascotHappyTimer = null;
            }, 3200);
        } else {
            answerEl.innerHTML = '<p>抱歉，小灵这次没答上来，请稍后再试。</p>';
            setMoxiaolingMascotState('idle');
        }

        resultEl.style.display = 'block';
    } catch (error) {
        console.error('AI Q&A Error:', error);
        setMoxiaolingMascotState('idle');
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
        loadingEl.setAttribute('aria-busy', 'false');
        submitBtn.disabled = false;
    }
}

// 导出供全局使用
window.speakWord = speakWord;
window.speakWordUS = speakWordUS;
window.speakExample = speakExample;
window.playAllDialogues = playAllDialogues;
window.playDialogue = playDialogue;
window.toggleFavorite = toggleFavorite;
window.removeFromWrongbook = removeFromWrongbook;
window.speakCurrentWord = speakCurrentWord;
window.speakCurrentWordUS = speakCurrentWordUS;
window.submitQA = submitQA;

// ========== 工具页面 ==========
let parsedWordsData = null;
let parsedReadingsData = null;
let parsedSpeechData = null;

function initToolPage() {
    // 初始化标签切换
    document.querySelectorAll('.tool-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tool-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tool-' + tab.dataset.tab).classList.add('active');
        });
    });

    // 初始化单词文件上传
    initWordsUpload();

    // 初始化阅读文件上传
    initReadingsUpload();

    // 初始化朗读文件上传
    initSpeechUpload();
}

// ========== 安全检查函数 ==========
const SecurityConfig = {
    // 最大文件大小 (5MB)
    maxFileSize: 5 * 1024 * 1024,

    // 允许的文件扩展名
    allowedExtensions: {
        markdown: ['.md', '.txt'],
        json: ['.json']
    },

    // 危险的文件扩展名
    dangerousExtensions: [
        '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',
        '.js', '.ts', '.jsx', '.tsx',
        '.html', '.htm', '.xhtml', '.shtml',
        '.php', '.asp', '.jsp', '.cgi', '.pl',
        '.py', '.rb', '.sh', '.bash', '.zsh',
        '.sql', '.db', '.mdb', '.sqlite',
        '.xml', '.xsl', '.xsd',
        '.zip', '.rar', '.7z', '.tar', '.gz',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp',
        '.mp3', '.mp4', '.avi', '.mkv', '.wav', '.pdf',
        '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
    ],

    // 危险内容模式（正则表达式）
    dangerousPatterns: [
        /<script[^>]*>[\s\S]*?<\/script>/gi,
        /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
        /<object[^>]*>[\s\S]*?<\/object>/gi,
        /<embed[^>]*>/gi,
        /on\w+\s*=/gi,
        /javascript:/gi,
        /eval\s*\(/gi,
        /document\.cookie/gi,
        /window\.location/gi,
        /fetch\s*\(/gi,
        /XMLHttpRequest/gi,
        /\$_(GET|POST|REQUEST|SESSION|COOKIE)/gi
    ]
};

// 安全检查函数
function validateUploadFile(file, fileType) {
    const errors = [];

    // 提取文件扩展名（统一使用小写）
    const fileNameLower = file.name.toLowerCase();
    const extension = '.' + fileNameLower.split('.').pop();
    const fileSize = file.size;

    // 1. 检查文件大小
    if (fileSize > SecurityConfig.maxFileSize) {
        errors.push(`文件大小超过限制 (最大 ${formatFileSize(SecurityConfig.maxFileSize)})`);
    }

    // 2. 检查文件扩展名（统一小写检查）
    if (SecurityConfig.dangerousExtensions.includes(extension)) {
        errors.push(`不支持的文件类型：${extension}`);
    }

    // 3. 检查允许的扩展名
    const allowedExts = SecurityConfig.allowedExtensions[fileType] || [];
    const hasAllowedExt = allowedExts.some(ext => fileNameLower.endsWith(ext.toLowerCase()));
    if (!hasAllowedExt) {
        errors.push(`只支持 ${allowedExts.join('、')} 格式的文件`);
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// 检查文件内容中的危险模式
function scanContentForDangerousPatterns(content) {
    const dangerousFindings = [];

    for (const pattern of SecurityConfig.dangerousPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            dangerousFindings.push(`发现危险内容模式：${pattern.source.substring(0, 50)}...`);
        }
    }

    return {
        isSafe: dangerousFindings.length === 0,
        findings: dangerousFindings
    };
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function initWordsUpload() {
    // Markdown 文件上传
    const mdUploadArea = document.getElementById('wordsMdUploadArea');
    const mdFileInput = document.getElementById('wordsMdFileInput');

    // 阻止冒泡，防止点击 file input 时触发父元素的 click 事件
    mdFileInput.addEventListener('click', (e) => e.stopPropagation());

    mdUploadArea.addEventListener('click', () => mdFileInput.click());
    mdUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        mdUploadArea.classList.add('dragover');
    });
    mdUploadArea.addEventListener('dragleave', () => {
        mdUploadArea.classList.remove('dragover');
    });
    mdUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        mdUploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.md')) handleWordsMdFile(file);
    });
    mdFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleWordsMdFile(file);
    });

    // JSON 文件上传（实时生效）
    const jsonUploadArea = document.getElementById('wordsJsonUploadArea');
    const jsonFileInput = document.getElementById('wordsJsonFileInput');

    // 阻止冒泡，防止点击 file input 时触发父元素的 click 事件
    jsonFileInput.addEventListener('click', (e) => e.stopPropagation());

    jsonUploadArea.addEventListener('click', () => jsonFileInput.click());
    jsonUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        jsonUploadArea.classList.add('dragover');
    });
    jsonUploadArea.addEventListener('dragleave', () => {
        jsonUploadArea.classList.remove('dragover');
    });
    jsonUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        jsonUploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) handleWordsJsonFile(file);
    });
    jsonFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleWordsJsonFile(file);
    });

    const fileInfo = document.getElementById('wordsFileInfo');
    const fileName = document.getElementById('wordsFileName');
    const fileSize = document.getElementById('wordsFileSize');
    const preview = document.getElementById('wordsPreview');
    const wordbookList = document.getElementById('wordbookList');
    const actions = document.getElementById('wordsActions');
    const status = document.getElementById('wordsStatus');

    function resetFileInput() {
        // 重置 file input，允许再次选择同一文件
        mdFileInput.value = '';
        jsonFileInput.value = '';
    }

    function handleWordsMdFile(file) {
        // 安全检查
        const validation = validateUploadFile(file, 'markdown');
        if (!validation.isValid) {
            showWordsStatus('文件验证失败：' + validation.errors.join('；'), 'error');
            resetFileInput();
            return;
        }

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;

            // 内容安全扫描
            const contentScan = scanContentForDangerousPatterns(content);
            if (!contentScan.isSafe) {
                showWordsStatus('文件内容包含不安全的内容，已拒绝处理', 'error');
                console.error('Dangerous content found:', contentScan.findings);
                resetFileInput();
                return;
            }

            try {
                parsedWordsData = parseWordsMD(content);
                showWordsPreview(parsedWordsData);
                showWordsStatus('Markdown 文件解析成功！', 'success');
                actions.style.display = 'block';
                resetFileInput();
            } catch (error) {
                showWordsStatus('文件解析失败：' + error.message, 'error');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    function handleWordsJsonFile(file) {
        // 安全检查
        const validation = validateUploadFile(file, 'json');
        if (!validation.isValid) {
            showWordsStatus('文件验证失败：' + validation.errors.join('；'), 'error');
            resetFileInput();
            return;
        }

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;

            // 内容安全扫描
            const contentScan = scanContentForDangerousPatterns(content);
            if (!contentScan.isSafe) {
                showWordsStatus('文件内容包含不安全的内容，已拒绝处理', 'error');
                console.error('Dangerous content found:', contentScan.findings);
                resetFileInput();
                return;
            }

            try {
                const data = JSON.parse(content);
                console.log('[Words JSON] Parsed data type:', typeof data, Array.isArray(data));
                console.log('[Words JSON] Data length:', data.length);
                parsedWordsData = data;
                showWordsPreview(parsedWordsData);
                showWordsStatus('JSON 文件加载成功！正在应用更改...', 'success');
                // 实时应用到系统
                applyWordsData(data);
                resetFileInput();
            } catch (error) {
                showWordsStatus('JSON 解析失败：' + error.message, 'error');
                console.error('JSON parse error:', error);
            }
        };
        reader.onerror = (e) => {
            showWordsStatus('文件读取失败', 'error');
            console.error('File read error:', e);
        };
        reader.readAsText(file);
    }

    function applyWordsData(data) {
        console.log('[Apply Words] Received data type:', typeof data, Array.isArray(data));
        console.log('[Apply Words] Data:', data);

        // 确保数据是数组
        if (!Array.isArray(data)) {
            showWordsStatus('数据格式错误：期望数组格式', 'error');
            console.error('Invalid data format:', data);
            return;
        }

        // 更新应用状态
        AppState.wordData = data;

        // 保存到 localStorage
        localStorage.setItem('wordData', JSON.stringify(data));

        // 重新初始化词书选择器
        initWordBookSelector();

        // 重新渲染当前页面
        if (document.getElementById('page-words').classList.contains('active')) {
            renderWordListPage();
        }
        if (document.getElementById('page-flashcard').classList.contains('active')) {
            renderFlashcardSetup();
        }

        showWordsStatus('✅ 单词数据已成功应用！系统已更新。', 'success');
    }

    function showWordsPreview(data) {
        wordbookList.innerHTML = '';

        // 确保数据是数组
        if (!Array.isArray(data)) {
            showWordsStatus('数据格式错误：期望数组格式', 'error');
            console.error('Invalid data format:', data);
            return;
        }

        if (data.length === 0) {
            wordbookList.innerHTML = '<li class="wordbook-item">没有数据</li>';
            preview.style.display = 'block';
            return;
        }

        data.forEach(book => {
            const bookItem = document.createElement('li');
            bookItem.className = 'wordbook-item';
            bookItem.innerHTML = `
                <strong>${book.name}</strong>
                <div class="unit-list">
                    ${book.units.map(unit => `
                        <div class="unit-item">
                            ${unit.unit} - ${unit.title || '未命名'} (${unit.words.length} 个单词)
                        </div>
                    `).join('')}
                </div>
            `;
            wordbookList.appendChild(bookItem);
        });
        preview.style.display = 'block';
    }

    function generateWordsJSON() {
        if (!parsedWordsData) return null;
        return JSON.stringify(parsedWordsData, null, 2);
    }

    function showWordsStatus(message, type) {
        status.innerHTML = message;
        status.className = 'status ' + type;
    }

    document.getElementById('wordsGenerateBtn').addEventListener('click', () => {
        const json = generateWordsJSON();
        if (!json) {
            showWordsStatus('没有可生成的数据', 'error');
            return;
        }
        downloadFile(json, 'words.json', 'application/json');
        showWordsStatus('✅ words.json 已下载！', 'success');
    });

    document.getElementById('wordsCopyBtn').addEventListener('click', () => {
        const json = generateWordsJSON();
        if (!json) {
            showWordsStatus('没有可复制的数据', 'error');
            return;
        }
        navigator.clipboard.writeText(json).then(() => {
            showWordsStatus('JSON 数据已复制到剪贴板！', 'success');
        }).catch(err => {
            showWordsStatus('复制失败：' + err.message, 'error');
        });
    });
}

function initReadingsUpload() {
    // Markdown 文件上传
    const mdUploadArea = document.getElementById('readingsMdUploadArea');
    const mdFileInput = document.getElementById('readingsMdFileInput');

    // 阻止冒泡，防止点击 file input 时触发父元素的 click 事件
    mdFileInput.addEventListener('click', (e) => e.stopPropagation());

    mdUploadArea.addEventListener('click', () => mdFileInput.click());
    mdUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        mdUploadArea.classList.add('dragover');
    });
    mdUploadArea.addEventListener('dragleave', () => {
        mdUploadArea.classList.remove('dragover');
    });
    mdUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        mdUploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.md')) handleReadingsMdFile(file);
    });
    mdFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleReadingsMdFile(file);
    });

    // JSON 文件上传（实时生效）
    const jsonUploadArea = document.getElementById('readingsJsonUploadArea');
    const jsonFileInput = document.getElementById('readingsJsonFileInput');

    // 阻止冒泡，防止点击 file input 时触发父元素的 click 事件
    jsonFileInput.addEventListener('click', (e) => e.stopPropagation());

    jsonUploadArea.addEventListener('click', () => jsonFileInput.click());
    jsonUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        jsonUploadArea.classList.add('dragover');
    });
    jsonUploadArea.addEventListener('dragleave', () => {
        jsonUploadArea.classList.remove('dragover');
    });
    jsonUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        jsonUploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) handleReadingsJsonFile(file);
    });
    jsonFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleReadingsJsonFile(file);
    });

    const fileInfo = document.getElementById('readingsFileInfo');
    const fileName = document.getElementById('readingsFileName');
    const fileSize = document.getElementById('readingsFileSize');
    const preview = document.getElementById('readingsPreview');
    const readingList = document.getElementById('readingList');
    const actions = document.getElementById('readingsActions');
    const status = document.getElementById('readingsStatus');

    function resetFileInput() {
        // 重置 file input，允许再次选择同一文件
        mdFileInput.value = '';
        jsonFileInput.value = '';
    }

    function handleReadingsMdFile(file) {
        // 安全检查
        const validation = validateUploadFile(file, 'markdown');
        if (!validation.isValid) {
            showReadingsStatus('文件验证失败：' + validation.errors.join('；'), 'error');
            resetFileInput();
            return;
        }

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;

            // 内容安全扫描
            const contentScan = scanContentForDangerousPatterns(content);
            if (!contentScan.isSafe) {
                showReadingsStatus('文件内容包含不安全的内容，已拒绝处理', 'error');
                console.error('Dangerous content found:', contentScan.findings);
                resetFileInput();
                return;
            }

            try {
                parsedReadingsData = parseReadingsMD(content);
                showReadingsPreview(parsedReadingsData);
                showReadingsStatus('Markdown 文件解析成功！', 'success');
                actions.style.display = 'block';
                resetFileInput();
            } catch (error) {
                showReadingsStatus('文件解析失败：' + error.message, 'error');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    function handleReadingsJsonFile(file) {
        // 安全检查
        const validation = validateUploadFile(file, 'json');
        if (!validation.isValid) {
            showReadingsStatus('文件验证失败：' + validation.errors.join('；'), 'error');
            resetFileInput();
            return;
        }

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;

            // 内容安全扫描
            const contentScan = scanContentForDangerousPatterns(content);
            if (!contentScan.isSafe) {
                showReadingsStatus('文件内容包含不安全的内容，已拒绝处理', 'error');
                console.error('Dangerous content found:', contentScan.findings);
                resetFileInput();
                return;
            }

            try {
                const data = JSON.parse(content);
                parsedReadingsData = data.readings || data;
                showReadingsPreview(parsedReadingsData);
                showReadingsStatus('JSON 文件加载成功！正在应用更改...', 'success');

                // 实时应用到系统
                applyReadingsData(parsedReadingsData);
                resetFileInput();
            } catch (error) {
                showReadingsStatus('JSON 解析失败：' + error.message, 'error');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    function applyReadingsData(data) {
        // 确保数据是数组
        if (!Array.isArray(data)) {
            showReadingsStatus('数据格式错误：期望数组格式', 'error');
            console.error('Invalid data format:', data);
            return;
        }

        // 更新应用状态
        AppState.readings = data;

        // 保存到 localStorage
        localStorage.setItem('readingsData', JSON.stringify(data));

        // 重新渲染阅读列表（如果当前在阅读页面）
        if (document.getElementById('page-readings').classList.contains('active')) {
            renderReadingsList();
        }

        showReadingsStatus('✅ 阅读数据已成功应用！系统已更新。', 'success');
    }

    function showReadingsPreview(data) {
        readingList.innerHTML = '';

        // 确保数据是数组
        if (!Array.isArray(data)) {
            showReadingsStatus('数据格式错误：期望数组格式', 'error');
            console.error('Invalid data format:', data);
            return;
        }

        if (data.length === 0) {
            readingList.innerHTML = '<li class="reading-item">没有数据</li>';
            preview.style.display = 'block';
            return;
        }

        data.forEach((reading, index) => {
            const readingItem = document.createElement('li');
            readingItem.className = 'reading-item';
            readingItem.innerHTML = `
                <strong>${reading.title} (${reading.titleCn})</strong>
                <div class="unit-list">
                    <div class="unit-item">
                        句型: ${reading.keySentencePatterns.length} 个 |
                        知识点: ${reading.knowledgePoints.length} 个 |
                        对话: ${reading.dialogues.length} 句
                    </div>
                </div>
            `;
            readingList.appendChild(readingItem);
        });
        preview.style.display = 'block';
    }

    function generateReadingsJSON() {
        if (!parsedReadingsData) return null;
        return JSON.stringify({ readings: parsedReadingsData }, null, 2);
    }

    function showReadingsStatus(message, type) {
        status.innerHTML = message;
        status.className = 'status ' + type;
    }

    document.getElementById('readingsGenerateBtn').addEventListener('click', () => {
        const json = generateReadingsJSON();
        if (!json) {
            showReadingsStatus('没有可生成的数据', 'error');
            return;
        }
        downloadFile(json, 'readings.json', 'application/json');
        showReadingsStatus('✅ readings.json 已下载！', 'success');
    });

    document.getElementById('readingsCopyBtn').addEventListener('click', () => {
        const json = generateReadingsJSON();
        if (!json) {
            showReadingsStatus('没有可复制的数据', 'error');
            return;
        }
        navigator.clipboard.writeText(json).then(() => {
            showReadingsStatus('JSON 数据已复制到剪贴板！', 'success');
        }).catch(err => {
            showReadingsStatus('复制失败：' + err.message, 'error');
        });
    });
}

// 初始化朗读文件上传
function initSpeechUpload() {
    // Markdown 文件上传
    const mdUploadArea = document.getElementById('speechMdUploadArea');
    const mdFileInput = document.getElementById('speechMdFileInput');

    // 阻止冒泡，防止点击 file input 时触发父元素的 click 事件
    mdFileInput.addEventListener('click', (e) => e.stopPropagation());

    mdUploadArea.addEventListener('click', () => mdFileInput.click());
    mdUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        mdUploadArea.classList.add('dragover');
    });
    mdUploadArea.addEventListener('dragleave', () => {
        mdUploadArea.classList.remove('dragover');
    });
    mdUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        mdUploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.md')) handleSpeechMdFile(file);
    });
    mdFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleSpeechMdFile(file);
    });

    // JSON 文件上传（实时生效）
    const jsonUploadArea = document.getElementById('speechJsonUploadArea');
    const jsonFileInput = document.getElementById('speechJsonFileInput');

    // 阻止冒泡，防止点击 file input 时触发父元素的 click 事件
    jsonFileInput.addEventListener('click', (e) => e.stopPropagation());

    jsonUploadArea.addEventListener('click', () => jsonFileInput.click());
    jsonUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        jsonUploadArea.classList.add('dragover');
    });
    jsonUploadArea.addEventListener('dragleave', () => {
        jsonUploadArea.classList.remove('dragover');
    });
    jsonUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        jsonUploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) handleSpeechJsonFile(file);
    });
    jsonFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleSpeechJsonFile(file);
    });

    const fileInfo = document.getElementById('speechFileInfo');
    const fileName = document.getElementById('speechFileName');
    const fileSize = document.getElementById('speechFileSize');
    const preview = document.getElementById('speechPreview');
    const speechList = document.getElementById('speechList');
    const actions = document.getElementById('speechActions');
    const status = document.getElementById('speechStatus');

    function resetFileInput() {
        // 重置 file input，允许再次选择同一文件
        mdFileInput.value = '';
        jsonFileInput.value = '';
    }

    function handleSpeechMdFile(file) {
        // 安全检查
        const validation = validateUploadFile(file, 'markdown');
        if (!validation.isValid) {
            showSpeechStatus('文件验证失败：' + validation.errors.join('；'), 'error');
            resetFileInput();
            return;
        }

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            try {
                // 扫描危险内容
                const safetyCheck = scanContentForDangerousPatterns(content);
                if (!safetyCheck.isSafe) {
                    showSpeechStatus('文件内容存在安全隐患：' + safetyCheck.findings.join('；'), 'error');
                    resetFileInput();
                    return;
                }

                parsedSpeechData = parseSpeechMD(content);
                showSpeechPreview(parsedSpeechData);
                showSpeechStatus('文件解析成功！', 'success');
                actions.style.display = 'block';
            } catch (error) {
                showSpeechStatus('文件解析失败：' + error.message, 'error');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    function handleSpeechJsonFile(file) {
        // 安全检查
        const validation = validateUploadFile(file, 'json');
        if (!validation.isValid) {
            showSpeechStatus('文件验证失败：' + validation.errors.join('；'), 'error');
            resetFileInput();
            return;
        }

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.style.display = 'block';

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            try {
                // 扫描危险内容
                const safetyCheck = scanContentForDangerousPatterns(content);
                if (!safetyCheck.isSafe) {
                    showSpeechStatus('文件内容存在安全隐患：' + safetyCheck.findings.join('；'), 'error');
                    resetFileInput();
                    return;
                }

                const jsonData = JSON.parse(content);

                // 兼容新旧格式：新格式是 books 数组，旧格式是 speeches 数组
                if (jsonData.books && Array.isArray(jsonData.books)) {
                    // 新格式：合并所有书中的 speeches
                    parsedSpeechData = [];
                    jsonData.books.forEach(book => {
                        if (book.speeches && Array.isArray(book.speeches)) {
                            book.speeches.forEach(speech => {
                                speech.bookName = book.name;
                                parsedSpeechData.push(speech);
                            });
                        }
                    });
                } else {
                    // 旧格式：直接使用 speeches
                    parsedSpeechData = jsonData.speeches || [];
                }

                // 直接应用到应用状态
                AppState.speechData = parsedSpeechData;
                console.log('朗读数据已实时更新，共 ' + parsedSpeechData.length + ' 篇');

                showSpeechPreview(parsedSpeechData);
                showSpeechStatus('✅ 数据已实时更新到应用！', 'success');
                actions.style.display = 'block';
            } catch (error) {
                showSpeechStatus('JSON 解析失败：' + error.message, 'error');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    function showSpeechPreview(data) {
        speechList.innerHTML = '';

        data.forEach((speech, index) => {
            const speechItem = document.createElement('li');
            speechItem.className = 'reading-item';
            speechItem.innerHTML = `
                <strong>${speech.title}</strong>
                <div class="unit-list">
                    <div class="unit-item">
                        章节数: ${speech.chapters ? speech.chapters.length : 0} 个
                    </div>
                </div>
            `;
            speechList.appendChild(speechItem);
        });

        preview.style.display = 'block';
    }

    function generateSpeechJSON() {
        if (!parsedSpeechData) return null;
        return JSON.stringify({ speeches: parsedSpeechData }, null, 2);
    }

    function showSpeechStatus(message, type) {
        status.innerHTML = message;
        status.className = 'status ' + type;
    }

    document.getElementById('speechGenerateBtn').addEventListener('click', () => {
        const json = generateSpeechJSON();
        if (!json) {
            showSpeechStatus('没有可生成的数据', 'error');
            return;
        }
        downloadFile(json, 'speech.json', 'application/json');
        showSpeechStatus('✅ speech.json 已下载！', 'success');
    });

    document.getElementById('speechCopyBtn').addEventListener('click', () => {
        const json = generateSpeechJSON();
        if (!json) {
            showSpeechStatus('没有可复制的数据', 'error');
            return;
        }
        navigator.clipboard.writeText(json).then(() => {
            showSpeechStatus('JSON 数据已复制到剪贴板！', 'success');
        }).catch(err => {
            showSpeechStatus('复制失败：' + err.message, 'error');
        });
    });
}

// 解析朗读 Markdown 文件
function parseSpeechMD(content) {
    const lines = content.split('\n');
    const speeches = [];
    let currentSpeech = null;
    let speechIndex = 0;
    let currentChapter = null;
    let chapterContent = [];
    let isFirstChapter = true;
    let isParsingSummary = false;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();

        // 跳过注释和代码块
        if (line.startsWith('<!--') || line.startsWith('```')) {
            continue;
        }

        // 检测文章标题 (# 开头且不在章节内)
        if (rawLine.startsWith('# ') && !currentSpeech) {
            const title = line.replace('# ', '').trim();
            currentSpeech = {
                id: `speech-${String(speechIndex + 1).padStart(3, '0')}`,
                title: title,
                bookName: '听书素材',
                summary: '',
                chapters: []
            };
            isFirstChapter = true;
            isParsingSummary = false;
            continue;
        }

        if (!currentSpeech) continue;

        // 检测章节 (## 开头)
        if (rawLine.startsWith('## ')) {
            const chapterTitle = line.replace('## ', '').trim();

            // 保存上一个章节（如果不是第一个）
            if (!isFirstChapter && currentChapter) {
                currentSpeech.chapters.push({
                    ...currentChapter,
                    content: chapterContent.join('\n').trim()
                });
            }

            // 检查是否是文章概要
            if (chapterTitle === '文章概要') {
                isParsingSummary = true;
                currentChapter = null;
                chapterContent = [];
            } else {
                isParsingSummary = false;
                currentChapter = {
                    title: chapterTitle
                };
                chapterContent = [];
            }
            isFirstChapter = false;
            continue;
        }

        // 收集内容
        if (isParsingSummary && currentSpeech) {
            // 跳过空的行（文章概要标题后的第一个空行）
            if (chapterContent.length === 0 && !line) {
                continue;
            }
            chapterContent.push(rawLine);
        } else if (currentChapter) {
            // 跳过空的行（章节标题后的第一个空行）
            if (chapterContent.length === 0 && !line) {
                continue;
            }
            chapterContent.push(rawLine);
        }
    }

    // 保存最后一个章节或概要
    if (currentSpeech) {
        if (isParsingSummary && chapterContent.length > 0) {
            currentSpeech.summary = chapterContent.join('\n').trim();
        } else if (currentChapter) {
            currentSpeech.chapters.push({
                ...currentChapter,
                content: chapterContent.join('\n').trim()
            });
        }
    }

    // 添加到结果列表
    if (currentSpeech && currentSpeech.chapters.length > 0) {
        speeches.push(currentSpeech);
        speechIndex++;
    }

    return speeches;
}

function parseWordsMD(content) {
    const lines = content.split('\n');
    const wordBooks = [];
    let currentBook = null;
    let currentUnit = null;
    let currentWordData = null;
    let wordIndex = 0;

    const bookNameToId = {
        '英语五年级上册': 'grade5-upper',
        '英语六年级上册': 'grade6-upper',
        '英语五年级下册': 'grade5-lower',
        '英语六年级下册': 'grade6-lower'
    };

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();

        if (line.startsWith('<!--') || line.startsWith('```')) {
            continue;
        }

        if (rawLine.startsWith('# ')) {
            const bookName = line.replace('# ', '').replace('单词', '').trim();
            if (bookName.includes('年级')) {
                if (currentWordData && currentUnit) {
                    currentUnit.words.push(currentWordData);
                    wordIndex++;
                }

                currentBook = {
                    id: bookNameToId[bookName] || bookName,
                    name: bookName,
                    units: []
                };
                wordBooks.push(currentBook);
                currentUnit = null;
                currentWordData = null;
                wordIndex = 0;
            }
            continue;
        }

        if (rawLine.startsWith('## ')) {
            const unitMatch = line.match(/##\s*(Unit\s*\d+)/);
            if (unitMatch) {
                if (currentWordData && currentUnit) {
                    currentUnit.words.push(currentWordData);
                    wordIndex++;
                }
                currentWordData = null;

                currentUnit = {
                    unit: unitMatch[1],
                    title: '',
                    category: '',
                    words: []
                };
                wordIndex = 0;
                if (currentBook) {
                    currentBook.units.push(currentUnit);
                }
            }
            continue;
        }

        if (rawLine.startsWith('Title:')) {
            const titleMatch = line.match(/Title:\s*(.+?)\s*Category:\s*(.+)/);
            if (titleMatch && currentUnit) {
                currentUnit.title = titleMatch[1].trim();
                currentUnit.category = titleMatch[2].trim();
            }
            continue;
        }

        if (rawLine.startsWith('  - ')) {
            const detailContent = line.substring(2).trim();
            if (!currentWordData) continue;

            if (detailContent.startsWith('例句：')) {
                const examplePart = detailContent.substring(3);
                const match = examplePart.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
                if (match) {
                    currentWordData.example = match[1].trim();
                    currentWordData.translation = match[2].trim();
                } else if (examplePart.trim()) {
                    currentWordData.example = examplePart.trim();
                }
            } else if (detailContent.startsWith('记忆：')) {
                currentWordData.memoryTip = detailContent.substring(3).trim();
            }
            continue;
        }

        if (rawLine.startsWith('* ')) {
            if (currentWordData && currentUnit) {
                currentUnit.words.push(currentWordData);
                wordIndex++;
            }

            currentWordData = parseWordLine(line, currentBook, currentUnit, wordIndex);
            continue;
        }
    }

    if (currentWordData && currentUnit) {
        currentUnit.words.push(currentWordData);
    }

    return wordBooks;
}

function parseWordLine(line, book, unit, index) {
    const wordLine = line.substring(2).trim();
    let phonetic = '';
    let meaning = '';

    const phoneticMatch = wordLine.match(/\/([^\/]+)\//);
    if (phoneticMatch) {
        phonetic = '/' + phoneticMatch[1] + '/';
        const parts = wordLine.split('/');
        if (parts.length >= 3) {
            meaning = parts[2].trim();
        }
    } else {
        const wordMatch = wordLine.match(/^([^\s\/]+(?:\s+[^\s\/]+)?)/);
        if (!wordMatch) return null;
        let remaining = wordLine.substring(wordMatch[0].length).trim();
        meaning = remaining;
    }

    const bookId = book ? (book.id || 'book') : 'book';
    const unitNum = unit ? unit.unit.replace('Unit ', 'u') : 'u0';
    const id = `${bookId}-${unitNum}-w${index + 1}`;
    const word = wordLine.split('/')[0].trim();

    return {
        id: id,
        word: word,
        phonetic: phonetic,
        meaning: meaning,
        example: '',
        translation: '',
        memoryTip: '',
        category: unit ? unit.category : ''
    };
}

function parseReadingsMD(content) {
    const lines = content.split('\n');
    const readings = [];
    let currentReading = null;
    let readingIndex = 0;
    let isParsingPatterns = false;
    let isParsingKnowledgePoints = false;

    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('# 题目：')) {
            startIndex = i;
            break;
        }
    }

    for (let i = startIndex; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();

        if (line.startsWith('<!--') || line.startsWith('```') || line.startsWith('*')) {
            continue;
        }

        if (line.startsWith('# 题目：')) {
            if (currentReading) {
                readings.push(currentReading);
            }

            const titleMatch = line.match(/# 题目：(.+?)\s*\(([^)]+)\)/);
            currentReading = {
                id: `reading-${String(readingIndex + 1).padStart(3, '0')}`,
                title: titleMatch ? titleMatch[1].trim() : '',
                titleCn: titleMatch ? titleMatch[2].trim() : '',
                scene: '',
                keySentencePatterns: [],
                knowledgePoints: [],
                dialogues: []
            };
            readingIndex++;
            isParsingPatterns = false;
            isParsingKnowledgePoints = false;
            continue;
        }

        if (!currentReading) continue;

        if (line.startsWith('# 场景：')) {
            currentReading.scene = line.replace('# 场景：', '').trim();
            continue;
        }

        if (line.startsWith('# 重点句型：') || line === '# 重点句型') {
            isParsingPatterns = true;
            isParsingKnowledgePoints = false;
            continue;
        }

        if (line.startsWith('# 知识点：') || line === '# 知识点') {
            isParsingPatterns = false;
            isParsingKnowledgePoints = true;
            continue;
        }

        if (rawLine.startsWith('  - ') && isParsingPatterns) {
            const patternLine = line.substring(2).trim();

            const halfMatch = patternLine.match(/^(.+?)\s*\(([^)]+)\)$/);
            if (halfMatch) {
                let meaning = halfMatch[2].trim();
                meaning = meaning.replace(/\.$/, '');
                currentReading.keySentencePatterns.push({
                    pattern: halfMatch[1].trim(),
                    meaning: meaning
                });
            }
            continue;
        }

        if (rawLine.startsWith('  - ') && isParsingKnowledgePoints) {
            const knowledgePointLine = line.substring(2).trim();
            if (knowledgePointLine) {
                currentReading.knowledgePoints.push(knowledgePointLine);
            }
            continue;
        }

        if (!rawLine.startsWith('  ')) {
            isParsingPatterns = false;
            isParsingKnowledgePoints = false;
        }

        if ((line.includes(':') || line.includes('：')) &&
            (line.includes('(') || line.includes('（'))) {

            const dialogueMatch = line.match(/^([^:]+):\s*(.+?)\s*\(([^)]+)\)$/);
            if (dialogueMatch) {
                let cnTranslation = dialogueMatch[3].trim();
                cnTranslation = cnTranslation.replace(/\.$/, '');

                const speakerCnMatch = cnTranslation.match(/^([^：:]+)[：:]/);
                const speakerCn = speakerCnMatch ? speakerCnMatch[1].trim() : cnTranslation;

                currentReading.dialogues.push({
                    speaker: dialogueMatch[1].trim(),
                    speakerCn: speakerCn,
                    content: dialogueMatch[2].trim(),
                    contentCn: cnTranslation
                });
            }
            continue;
        }
    }

    if (currentReading) {
        readings.push(currentReading);
    }

    return readings;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ========== 语句练习页面 ==========
/**
 * 问题背景：
 * 1. switchPage 函数在每次切换到 'sentences' 页面时会调用 initSentencesPage()
 * 2. 如果在 HTML 中使用内联 onclick 属性绑定事件，同时在 JS 中使用 addEventListener 绑定，
 *    会导致事件被触发两次（内联 onclick 执行一次，addEventListener 执行一次）
 * 3. 这会导致 startSentencePracticeFromSelection 被调用两次，导致语音重复播放
 *
 * 解决方案：
 * 1. 移除 HTML 中的内联 onclick 属性，只使用 addEventListener 绑定事件
 * 2. 添加 sentencesPageInitialized 标志，防止 initSentencesPage 重复执行
 *
 * 注意：其他页面（如闪卡、错题本等）如果有类似的问题，也需要检查并修复
 */
let sentencesPageInitialized = false;

function initSentencesPage() {
    // 防止重复初始化
    if (sentencesPageInitialized) {
        return;
    }
    sentencesPageInitialized = true;

    // 初始化词书选择器
    initSentencesWordbookSelector();

    // 绑定开始练习按钮（只通过 addEventListener 绑定，不要在 HTML 中使用 onclick）
    const startBtn = document.getElementById('start-sentences-btn');
    if (startBtn) {
        startBtn.addEventListener('click', startSentencePracticeFromSelection);
    }

    // 绑定练习页面按钮（使用通用函数）
    bindSentencePracticeButtons();

    // 绑定结果页面按钮
    const retryBtn = document.getElementById('retry-sentence-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            if (AppState.sentencesSession) {
                startSentencePracticeWithSession(AppState.sentencesSession);
            }
        });
    }

    const backBtn = document.getElementById('back-sentences-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => switchPage('sentences'));
    }
}

function initSentencesWordbookSelector() {
    const wordbookSelect = document.getElementById('sentences-wordbook-select');
    if (!wordbookSelect) return;

    // 从 readings 数据中获取词书列表
    const readings = AppState.readings || [];
    if (readings.length === 0) {
        wordbookSelect.innerHTML = '<option value="">暂无数据</option>';
        return;
    }

    // 按词书分组
    const bookMap = new Map();
    readings.forEach(reading => {
        const bookName = reading.bookName || '默认词书';
        if (!bookMap.has(bookName)) {
            bookMap.set(bookName, []);
        }
        bookMap.get(bookName).push(reading);
    });

    // 清空并重新填充选择器
    wordbookSelect.innerHTML = '';

    // 填充选择器
    bookMap.forEach((readings, bookName) => {
        const option = document.createElement('option');
        option.value = bookName;
        option.textContent = bookName;
        wordbookSelect.appendChild(option);
    });

    // 绑定选择变化事件
    wordbookSelect.onchange = function(e) {
        handleSentencesWordBookChange(e.target.value);
    };

    // 自动选择第一个书本并加载单元列表
    const firstBook = bookMap.keys().next().value;
    if (firstBook) {
        wordbookSelect.value = firstBook;
        handleSentencesWordBookChange(firstBook);
    }
}

function handleSentencesWordBookChange(bookName) {
    // 重置页码
    AppState.sentencesPage = 1;

    const unitSelect = document.getElementById('sentences-unit-select');

    // 如果没有选择书本，禁用单元选择器
    if (!bookName) {
        if (unitSelect) {
            unitSelect.innerHTML = '<option value="">请先选择书本</option>';
            unitSelect.disabled = true;
        }
        return;
    }

    // 获取该词书下的所有阅读材料
    const readings = AppState.readings || [];
    const bookReadings = readings.filter(r => (r.bookName || '默认词书') === bookName);

    if (bookReadings.length === 0) {
        if (unitSelect) {
            unitSelect.innerHTML = '<option value="">该书本下暂无数据</option>';
            unitSelect.disabled = true;
        }
        return;
    }

    // 按单元分组
    const unitMap = new Map();
    bookReadings.forEach(reading => {
        const unitName = reading.unitName || '未分类';
        if (!unitMap.has(unitName)) {
            unitMap.set(unitName, []);
        }
        unitMap.get(unitName).push(reading);
    });

    // 启用并填充单元选择器
    if (unitSelect) {
        // 清空并添加"全部单元"默认选项
        unitSelect.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '全部单元';
        defaultOption.selected = true;
        unitSelect.appendChild(defaultOption);

        unitMap.forEach((readings, unitName) => {
            const option = document.createElement('option');
            option.value = unitName;
            option.textContent = unitName;
            unitSelect.appendChild(option);
        });
        unitSelect.disabled = false;

        // 绑定选择变化事件
        unitSelect.onchange = function(e) {
            AppState.sentencesPage = 1;
        };
    }
}

function startSentencePracticeFromSelection() {
    const wordbookSelect = document.getElementById('sentences-wordbook-select');
    const unitSelect = document.getElementById('sentences-unit-select');

    const bookName = wordbookSelect?.value;
    const unitName = unitSelect?.value;

    if (!bookName) {
        showToast('请先选择书本');
        return;
    }

    // 获取选中的书本下的所有阅读材料
    const readings = AppState.readings || [];
    let selectedReadings = readings.filter(r => (r.bookName || '默认词书') === bookName);

    // 如果选择了具体单元，过滤该单元的阅读材料
    if (unitName) {
        selectedReadings = selectedReadings.filter(r =>
            (r.unitName || '未分类') === unitName
        );
    }

    if (selectedReadings.length === 0) {
        showToast('没有找到阅读材料');
        return;
    }

    // 收集所有句子
    let allDialogues = [];
    selectedReadings.forEach(reading => {
        if (reading.dialogues && Array.isArray(reading.dialogues)) {
            reading.dialogues.forEach(dialogue => {
                allDialogues.push({
                    ...dialogue,
                    sourceTitle: reading.title,
                    sourceTitleCn: reading.titleCn,
                    sourceId: reading.id
                });
            });
        }
    });

    if (allDialogues.length === 0) {
        showToast('没有找到句子数据');
        return;
    }

    // 按阅读材料和对话顺序排序
    allDialogues.sort((a, b) => {
        if (a.sourceId !== b.sourceId) {
            return selectedReadings.findIndex(r => r.id === a.sourceId) -
                   selectedReadings.findIndex(r => r.id === b.sourceId);
        }
        return 0;
    });

    // 创建会话
    AppState.sentencesSession = {
        dialogues: allDialogues,
        currentIndex: 0,
        correctCount: 0,
        wrongCount: 0,
        wrongSentenceIds: [],
        startTime: Date.now(),
        isPaused: false
    };

    // 跳转到练习页面
    switchPage('sentence-practice');
    showCurrentSentence();
}

function showCurrentSentence() {
    const session = AppState.sentencesSession;
    if (!session) return;

    const { dialogues, currentIndex } = session;

    if (currentIndex >= dialogues.length) {
        // 测试完成
        endSentencePractice();
        return;
    }

    const dialogue = dialogues[currentIndex];
    const total = dialogues.length;

    // 更新进度
    document.getElementById('sentence-progress-text').textContent = `${currentIndex + 1} / ${total}`;
    const progressPercent = ((currentIndex) / total) * 100;
    document.getElementById('sentence-progress-fill').style.width = `${progressPercent}%`;

    // 显示中文
    document.getElementById('sentence-chinese').textContent = dialogue.contentCn;

    // 生成单词输入框
    const words = dialogue.content.split(/\s+/);
    const inputsContainer = document.getElementById('sentence-inputs');

    // 保存当前滚动位置（在渲染前保存容器滚动位置）
    const inputsScrollTop = inputsContainer.scrollTop;
    // 保存页面滚动位置
    const pageScrollY = window.scrollY || window.pageYOffset;

    inputsContainer.innerHTML = words.map((word, idx) => {
        const cleanWord = word.replace(/[.,?!]/g, '');
        const hasPunctuation = word !== cleanWord;
        return `
            <div class="word-input-wrapper">
                <input type="text"
                    class="sentence-word-input"
                    data-word-index="${idx}"
                    data-original-word="${cleanWord}"
                    data-has-punctuation="${hasPunctuation}"
                    placeholder=""
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false">
                ${hasPunctuation ? `<span class="punctuation">${word.match(/[.,?!]/g)[0]}</span>` : ''}
            </div>
        `;
    }).join(' ');

    // 辅助函数：安全聚焦并选中文本，不触发滚动
    function safeFocusAndSelect(input) {
        if (!input) return;

        // 检测是否为 iOS 设备
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        // 检测是否在 Web App 模式（添加到主屏幕）
        const isWebApp = window.navigator.standalone === true ||
                        window.matchMedia('(display-mode: standalone)').matches;

        if (isIOS && isWebApp) {
            // iOS Web App 模式专用处理
            // Web App 模式下虚拟键盘行为特殊，需要更激进的锁定策略

            // 1. 保存当前页面滚动位置
            const currentPageY = window.scrollY || window.pageYOffset;

            // 2. 锁定页面滚动（Web App 模式）
            document.body.style.position = 'fixed';
            document.body.style.top = `-${currentPageY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';

            // 3. 计算目标位置（相对于容器）
            const offsetTop = input.offsetTop;
            const inputHeight = input.offsetHeight;
            const containerHeight = inputsContainer.offsetHeight;
            const targetScrollTop = offsetTop - (containerHeight / 2) + (inputHeight / 2);

            // 4. 设置容器滚动位置
            inputsContainer.scrollTop = Math.max(0, targetScrollTop);

            // 5. 聚焦（使用 preventScroll 选项）
            input.focus({ preventScroll: true });

            // 6. 延迟选中文本
            setTimeout(() => {
                input.select();
            }, 150);

            // 7. 恢复页面滚动锁定状态
            requestAnimationFrame(() => {
                inputsContainer.scrollTop = Math.max(0, targetScrollTop);
            });

        } else if (isIOS) {
            // iOS 普通模式（不是 Web App）
            // 1. 先滚动到目标位置
            const inputRect = input.getBoundingClientRect();
            const containerRect = inputsContainer.getBoundingClientRect();
            const offsetTop = input.offsetTop;

            // 2. 计算目标位置
            const targetScrollTop = offsetTop - (containerRect.height / 2) + (inputRect.height / 2);

            // 3. 使用 scrollTop 设置位置
            inputsContainer.scrollTop = targetScrollTop;

            // 4. 聚焦但不选中文本（iOS 上 select() 可能触发滚动）
            input.focus({ preventScroll: true });

            // 5. 延迟选中文本（等虚拟键盘稳定后）
            setTimeout(() => {
                input.select();
            }, 100);

            // 6. 再次确认滚动位置
            requestAnimationFrame(() => {
                inputsContainer.scrollTop = targetScrollTop;
            });
        } else {
            // 非 iOS 设备：使用原来的逻辑
            // 先保存当前滚动位置
            inputsContainer.scrollTop = inputsScrollTop;
            window.scrollTo(0, pageScrollY);
            // 聚焦
            input.focus();
            // 选中文本
            input.select();
            // 再次恢复滚动位置（focus 可能触发滚动）
            inputsContainer.scrollTop = inputsScrollTop;
            window.scrollTo(0, pageScrollY);
        }
    }

    // 辅助函数：移除 Web App 滚动锁定
    function removeWebAppScrollLock() {
        if (!isWebAppMode) return;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
    }

    // 检测 Web App 模式
    const isWebAppMode = window.navigator.standalone === true ||
                         window.matchMedia('(display-mode: standalone)').matches;

    // 在页面隐藏/显示时处理滚动锁定
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isWebAppMode) {
            // 页面重新可见时，恢复滚动位置
            setTimeout(() => {
                window.scrollTo(0, pageScrollY);
            }, 100);
        }
    });

    // 需要阻止的滚动触发按键列表
    const scrollTriggerKeys = [
        ' ',        // 空格键
        'Home',     // 跳转到顶部
        'End',      // 跳转到底部
        'PageUp',   // 向上翻页
        'PageDown', // 向下翻页
        'ArrowUp',  // 向上箭头
        'ArrowDown' // 向下箭头
    ];

    // 绑定输入框事件
    inputsContainer.querySelectorAll('.sentence-word-input').forEach((input, idx) => {
        // input 事件：处理用户输入
        input.addEventListener('input', (e) => {
            // 确保输入时滚动位置不变
            inputsContainer.scrollTop = inputsScrollTop;
            window.scrollTo(0, pageScrollY);

            const currentWord = e.target.dataset.originalWord;
            const userValue = e.target.value.trim();

            // 只有输入完整单词后才跳转到下一个（输入长度达到单词长度时）
            if (userValue.length >= currentWord.length) {
                const nextInput = inputsContainer.querySelector(`input[data-word-index="${idx + 1}"]`);
                if (nextInput) {
                    safeFocusAndSelect(nextInput);
                }
            }
        });

        // keydown 事件：处理按键
        input.addEventListener('keydown', (e) => {
            // 确保按键时滚动位置不变
            inputsContainer.scrollTop = inputsScrollTop;
            window.scrollTo(0, pageScrollY);

            // 阻止所有可能触发页面滚动的按键
            if (scrollTriggerKeys.includes(e.key)) {
                e.preventDefault();
            }

            // 阻止 Command 键相关的默认行为（macOS 上 Cmd+I 等快捷键）
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
            }

            if (e.key === 'Enter') {
                checkSentenceAnswer();
            }
            // 处理 Backspace 跳转到上一个输入框
            if (e.key === 'Backspace' && e.target.value === '' && idx > 0) {
                const prevInput = inputsContainer.querySelector(`input[data-word-index="${idx - 1}"]`);
                if (prevInput) {
                    safeFocusAndSelect(prevInput);
                }
            }
            // 阻止方向键跳出范围
            if (e.key === 'ArrowLeft' && document.activeElement === input && input.selectionStart === 0) {
                const prevInput = inputsContainer.querySelector(`input[data-word-index="${idx - 1}"]`);
                if (prevInput) {
                    e.preventDefault();
                    safeFocusAndSelect(prevInput);
                }
            }
            if (e.key === 'ArrowRight' && document.activeElement === input && input.selectionStart === input.value.length) {
                const nextInput = inputsContainer.querySelector(`input[data-word-index="${idx + 1}"]`);
                if (nextInput) {
                    e.preventDefault();
                    safeFocusAndSelect(nextInput);
                }
            }
            // 处理 Tab 键循环切换
            if (e.key === 'Tab') {
                e.preventDefault();
                const direction = e.shiftKey ? -1 : 1;
                const totalInputs = words.length;
                let targetIdx = idx + direction;
                if (targetIdx < 0) targetIdx = totalInputs - 1;
                if (targetIdx >= totalInputs) targetIdx = 0;
                const targetInput = inputsContainer.querySelector(`input[data-word-index="${targetIdx}"]`);
                if (targetInput) {
                    safeFocusAndSelect(targetInput);
                }
            }
        });

        // paste 事件：处理粘贴，防止粘贴触发滚动
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            // 插入粘贴的文本
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const currentValue = input.value;
            const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
            input.value = newValue;
            // 将光标移动到粘贴内容之后
            const newCursorPos = start + text.length;
            input.setSelectionRange(newCursorPos, newCursorPos);
            // 触发 input 事件
            input.dispatchEvent(new Event('input'));
            // 确保滚动位置不变
            inputsContainer.scrollTop = inputsScrollTop;
            window.scrollTo(0, pageScrollY);
        });

        // focus 事件：聚焦时恢复滚动位置
        input.addEventListener('focus', () => {
            inputsContainer.scrollTop = inputsScrollTop;
            window.scrollTo(0, pageScrollY);
        });
    });

    // 聚焦第一个输入框（使用 requestAnimationFrame 确保渲染完成）
    const firstInput = inputsContainer.querySelector('.sentence-word-input');
    if (firstInput) {
        requestAnimationFrame(() => {
            safeFocusAndSelect(firstInput);
            // 再次确认滚动位置
            inputsContainer.scrollTop = inputsScrollTop;
            window.scrollTo(0, pageScrollY);
        });
    }

    // 隐藏反馈和答案显示
    document.getElementById('sentence-feedback').style.display = 'none';
    document.getElementById('answer-display').style.display = 'none';

    // 自动朗读
    setTimeout(() => {
        speakText(dialogue.content, 'en-US');
    }, 500);
}

function playCurrentSentence() {
    const session = AppState.sentencesSession;
    if (!session) return;

    const { dialogues, currentIndex } = session;

    if (currentIndex < dialogues.length) {
        speakText(dialogues[currentIndex].content, 'en-US');
    }
}

function checkSentenceAnswer() {
    const session = AppState.sentencesSession;
    if (!session) return;

    const { dialogues, currentIndex } = session;

    if (currentIndex >= dialogues.length) return;

    const dialogue = dialogues[currentIndex];
    const expectedWords = dialogue.content.split(/\s+/).map(w => w.replace(/[.,?!]/g, ''));

    // 收集用户输入
    const inputs = document.querySelectorAll('.sentence-word-input');
    let allCorrect = true;
    let userWords = [];

    inputs.forEach((input, idx) => {
        const originalWord = input.dataset.originalWord;
        const userWord = input.value.trim();
        userWords.push(userWord);

        // 区分大小写比较
        if (userWord !== originalWord) {
            allCorrect = false;
            input.style.borderColor = 'var(--danger-color)';
        } else {
            input.style.borderColor = 'var(--success-color)';
        }
    });

    const feedbackEl = document.getElementById('sentence-feedback');

    if (allCorrect && userWords.length === expectedWords.length) {
        // 正确答案
        session.correctCount++;
        feedbackEl.innerHTML = '<span class="feedback-correct">太棒了！</span>';
        feedbackEl.style.display = 'block';

        setTimeout(() => {
            session.currentIndex++;
            showCurrentSentence();
        }, 1500);
    } else {
        // 错误答案
        session.wrongCount++;
        // 使用对话的原始 id（如果有），否则回退到动态生成的 id
        const sentenceId = dialogue.id || `${dialogue.sourceId}-${currentIndex}`;
        if (!session.wrongSentenceIds.includes(sentenceId)) {
            session.wrongSentenceIds.push(sentenceId);
        }

        // 记录错句
        addWrongSentence({
            id: sentenceId,
            readingId: dialogue.sourceId || '',
            readingTitleCn: dialogue.sourceTitleCn || dialogue.sourceId || '',
            english: dialogue.content,
            chinese: dialogue.contentCn
        });

        feedbackEl.innerHTML = '<span class="feedback-wrong">加油！</span>';
        feedbackEl.style.display = 'block';
    }
}

function skipSentence() {
    const session = AppState.sentencesSession;
    if (!session) return;

    session.currentIndex++;
    showCurrentSentence();
}

function showAnswer() {
    const session = AppState.sentencesSession;
    if (!session) return;

    const { dialogues, currentIndex } = session;

    if (currentIndex >= dialogues.length) return;

    const dialogue = dialogues[currentIndex];
    const words = dialogue.content.split(/\s+/);

    // 在答案显示区域显示答案
    const answerDisplay = document.getElementById('answer-display');
    answerDisplay.innerHTML = `
        <div class="answer-label">参考答案：</div>
        <div class="answer-words">
            ${words.map((word, idx) => {
                const cleanWord = word.replace(/[.,?!]/g, '');
                const userInput = document.querySelector(`input[data-word-index="${idx}"]`);
                const userValue = userInput ? userInput.value.trim() : '';
                // 区分大小写比较
                const isCorrect = userValue && userValue === cleanWord;
                return `<span class="answer-word ${isCorrect ? 'correct' : ''}">${word}</span>`;
            }).join('')}
        </div>
    `;
    answerDisplay.style.display = 'block';

    // 显示提示
    const feedbackEl = document.getElementById('sentence-feedback');
    feedbackEl.innerHTML = '<span class="feedback-answer">参考答案已显示，请对照修改</span>';
    feedbackEl.style.display = 'block';
}

function endSentencePractice() {
    const session = AppState.sentencesSession;
    if (!session) return;

    const { correctCount, wrongCount, startTime } = session;
    const total = correctCount + wrongCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // 计算用时
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // 更新结果页面
    document.getElementById('sentence-accuracy').textContent = accuracy + '%';
    document.getElementById('sentence-correct').textContent = correctCount;
    document.getElementById('sentence-wrong').textContent = wrongCount;
    document.getElementById('sentence-time').textContent = timeStr;

    // 跳转到结果页面
    switchPage('sentence-result');
}

function addWrongSentence(sentenceData) {
    const progress = AppState.userProgress;

    if (!progress.wrongSentences) {
        progress.wrongSentences = [];
    }

    const existing = progress.wrongSentences.find(s => s.id === sentenceData.id);

    if (existing) {
        existing.wrongCount += 1;
        existing.lastWrongDate = new Date().toISOString().split('T')[0];
    } else {
        progress.wrongSentences.push({
            ...sentenceData,
            wrongCount: 1,
            lastWrongDate: new Date().toISOString().split('T')[0]
        });
    }

    saveUserProgress();
    console.log('添加/更新错句:', sentenceData.id);
}

function startSentencePracticeWithSession(session) {
    AppState.sentencesSession = {
        dialogues: session.dialogues,
        currentIndex: 0,
        correctCount: 0,
        wrongCount: 0,
        wrongSentenceIds: [],
        startTime: Date.now(),
        isPaused: false
    };
    switchPage('sentence-practice');
    showCurrentSentence();
}

// 页面切换时初始化语句页面
const originalSwitchPage = switchPage;
switchPage = function(pageName) {
    originalSwitchPage(pageName);

    if (pageName === 'sentences') {
        initSentencesPage();
        renderSentencesPage();
    } else if (pageName === 'sentence-practice') {
        // 确保练习页面的按钮事件已绑定
        bindSentencePracticeButtons();
    }
};

// 绑定语句练习页面按钮事件（可重复调用）
function bindSentencePracticeButtons() {
    // 绑定播放按钮
    const playBtn = document.getElementById('play-sentence-btn');
    if (playBtn) {
        // 移除旧的事件监听器，防止重复
        playBtn.removeEventListener('click', playCurrentSentence);
        playBtn.addEventListener('click', playCurrentSentence);
    }

    // 绑定检查按钮
    const checkBtn = document.getElementById('check-sentence-btn');
    if (checkBtn) {
        checkBtn.removeEventListener('click', checkSentenceAnswer);
        checkBtn.addEventListener('click', checkSentenceAnswer);
    }

    // 绑定跳过按钮
    const skipBtn = document.getElementById('skip-sentence-btn');
    if (skipBtn) {
        skipBtn.removeEventListener('click', skipSentence);
        skipBtn.addEventListener('click', skipSentence);
    }

    // 绑定查看答案按钮
    const showAnswerBtn = document.getElementById('show-answer-btn');
    if (showAnswerBtn) {
        showAnswerBtn.removeEventListener('click', showAnswer);
        showAnswerBtn.addEventListener('click', showAnswer);
    }
}

function renderSentencesPage() {
    // 检查阅读数据是否已加载
    if (!AppState.readings || AppState.readings.length === 0) {
        // 数据未加载，显示提示
        const wordbookSelect = document.getElementById('sentences-wordbook-select');
        const unitSelect = document.getElementById('sentences-unit-select');
        if (wordbookSelect) {
            wordbookSelect.innerHTML = '<option value="">加载中...</option>';
        }
        if (unitSelect) {
            unitSelect.innerHTML = '<option value="">请先选择书本</option>';
            unitSelect.disabled = true;
        }
        return;
    }

    initSentencesWordbookSelector();
}

// 导出工具函数
window.initToolPage = initToolPage;