// 本地存储管理模块
export default class StorageManager {
    constructor() {
        this.storage = window.localStorage;
        this.STORAGE_KEY = 'quiz_completion';
        this.initStorage();
    }

    initStorage() {
        if (!this.storage.getItem(this.STORAGE_KEY)) {
            this.storage.setItem(this.STORAGE_KEY, JSON.stringify({
                version: 1,
                data: {}
            }));
        }
    }

    getQuestionCompletion(setId, questionId) {
        const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
        return data.data[`${setId}-${questionId}`] || null;
    }

    updateQuestionCompletion(setId, questionId, isCorrect) {
        const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
        const key = `${setId}-${questionId}`;
        const today = new Date().toISOString().split('T')[0];

        const current = data.data[key] || {
            completed: 0,
            attempts: 0,
            errors: 0,
            lastAttemptDate: null
        };

        current.attempts++;
        if (!isCorrect) {
            current.errors++;
        }
        current.completed = 1;
        current.lastAttemptDate = today;

        data.data[key] = current;
        this.storage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    getSetStats(setId, questions) {
        const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
        let completed = 0;
        let totalAttempts = 0;
        let totalErrors = 0;

        questions.forEach(q => {
            const completion = data.data[`${setId}-${q.uniqueId}`];
            if (completion) {
                if (completion.completed) completed++;
                totalAttempts += completion.attempts || 0;
                totalErrors += completion.errors || 0;
            }
        });

        return {
            completed,
            totalAttempts,
            totalErrors,
            completionRate: questions.length ? Math.round((completed / questions.length) * 100) : 0
        };
    }

    getBankStats(fileName) {
        const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
        const prefix = fileName.replace('.json', '');
        let completed = 0;
        let total = 0;
        let attempts = 0;
        let errors = 0;

        // 遍历所有记录，找出属于这个题库的数据
        for (const key in data.data) {
            if (key.startsWith(prefix)) {
                total++;
                const completion = data.data[key];
                if (completion.completed) completed++;
                attempts += completion.attempts || 0;
                errors += completion.errors || 0;
            }
        }

        return {
            completed,
            total,
            attempts,
            errors
        };
    }

    getAllBanksStats() {
        const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
        const today = new Date().toISOString().split('T')[0];
        let totalQuestions = 0;
        let totalCompleted = 0;
        let totalAttempts = 0;
        let totalErrors = 0;
        let todayPracticed = 0;

        // 遍历所有记录
        for (const key in data.data) {
            const completion = data.data[key];
            totalQuestions++;
            if (completion.completed) totalCompleted++;
            totalAttempts += completion.attempts || 0;
            totalErrors += completion.errors || 0;
            if (completion.lastAttemptDate === today) {
                todayPracticed++;
            }
        }

        return {
            totalQuestions,
            totalCompleted,
            totalAttempts,
            totalErrors,
            todayPracticed
        };
    }

    // 清除所有数据
    clearAll() {
        this.storage.removeItem(this.STORAGE_KEY);
    }
} 