import StorageManager from './storage.js';
import JsonLoader from './jsonLoader.js';
import KeyboardManager from './keyboard.js';
import QuestionManager from './QuestionManager.js';
import PracticeManager from './PracticeManager.js';
import AppState from './AppState.js';
import NavigationManager from './NavigationManager.js';
import QuizManager from './QuizManager.js';
import UrlManager from './UrlManager.js';
import EditManager from './EditManager.js';
import CrossPracticeManager from './CrossPracticeManager.js';
import logger from './logger.js';

// 获取App模块的logger
const log = logger.getLogger('App');

const app = Vue.createApp({
    data() {
        try {
            const appState = new AppState();
            const storageManager = new StorageManager();
            const jsonLoader = new JsonLoader();
            const keyboardManager = new KeyboardManager(this);
            const questionManager = new QuestionManager(storageManager);
            const practiceManager = new PracticeManager(storageManager);
            const urlManager = new UrlManager();
            const navigationManager = new NavigationManager(appState, urlManager, questionManager);
            const quizManager = new QuizManager(appState, practiceManager, storageManager);
            const editManager = new EditManager(appState, questionManager);
            const crossPracticeManager = new CrossPracticeManager(appState, practiceManager, storageManager);

            return {
                // Managers
                appState,
                storageManager,
                jsonLoader,
                keyboardManager,
                questionManager,
                practiceManager,
                urlManager,
                navigationManager,
                quizManager,
                editManager,
                crossPracticeManager,

                // App State (make it reactive)
                pageState: appState.pageState,
                fileList: appState.fileList,
                groupedFileList: appState.groupedFileList,
                chosenSet: appState.chosenSet,
                bankStats: appState.bankStats,
                updateTime: appState.updateTime,
                showAnswer: appState.showAnswer,
                isEditing: appState.isEditing,
                editingField: appState.editingField,
                editingContent: appState.editingContent,
                showExportButton: appState.showExportButton,
                showUnsavedModal: appState.showUnsavedModal,
                showTagsModal: appState.showTagsModal,
                selectedTags: appState.selectedTags,
                topTags: appState.topTags,
                allTags: appState.allTags,

                // Quiz state
                chosenAnswer: '',
                chosenAnswers: [],
                shortAnswerText: '',
                fillInAnswers: [],
                currentSessionCompleted: new Set(),
                showAnswer: false,

                // Cross-practice related
                questionTypes: [
                    { value: 'single-choice', label: '单选题' },
                    { value: 'multiple-choice', label: '多选题' },
                    { value: 'fill-in-blank', label: '填空题' },
                    { value: 'short-answer', label: '简答题' }
                ],
                selectedQuestionTypes: [],
                crossPracticeMode: 'random',
                crossPracticeCount: 10,
                showCrossPracticeModal: false,
                crossPracticeStrategy: 'random',

                // UI state
                isLoading: false,
                initError: null
            }
        } catch (error) {
            console.error('Failed to initialize app data:', error);
            return {
                initError: error.message,
                isLoading: false,
                pageState: 'error'
            }
        }
    },
    async created() {
        try {
            log.info('Initializing app components...');
            
            // 初始化各个管理器
            await this.jsonLoader.init();
            await this.keyboardManager.init();
            await this.navigationManager.init();
            await this.urlManager.init();
            await this.crossPracticeManager.init();

            log.info('Loading bank list...');
            // 先加载题库列表
            await this.loadBankList();
            
            // 初始化练习管理器
            if (this.jsonLoader.questions.length > 0) {
                log.debug('Initializing practice with questions:', {
                    count: this.jsonLoader.questions.length,
                    mode: 'sequence'
                });
                this.practiceManager.initPractice(this.jsonLoader.questions, 'sequence');
            }
        } catch (error) {
            log.error('Failed to initialize app:', error);
            this.appState.setState('loadError', error.message);
        }
    },
    mounted() {
        log.debug('App mounted, initializing keyboard events');
        // 初始化键盘事件监听
        this.keyboardManager.initKeyboardEvents();
        
        // 从URL参数中获取初始状态并处理
        this.$nextTick(async () => {
            try {
                log.info('Processing URL parameters...');
                await this.handleUrlParams();
            } catch (error) {
                log.error('Failed to handle URL params:', error);
                this.resetAllState();
            }
        });
    },
    beforeUnmount() {
        // 清理事件监听器
        this.keyboardManager.cleanup();
        this.navigationManager.cleanup();
        this.urlManager.cleanup();
    },
    watch: {
        selectedQuestionTypes: {
            handler() {
                console.log('[selectedQuestionTypes] Question types changed, updating distribution');
                this.updateBankDistribution();
            },
            deep: true
        },
        pageState: {
            handler(newState, oldState) {
                console.log('Page state changed:', {
                    from: oldState,
                    to: newState
                });

                // 确保状态有效
                if (!newState) {
                    console.warn('[pageState watch] Invalid state detected, resetting to home');
                    this.$nextTick(() => {
                        this.resetAllState();
                    });
                    return;
                }

                // 处理不同状态的UI更新
                switch (newState) {
                    case 'home':
                        // 清理相关状态
                        this.questionManager?.clearEditHistory();
                        this.showExportButton = false;
                        break;

                    case 'setDescription':
                        // 初始化模式按钮
                        this.$nextTick(() => {
                            const buttons = document.querySelectorAll('.mode-btn');
                            if (buttons.length > 0) {
                                console.log('Mode buttons after state change:', {
                                    totalButtons: buttons.length,
                                    buttonElements: Array.from(buttons).map(btn => ({
                                        text: btn.textContent.trim(),
                                        tabIndex: btn.tabIndex,
                                        hasClickHandler: btn.onclick !== null,
                                        hasKeydownHandler: btn.onkeydown !== null
                                    }))
                                });
                                this.initModeButtonsFocus();
                            } else {
                                console.warn('[pageState watch] No mode buttons found in setDescription state');
                            }
                        });
                        break;

                    case 'quiz':
                    case 'orderQuiz':
                    case 'randomQuiz':
                        // 确保练习管理器已初始化
                        if (!this.practiceManager?.questions?.length) {
                            console.warn('[pageState watch] No questions available in quiz state');
                            this.$nextTick(() => {
                                this.goBack();
                            });
                        }
                        break;

                    default:
                        console.warn('[pageState watch] Unknown state:', newState);
                        break;
                }
            }
        },
        'practiceManager.currentIndex': {
            handler(newIndex) {
                console.log('[watch] currentIndex changed:', newIndex);
                if (this.practiceManager && this.practiceManager.questions && this.appState.pageState === 'quiz') {
                    const currentQuestion = this.practiceManager.questions[newIndex];
                    console.log('[watch] Current question:', currentQuestion);
                    if (currentQuestion) {
                        // 确保保持 bank 参数
                        const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet?.name)?.file;
                        if (currentFile) {
                            this.urlManager.updateUrlParams('quiz', {
                                mode: this.navigationManager.getCurrentMode(),
                                qid: newIndex + 1,
                                bank: currentFile
                            });
                        }
                    }
                }
            }
        },
        // Add watcher for appState changes
        'appState.pageState'(newState) {
            this.pageState = newState;
        },
        'appState.fileList'(newList) {
            this.fileList = newList;
        },
        'appState.groupedFileList'(newList) {
            this.groupedFileList = newList;
        },
        'appState.chosenSet'(newSet) {
            this.chosenSet = newSet;
        },
        'appState.bankStats'(newStats) {
            this.bankStats = newStats;
        },
        'appState.updateTime'(newTime) {
            this.updateTime = newTime;
        }
    },
    computed: {
        currentQuestion() {
            return this.practiceManager?.getCurrentQuestion() || null;
        },
        currentIndex() {
            return this.practiceManager?.currentIndex || 0;
        },
        quizList() {
            return this.practiceManager?.questions || [];
        },
        isPreviewMode() {
            return this.practiceManager?.isPreviewMode || false;
        },
        totalStats() {
            return this.storageManager.getAllBanksStats();
        },
        setStats() {
            if (!this.appState.chosenSet) return null;
            return this.storageManager.getSetStats(this.appState.chosenSet.id, this.jsonLoader.questions);
        },
        renderedContent() {
            return this.questionManager.renderContent(this.currentQuestion?.content);
        },
        renderedAnalysis() {
            return this.questionManager.renderContent(this.currentQuestion?.analysis);
        },
        progressText() {
            return `${this.currentIndex + 1} / ${this.quizList.length}`;
        },
        completedCount() {
            return this.quizManager.getCompletedCount();
        },
        letterMap() {
            return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        },
        filteredGroupedFileList() {
            if (!this.appState.selectedTags.length) {
                return this.appState.groupedFileList;
            }
            return this.appState.groupedFileList.map(group => [
                group[0],
                group[1].filter(file => {
                    if (!file.tags) return false;
                    return this.appState.selectedTags.every(tag => file.tags.includes(tag));
                })
            ]).filter(group => group[1].length > 0);
        },
        filteredBankDistribution() {
            return this.crossPracticeManager.getFilteredBankDistribution();
        },
        maxQuestionCount() {
            return this.crossPracticeManager.getMaxQuestionCount();
        },
        canStartCrossPractice() {
            return this.crossPracticeManager.canStartPractice();
        },
        showCrossPracticeModal: {
            get() {
                return this.crossPracticeManager.showModal;
            },
            set(value) {
                this.crossPracticeManager.showModal = value;
            }
        }
    },
    methods: {
        // 加载题库列表
        async loadBankList() {
            try {
                log.info('Starting to load bank list');
                this.appState.setState('isLoading', true);
                
                // 使用jsonLoader加载题库列表
                const bankList = this.jsonLoader.bankList;
                log.debug('Bank list loaded:', { count: bankList.length });
                this.appState.setState('fileList', bankList);
                this.appState.setUpdateTime(this.jsonLoader.updateTime);
                
                // 加载每个题库的统计信息
                log.info('Loading stats for each bank...');
                for (const bank of bankList) {
                    try {
                        // 先加载题库数据
                        log.debug(`Loading bank data: ${bank.file}`);
                        await this.jsonLoader.loadFile(bank.file);
                        // 然后获取统计信息
                        const stats = await this.storageManager.getBankStats(bank.file, this.jsonLoader);
                        log.debug(`Stats loaded for ${bank.file}:`, stats);
                        this.appState.updateBankStats(bank.file, stats);
                    } catch (error) {
                        log.warn(`Error loading bank ${bank.file}:`, error);
                        this.appState.updateBankStats(bank.file, {
                            completed: 0,
                            total: 0,
                            accuracy: 0
                        });
                    }
                }
                
                // 加载每个题库的sets信息以获取category和tags
                log.info('Loading sets information for categories and tags...');
                const fileCategories = {};
                const fileTags = {};
                const tagsCount = new Map();
                
                for (const bank of bankList) {
                    try {
                        const bankData = await this.jsonLoader.loadFile(bank.file);
                        const category = bankData.sets[0]?.category || '未分类';
                        const tags = bankData.sets[0]?.tags || [];
                        
                        fileCategories[bank.file] = category;
                        fileTags[bank.file] = tags;
                        
                        // 统计tags
                        tags.forEach(tag => {
                            tagsCount.set(tag, (tagsCount.get(tag) || 0) + 1);
                        });

                        log.debug(`Processed bank ${bank.file}:`, {
                            category,
                            tags,
                            tagsCount: Array.from(tagsCount.entries())
                        });
                    } catch (error) {
                        log.warn(`Error loading bank ${bank.file}:`, error);
                        fileCategories[bank.file] = '未分类';
                        fileTags[bank.file] = [];
                    }
                }
                
                // 更新fileList添加tags信息
                log.info('Updating file list with tags information');
                this.appState.setState('fileList', bankList.map(bank => ({
                    ...bank,
                    tags: fileTags[bank.file] || []
                })));
                
                // 获取前三个最常用的tags和所有tags
                const sortedTags = Array.from(tagsCount.entries())
                    .sort((a, b) => b[1] - a[1]);
                
                const topTags = sortedTags
                    .slice(0, 3)
                    .map(([tag, count]) => ({ tag, count }));
                
                const allTags = sortedTags
                    .map(([tag, count]) => ({ tag, count }));
                
                log.debug('Tags statistics:', {
                    topTags,
                    totalTags: allTags.length
                });
                
                this.appState.updateTags(topTags, allTags);
                
                // 按category对题库进行分组
                const groups = {};
                bankList.forEach(bank => {
                    const category = fileCategories[bank.file] || '未分类';
                    if (!groups[category]) {
                        groups[category] = [];
                    }
                    groups[category].push({
                        ...bank,
                        tags: fileTags[bank.file] || []
                    });
                });
                
                // 对每个分类内的题库按名称排序
                for (const category in groups) {
                    groups[category].sort((a, b) => a.name.localeCompare(b.name));
                }
                
                // 转换为数组并按分类名排序，确保"未分类"永远在最后
                this.appState.setState('groupedFileList', Object.entries(groups)
                    .sort((a, b) => {
                        if (a[0] === '未分类') return 1;
                        if (b[0] === '未分类') return -1;
                        return a[0].localeCompare(b[0]);
                    })
                );

                log.info('Bank list loading completed successfully');
            } catch (error) {
                log.error('Error loading file list:', error);
                this.appState.setState('loadError', error.message);
            } finally {
                this.appState.setState('isLoading', false);
            }
        },

        // 加载题库文件
        async loadJsonFile(fileName) {
            console.log('[loadJsonFile] Starting to load file:', fileName);
            if (this.isLoading) {
                console.log('[loadJsonFile] Already loading, skipping');
                return;
            }
            this.isLoading = true;
            try {
                console.log('[loadJsonFile] Loading data from file');
                const data = await this.jsonLoader.loadFile(fileName);
                console.log('[loadJsonFile] Data loaded:', {
                    setName: data.sets[0]?.name,
                    questionCount: data.questions?.length
                });
                
                this.appState.setState('chosenSet', data.sets[0]);
                
                // 更新统计数据
                console.log('[loadJsonFile] Updating bank stats');
                const stats = await this.storageManager.getBankStats(fileName, this.jsonLoader);
                this.bankStats[fileName] = stats;
                
                // 更新URL并切换到题库详情页
                console.log('[loadJsonFile] Updating page state to setDescription');
                this.updatePageState('setDescription');
            } catch (error) {
                console.error('[loadJsonFile] Failed to load bank:', error);
                alert('加载题库失败: ' + error.message);
            } finally {
                this.isLoading = false;
                console.log('[loadJsonFile] Loading completed');
            }
        },

        // 开始练习
        startQuiz(mode) {
            switch (mode) {
                case 'all':
                    this.enterQuizMode();
                    break;
                case 'wrong':
                    this.enterOrderQuizMode();
                    break;
                case 'random':
                    this.enterRandomQuizMode();
                    break;
                case 'preview':
                    this.enterPreviewMode();
                    break;
            }
        },

        // 进入练习模式
        enterQuizMode() {
            this.practiceManager.initPractice(this.jsonLoader.questions, 'sequence');
            this.practiceManager.togglePreviewMode(false);
            this.showAnswer = false;
            this.currentSessionCompleted.clear();
            this.updatePageState('quiz', { 
                mode: 'all',
                qid: 1 // 从第一题开始
            });
        },

        enterOrderQuizMode() {
            this.practiceManager.initPractice(this.jsonLoader.questions, 'error-rate');
            this.practiceManager.togglePreviewMode(false);
            this.showAnswer = false;
            this.currentSessionCompleted.clear();
            this.updatePageState('quiz', { 
                mode: 'wrong',
                qid: 1 // 从第一题开始
            });
        },

        enterRandomQuizMode() {
            this.practiceManager.initPractice(this.jsonLoader.questions, 'random');
            this.practiceManager.togglePreviewMode(false);
            this.showAnswer = false;
            this.currentSessionCompleted.clear();
            this.updatePageState('quiz', { 
                mode: 'random',
                qid: 1 // 从第一题开始
            });
        },

        enterPreviewMode() {
            this.practiceManager.initPractice(this.jsonLoader.questions, 'sequence');
            this.practiceManager.togglePreviewMode(false); // 关闭预览模式
            this.showAnswer = true; // 显示解析
            this.isEditing = true; // 启用编辑模式
            this.questionManager.startEditing(this.jsonLoader.questions[0]); // 开始编辑第一题
            this.showExportButton = true; // 显示导出按钮
            this.updatePageState('quiz', { 
                mode: 'preview',
                qid: 1 // 从第一题开始
            });
        },

        // 编辑相关方法
        editQuestion() {
            if (this.isPreviewMode) return;
            console.log('Starting edit mode for question:', this.currentQuestion);
            this.questionManager.startEditing(this.currentQuestion);
            this.isEditing = true;
            this.showExportButton = true;
            // 自动切换到解析模式
            this.showAnswer = true;
        },

        enterEditMode(field, content) {
            if (this.isPreviewMode) return;
            console.log('Entering edit mode:', {
                field,
                content,
                currentContent: content || '点击编辑'
            });
            this.editingField = field;
            this.editingContent = content || '';
        },

        exitEditMode() {
            console.log('Exiting edit mode:', {
                field: this.editingField,
                content: this.editingContent,
                question: this.currentQuestion
            });
            
            if (this.editingField && this.editingContent !== undefined) {
                const question = this.currentQuestion;
                if (this.editingField === 'content') {
                    question.content = this.editingContent;
                } else if (this.editingField === 'analysis') {
                    question.analysis = this.editingContent;
                } else if (this.editingField.startsWith('option-')) {
                    const idx = parseInt(this.editingField.split('-')[1]);
                    question.options[idx] = this.editingContent;
                }
                this.questionManager.saveCurrentEdit();
                // 更新修改计数
                this.modifiedCount = this.questionManager.getModifiedQuestions().length;
            }
            this.editingField = null;
            this.editingContent = '';
        },

        // 退出整个编辑模式
        exitEntireEditMode() {
            if (this.editingField) {
                this.exitEditMode();
            }
            this.isEditing = false;
            this.showAnswer = false;
            this.showExportButton = false;
            this.questionManager.cancelEditing();
        },

        // 导出相关方法
        handleExport(questions) {
            const exportData = {
                questions: questions,
                sets: [this.appState.chosenSet]
            };

            const blob = new Blob([JSON.stringify(exportData, null, 4)], 
                { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // 从fileList中获取当前题库的文件名
            const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet.name)?.file;
            a.download = this.questionManager.generateExportFileName(currentFile || 'export');
            a.click();
            URL.revokeObjectURL(url);

            // 更新导出状态
            this.lastExportTimestamp = Date.now();
            this.modifiedCount = 0;
            this.questionManager.clearModifiedQuestions();
            this.showExportButton = false;
            this.isEditing = false;
            this.showUnsavedModal = false;
        },

        // 导出修改
        exportModifiedData() {
            const modifiedQuestions = this.questionManager.getModifiedQuestions();
            const questions = this.jsonLoader.questions.map(q => {
                if (modifiedQuestions.includes(q.uniqueId)) {
                    return { ...q };
                }
                return q;
            });
            this.handleExport(questions);
        },

        // 状态更新
        updatePageState(newState, params = {}) {
            console.log('[updatePageState] from:', this.appState.pageState, 'to:', newState, 'params:', params);
            // 如果有未导出的修改，且不是刚刚导出的，且不是在编辑模式中
            if (this.modifiedCount > 0 && !this.dontShowExportReminder && 
                (!this.lastExportTimestamp || Date.now() - this.lastExportTimestamp > 1000) &&
                !this.isEditing) {
                const hasUnsaved = this.checkModifiedQuestions();
                if (hasUnsaved) {
                    return;
                }
            }
            
            if (this.isEditing && this.questionManager.checkUnsavedChanges()) {
                this.showUnsavedDialog(newState);
                return;
            }
            
            this.appState.setState('pageState', newState);
            
            // 如果是返回题库详情页，确保传递当前题库参数
            if (newState === 'setDescription' && this.appState.chosenSet) {
                const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet.name)?.file;
                if (currentFile) {
                    params.bank = currentFile;
                }
            }
            
            // 如果是进入答题页面，确保传递当前题目序号
            if (newState === 'quiz' && this.practiceManager) {
                params.qid = params.qid || (this.practiceManager.currentIndex + 1);
            }
            
            // 更新URL参数
            this.urlManager.updateUrlParams(newState, params);
            
            if (newState === 'home') {
                this.questionManager.clearEditHistory();
                this.showExportButton = false;
            }
        },

        showUnsavedDialog(action) {
            const dialog = document.createElement('div');
            dialog.className = 'modal-overlay';
            dialog.innerHTML = `
                <div class="modal-content modal-btn">
                    <h3>未保存的修改</h3>
                    <p>当前题目有未保存的修改，请选择操作：</p>
                    <div class="modal-btn-group">
                        <button class="btn btn-continue-edit" id="continueEdit">继续编辑</button>
                        <button class="btn btn-save-export" id="saveAndExport">保存导出</button>
                        <button class="btn btn-discard" id="discardAndContinue">放弃修改</button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            // 点击遮罩层关闭对话框（继续编辑）
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    document.body.removeChild(dialog);
                }
            });

            // 继续编辑
            dialog.querySelector('#continueEdit').addEventListener('click', () => {
                document.body.removeChild(dialog);
            });

            // 保存并导出
            dialog.querySelector('#saveAndExport').addEventListener('click', () => {
                this.questionManager.saveCurrentEdit();
                this.exportModifiedData();
                document.body.removeChild(dialog);
                
                // 根据action执行相应操作
                this.handleActionAfterSave(action);
            });

            // 仅保存
            dialog.querySelector('#saveAndContinue').addEventListener('click', () => {
                this.questionManager.saveCurrentEdit();
                document.body.removeChild(dialog);
                
                // 根据action执行相应操作
                this.handleActionAfterSave(action);
            });

            // 放弃修改并继续
            dialog.querySelector('#discardAndContinue').addEventListener('click', () => {
                this.questionManager.cancelEditing();
                document.body.removeChild(dialog);
                
                // 根据action执行相应操作
                this.handleActionAfterSave(action);
            });
        },

        // 处理保存后的操作
        handleActionAfterSave(action) {
            if (action === 'next') {
                this.practiceManager.currentIndex++;
                this.questionManager.startEditing(this.practiceManager.questions[this.practiceManager.currentIndex]);
            } else if (action === 'prev') {
                this.practiceManager.currentIndex--;
                this.questionManager.startEditing(this.practiceManager.questions[this.practiceManager.currentIndex]);
            } else if (action === 'setDescription') {
                this.exitEntireEditMode();
                this.appState.setState('pageState', action);
            } else if (action === 'home') {
                this.exitEntireEditMode();
                this.appState.setState('pageState', action);
            }
            
            // 更新URL参数
            if (action === 'next' || action === 'prev') {
                this.$nextTick(() => {
                    this.urlManager.updateUrlParams('quiz', {
                        mode: this.navigationManager.getCurrentMode(),
                        qid: this.practiceManager.questions[this.practiceManager.currentIndex].uniqueId
                    });
                });
            }
        },

        goBack() {
            console.log('[goBack] Called, pageState:', this.appState.pageState, 'isEditing:', this.isEditing);
            if (this.isEditing) {
                if (this.questionManager.checkUnsavedChanges()) {
                    this.showUnsavedDialog('setDescription');
                    return;
                } else {
                    this.exitEntireEditMode();
                }
            }
            
            // 获取当前题库文件名
            const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet?.name)?.file;
            console.log('[goBack] Current bank file:', currentFile);
            
            // 返回题库描述页面时保持bank参数
            console.log('[goBack] updatePageState to setDescription');
            this.updatePageState('setDescription', { bank: currentFile });
        },

        goHome() {
            console.log('[goHome] Called, pageState:', this.appState.pageState);
            if (this.isEditing) {
                this.exitEntireEditMode();
            }
            // 清除所有状态和URL参数
            this.appState.setState('chosenSet', null);
            this.questionManager.clearEditHistory();
            this.showExportButton = false;
            this.updatePageState('home');
        },

        async getBankStats(fileName) {
            try {
                // 确保题库已加载
                if (!this.jsonLoader.loadedBanks.has(fileName)) {
                    console.log(`[getBankStats] Loading bank first: ${fileName}`);
                    await this.jsonLoader.loadFile(fileName);
                }
                
                const bankData = await this.storageManager.getBankStats(fileName, this.jsonLoader);
                console.log(`[getBankStats] Stats for ${fileName}:`, bankData);
                if (!bankData) return null;
                
                const stats = {
                    completed: bankData.completed || 0,
                    total: bankData.total || 0,
                    accuracy: bankData.attempts > 0 
                        ? Math.round((bankData.correct / bankData.attempts) * 100)
                        : 0
                };
                console.log(`[getBankStats] Processed stats for ${fileName}:`, stats);
                return stats;
            } catch (e) {
                console.error('获取题库统计失败:', e);
                return {
                    completed: 0,
                    total: 0,
                    accuracy: 0
                };
            }
        },

        renderMarkdown(text) {
            if (!text) return '';
            return marked.parse(text);
        },

        renderMarkdownWithLatex(text) {
            if (!text) return '';
            
            // 先处理多行公式，避免被markdown解析器破坏格式
            let content = text;
            
            // 保存多行公式
            const formulas = [];
            content = content.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
                // 保持原始换行，不进行任何替换
                formulas.push(formula.trim());
                return `<div class="katex-display">${katex.renderToString(formula.trim(), {
                    displayMode: true,
                    throwOnError: false,
                    strict: false,
                    trust: true,
                    output: 'html'
                })}</div>`;
            });
            
            // 处理Markdown
            content = marked.parse(content);
            
            // 处理行内公式
            content = content.replace(/\$([^$]+?)\$/g, (match, formula) => {
                try {
                    return katex.renderToString(formula.trim(), {
                        displayMode: false,
                        throwOnError: false,
                        strict: false
                    });
                } catch (e) {
                    console.error('LaTeX rendering error:', e);
                    console.error('Formula:', formula);
                    return match;
                }
            });
            
            return content;
        },

        handleOptionChange(option, isSingleChoice) {
            console.log('Option change handler:', {
                option,
                isSingleChoice,
                currentValue: isSingleChoice ? this.chosenAnswer : this.chosenAnswers
            });

            if (isSingleChoice) {
                this.chosenAnswer = option;
            } else {
                const index = this.chosenAnswers.indexOf(option);
                if (index === -1) {
                    this.chosenAnswers.push(option);
                } else {
                    this.chosenAnswers.splice(index, 1);
                }
            }

            console.log('After option change:', {
                chosenAnswer: this.chosenAnswer,
                chosenAnswers: this.chosenAnswers
            });
        },

        isChosenOptionSingle(opt) {
            console.log('Checking single option selection:', {
                option: opt,
                optionType: typeof opt,
                chosenAnswer: this.chosenAnswer,
                chosenAnswerType: typeof this.chosenAnswer,
                isChosen: String(this.chosenAnswer) === String(opt)
            });
            return String(this.chosenAnswer) === String(opt);
        },

        isCorrectOptionMulti(opt) {
            const ans = this.currentQuestion?.correct_answer || [];
            const isCorrect = ans.some(a => String(a) === String(opt));
            console.log('Checking multi option correctness:', {
                option: opt,
                correctAnswers: ans,
                isCorrect: isCorrect
            });
            return isCorrect;
        },

        isCorrectOptionSingle(opt) {
            const ans = this.currentQuestion?.correct_answer || [];
            const isCorrect = ans.length > 0 && String(ans[0]) === String(opt);
            console.log('Checking single option correctness:', {
                option: opt,
                optionType: typeof opt,
                correctAnswer: ans[0],
                correctAnswerType: ans.length > 0 ? typeof ans[0] : 'undefined',
                isCorrect: isCorrect
            });
            return isCorrect;
        },

        submitAnswer() {
            const q = this.currentQuestion;
            if (!q) return;

            let answer;
            let isCorrect = false;

            switch (q.type) {
                case 'single-choice':
                    answer = this.chosenAnswer;
                    isCorrect = q.correct_answer.includes(answer);
                    break;
                case 'multiple-choice':
                    answer = [...this.chosenAnswers].sort();
                    isCorrect = this.compareArrays(answer, q.correct_answer);
                    break;
                case 'fill-in-blank':
                    answer = this.fillInAnswers;
                    isCorrect = this.compareArrays(answer, q.correct_answer);
                    break;
                case 'short-answer':
                    answer = this.shortAnswerText;
                    // 简答题特殊处理
                    isCorrect = q.correct_answer.some(ans => 
                        answer.toLowerCase().includes(ans.toLowerCase())
                    );
                    break;
            }

            // 记录完成状态
            this.currentSessionCompleted.add(q.uniqueId);
            
            // 更新题目完成状态
            const setId = this.appState.chosenSet.isCrossPractice ? q.sourceBank : this.appState.chosenSet.id;
            this.storageManager.updateQuestionCompletion(setId, q.uniqueId, isCorrect);
            this.showAnswer = true;

            // 更新URL以反映答案已提交
            this.urlManager.updateUrlParams('quiz', {
                mode: this.navigationManager.getCurrentMode(),
                qid: this.currentQuestion.uniqueId
            });
        },

        nextQuestion() {
            if (this.practiceManager && this.practiceManager.currentIndex < this.practiceManager.questions.length - 1) {
                // 如果在编辑模式，自动保存当前编辑并开始编辑下一题
                if (this.isEditing) {
                    // 如果当前有未保存的字段编辑，先保存
                    if (this.editingField) {
                        this.exitEditMode();
                    }
                    // 如果有未保存的修改，自动保存
                    if (this.questionManager.checkUnsavedChanges()) {
                        this.questionManager.saveCurrentEdit();
                    }
                    this.practiceManager.currentIndex++;
                    this.questionManager.startEditing(this.practiceManager.questions[this.practiceManager.currentIndex]);
                    this.showAnswer = true;
                } else {
                    this.practiceManager.currentIndex++;
                    this.showAnswer = false;
                }
                
                // 立即更新URL参数
                this.$nextTick(() => {
                    const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet?.name)?.file;
                    this.urlManager.updateUrlParams('quiz', {
                        mode: this.navigationManager.getCurrentMode(),
                        qid: this.practiceManager.currentIndex + 1,
                        bank: currentFile
                    });
                });
            } else if (!this.practiceManager.isPreviewMode) {
                this.updatePageState('result');
            }
        },

        prevQuestion() {
            if (this.practiceManager && this.practiceManager.currentIndex > 0) {
                // 如果在编辑模式，自动保存当前编辑并开始编辑上一题
                if (this.isEditing) {
                    // 如果当前有未保存的字段编辑，先保存
                    if (this.editingField) {
                        this.exitEditMode();
                    }
                    // 如果有未保存的修改，自动保存
                    if (this.questionManager.checkUnsavedChanges()) {
                        this.questionManager.saveCurrentEdit();
                    }
                    this.practiceManager.currentIndex--;
                    this.questionManager.startEditing(this.practiceManager.questions[this.practiceManager.currentIndex]);
                    this.showAnswer = true;
                } else {
                    this.practiceManager.currentIndex--;
                    this.showAnswer = false;
                }
                
                // 立即更新URL参数
                this.$nextTick(() => {
                    const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet?.name)?.file;
                    this.urlManager.updateUrlParams('quiz', {
                        mode: this.navigationManager.getCurrentMode(),
                        qid: this.practiceManager.currentIndex + 1,
                        bank: currentFile
                    });
                });
            }
        },

        formatDate(isoDate) {
            if (!isoDate) return '';
            const date = new Date(isoDate);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (isoDate.startsWith(today.toISOString().split('T')[0])) {
                return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            } else if (isoDate.startsWith(yesterday.toISOString().split('T')[0])) {
                return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            } else {
                return date.toLocaleDateString('zh-CN') + ' ' + 
                       date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            }
        },
        closeUnsavedModal() {
            this.showUnsavedModal = false;
        },
        truncateText(text, length) {
            if (!text) return '';
            text = text.replace(/<[^>]*>/g, ''); // 移除HTML标签
            return text.length > length ? text.slice(0, length) + '...' : text;
        },
        getSetName(setId) {
            return this.jsonLoader.sets.find(s => s.id === setId)?.name || setId;
        },
        checkModifiedQuestions() {
            const modifiedQuestions = this.questionManager.getModifiedQuestions();
            if (modifiedQuestions.length > 0 && !this.dontShowExportReminder) {
                // 只显示当前题库的修改题目
                this.groupedModifiedQuestions = this.jsonLoader.questions
                    .filter(q => modifiedQuestions.includes(q.uniqueId));
                
                // 显示未导出提示模态框
                this.showUnsavedModal = true;
                return true;
            }
            return false;
        },
        showBanner(content, type = 'info', closeable = true) {
            this.banner = {
                show: true,
                content,
                type,
                closeable
            };
        },
        closeBanner() {
            this.banner.show = false;
        },
        formatUpdateTime(isoString) {
            const date = new Date(isoString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        closeUnsavedModalAndContinue() {
            this.showUnsavedModal = false;
            this.questionManager.clearModifiedQuestions();
            this.modifiedCount = 0;
            this.showExportButton = false;
        },
        toggleTag(tag) {
            const index = this.selectedTags.indexOf(tag);
            if (index === -1) {
                this.selectedTags.push(tag);
            } else {
                this.selectedTags.splice(index, 1);
            }
        },
        clearTags() {
            this.selectedTags = [];
        },
        async loadBankStats(fileName) {
            console.log('[loadBankStats] Loading stats for:', fileName);
            try {
                // 获取统计信息
                const stats = this.storageManager.getBankStats(fileName, this.jsonLoader);
                console.log('[loadBankStats] Retrieved stats:', stats);
                this.bankStats[fileName] = stats;
                
                // 强制更新计算属性
                this.$forceUpdate();
                console.log('[loadBankStats] Stats updated and view forced to update');
                
                // 如果在题库详情页面，确保setStats被重新计算
                if (this.appState.pageState === 'setDescription') {
                    console.log('[loadBankStats] Recalculating setStats for description page');
                    // Vue会自动重新计算setStats，因为依赖的数据已经更新
                    const currentStats = this.setStats;
                    console.log('[loadBankStats] Current setStats:', currentStats);
                }
            } catch (error) {
                console.error('[loadBankStats] Error loading bank stats:', error);
            }
        },
        focusPrevButton(event) {
            console.log('focusPrevButton triggered', {
                eventTarget: event.target,
                eventType: event.type,
                currentActiveElement: document.activeElement
            });
            
            const buttons = Array.from(document.querySelectorAll('.mode-btn'));
            console.log('Found mode buttons:', {
                totalButtons: buttons.length,
                buttonTexts: buttons.map(btn => btn.textContent.trim())
            });
            
            const currentIndex = buttons.indexOf(event.target);
            console.log('Current button index:', currentIndex);
            
            const prevIndex = (currentIndex - 1 + buttons.length) % buttons.length;
            console.log('Will focus on button index:', prevIndex);
            
            buttons[prevIndex].focus();
            console.log('Focus set to:', {
                buttonText: buttons[prevIndex].textContent.trim(),
                newActiveElement: document.activeElement
            });
        },
        focusNextButton(event) {
            console.log('focusNextButton triggered', {
                eventTarget: event.target,
                eventType: event.type,
                currentActiveElement: document.activeElement
            });
            
            const buttons = Array.from(document.querySelectorAll('.mode-btn'));
            console.log('Found mode buttons:', {
                totalButtons: buttons.length,
                buttonTexts: buttons.map(btn => btn.textContent.trim())
            });
            
            const currentIndex = buttons.indexOf(event.target);
            console.log('Current button index:', currentIndex);
            
            const nextIndex = (currentIndex + 1) % buttons.length;
            console.log('Will focus on button index:', nextIndex);
            
            buttons[nextIndex].focus();
            console.log('Focus set to:', {
                buttonText: buttons[nextIndex].textContent.trim(),
                newActiveElement: document.activeElement
            });
        },
        focusUpButton(event) {
            console.log('focusUpButton triggered', {
                eventTarget: event.target,
                eventType: event.type,
                currentActiveElement: document.activeElement
            });
            
            const buttons = Array.from(document.querySelectorAll('.mode-btn'));
            console.log('Found mode buttons:', {
                totalButtons: buttons.length,
                buttonTexts: buttons.map(btn => btn.textContent.trim())
            });
            
            const currentIndex = buttons.indexOf(event.target);
            console.log('Current button index:', currentIndex);
            
            const COLS = window.innerWidth <= 600 ? 1 : 2;
            console.log('Grid layout:', {
                columns: COLS,
                windowWidth: window.innerWidth
            });
            
            const prevIndex = currentIndex - COLS;
            console.log('Calculated previous index:', prevIndex);
            
            if (prevIndex >= 0) {
                console.log('Moving up to index:', prevIndex);
                buttons[prevIndex].focus();
            } else {
                // 如果到达顶部，跳转到最后一行的相同列
                const sameColBottom = currentIndex % COLS + Math.floor((buttons.length - 1) / COLS) * COLS;
                console.log('Wrapping to bottom, calculated index:', {
                    currentCol: currentIndex % COLS,
                    lastRowStart: Math.floor((buttons.length - 1) / COLS) * COLS,
                    targetIndex: sameColBottom
                });
                
                if (sameColBottom < buttons.length) {
                    buttons[sameColBottom].focus();
                } else {
                    buttons[buttons.length - 1].focus();
                }
            }
            
            console.log('Focus set to:', {
                buttonText: document.activeElement.textContent.trim(),
                newActiveElement: document.activeElement
            });
        },
        focusDownButton(event) {
            console.log('focusDownButton triggered', {
                eventTarget: event.target,
                eventType: event.type,
                currentActiveElement: document.activeElement
            });
            
            const buttons = Array.from(document.querySelectorAll('.mode-btn'));
            console.log('Found mode buttons:', {
                totalButtons: buttons.length,
                buttonTexts: buttons.map(btn => btn.textContent.trim())
            });
            
            const currentIndex = buttons.indexOf(event.target);
            console.log('Current button index:', currentIndex);
            
            const COLS = window.innerWidth <= 600 ? 1 : 2;
            console.log('Grid layout:', {
                columns: COLS,
                windowWidth: window.innerWidth
            });
            
            const nextIndex = currentIndex + COLS;
            console.log('Calculated next index:', nextIndex);
            
            if (nextIndex < buttons.length) {
                console.log('Moving down to index:', nextIndex);
                buttons[nextIndex].focus();
            } else {
                // 如果到达底部，跳转到第一行的相同列
                const sameColTop = currentIndex % COLS;
                console.log('Wrapping to top, calculated index:', {
                    currentCol: currentIndex % COLS,
                    targetIndex: sameColTop
                });
                buttons[sameColTop].focus();
            }
            
            console.log('Focus set to:', {
                buttonText: document.activeElement.textContent.trim(),
                newActiveElement: document.activeElement
            });
        },
        handleKeyNavigation(event) {
            // 如果不是在题库详情页，不处理
            if (this.appState.pageState !== 'setDescription') {
                return;
            }

            // 获取所有模式按钮
            const buttons = Array.from(document.querySelectorAll('.mode-btn'));
            if (!buttons.length) return;

            // 获取当前焦点按钮的索引
            const currentIndex = buttons.findIndex(btn => btn === document.activeElement);
            let nextIndex = currentIndex;

            // 定义网格布局
            const COLS = window.innerWidth <= 600 ? 1 : 2;
            const ROWS = Math.ceil(buttons.length / COLS);

            // 计算当前位置
            const currentRow = Math.floor(currentIndex / COLS);
            const currentCol = currentIndex % COLS;

            switch (event.key) {
                case 'ArrowRight':
                    nextIndex = currentIndex + 1;
                    if (nextIndex >= buttons.length) {
                        nextIndex = 0; // 循环到第一个
                    }
                    break;
                case 'ArrowLeft':
                    nextIndex = currentIndex - 1;
                    if (nextIndex < 0) {
                        nextIndex = buttons.length - 1; // 循环到最后一个
                    }
                    break;
                case 'ArrowDown':
                    // 向下移动，如果到底则循环到顶部同列
                    nextIndex = currentIndex + COLS;
                    if (nextIndex >= buttons.length) {
                        // 如果超出范围，回到顶部同列
                        nextIndex = currentCol;
                    }
                    break;
                case 'ArrowUp':
                    // 向上移动，如果到顶则循环到底部同列
                    nextIndex = currentIndex - COLS;
                    if (nextIndex < 0) {
                        // 如果超出范围，去到底部同列
                        nextIndex = currentCol + (ROWS - 1) * COLS;
                        // 确保不超出实际按钮数量
                        if (nextIndex >= buttons.length) {
                            nextIndex = buttons.length - 1;
                        }
                    }
                    break;
                case 'Tab':
                    // Tab 键循环
                    nextIndex = event.shiftKey ? 
                        (currentIndex - 1 + buttons.length) % buttons.length :
                        (currentIndex + 1) % buttons.length;
                    break;
                default:
                    return; // 其他键不处理
            }

            // 阻止默认行为
            event.preventDefault();

            // 设置焦点
            if (nextIndex >= 0 && nextIndex < buttons.length) {
                buttons[nextIndex].focus();
            }
        },
        getFocusableElements() {
            // 获取当前页面中所有可聚焦的元素
            if (this.appState.pageState === 'setDescription') {
                // 在题库详情页中，只获取模式按钮
                return Array.from(document.querySelectorAll('.mode-btn'))
                    .filter(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    });
            }
            
            const selector = 'button, [tabindex="0"], a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
            return Array.from(this.$el.querySelectorAll(selector))
                .filter(el => {
                    // 确保元素是可见的
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                });
        },
        initModeButtonsFocus() {
            // 确保第一个按钮获得焦点
            if (this.appState.pageState === 'setDescription') {
                this.$nextTick(() => {
                    const firstBtn = this.$refs.firstModeBtn;
                    if (firstBtn) {
                        firstBtn.focus();
                    }
                });
            }
        },
        // URL参数处理
        async handleUrlParams() {
            const urlParams = new URLSearchParams(window.location.search);
            const bankParam = urlParams.get('bank');
            const stateParam = urlParams.get('state');
            const modeParam = urlParams.get('mode');
            const qidParam = urlParams.get('qid');
            
            console.log('[handleUrlParams] Processing URL parameters:', {
                bank: bankParam,
                state: stateParam,
                mode: modeParam,
                qid: qidParam
            });
            
            // 如果没有bank参数，设置为首页状态
            if (!bankParam) {
                console.log('[handleUrlParams] No bank parameter, setting home state');
                this.resetAllState();
                this.appState.setState('pageState', 'home');
                return;
            }

            // 确保题库列表已加载
            if (this.appState.fileList.length === 0) {
                console.log('[handleUrlParams] File list not loaded yet, loading...');
                await this.loadBankList();
            }

            // 验证题库是否存在
            const bankExists = this.appState.fileList.some(f => f.file === bankParam);
            if (!bankExists) {
                console.error('[handleUrlParams] Bank not found:', bankParam);
                alert('找不到指定的题库');
                this.resetAllState();
                return;
            }
            
            try {
                this.isLoading = true;
                // 加载题库数据
                console.log('[handleUrlParams] Loading bank data:', bankParam);
                const data = await this.jsonLoader.loadFile(bankParam);
                console.log('[handleUrlParams] Bank data loaded:', {
                    setName: data.sets[0]?.name,
                    questionCount: data.questions?.length
                });
                
                this.appState.setState('chosenSet', data.sets[0]);
                
                // 更新统计数据
                console.log('[handleUrlParams] Updating bank stats');
                const stats = await this.storageManager.getBankStats(bankParam, this.jsonLoader);
                this.bankStats[bankParam] = stats;
                
                // 根据state参数设置页面状态
                if (stateParam === 'quiz' && modeParam) {
                    console.log('[handleUrlParams] Setting up quiz mode:', modeParam);
                    await this.setupQuizMode(modeParam, qidParam);
                } else {
                    const newState = stateParam || 'setDescription';
                    console.log('[handleUrlParams] Setting page state to:', newState);
                    this.appState.setState('pageState', newState);
                    
                    // 更新URL参数以保持一致性
                    this.urlManager.updateUrlParams(newState, {
                        bank: bankParam
                    });
                }
            } catch (error) {
                console.error('[handleUrlParams] Failed to process URL parameters:', error);
                alert('加载题库失败: ' + error.message);
                this.resetAllState();
            } finally {
                this.isLoading = false;
            }
        },

        // 设置练习模式，支持qid跳转
        async setupQuizMode(mode, qid = null) {
            console.log('[setupQuizMode] Setting up quiz mode:', mode, {
                currentQuestions: this.jsonLoader.questions?.length,
                qid
            });
            try {
                // 确保我们使用的是当前加载的题库数据
                const questions = this.jsonLoader.questions;
                if (!questions || questions.length === 0) {
                    throw new Error('No questions available for quiz mode');
                }

                switch(mode) {
                    case 'all':
                        this.practiceManager.initPractice(questions, 'sequence');
                        this.practiceManager.togglePreviewMode(false);
                        break;
                    case 'wrong':
                        this.practiceManager.initPractice(questions, 'error-rate');
                        this.practiceManager.togglePreviewMode(false);
                        break;
                    case 'random':
                        this.practiceManager.initPractice(questions, 'random');
                        this.practiceManager.togglePreviewMode(false);
                        break;
                    case 'preview':
                        this.practiceManager.initPractice(questions, 'sequence');
                        this.practiceManager.togglePreviewMode(true);
                        this.showAnswer = true;
                        break;
                }

                // 跳转到指定题目
                if (qid) {
                    // 尝试通过序号定位（序号从1开始）
                    const num = parseInt(qid);
                    if (!isNaN(num) && num >= 1 && num <= this.practiceManager.questions.length) {
                        this.practiceManager.currentIndex = num - 1;
                    }
                }

                console.log('[setupQuizMode] Practice manager initialized with questions:', questions.length);
                this.resetQuizState();
                this.appState.setState('pageState', 'quiz');
                
                // 更新URL参数，确保包含当前题目序号
                const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet?.name)?.file;
                this.urlManager.updateUrlParams('quiz', {
                    mode: mode,
                    qid: this.practiceManager.currentIndex + 1,
                    bank: currentFile
                });
                
                console.log('[setupQuizMode] Quiz mode setup completed');
            } catch (error) {
                console.error('[setupQuizMode] Failed to setup quiz mode:', error);
                this.resetAllState();
            }
        },

        // 处理浏览器前进/后退
        async handlePopState(event) {
            console.log('[handlePopState] Processing popstate event:', event);
            const urlParams = new URLSearchParams(window.location.search);
            const bankParam = urlParams.get('bank');
            const stateParam = urlParams.get('state');
            const modeParam = urlParams.get('mode');
            const practiceModeParam = urlParams.get('practiceMode');
            const countParam = urlParams.get('count');
            
            console.log('[handlePopState] URL parameters:', {
                bank: bankParam,
                state: stateParam,
                mode: modeParam,
                practiceMode: practiceModeParam,
                count: countParam
            });
            
            if (!bankParam && modeParam !== 'cross') {
                console.log('[handlePopState] No bank parameter and not cross mode, resetting state');
                this.resetAllState();
                return;
            }
            
            try {
                if (modeParam === 'cross') {
                    // 跨卷练习模式
                    if (this.appState.chosenSet?.isCrossPractice) {
                        // 已经在跨卷练习中，保持状态
                        console.log('[handlePopState] Already in cross practice mode');
                        return;
                    }
                    // 否则重置到首页
                    console.log('[handlePopState] Invalid cross practice state, resetting');
                    this.resetAllState();
                    return;
                }

                // 普通题库模式
                const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet?.name)?.file;
                console.log('[handlePopState] Checking bank change:', {
                    current: currentFile,
                    new: bankParam
                });
                
                if (bankParam !== currentFile) {
                    console.log('[handlePopState] Loading new bank data');
                    const data = await this.jsonLoader.loadFile(bankParam);
                    this.appState.setState('chosenSet', data.sets[0]);
                    // 更新统计数据
                    await this.loadBankStats(bankParam);
                }
                
                // 根据state参数切换状态
                if (stateParam) {
                    console.log('[handlePopState] Processing state:', stateParam);
                    switch(stateParam) {
                        case 'quiz':
                            if (modeParam) {
                                console.log('[handlePopState] Setting up quiz mode:', modeParam);
                                this.setupQuizMode(modeParam);
                            }
                            break;
                        case 'setDescription':
                            console.log('[handlePopState] Switching to setDescription');
                            this.appState.setState('pageState', 'setDescription');
                            break;
                        default:
                            console.log('[handlePopState] Invalid state, resetting');
                            this.resetAllState();
                    }
                } else {
                    console.log('[handlePopState] No state parameter, defaulting to setDescription');
                    this.appState.setState('pageState', 'setDescription');
                }
            } catch (error) {
                console.error('[handlePopState] Failed to handle popstate:', error);
                this.resetAllState();
            }
        },

        // 处理 URL 变化
        async handleUrlChange(event) {
            // 避免重复处理 popstate 事件
            if (event.type === 'popstate') {
                return;
            }

            console.log('[handleUrlChange] URL changed:', {
                oldURL: event.oldURL,
                newURL: event.newURL || window.location.href
            });

            await this.handleUrlParams();
        },

        // 更新URL参数
        updateUrlParams(state, params = {}) {
            console.log('[updateUrlParams] Updating URL parameters:', params);
            const url = new URL(window.location.href);
            const newParams = new URLSearchParams();
            
            // 设置页面状态
            newParams.set('state', state);
            
            // 根据不同状态设置参数
            if (state === 'quiz') {
                // 设置练习模式
                const mode = params.mode || this.navigationManager.getCurrentMode();
                newParams.set('mode', mode);
                
                // 设置题目ID
                if (params.qid) {
                    console.log('[updateUrlParams] Setting qid:', params.qid);
                    newParams.set('qid', params.qid);
                }
                
                // 保持 bank 参数
                if (params.bank) {
                    console.log('[updateUrlParams] Setting bank:', params.bank);
                    newParams.set('bank', params.bank);
                }
            } else if (state === 'setDescription' && params.bank) {
                newParams.set('bank', params.bank);
            }
            
            // 更新URL，不刷新页面
            url.search = newParams.toString();
            window.history.pushState({
                state,
                params: Object.fromEntries(newParams.entries())
            }, '', url);
            console.log('[updateUrlParams] URL updated with params:', Object.fromEntries(newParams.entries()));
        },

        // 重置所有状态
        resetAllState() {
            console.log('[resetAllState] Resetting all state');
            
            // 重置 AppState
            this.appState.resetState();
            
            // 重置练习相关状态
            this.practiceManager?.reset();
            this.resetQuizState();
            
            // 重置编辑相关状态
            this.questionManager?.clearEditHistory();
            this.isEditing = false;
            this.editingField = null;
            this.editingContent = '';
            this.showExportButton = false;
            
            // 重置 URL 参数
            this.urlManager.updateUrlParams('home', {});
            
            // 重置其他状态
            this.showUnsavedModal = false;
            this.showTagsModal = false;
            this.selectedTags = [];
            
            console.log('[resetAllState] State reset completed');
        },

        // 重置答题状态
        resetQuizState() {
            console.log('[resetQuizState] Resetting quiz state');
            this.chosenAnswer = '';
            this.chosenAnswers = [];
            this.shortAnswerText = '';
            this.fillInAnswers = [];
            if (this.currentSessionCompleted) {
                this.currentSessionCompleted.clear();
            } else {
                this.currentSessionCompleted = new Set();
            }
            this.showAnswer = false;
            console.log('[resetQuizState] Quiz state reset completed');
        },

        // 全局Alt+H返回上一级快捷键
        handleGlobalBackShortcut(e) {
            const tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if (e.altKey && (e.key === 'h' || e.key === 'H')) {
                console.log('[handleGlobalBackShortcut] Alt+H detected, pageState:', this.appState.pageState);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                switch (this.appState.pageState) {
                    case 'quiz':
                    case 'orderQuiz':
                    case 'randomQuiz':
                        if (!this.isEditing) {
                            console.log('[handleGlobalBackShortcut] Calling goBack() from quiz mode');
                            this.goBack();
                        }
                        break;
                    case 'setDescription':
                        console.log('[handleGlobalBackShortcut] Calling goHome() from setDescription');
                        this.goHome();
                        break;
                    case 'home':
                        // 在首页不做任何操作
                        break;
                }
                return false;
            }
        },

        // 返回上一页
        goBack() {
            console.log('[goBack] Called, pageState:', this.appState.pageState, 'isEditing:', this.isEditing);
            if (this.isEditing) {
                if (this.questionManager.checkUnsavedChanges()) {
                    this.showUnsavedDialog('setDescription');
                    return;
                } else {
                    this.exitEntireEditMode();
                }
            }
            
            // 获取当前题库文件名
            const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet?.name)?.file;
            console.log('[goBack] Current bank file:', currentFile);
            
            // 返回题库描述页面时保持bank参数
            console.log('[goBack] updatePageState to setDescription');
            this.updatePageState('setDescription', { bank: currentFile });
        },

        // 返回首页
        goHome() {
            console.log('[goHome] Called, pageState:', this.appState.pageState);
            if (this.isEditing) {
                this.exitEntireEditMode();
            }
            // 清除所有状态和URL参数
            this.appState.setState('chosenSet', null);
            this.questionManager.clearEditHistory();
            this.showExportButton = false;
            this.updatePageState('home');
        },

        // 获取题目所属的题库
        getBankByQuestion(question) {
            return this.filteredBankDistribution.find(
                bank => bank.questions.some(q => q.uniqueId === question.uniqueId)
            );
        },

        // 开始跨卷练习
        async startCrossPractice() {
            if (!this.canStartCrossPractice) return;
            
            try {
                this.isLoading = true;
                
                // 先加载所有需要的题库
                const banksToLoad = this.filteredBankDistribution
                    .filter(bank => !this.jsonLoader.loadedBanks.has(bank.file))
                    .map(bank => bank.file);
                
                if (banksToLoad.length > 0) {
                    await this.jsonLoader.loadMultipleBanks(banksToLoad);
                }

                // 收集所有符合条件的题目
                let allQuestions = [];
                this.filteredBankDistribution.forEach(bank => {
                    const bankQuestions = this.jsonLoader.getQuestionsFromBank(bank.file)
                        .filter(q => this.selectedQuestionTypes.includes(q.type));
                    allQuestions = allQuestions.concat(bankQuestions);
                });

                if (allQuestions.length === 0) {
                    throw new Error('没有找到符合条件的题目');
                }

                if (this.crossPracticeCount > allQuestions.length) {
                    this.crossPracticeCount = allQuestions.length;
                }

                // 根据模式排序题目
                if (this.crossPracticeMode === 'error-rate') {
                    allQuestions.sort((a, b) => {
                        const statsA = this.storageManager.getQuestionStats(this.getBankByQuestion(a).file, a.uniqueId);
                        const statsB = this.storageManager.getQuestionStats(this.getBankByQuestion(b).file, b.uniqueId);
                        const errorRateA = statsA ? 1 - (statsA.correct / statsA.attempts) : 1;
                        const errorRateB = statsB ? 1 - (statsB.correct / statsB.attempts) : 1;
                        return errorRateB - errorRateA;
                    });
                } else {
                    // 随机模式
                    allQuestions = this.shuffleArray(allQuestions);
                }

                // 选择指定数量的题目
                const selectedQuestions = allQuestions.slice(0, this.crossPracticeCount);

                // 为每个题目添加来源题库信息
                const questionsWithSource = selectedQuestions.map(q => ({
                    ...q,
                    sourceBank: this.getBankByQuestion(q).name || '未知题库'
                }));

                // 创建虚拟题库集合
                const virtualSet = {
                    id: 'cross-practice-' + Date.now(),
                    name: '跨卷练习',
                    description: `从${this.filteredBankDistribution.length}个题库中选择的${this.crossPracticeCount}道题目\n\n包含题库：\n${this.filteredBankDistribution.map(bank => `- ${bank.name} (${bank.questionCount}题)`).join('\n')}`,
                    isCrossPractice: true
                };

                // 初始化练习
                this.appState.setState('chosenSet', virtualSet);
                this.practiceManager.initPractice(questionsWithSource, this.crossPracticeMode);
                this.showCrossPracticeModal = false;
                this.updatePageState('quiz', { 
                    mode: 'cross',
                    practiceMode: this.crossPracticeMode,
                    count: this.crossPracticeCount
                });
            } catch (error) {
                console.error('Failed to start cross practice:', error);
                alert(error.message || '启动跨卷练习失败');
            } finally {
                this.isLoading = false;
            }
        },

        // 数组随机打乱
        shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        },

        // 验证题目数量
        handleQuestionInput(event) {
            const rawValue = event.target.value;
            console.log('[handleQuestionInput] Input event:', {
                type: event.type,
                rawValue: rawValue,
                currentCount: this.crossPracticeCount
            });

            let value = parseInt(rawValue);
            
            // 允许输入框暂时为空或大于最大值
            if (rawValue === '' || !isNaN(value)) {
                this.crossPracticeCount = rawValue;
            }
        },

        // 在失去焦点时验证和更新值
        handleQuestionBlur() {
            console.log('[handleQuestionBlur] Validating value:', this.crossPracticeCount);
            
            let value = parseInt(this.crossPracticeCount);
            if (isNaN(value) || value < 1) {
                value = 1;
            } else if (value > this.maxQuestionCount) {
                value = this.maxQuestionCount;
            }
            
            this.crossPracticeCount = value;
            this.updateBankDistribution();
        },

        // 更新题库分布
        updateBankDistribution() {
            console.log('[updateBankDistribution] Updating with count:', this.crossPracticeCount);
            
            const totalRequestedQuestions = this.crossPracticeCount;
            let remainingQuestions = totalRequestedQuestions;
            
            // 首先计算每个题库实际可用的题目数量
            this.filteredBankDistribution.forEach(bank => {
                const bankQuestions = this.jsonLoader.getQuestionsFromBank(bank.file)
                    .filter(q => this.selectedQuestionTypes.includes(q.type));
                bank.availableQuestions = bankQuestions.length;
                console.log(`[updateBankDistribution] Bank ${bank.name} has ${bank.availableQuestions} available questions`);
            });

            // 根据策略计算每个题库的题目数
            if (this.crossPracticeStrategy === 'error-rate') {
                // 根据错误率和可用题目数分配
                let totalWeight = 0;
                this.filteredBankDistribution.forEach(bank => {
                    const errorRate = 1 - (bank.stats.accuracy || 0) / 100;
                    bank.weight = errorRate * bank.availableQuestions;
                    totalWeight += bank.weight;
                });

                this.filteredBankDistribution.forEach(bank => {
                    const proportion = bank.weight / totalWeight;
                    bank.questionCount = Math.min(
                        Math.round(totalRequestedQuestions * proportion),
                        bank.availableQuestions
                    );
                    remainingQuestions -= bank.questionCount;
                });
            } else {
                // 平均分配题目，但考虑每个题库的可用题目数
                const banksWithQuestions = this.filteredBankDistribution.filter(bank => bank.availableQuestions > 0);
                let avgQuestions = Math.floor(remainingQuestions / banksWithQuestions.length);

                this.filteredBankDistribution.forEach(bank => {
                    if (bank.availableQuestions > 0) {
                        bank.questionCount = Math.min(avgQuestions, bank.availableQuestions);
                        remainingQuestions -= bank.questionCount;
                    } else {
                        bank.questionCount = 0;
                    }
                });
            }

            // 处理剩余的题目（分配给还有可用题目的题库）
            if (remainingQuestions > 0) {
                for (let bank of this.filteredBankDistribution) {
                    const canAddMore = bank.availableQuestions - bank.questionCount;
                    if (canAddMore > 0) {
                        const toAdd = Math.min(remainingQuestions, canAddMore);
                        bank.questionCount += toAdd;
                        remainingQuestions -= toAdd;
                        if (remainingQuestions === 0) break;
                    }
                }
            }

            // 如果总的可用题目数小于请求的题目数，更新 crossPracticeCount
            const totalAvailable = this.filteredBankDistribution.reduce((sum, bank) => sum + bank.questionCount, 0);
            if (totalAvailable < totalRequestedQuestions) {
                console.log(`[updateBankDistribution] Adjusting requested count from ${totalRequestedQuestions} to ${totalAvailable} due to availability`);
                this.crossPracticeCount = totalAvailable;
            }

            console.log('[updateBankDistribution] Updated distribution:', this.filteredBankDistribution);
        },
        backToHome() {
            if (this.showAnswer || confirm('确定要退出练习吗？当前进度将不会保存。')) {
                this.updatePageState('home');
            }
        },

        // 复制当前题目链接
        async copyCurrentLink() {
            try {
                const url = new URL(window.location.href);
                const params = new URLSearchParams(url.search);
                
                // 获取当前题目在原题库中的序号（从1开始）
                const currentQuestion = this.practiceManager.getCurrentQuestion();
                let questionSequenceNumber = 1;
                
                // 在原题库中查找当前题目的序号，通过内容匹配
                if (currentQuestion) {
                    const originalQuestions = this.jsonLoader.questions;
                    // 使用题目内容和类型来匹配，确保找到正确的题目
                    questionSequenceNumber = originalQuestions.findIndex(q => 
                        q.content === currentQuestion.content && 
                        q.type === currentQuestion.type
                    ) + 1;

                    // 如果没找到匹配的题目（这种情况不应该发生），使用默认值
                    if (questionSequenceNumber <= 0) {
                        console.error('Failed to find matching question in original bank:', currentQuestion);
                        questionSequenceNumber = 1;
                    }
                }
                
                // 确保当前状态已经同步到URL，但使用原题库中的序号
                const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet?.name)?.file;
                this.urlManager.updateUrlParams('quiz', {
                    mode: 'all', // 总是使用全部练习模式的链接
                    qid: questionSequenceNumber,
                    bank: currentFile
                });
                
                // 获取更新后的URL
                const finalUrl = window.location.href;
                await navigator.clipboard.writeText(finalUrl);
                
                // 显示成功提示
                const toast = document.createElement('div');
                toast.textContent = '链接已复制到剪贴板';
                toast.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 4px;
                    z-index: 1000;
                `;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
            } catch (error) {
                console.error('Failed to copy link:', error);
                alert('复制链接失败');
            }
        },
        saveCurrentEdit() {
            this.questionManager.saveCurrentEdit();
            // 更新修改计数
            this.modifiedCount = this.questionManager.getModifiedQuestions().length;
            // 导出修改后的JSON
            this.exportModifiedData();
        },
        // 获取当前练习模式
        getCurrentMode() {
            if (!this.practiceManager) return 'all';
            if (this.isEditing) return 'preview';
            if (this.practiceManager.mode === 'random') return 'random';
            if (this.practiceManager.mode === 'error-rate') return 'wrong';
            return 'all';
        },
        // 获取当前题目ID
        getCurrentQuestionId() {
            if (this.practiceManager && this.practiceManager.questions) {
                // 直接返回当前题目的序号（从1开始）
                return this.practiceManager.currentIndex + 1;
            }
            return null;
        },
        // 初始化键盘事件监听
        initKeyboardEvents() {
            this.$nextTick(() => {
                if (this.appState.pageState === 'setDescription') {
                    console.log('Page mounted in setDescription state');
                    const buttons = document.querySelectorAll('.mode-btn');
                    console.log('Initial mode buttons state:', {
                        totalButtons: buttons.length,
                        buttonElements: Array.from(buttons).map(btn => ({
                            text: btn.textContent.trim(),
                            tabIndex: btn.tabIndex,
                            hasClickHandler: btn.onclick !== null,
                            hasKeydownHandler: btn.onkeydown !== null
                        }))
                    });
                }
            });

            // 添加浏览器前进/后退按钮支持
            window.addEventListener('popstate', this.handlePopState);

            // 添加 URL 变化监听
            window.addEventListener('hashchange', this.handleUrlChange);
            window.addEventListener('popstate', this.handleUrlChange);

            // 添加全局Alt+H返回快捷键
            window.addEventListener('keydown', this.handleGlobalBackShortcut);
        },
    }
});

// Create a function to initialize the app
const initializeApp = async () => {
    try {
        const mountedApp = app.mount('#app');
        console.log('Vue app mounted successfully');
        return mountedApp;
    } catch (error) {
        console.error('Failed to mount Vue app:', error);
        throw error;
    }
};

export { app, initializeApp };