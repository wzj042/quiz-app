// 题目管理模块
export default class QuestionManager {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.originalQuestion = null;
        this.currentQuestion = null;
        this.hasUnsavedChanges = false;
        this.modifiedQuestions = new Set();
    }

    // 开始编辑题目
    startEditing(question) {
        // 深拷贝当前题目
        this.originalQuestion = JSON.parse(JSON.stringify(question));
        this.currentQuestion = question;
        this.hasUnsavedChanges = false;
    }

    // 保存当前编辑
    saveCurrentEdit() {
        if (!this.currentQuestion || !this.originalQuestion) return;

        // 检查是否有实际变化
        if (JSON.stringify(this.currentQuestion) !== JSON.stringify(this.originalQuestion)) {
            this.modifiedQuestions.add(this.currentQuestion.uniqueId);
            this.hasUnsavedChanges = true;
        }
    }

    // 取消编辑
    cancelEditing() {
        if (!this.currentQuestion || !this.originalQuestion) return;

        // 还原原始数据
        Object.assign(this.currentQuestion, this.originalQuestion);
        this.originalQuestion = null;
        this.currentQuestion = null;
        this.hasUnsavedChanges = false;
    }

    checkUnsavedChanges() {
        if (!this.currentQuestion || !this.originalQuestion) return false;
        return JSON.stringify(this.currentQuestion) !== JSON.stringify(this.originalQuestion);
    }

    // 验证题目格式
    validateQuestion(question) {
        if (!question.type || !question.content) {
            return false;
        }

        switch (question.type) {
            case 'single-choice':
            case 'multiple-choice':
                return this.validateChoiceQuestion(question);
            case 'fill-in-blank':
                return this.validateFillInBlankQuestion(question);
            case 'short-answer':
                return this.validateShortAnswerQuestion(question);
            default:
                return false;
        }
    }

    // 验证选择题
    validateChoiceQuestion(question) {
        return (
            Array.isArray(question.options) &&
            question.options.length > 0 &&
            Array.isArray(question.correct_answer) &&
            question.correct_answer.length > 0 &&
            question.correct_answer.every(ans => question.options.includes(ans))
        );
    }

    // 验证填空题
    validateFillInBlankQuestion(question) {
        return (
            Array.isArray(question.blanks) &&
            Array.isArray(question.correct_answer) &&
            question.blanks.length === question.correct_answer.length &&
            question.blanks.length > 0
        );
    }

    // 验证简答题
    validateShortAnswerQuestion(question) {
        return (
            Array.isArray(question.correct_answer) &&
            question.correct_answer.length > 0
        );
    }

    // 获取已修改的题目
    getModifiedQuestions() {
        return Array.from(this.modifiedQuestions);
    }

    // 清除修改历史
    clearEditHistory() {
        this.originalQuestion = null;
        this.currentQuestion = null;
        this.hasUnsavedChanges = false;
        this.modifiedQuestions.clear();
    }

    generateExportFileName(fileName) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        // 移除.json后缀，避免重复
        const baseFileName = fileName.replace(/\.json$/, '');
        return `${baseFileName}_修改_${dateStr}_${timeStr}.json`;
    }

    clearModifiedQuestions() {
        this.modifiedQuestions.clear();
    }
} 