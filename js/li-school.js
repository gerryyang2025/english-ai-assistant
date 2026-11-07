// 课程底稿、原始讲义与整本打印稿共用同一个内容目录。
const LiSchool = (() => {
    const base = 'content/li-school/';
    const get = id => document.getElementById('li-' + id);
    const supportsAudio = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    let lessons = [];
    let loading = false;
    let activeUtterance = null;

    function asset(path) {
        return base + path.split('/').map(encodeURIComponent).join('/');
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function stopAudio() {
        if (!activeUtterance) return;
        activeUtterance = null;
        window.speechSynthesis.cancel();
    }

    function speak(text, isWord) {
        stopAudio();
        const synth = window.speechSynthesis;
        const british = get('accent').value === 'gb';
        // School subjects and initialisms should sound like individual letters.
        const spoken = text.replace(/\b(?:IT|PS|USA)\b/g, match => match.split('').join(' '))
            .replace(/\.{3}|…/g, ', ');
        const utterance = new SpeechSynthesisUtterance(spoken);
        activeUtterance = utterance;
        utterance.lang = british ? 'en-GB' : 'en-US';
        utterance.rate = isWord ? 0.8 : 0.9;
        utterance.onend = () => {
            if (activeUtterance === utterance) activeUtterance = null;
        };
        utterance.onerror = event => {
            if (activeUtterance !== utterance) return;
            activeUtterance = null;
            if (!['canceled', 'interrupted'].includes(event.error)) {
                get('audio-status').textContent = '朗读未能播放，请检查设备的英语语音后再试。';
            }
        };
        get('audio-status').textContent = '';
        synth.resume();
        synth.cancel();
        speakUtteranceWithVoice(utterance, british, () => activeUtterance === utterance && !document.hidden);
    }

    function readingLine(text, kind) {
        const line = element('div', 'li-reading-line');
        const english = element(kind === '单词' ? 'h4' : 'span', '', text);
        english.lang = 'en';
        const button = element('button', 'li-say', '朗读');
        button.type = 'button';
        button.disabled = !supportsAudio;
        button.setAttribute('aria-label', '朗读' + kind + '：' + text);
        button.addEventListener('click', () => speak(text, kind === '单词'));
        line.append(english, button);
        return line;
    }

    function bilingual(label, english, chinese) {
        const box = element('div', 'li-example');
        box.append(element('dt', '', label));
        const content = element('dd');
        content.append(readingLine(english, label), element('p', 'li-translation', chinese));
        box.append(content);
        return box;
    }

    function wordCard(row) {
        const card = element('article', 'li-word');
        const term = element('div', 'li-term');
        if (row.sound) term.append(element('p', 'li-target', '目标音 /' + row.sound + '/'));
        term.append(readingLine(row.word, '单词'), element('p', 'li-ipa', '/' + row.ipa + '/'),
            element('p', 'li-meaning', row.meaning));
        const details = element('dl', 'li-usage');
        details.append(bilingual('常用词组', row.phrase, row.phrase_zh),
            bilingual('例句', row.sentence, row.sentence_zh));
        const note = element('div', 'li-memory');
        note.append(element('dt', '', '记忆方法'), element('dd', '', row.memory));
        if (row.reference && /^https?:\/\//i.test(row.reference.url)) {
            const link = element('a', 'li-reference', row.reference.label);
            link.href = row.reference.url;
            link.target = '_blank';
            link.rel = 'noopener';
            note.querySelector('dd').append(' ', link);
        }
        details.append(note);
        card.append(term, details);
        return card;
    }

    function drawLesson() {
        stopAudio();
        const lesson = lessons[get('lesson').selectedIndex];
        get('date').textContent = lesson.date;
        get('theme').textContent = lesson.theme;
        get('count').textContent = lesson.rows.length + ' 项';
        get('note').textContent = lesson.note || '';
        get('note').hidden = !lesson.note;
        get('audio-status').textContent = supportsAudio ? '' : '本浏览器不支持语音朗读，可在支持系统语音的浏览器中打开。';
        const files = Object.keys(lesson.sources);
        get('sources').open = false;
        get('sources').querySelector('summary').textContent = '本课原始讲义（' + files.length + '）';
        get('files').replaceChildren(...files.map(path => {
            const filename = path.split('/').pop();
            const variant = filename.match(/(中英文|音标单词|音标|中文|英文)\.pdf$/);
            const link = element('a', 'li-source', (variant ? variant[1] + '讲义' : filename) + ' ↗');
            link.href = asset(path);
            link.title = filename;
            link.target = '_blank';
            link.rel = 'noopener';
            return link;
        }));
        get('rows').replaceChildren(...lesson.rows.map(wordCard));
    }

    async function open() {
        // 首页入口可能位于一屏以下；切换面板时将新课程标题带回视口。
        document.querySelector('.main-content').scrollTop = 0;
        if (lessons.length || loading) return;
        loading = true;
        get('retry').hidden = true;
        get('load-status').textContent = '正在加载课程…';
        try {
            const response = await fetch(asset('单词表数据/课程.json'));
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const book = await response.json();
            if (!book.lessons?.length) throw new Error('课程为空');
            const ordered = [...book.lessons].sort((a, b) => b.date.localeCompare(a.date));
            const days = new Set(ordered.map(lesson => lesson.date)).size;
            const count = ordered.reduce((sum, lesson) => sum + lesson.rows.length, 0);
            get('summary').textContent = days + ' 个学习日期 · ' + ordered.length + ' 个课次 · ' + count + ' 项学习内容';
            get('lesson').replaceChildren(...ordered.map(lesson =>
                new Option(lesson.date + '　' + lesson.theme)));
            lessons = ordered;
            drawLesson();
            get('book').href = asset(book.output);
            get('book').hidden = false;
            get('body').hidden = false;
            get('load-status').textContent = '';
        } catch (error) {
            lessons = [];
            get('load-status').textContent = '课程未能加载，请重试。';
            get('retry').hidden = false;
        } finally {
            loading = false;
        }
    }

    get('lesson').addEventListener('change', drawLesson);
    get('accent').addEventListener('change', stopAudio);
    get('retry').addEventListener('click', open);
    get('print').addEventListener('click', () => window.print());
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio(); });
    return { open, stopAudio };
})();
