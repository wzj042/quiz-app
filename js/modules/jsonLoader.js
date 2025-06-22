// JSON加载器模块
export default class JsonLoader {
    constructor() {
        this.questions = [];
        this.sets = [];
    }

    // 加载JSON文件
    async loadFile(fileName) {
        try {
            const resp = await fetch(`assets/${fileName}`);
            const jsonData = await resp.json();

            // // 数据校验
            // if (!this.validateData(jsonData)) {
            //     throw new Error(`${fileName} 数据格式错误`);
            // }

            // 处理题目内容 - 使用marked渲染Markdown
            jsonData.questions = jsonData.questions.map(q => ({
                ...q,
                content: marked.parse(q.content || ''),
                analysis: q.analysis ? marked.parse(q.analysis) : ''
            }));

            this.questions = jsonData.questions;
            this.sets = jsonData.sets;

            return {
                questions: this.questions,
                sets: this.sets
            };
        } catch(e) {
            throw new Error(`加载 ${fileName} 失败：${e.message}`);
        }
    }

    // 数据格式验证
    validateData(data) {
        // 基本结构验证
        if (!Array.isArray(data.questions) || !Array.isArray(data.sets)) {
            return false;
        }

        // 题目格式验证
        const validQuestionTypes = ['single-choice', 'multiple-choice', 'short-answer'];
        const isValidQuestion = q => {
            return q.uniqueId && 
                   q.content && 
                   validQuestionTypes.includes(q.type) &&
                   Array.isArray(q.correct_answer) &&
                   q.correct_answer.length > 0;
        };

        // 检查每个题目的格式
        if (!data.questions.every(isValidQuestion)) {
            return false;
        }

        // 检查每个set的格式
        const isValidSet = set => {
            return set.id && 
                   set.name && 
                   Array.isArray(set.questionIds) &&
                   set.questionIds.every(id => 
                       data.questions.some(q => q.uniqueId === id)
                   );
        };

        return data.sets.every(isValidSet);
    }

    // 根据set获取题目列表
    getQuestionsBySet(setId) {
        const set = this.sets.find(s => s.id === setId);
        if (!set) return [];
        
        const idSet = new Set(set.questionIds);
        return this.questions.filter(q => idSet.has(q.uniqueId));
    }

    // 按错误率排序题目
    sortQuestionsByErrorRate(questions, getCompletionFunc) {
        return [...questions].sort((a, b) => {
            const statsA = getCompletionFunc(a.uniqueId);
            const statsB = getCompletionFunc(b.uniqueId);
            
            // 未完成的题目排在前面
            if (!statsA) return -1;
            if (!statsB) return 1;
            
            // 错误的题目排在前面
            if (!statsA.isCorrect && statsB.isCorrect) return -1;
            if (statsA.isCorrect && !statsB.isCorrect) return 1;
            
            // 按完成时间排序
            return new Date(statsB.completedAt) - new Date(statsA.completedAt);
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