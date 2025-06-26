// 题目管理模块
export default class QuestionManager {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.originalQuestion = null;
        this.currentQuestion = null;
        this.hasUnsavedChanges = false;
        this.modifiedQuestions = new Set();
        this.maxQuestionSize = 1024 * 1024; // 1MB
        this.maxOptionsLength = 100;
        this.maxContentLength = 5000;
        this.maxAnswerLength = 1000;
        this.questions = [];
    }

    // 开始编辑题目
    startEditing(question) {
        try {
            if (!question || typeof question !== 'object') {
                throw new Error('Invalid question object');
            }

            // 验证题目大小
            const questionSize = new TextEncoder().encode(JSON.stringify(question)).length;
            if (questionSize > this.maxQuestionSize) {
                throw new Error('Question size exceeds limit');
            }

            // 深拷贝当前题目
            this.originalQuestion = JSON.parse(JSON.stringify(question));
            this.currentQuestion = question;
            this.hasUnsavedChanges = false;

            return true;
        } catch (error) {
            console.error('[startEditing] Failed:', error);
            this.originalQuestion = null;
            this.currentQuestion = null;
            this.hasUnsavedChanges = false;
            return false;
        }
    }

    // 保存当前编辑
    saveCurrentEdit() {
        try {
            if (!this.currentQuestion || !this.originalQuestion) {
                console.warn('[saveCurrentEdit] No question being edited');
                return false;
            }

            // 验证当前题目
            if (!this.validateQuestion(this.currentQuestion)) {
                throw new Error('Invalid question format');
            }

            // 检查是否有实际变化
            if (JSON.stringify(this.currentQuestion) !== JSON.stringify(this.originalQuestion)) {
                // 验证题目大小
                const questionSize = new TextEncoder().encode(JSON.stringify(this.currentQuestion)).length;
                if (questionSize > this.maxQuestionSize) {
                    throw new Error('Question size exceeds limit');
                }

                this.modifiedQuestions.add(this.currentQuestion.uniqueId);
                this.hasUnsavedChanges = true;
            }

            return true;
        } catch (error) {
            console.error('[saveCurrentEdit] Failed:', error);
            return false;
        }
    }

    // 取消编辑
    cancelEditing() {
        try {
            if (!this.currentQuestion || !this.originalQuestion) {
                console.warn('[cancelEditing] No question being edited');
                return false;
            }

            // 还原原始数据
            Object.assign(this.currentQuestion, JSON.parse(JSON.stringify(this.originalQuestion)));
            this.originalQuestion = null;
            this.currentQuestion = null;
            this.hasUnsavedChanges = false;

            return true;
        } catch (error) {
            console.error('[cancelEditing] Failed:', error);
            // 强制重置状态
            this.originalQuestion = null;
            this.currentQuestion = null;
            this.hasUnsavedChanges = false;
            return false;
        }
    }

    checkUnsavedChanges() {
        try {
            if (!this.currentQuestion || !this.originalQuestion) return false;

            const currentStr = JSON.stringify(this.currentQuestion);
            const originalStr = JSON.stringify(this.originalQuestion);

            return currentStr !== originalStr;
        } catch (error) {
            console.error('[checkUnsavedChanges] Failed:', error);
            return false;
        }
    }

    // 验证题目格式
    validateQuestion(question) {
        try {
            console.log('[QuestionManager:validateQuestion] Validating question:', {
                questionId: question?.uniqueId,
                type: question?.type
            });

            if (!question || typeof question !== 'object') {
                console.warn('[QuestionManager:validateQuestion] Question is not an object');
                return false;
            }

            if (!question.uniqueId) {
                console.warn('[QuestionManager:validateQuestion] Question missing uniqueId');
                return false;
            }

            if (!question.type || !question.content) {
                console.warn('[QuestionManager:validateQuestion] Question missing type or content');
                return false;
            }

            if (typeof question.content !== 'string') {
                console.warn('[QuestionManager:validateQuestion] Question content is not a string');
                return false;
            }

            if (question.content.length > this.maxContentLength) {
                console.warn('[QuestionManager:validateQuestion] Question content exceeds max length');
                return false;
            }

            // 验证分析内容
            if (question.analysis && (
                typeof question.analysis !== 'string' ||
                question.analysis.length > this.maxContentLength
            )) {
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
        } catch (error) {
            console.error('[QuestionManager:validateQuestion] Error:', error);
            return false;
        }
    }

    // 验证选择题
    validateChoiceQuestion(question) {
        try {
            if (!Array.isArray(question.options)) return false;
            if (question.options.length === 0) return false;
            if (question.options.length > this.maxOptionsLength) return false;

            // 验证选项内容
            if (!question.options.every(opt => 
                typeof opt === 'string' && 
                opt.length > 0 && 
                opt.length <= this.maxAnswerLength
            )) {
                return false;
            }

            if (!Array.isArray(question.correct_answer)) return false;
            if (question.correct_answer.length === 0) return false;
            if (question.type === 'single-choice' && question.correct_answer.length !== 1) return false;

            // 验证答案内容
            return question.correct_answer.every(ans => 
                typeof ans === 'string' &&
                ans.length <= this.maxAnswerLength &&
                question.options.includes(ans)
            );
        } catch (error) {
            console.error('[validateChoiceQuestion] Failed:', error);
            return false;
        }
    }

    // 验证填空题
    validateFillInBlankQuestion(question) {
        try {
            if (!Array.isArray(question.blanks)) return false;
            if (question.blanks.length === 0) return false;
            if (question.blanks.length > this.maxOptionsLength) return false;

            // 验证空格内容
            if (!question.blanks.every(blank => 
                typeof blank === 'string' && 
                blank.length <= this.maxAnswerLength
            )) {
                return false;
            }

            if (!Array.isArray(question.correct_answer)) return false;
            if (question.correct_answer.length !== question.blanks.length) return false;

            // 验证答案内容
            return question.correct_answer.every(ans => 
                typeof ans === 'string' &&
                ans.length <= this.maxAnswerLength
            );
        } catch (error) {
            console.error('[validateFillInBlankQuestion] Failed:', error);
            return false;
        }
    }

    // 验证简答题
    validateShortAnswerQuestion(question) {
        try {
            if (!Array.isArray(question.correct_answer)) return false;
            if (question.correct_answer.length === 0) return false;
            if (question.correct_answer.length > this.maxOptionsLength) return false;

            // 验证答案内容
            return question.correct_answer.every(ans => 
                typeof ans === 'string' &&
                ans.length <= this.maxAnswerLength
            );
        } catch (error) {
            console.error('[validateShortAnswerQuestion] Failed:', error);
            return false;
        }
    }

    // 获取已修改的题目
    getModifiedQuestions() {
        try {
            return Array.from(this.modifiedQuestions);
        } catch (error) {
            console.error('[getModifiedQuestions] Failed:', error);
            return [];
        }
    }

    // 清除修改历史
    clearEditHistory() {
        try {
            this.originalQuestion = null;
            this.currentQuestion = null;
            this.hasUnsavedChanges = false;
            this.modifiedQuestions.clear();
            return true;
        } catch (error) {
            console.error('[clearEditHistory] Failed:', error);
            return false;
        }
    }

    generateExportFileName(fileName) {
        try {
            if (!fileName || typeof fileName !== 'string') {
                throw new Error('Invalid file name');
            }

            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            
            // 移除.json后缀，避免重复
            const baseFileName = fileName.replace(/\.json$/, '');
            
            // 生成文件名并验证长度
            const exportFileName = `${baseFileName}_修改_${dateStr}_${timeStr}.json`;
            if (exportFileName.length > 255) { // 常见文件系统的文件名长度限制
                return `修改_${dateStr}_${timeStr}.json`;
            }
            
            return exportFileName;
        } catch (error) {
            console.error('[generateExportFileName] Failed:', error);
            const now = new Date();
            return `修改_${now.getTime()}.json`;
        }
    }

    clearModifiedQuestions() {
        try {
            this.modifiedQuestions.clear();
            return true;
        } catch (error) {
            console.error('[clearModifiedQuestions] Failed:', error);
            return false;
        }
    }

    // Add setQuestions method
    setQuestions(questions) {
        try {
            if (!Array.isArray(questions)) {
                console.error('[QuestionManager:setQuestions] Invalid questions array');
                return false;
            }

            console.log('[QuestionManager:setQuestions] Setting questions:', {
                count: questions.length,
                hasUniqueIds: questions.every(q => q.uniqueId),
                questionTypes: questions.map(q => q.type)
            });

            // Validate each question
            const validQuestions = questions.every(q => {
                const isValid = this.validateQuestion(q);
                if (!isValid) {
                    console.warn('[QuestionManager:setQuestions] Invalid question:', {
                        questionId: q.uniqueId,
                        type: q.type
                    });
                }
                return isValid;
            });

            if (!validQuestions) {
                console.error('[QuestionManager:setQuestions] Some questions are invalid');
                return false;
            }

            this.questions = questions;
            console.log('[QuestionManager:setQuestions] Questions set successfully');
            return true;
        } catch (error) {
            console.error('[QuestionManager:setQuestions] Error:', error);
            return false;
        }
    }
} 