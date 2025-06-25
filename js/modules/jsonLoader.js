// JSON加载器模块
export default class JsonLoader {
    constructor() {
        this.questions = [];
        this.sets = [];
        this.loadedFile = null;
        this.validQuestionTypes = ['single-choice', 'multiple-choice', 'short-answer', 'fill-in-blank'];
        this.allTags = new Map(); // 存储所有tags及其出现次数
    }

    // 生成唯一ID
    generateUniqueId(setId, index, content) {
        // 使用内容的哈希值来确保唯一性
        const contentHash = this.hashString(content);
        return `${setId}-${contentHash}-${String(index + 1).padStart(3, '0')}`;
    }

    // 简单的字符串哈希函数
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).substring(0, 8);
    }

    // 处理题目数据，添加唯一ID
    processQuestions(questions, setId) {
        return questions.map((q, index) => {
            // 生成新的唯一ID
            const uniqueId = this.generateUniqueId(setId, index, q.content);
            
            // 清理和验证内容
            const cleanedQuestion = this.sanitizeQuestion(q);
            
            // 返回新对象，保留原有属性但使用新ID
            return {
                ...cleanedQuestion,
                uniqueId
            };
        });
    }

    // 清理题目内容
    sanitizeQuestion(question) {
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
    }

    // 清理文本内容
    sanitizeText(text) {
        if (!text) return '';
        
        // 移除可能的XSS内容
        return text
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+="[^"]*"/g, '')
            .replace(/javascript:/gi, '')
            .trim();
    }

    // 加载JSON文件
    async loadFile(fileName) {
        try {
            // 检查是否已经加载
            if (this.loadedFile === fileName) {
                return {
                    questions: this.questions,
                    sets: this.sets
                };
            }

            const response = await fetch(`assets/${fileName}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // 验证数据格式
            if (!this.validateData(data)) {
                throw new Error('Invalid data format');
            }
            
            // 处理sets，确保每个set都有id和category
            this.sets = data.sets.map((set, index) => {
                const setId = set.id || `set-${String(index + 1).padStart(3, '0')}`;
                // 更新tags统计
                if (set.tags && Array.isArray(set.tags)) {
                    set.tags.forEach(tag => {
                        this.allTags.set(tag, (this.allTags.get(tag) || 0) + 1);
                    });
                }
                return {
                    ...set,
                    id: setId,
                    name: this.sanitizeText(set.name),
                    description: set.description ? this.sanitizeText(set.description) : '',
                    category: set.category ? this.sanitizeText(set.category) : '未分类',
                    tags: set.tags || []
                };
            });

            // 处理questions，为每个题目生成唯一ID
            this.questions = data.questions.map((q, index) => {
                // 默认放入第一个set
                const setId = this.sets[0].id;
                const uniqueId = this.generateUniqueId(setId, index, q.content);
                const cleanedQuestion = this.sanitizeQuestion(q);
                return {
                    ...cleanedQuestion,
                    uniqueId
                };
            });

            // 更新加载状态
            this.loadedFile = fileName;

            return {
                questions: this.questions,
                sets: this.sets
            };
        } catch (e) {
            console.error('加载题目文件失败:', e);
            throw e;
        }
    }

    // 数据格式验证
    validateData(data) {
        try {
            // 基本结构验证
            if (!Array.isArray(data.questions) || !Array.isArray(data.sets)) {
                return false;
            }

            // 题目格式验证
            const isValidQuestion = q => {
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
            };

            // 检查每个题目的格式
            if (!data.questions.every(isValidQuestion)) {
                return false;
            }

            // 检查每个set的格式
            const isValidSet = set => {
                return set.name && typeof set.name === 'string';
            };

            return data.sets.every(isValidSet);
        } catch (error) {
            console.error('Data validation failed:', error);
            return false;
        }
    }

    // 根据set获取题目列表
    getQuestionsBySet(setId) {
        return this.questions.filter(q => q.uniqueId.startsWith(setId));
    }

    // 按错误率排序题目
    sortQuestionsByErrorRate(questions, getCompletion) {
        return [...questions].sort((a, b) => {
            const completionA = getCompletion(a.uniqueId);
            const completionB = getCompletion(b.uniqueId);
            
            const errorRateA = completionA ? 
                (completionA.errors / Math.max(1, completionA.attempts)) : 0;
            const errorRateB = completionB ? 
                (completionB.errors / Math.max(1, completionB.attempts)) : 0;
            
            return errorRateB - errorRateA; // 错误率高的排前面
        });
    }

    // 随机打乱题目顺序
    shuffleQuestions(questions) {
        const shuffled = [...questions];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // 按分类对题库进行分组
    groupSetsByCategory(sets) {
        const groups = {};
        sets.forEach(set => {
            const category = set.category || '未分类';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(set);
        });
        
        // 对每个分类内的题库按名称排序
        for (const category in groups) {
            groups[category].sort((a, b) => a.name.localeCompare(b.name));
        }
        
        // 返回排序后的分类列表
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }

    // 获取所有tags及其出现次数，按出现次数降序排序
    getAllTags() {
        return Array.from(this.allTags.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => ({ tag, count }));
    }

    // 获取前N个最常用的tags
    getTopTags(n = 3) {
        return this.getAllTags().slice(0, n);
    }

    // 根据选中的tags筛选sets
    filterSetsByTags(sets, selectedTags) {
        if (!selectedTags || selectedTags.length === 0) return sets;
        return sets.filter(set => 
            selectedTags.every(tag => set.tags && set.tags.includes(tag))
        );
    }
} 