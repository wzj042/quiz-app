// 练习状态管理模块
export default class PracticeManager {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.currentMode = null; // 'sequence', 'error-rate', 'random'
        this.currentIndex = 0;
        this.questions = [];
        this.answers = new Map(); // 存储当前练习的答案
        this.isPreviewMode = false;
    }

    // 初始化练习
    initPractice(questions, mode) {
        this.questions = [...questions];
        this.currentMode = mode;
        this.currentIndex = 0;
        this.answers.clear();
        
        // 根据模式排序题目
        switch (mode) {
            case 'error-rate':
                this.sortByErrorRate();
                break;
            case 'random':
                this.shuffleQuestions();
                break;
            // sequence模式保持原顺序
        }
    }

    // 按错误率排序
    sortByErrorRate() {
        this.questions.sort((a, b) => {
            const statsA = this.storageManager.getQuestionCompletion(a.uniqueId);
            const statsB = this.storageManager.getQuestionCompletion(b.uniqueId);
            
            const errorRateA = statsA ? statsA.errors / Math.max(1, statsA.attempts) : 0;
            const errorRateB = statsB ? statsB.errors / Math.max(1, statsB.attempts) : 0;
            
            return errorRateB - errorRateA; // 错误率高的排前面
        });
    }

    // 随机打乱题目
    shuffleQuestions() {
        for (let i = this.questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.questions[i], this.questions[j]] = [this.questions[j], this.questions[i]];
            
            // 如果是选择题，同时打乱选项顺序
            const q = this.questions[i];
            if ((q.type === 'single-choice' || q.type === 'multiple-choice') && Array.isArray(q.options)) {
                const originalOptions = [...q.options];
                const shuffledOptions = [...originalOptions];
                // 打乱选项
                for (let k = shuffledOptions.length - 1; k > 0; k--) {
                    const l = Math.floor(Math.random() * (k + 1));
                    [shuffledOptions[k], shuffledOptions[l]] = [shuffledOptions[l], shuffledOptions[k]];
                }
                // 更新正确答案
                if (q.type === 'single-choice') {
                    const oldCorrectAnswer = q.correct_answer[0];
                    const newIndex = shuffledOptions.indexOf(oldCorrectAnswer);
                    q.correct_answer = [shuffledOptions[newIndex]];
                } else {
                    q.correct_answer = q.correct_answer.map(ans => 
                        shuffledOptions[originalOptions.indexOf(ans)]
                    );
                }
                q.options = shuffledOptions;
            }
        }
    }

    // 获取当前题目
    getCurrentQuestion() {
        return this.questions[this.currentIndex];
    }

    // 保存答案
    saveAnswer(answer) {
        if (!this.isPreviewMode) {
            const question = this.getCurrentQuestion();
            this.answers.set(question.uniqueId, answer);
        }
    }

    // 检查答案
    checkAnswer(answer) {
        const question = this.getCurrentQuestion();
        let isCorrect = false;

        switch (question.type) {
            case 'single-choice':
                isCorrect = question.correct_answer.includes(answer);
                break;
            case 'multiple-choice':
                isCorrect = this.compareArrays(answer, question.correct_answer);
                break;
            case 'fill-in-blank':
                isCorrect = this.compareArrays(answer, question.correct_answer);
                break;
            case 'short-answer':
                // 简答题需要特殊处理，这里简单实现
                isCorrect = question.correct_answer.some(ans => 
                    answer.toLowerCase().includes(ans.toLowerCase())
                );
                break;
        }

        if (!this.isPreviewMode) {
            this.storageManager.updateQuestionCompletion(
                question.uniqueId,
                isCorrect
            );
        }

        return isCorrect;
    }

    // 比较数组是否相等（不考虑顺序）
    compareArrays(arr1, arr2) {
        if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
        if (arr1.length !== arr2.length) return false;
        const set1 = new Set(arr1);
        return arr2.every(item => set1.has(item));
    }

    // 移动到下一题
    nextQuestion() {
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            return true;
        }
        return false;
    }

    // 移动到上一题
    previousQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return true;
        }
        return false;
    }

    // 获取练习统计信息
    getPracticeStats() {
        const total = this.questions.length;
        const attempted = this.answers.size;
        const correct = Array.from(this.answers.entries()).filter(
            ([questionId, answer]) => this.checkAnswer(answer)
        ).length;

        return {
            total,
            attempted,
            correct,
            accuracy: attempted ? Math.round((correct / attempted) * 100) : 0
        };
    }

    // 切换预览模式
    togglePreviewMode(enabled) {
        this.isPreviewMode = enabled;
        if (enabled) {
            this.answers.clear();
        }
    }

    // 重置当前练习
    reset() {
        this.currentIndex = 0;
        this.answers.clear();
    }

    // 获取当前模式的中文名称
    getModeDisplayName() {
        switch (this.currentMode) {
            case 'sequence':
                return '顺序练习';
            case 'error-rate':
                return '错误率练习';
            case 'random':
                return '随机练习';
            default:
                return '';
        }
    }
} 