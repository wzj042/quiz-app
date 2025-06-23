// JSON加载器模块
export default class JsonLoader {
    constructor() {
        this.questions = [];
        this.sets = [];
    }

    // 生成唯一ID
    generateUniqueId(setId, index) {
        return `${setId}-q${String(index + 1).padStart(3, '0')}`;
    }

    // 处理题目数据，添加唯一ID
    processQuestions(questions, setId) {
        return questions.map((q, index) => {
            // 生成新的唯一ID
            const uniqueId = this.generateUniqueId(setId, index);
            
            // 返回新对象，保留原有属性但使用新ID
            return {
                ...q,
                uniqueId
            };
        });
    }

    // 加载JSON文件
    async loadFile(fileName) {
        try {
            const response = await fetch(`assets/${fileName}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // 处理sets，确保每个set都有id
            this.sets = data.sets.map((set, index) => {
                const setId = set.id || `set-${String(index + 1).padStart(3, '0')}`;
                return {
                    ...set,
                    id: setId
                };
            });

            // 处理questions，为每个题目生成唯一ID
            this.questions = data.questions.map((q, index) => {
                // 默认放入第一个set
                const setId = this.sets[0].id;
                const uniqueId = this.generateUniqueId(setId, index);
                return {
                    ...q,
                    uniqueId
                };
            });

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
        // 基本结构验证
        if (!Array.isArray(data.questions) || !Array.isArray(data.sets)) {
            return false;
        }

        // 题目格式验证
        const validQuestionTypes = ['single-choice', 'multiple-choice', 'short-answer', 'fill-in-blank'];
        const isValidQuestion = q => {
            if (!q.uniqueId || !q.content || !validQuestionTypes.includes(q.type)) {
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
            return set.id && set.name;
        };

        return data.sets.every(isValidSet);
    }

    // 根据set获取题目列表
    getQuestionsBySet(setId) {
        return this.questions;
    }

    // 按错误率排序题目
    sortQuestionsByErrorRate(questions, getCompletion) {
        return [...questions].sort((a, b) => {
            const completionA = getCompletion(a.uniqueId);
            const completionB = getCompletion(b.uniqueId);
            
            const errorRateA = completionA ? 
                (completionA.totalErrors / Math.max(1, completionA.totalAttempts)) : 0;
            const errorRateB = completionB ? 
                (completionB.totalErrors / Math.max(1, completionB.totalAttempts)) : 0;
            
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
} 