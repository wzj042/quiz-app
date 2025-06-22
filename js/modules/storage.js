// 本地存储管理模块
export default class StorageManager {
    constructor() {
        this.PREFIX = 'quiz_app_';
    }

    // 获取题目的完成状态
    getQuestionCompletion(setId, questionId) {
        const key = `${this.PREFIX}completion_${setId}_${questionId}`;
        const data = localStorage.getItem(key);
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch(e) {
            return null;
        }
    }

    // 更新题目完成状态
    updateQuestionCompletion(setId, questionId, isCorrect) {
        const key = `${this.PREFIX}completion_${setId}_${questionId}`;
        const data = {
            completed: true,
            isCorrect: isCorrect,
            completedAt: new Date().toISOString()
        };
        localStorage.setItem(key, JSON.stringify(data));
    }

    // 获取题目笔记
    getNote(setId, questionId) {
        const key = `${this.PREFIX}note_${setId}_${questionId}`;
        return localStorage.getItem(key) || '';
    }

    // 保存题目笔记
    saveNote(setId, questionId, note) {
        const key = `${this.PREFIX}note_${setId}_${questionId}`;
        localStorage.setItem(key, note);
    }

    // 获取题库完成情况统计
    getSetStats(setId, questions) {
        let completed = 0;
        let correct = 0;

        questions.forEach(q => {
            const completion = this.getQuestionCompletion(setId, q.uniqueId);
            if (completion) {
                completed++;
                if (completion.isCorrect) {
                    correct++;
                }
            }
        });

        return {
            total: questions.length,
            completed,
            correct,
            completionRate: (completed / questions.length * 100).toFixed(1)
        };
    }

    // 导出笔记
    exportNotes(setId, questions) {
        const notes = {};
        questions.forEach(q => {
            if(q.uniqueId) {
                const note = this.getNote(setId, q.uniqueId);
                if (note) {
                    notes[q.uniqueId] = {
                        id: q.uniqueId,
                        content: note
                    };
                }
            }
        });
        return { analysis: Object.values(notes) };
    }

    // 导入笔记
    importNotes(setId, notesData) {
        if (!Array.isArray(notesData.analysis)) {
            throw new Error('导入的JSON文件格式错误');
        }

        notesData.analysis.forEach(item => {
            if (item && item.id && item.content) {
                this.saveNote(setId, item.id, item.content);
            }
        });

        return notesData.analysis.length;
    }
} 