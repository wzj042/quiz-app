// JSON加载器模块
export default class JsonLoader {
    constructor() {
        this.questions = [];
        this.sets = [];
        this.loadedFile = null;
        this.validQuestionTypes = ['single-choice', 'multiple-choice', 'short-answer', 'fill-in-blank'];
        this.allTags = new Map(); // 存储所有tags及其出现次数
        this.loadedBanks = new Map(); // 存储已加载的题库
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1秒
        this.maxLoadTime = 5000; // 5秒
        this.maxShuffleAttempts = 100;
    }

    // 生成唯一ID
    generateUniqueId(setId, index, content) {
        try {
            if (!setId || typeof content !== 'string') {
                throw new Error('Invalid parameters for generateUniqueId');
            }
            // 使用内容的哈希值来确保唯一性
            const contentHash = this.hashString(content);
            return `${setId}-${contentHash}-${String(index + 1).padStart(3, '0')}`;
        } catch (error) {
            console.error('[generateUniqueId] Error:', error);
            // 生成一个基于时间戳的备用ID
            return `${setId}-${Date.now()}-${String(index + 1).padStart(3, '0')}`;
        }
    }

    // 简单的字符串哈希函数
    hashString(str) {
        try {
            if (typeof str !== 'string') {
                throw new Error('Input must be a string');
            }
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash).toString(16).substring(0, 8);
        } catch (error) {
            console.error('[hashString] Error:', error);
            // 返回一个基于时间戳的备用哈希
            return Date.now().toString(16).substring(0, 8);
        }
    }

    // 处理题目数据，添加唯一ID
    processQuestions(questions, setId) {
        if (!Array.isArray(questions) || !setId) {
            console.error('[processQuestions] Invalid parameters:', { questions, setId });
            return [];
        }

        return questions.map((q, index) => {
            try {
                // 生成新的唯一ID
                const uniqueId = this.generateUniqueId(setId, index, q.content || '');
                
                // 清理和验证内容
                const cleanedQuestion = this.sanitizeQuestion(q);
                
                // 返回新对象，保留原有属性但使用新ID
                return {
                    ...cleanedQuestion,
                    uniqueId
                };
            } catch (error) {
                console.error(`[processQuestions] Error processing question ${index}:`, error);
                // 返回一个最小可用的问题对象
                return {
                    content: '加载失败的题目',
                    type: 'short-answer',
                    correct_answer: ['无法加载'],
                    uniqueId: this.generateUniqueId(setId, index, 'error')
                };
            }
        });
    }

    // 清理题目内容
    sanitizeQuestion(question) {
        try {
            if (!question || typeof question !== 'object') {
                throw new Error('Invalid question object');
            }

            const cleaned = { ...question };
            
            // 清理文本内容
            cleaned.content = this.sanitizeText(cleaned.content);
            if (cleaned.analysis) {
                cleaned.analysis = this.sanitizeText(cleaned.analysis);
            }

            // 清理选项
            if (cleaned.options) {
                cleaned.options = cleaned.options.map(opt => this.sanitizeText(opt));
            }

            // 清理答案
            if (cleaned.correct_answer) {
                cleaned.correct_answer = cleaned.correct_answer.map(ans => this.sanitizeText(ans));
            }

            return cleaned;
        } catch (error) {
            console.error('[sanitizeQuestion] Error:', error);
            // 返回一个最小可用的问题对象
            return {
                content: '无效的题目',
                type: 'short-answer',
                correct_answer: ['无法加载']
            };
        }
    }

    // 清理文本内容
    sanitizeText(text) {
        try {
            if (!text) return '';
            
            // 移除可能的XSS内容
            return text
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+="[^"]*"/g, '')
                .replace(/javascript:/gi, '')
                .trim();
        } catch (error) {
            console.error('[sanitizeText] Error:', error);
            return '';
        }
    }

    // 加载JSON文件
    async loadFile(fileName, storageManager = null) {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.maxLoadTime);

                const response = await fetch(`assets/${fileName}`, {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                // 验证数据格式
                if (!this.validateData(data)) {
                    throw new Error('Invalid data format');
                }

                // 处理题目，添加唯一ID
                const setId = fileName.replace('.json', '');
                data.questions = this.processQuestions(data.questions || [], setId);
                
                // 更新当前加载的题库
                this.questions = data.questions;
                this.sets = data.sets || [];
                
                // 缓存题库数据
                this.loadedBanks.set(fileName, {
                    questions: data.questions,
                    sets: data.sets || []
                });

                // Set current setId in storage manager if available
                if (storageManager && typeof storageManager.setCurrentSetId === 'function') {
                    storageManager.setCurrentSetId(setId);
                    console.log('[loadFile] Updated current setId in storage:', setId);
                }
                
                return data;
            } catch (error) {
                console.error(`[loadFile] Failed to load ${fileName} (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        throw new Error(`Failed to load ${fileName} after ${this.maxRetries} attempts`);
    }

    // 从指定题库获取题目
    getQuestionsFromBank(fileName, storageManager = null) {
        try {
            // Set current setId in storage manager if available
            if (storageManager && typeof storageManager.setCurrentSetId === 'function') {
                const setId = fileName.replace('.json', '');
                storageManager.setCurrentSetId(setId);
                console.log('[getQuestionsFromBank] Updated current setId in storage:', setId);
            }

            // 如果题库已加载，从缓存获取
            if (this.loadedBanks.has(fileName)) {
                return this.loadedBanks.get(fileName).questions;
            }
            
            // 如果是当前加载的题库
            if (this.questions.length > 0 && this.sets.length > 0) {
                return this.questions;
            }
            
            return [];
        } catch (error) {
            console.error('[getQuestionsFromBank] Error:', error);
            return [];
        }
    }

    // 异步加载多个题库
    async loadMultipleBanks(fileNames, storageManager = null) {
        if (!Array.isArray(fileNames)) {
            console.error('[loadMultipleBanks] Invalid fileNames:', fileNames);
            return [];
        }

        const loadPromises = fileNames.map(fileName => 
            Promise.race([
                this.loadFile(fileName, storageManager)
                    .then(data => ({
                        fileName,
                        data
                    }))
                    .catch(error => {
                        console.error(`[loadMultipleBanks] Error loading bank ${fileName}:`, error);
                        return null;
                    }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), this.maxLoadTime)
                )
            ])
        );

        try {
            const results = await Promise.all(loadPromises);
            return results.filter(result => result !== null);
        } catch (error) {
            console.error('[loadMultipleBanks] Error loading banks:', error);
            return [];
        }
    }

    // 设置当前数据
    async setCurrentData(data, fileName = null, storageManager = null) {
        try {
            if (!data || !data.sets || !data.questions) {
                throw new Error('Invalid data structure');
            }

            console.log('[JsonLoader] Setting current data:', {
                fileName,
                setsCount: data.sets?.length,
                questionsCount: data.questions?.length
            });

            // Set current setId in storage manager if available
            if (fileName && storageManager && typeof storageManager.setCurrentSetId === 'function') {
                const setId = fileName.replace('.json', '');
                storageManager.setCurrentSetId(setId);
                console.log('[setCurrentData] Updated current setId in storage:', setId);
            }

            this.questions = data.questions;
            this.sets = data.sets;
            
            // 更新缓存
            if (fileName) {
                this.loadedBanks.set(fileName, {
                    questions: data.questions,
                    sets: data.sets
                });
            }
            
            return true;
        } catch (error) {
            console.error('[setCurrentData] Error:', error);
            return false;
        }
    }

    // 数据格式验证
    validateData(data) {
        try {
            // 基本结构验证
            if (!data || !Array.isArray(data.questions) || !Array.isArray(data.sets)) {
                return false;
            }

            // 题目格式验证
            const isValidQuestion = q => {
                try {
                    if (!q.content || !this.validQuestionTypes.includes(q.type)) {
                        return false;
                    }

                    // 选择题特殊验证
                    if (q.type === 'single-choice' || q.type === 'multiple-choice') {
                        return Array.isArray(q.options) && 
                               q.options.length > 0 &&
                               Array.isArray(q.correct_answer) &&
                               q.correct_answer.length > 0 &&
                               q.correct_answer.every(ans => q.options.includes(ans));
                    }

                    // 填空题特殊验证
                    if (q.type === 'fill-in-blank') {
                        return Array.isArray(q.blanks) &&
                               Array.isArray(q.correct_answer) &&
                               q.blanks.length === q.correct_answer.length &&
                               q.blanks.length > 0;
                    }

                    // 简答题特殊验证
                    if (q.type === 'short-answer') {
                        return Array.isArray(q.correct_answer) &&
                               q.correct_answer.length > 0;
                    }

                    return true;
                } catch (error) {
                    console.error('[validateData] Error validating question:', error);
                    return false;
                }
            };

            // 检查每个题目的格式
            const validQuestions = data.questions.every(isValidQuestion);
            if (!validQuestions) {
                console.error('[validateData] Invalid question format detected');
                return false;
            }

            // 检查每个set的格式
            const isValidSet = set => {
                try {
                    return set && set.name && typeof set.name === 'string';
                } catch (error) {
                    console.error('[validateData] Error validating set:', error);
                    return false;
                }
            };

            const validSets = data.sets.every(isValidSet);
            if (!validSets) {
                console.error('[validateData] Invalid set format detected');
                return false;
            }

            return true;
        } catch (error) {
            console.error('[validateData] Data validation failed:', error);
            return false;
        }
    }

    // 根据set获取题目列表
    getQuestionsBySet(setId) {
        try {
            if (!setId) {
                console.error('[getQuestionsBySet] Invalid setId');
                return [];
            }
            return this.questions.filter(q => q.uniqueId.startsWith(setId));
        } catch (error) {
            console.error('[getQuestionsBySet] Error:', error);
            return [];
        }
    }

    // 按错误率排序题目
    sortQuestionsByErrorRate(questions, getCompletion) {
        try {
            if (!Array.isArray(questions) || typeof getCompletion !== 'function') {
                console.error('[sortQuestionsByErrorRate] Invalid parameters');
                return [...questions];
            }

            return [...questions].sort((a, b) => {
                try {
                    const completionA = getCompletion(a.uniqueId);
                    const completionB = getCompletion(b.uniqueId);
                    
                    const errorRateA = completionA ? 
                        (completionA.errors / Math.max(1, completionA.attempts)) : 0;
                    const errorRateB = completionB ? 
                        (completionB.errors / Math.max(1, completionB.attempts)) : 0;
                    
                    return errorRateB - errorRateA; // 错误率高的排前面
                } catch (error) {
                    console.error('[sortQuestionsByErrorRate] Error comparing questions:', error);
                    return 0;
                }
            });
        } catch (error) {
            console.error('[sortQuestionsByErrorRate] Error:', error);
            return [...questions];
        }
    }

    // 随机打乱题目顺序
    shuffleQuestions(questions) {
        try {
            if (!Array.isArray(questions)) {
                console.error('[shuffleQuestions] Invalid questions array');
                return [...questions];
            }

            const original = [...questions];
            let attempts = 0;
            let shuffled;

            do {
                shuffled = [...questions];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                attempts++;

                // 检查是否真的打乱了（避免完全相同的顺序）
                let isDifferent = false;
                for (let i = 0; i < shuffled.length; i++) {
                    if (shuffled[i] !== original[i]) {
                        isDifferent = true;
                        break;
                    }
                }

                if (isDifferent || attempts >= this.maxShuffleAttempts) {
                    break;
                }
            } while (attempts < this.maxShuffleAttempts);

            if (attempts >= this.maxShuffleAttempts) {
                console.warn('[shuffleQuestions] Max shuffle attempts reached');
            }

            return shuffled;
        } catch (error) {
            console.error('[shuffleQuestions] Error:', error);
            return [...questions];
        }
    }

    // 按分类对题库进行分组
    groupSetsByCategory(sets) {
        try {
            if (!Array.isArray(sets)) {
                console.error('[groupSetsByCategory] Invalid sets array');
                return [];
            }

            const groups = {};
            sets.forEach(set => {
                try {
                    const category = set.category || '未分类';
                    if (!groups[category]) {
                        groups[category] = [];
                    }
                    groups[category].push(set);
                } catch (error) {
                    console.error('[groupSetsByCategory] Error processing set:', error);
                }
            });
            
            // 对每个分类内的题库按名称排序
            for (const category in groups) {
                try {
                    groups[category].sort((a, b) => {
                        const nameA = a.name || '';
                        const nameB = b.name || '';
                        return nameA.localeCompare(nameB);
                    });
                } catch (error) {
                    console.error(`[groupSetsByCategory] Error sorting category ${category}:`, error);
                }
            }
            
            // 返回排序后的分类列表
            return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
        } catch (error) {
            console.error('[groupSetsByCategory] Error:', error);
            return [];
        }
    }

    // 获取所有tags及其出现次数，按出现次数降序排序
    getAllTags() {
        try {
            return Array.from(this.allTags.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([tag, count]) => ({ tag, count }));
        } catch (error) {
            console.error('[getAllTags] Error:', error);
            return [];
        }
    }

    // 获取前N个最常用的tags
    getTopTags(n = 3) {
        try {
            if (typeof n !== 'number' || n < 0) {
                console.error('[getTopTags] Invalid n:', n);
                n = 3;
            }
            return this.getAllTags().slice(0, n);
        } catch (error) {
            console.error('[getTopTags] Error:', error);
            return [];
        }
    }

    // 根据选中的tags筛选sets
    filterSetsByTags(sets, selectedTags) {
        try {
            if (!Array.isArray(sets)) {
                console.error('[filterSetsByTags] Invalid sets array');
                return [];
            }

            if (!Array.isArray(selectedTags) || selectedTags.length === 0) {
                return sets;
            }

            return sets.filter(set => {
                try {
                    return selectedTags.every(tag => 
                        set.tags && Array.isArray(set.tags) && set.tags.includes(tag)
                    );
                } catch (error) {
                    console.error('[filterSetsByTags] Error filtering set:', error);
                    return false;
                }
            });
        } catch (error) {
            console.error('[filterSetsByTags] Error:', error);
            return [];
        }
    }
} 