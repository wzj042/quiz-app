// 本地存储管理模块
export default class StorageManager {
    constructor() {
        this.STORAGE_KEY = 'quiz_completion';
        this.data = this.loadData();
    }

    loadData() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    }

    saveData() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    }

    getQuestionCompletion(setId, questionId) {
        try {
            const data = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
            return data?.data?.[`${setId}-${questionId}`] || null;
        } catch (error) {
            console.error('Error getting question completion:', error);
            return null;
        }
    }

    updateQuestionCompletion(setId, questionId, isCorrect) {
        if (!this.data[setId]) {
            this.data[setId] = {};
        }
        
        if (!this.data[setId][questionId]) {
            this.data[setId][questionId] = {
                totalAttempts: 0,
                correctCount: 0,
                incorrectCount: 0,
                consecutiveCorrect: 0,
                lastAttemptDate: null,
                lastCorrect: false,
                firstAttemptDate: null,
                completed: false
            };
        }

        const stats = this.data[setId][questionId];
        const now = new Date().toISOString();

        // 更新统计数据
        stats.totalAttempts++;
        stats.completed = true; // 只要提交过就算完成
        if (isCorrect) {
            stats.correctCount++;
            stats.consecutiveCorrect++;
            stats.lastCorrect = true;
        } else {
            stats.incorrectCount++;
            stats.consecutiveCorrect = 0;
            stats.lastCorrect = false;
        }

        // 更新时间
        if (!stats.firstAttemptDate) {
            stats.firstAttemptDate = now;
        }
        stats.lastAttemptDate = now;

        this.saveData();
        return stats;
    }

    getQuestionStats(setId, questionId) {
        if (!this.data[setId] || !this.data[setId][questionId]) {
            return null;
        }
        return this.data[setId][questionId];
    }

    getSetStats(setId, questions) {
        if (!this.data[setId]) {
            return {
                totalAttempts: 0,
                totalCorrect: 0,
                totalIncorrect: 0,
                averageAccuracy: 0,
                completedQuestions: 0,
                totalQuestions: questions.length,
                completionRate: 0,
                todayAttempts: 0,
                todayCorrect: 0,
                distinctQuestionCount: 0, // 添加不同题目数统计
                totalQuestionAttempts: 0  // 添加总题目练习数（含重复）
            };
        }

        const today = new Date().toISOString().split('T')[0];
        let stats = {
            totalAttempts: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            completedQuestions: 0,
            todayAttempts: 0,
            todayCorrect: 0,
            distinctQuestionCount: 0,
            totalQuestionAttempts: 0,
            todayDistinctQuestions: new Set()
        };

        // 用于统计今日不同的题目数
        const todayQuestions = new Set();

        questions.forEach(q => {
            const qStats = this.data[setId][q.uniqueId];
            if (qStats) {
                stats.totalAttempts += qStats.totalAttempts;
                stats.totalCorrect += qStats.correctCount;
                stats.totalIncorrect += qStats.incorrectCount;
                
                // 只要提交过就算完成
                if (qStats.completed) {
                    stats.completedQuestions++;
                }

                // 统计练习过的不同题目数
                stats.distinctQuestionCount++;
                stats.totalQuestionAttempts += qStats.totalAttempts;

                // 统计今日数据
                if (qStats.lastAttemptDate?.startsWith(today)) {
                    stats.todayAttempts++;
                    if (qStats.lastCorrect) {
                        stats.todayCorrect++;
                    }
                    todayQuestions.add(q.uniqueId);
                }
            }
        });

        return {
            ...stats,
            averageAccuracy: stats.totalAttempts > 0 
                ? (stats.totalCorrect / stats.totalAttempts * 100).toFixed(1)
                : 0,
            completionRate: (stats.completedQuestions / questions.length * 100).toFixed(1),
            totalQuestions: questions.length,
            todayDistinctQuestions: todayQuestions.size
        };
    }

    getBankStats(fileName) {
        try {
            const data = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
            if (!data || !data.data) {
                return {
                    completed: 0,
                    total: 0,
                    attempts: 0,
                    errors: 0
                };
            }

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
        } catch (error) {
            console.error('Error getting bank stats:', error);
            return {
                completed: 0,
                total: 0,
                attempts: 0,
                errors: 0
            };
        }
    }

    getAllBanksStats() {
        let totalStats = {
            totalQuestions: 0,
            totalCompleted: 0,
            totalAttempts: 0,
            totalCorrect: 0,
            todayPracticed: 0,
            todayCorrect: 0,
            distinctQuestionCount: 0,
            totalQuestionAttempts: 0,
            todayDistinctQuestions: new Set()
        };

        const today = new Date().toISOString().split('T')[0];

        for (const setId in this.data) {
            for (const questionId in this.data[setId]) {
                const qStats = this.data[setId][questionId];
                totalStats.totalQuestions++;
                if (qStats.completed) {
                    totalStats.totalCompleted++;
                }
                totalStats.totalAttempts += qStats.totalAttempts;
                totalStats.totalCorrect += qStats.correctCount;
                totalStats.distinctQuestionCount++;
                totalStats.totalQuestionAttempts += qStats.totalAttempts;

                if (qStats.lastAttemptDate?.startsWith(today)) {
                    totalStats.todayPracticed++;
                    if (qStats.lastCorrect) {
                        totalStats.todayCorrect++;
                    }
                    totalStats.todayDistinctQuestions.add(questionId);
                }
            }
        }

        return {
            ...totalStats,
            averageAccuracy: totalStats.totalAttempts > 0
                ? (totalStats.totalCorrect / totalStats.totalAttempts * 100).toFixed(1)
                : 0,
            todayDistinctQuestions: totalStats.todayDistinctQuestions.size
        };
    }

    // 清除所有数据
    clearAll() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            this.data = {};
        } catch (error) {
            console.error('Error clearing storage:', error);
        }
    }

    // Banner显示状态相关
    getBannerShown() {
        return localStorage.getItem('bannerShown') === 'true';
    }

    setBannerShown(shown) {
        localStorage.setItem('bannerShown', shown);
    }
} 