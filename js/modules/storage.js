// 本地存储管理模块
export default class StorageManager {
    constructor() {
        this.STORAGE_KEY = 'quiz-app-storage';
        this.version = '1.0.0';
        try {
            const savedData = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
            this.data = savedData?.data || {};
        } catch (error) {
            console.error('Failed to load storage:', error);
            this.data = {};
        }
    }

    loadData() {
        try {
            const savedData = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
            if (!savedData) return {};
            return savedData.data || {};
        } catch (error) {
            console.error('Failed to load data:', error);
            return {};
        }
    }

    saveData() {
        try {
            console.log('[saveData] Saving data to localStorage:', this.data);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                version: this.version,
                data: this.data
            }));
        } catch (error) {
            console.error('[saveData] Failed to save data:', error);
        }
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
        console.log('[updateQuestionCompletion] Updating stats:', { setId, questionId, isCorrect });
        
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

        console.log('[updateQuestionCompletion] Updated stats:', stats);
        
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
                ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100)
                : 0,
            completionRate: (stats.completedQuestions / questions.length * 100).toFixed(1),
            totalQuestions: questions.length,
            todayDistinctQuestions: todayQuestions.size
        };
    }

    getBankStats(fileName, jsonLoader) {
        try {
            console.log('[getBankStats] Checking stats for:', fileName);
            console.log('[getBankStats] Current data:', this.data);
            
            const prefix = fileName.replace('.json', '');
            let completed = 0;
            let attempts = 0;
            let correct = 0;

            // 遍历所有记录，找出属于这个题库的数据
            for (const setId in this.data) {
                if (setId === prefix) {
                    const setData = this.data[setId];
                    for (const questionId in setData) {
                        const qStats = setData[questionId];
                        if (qStats && typeof qStats === 'object') {
                            if (qStats.completed) completed++;
                            attempts += qStats.totalAttempts || 0;
                            correct += qStats.correctCount || 0;
                        }
                    }
                }
            }

            // 获取题库的实际题目总数
            let total = jsonLoader ? jsonLoader.questions.length : 0;

            const stats = {
                completed,
                total,
                attempts,
                correct,
                accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0
            };
            
            console.log(`[getBankStats] Calculated stats for ${fileName}:`, stats);
            return stats;
        } catch (error) {
            console.error('Error getting bank stats:', error);
            return {
                completed: 0,
                total: 0,
                attempts: 0,
                correct: 0,
                accuracy: 0
            };
        }
    }

    getAllBanksStats() {
        console.log('[getAllBanksStats] Starting calculation with data:', this.data);
        
        let totalStats = {
            totalQuestions: 0,        // 所有题库的题目总数
            completedQuestions: 0,    // 已练习过的题目总数（包括所有题库）
            totalAttempts: 0,         // 总练习次数（包括重复练习）
            totalCorrect: 0,          // 总正确次数
            todayPracticed: 0,        // 今日练习题目数
            averageAccuracy: 0        // 平均正确率
        };

        const today = new Date().toISOString().split('T')[0];

        // 遍历每个题库的数据
        for (const setId in this.data) {
            console.log(`[getAllBanksStats] Processing set: ${setId}`);
            const setData = this.data[setId];
            
            // 确保setData是一个对象且不是null
            if (setData && typeof setData === 'object') {
                // 遍历题库中的每个问题
                for (const questionId in setData) {
                    const qStats = setData[questionId];
                    
                    // 确保qStats是有效的统计数据对象
                    if (qStats && typeof qStats === 'object') {
                        totalStats.totalQuestions++;

                        // 统计已练习的题目（直接累加，不去重）
                        if (qStats.completed) {
                            totalStats.completedQuestions++;
                        }

                        // 累加练习次数和正确次数
                        totalStats.totalAttempts += qStats.totalAttempts || 0;
                        totalStats.totalCorrect += qStats.correctCount || 0;

                        // 统计今日练习
                        if (qStats.lastAttemptDate?.startsWith(today)) {
                            totalStats.todayPracticed++;
                        }
                    }
                }
            }
        }

        // 计算最终统计结果
        const result = {
            totalQuestions: totalStats.totalQuestions,
            completedQuestions: totalStats.completedQuestions,
            totalAttempts: totalStats.totalAttempts,
            totalCorrect: totalStats.totalCorrect,
            todayPracticed: totalStats.todayPracticed,
            averageAccuracy: totalStats.totalAttempts > 0 
                ? Math.round((totalStats.totalCorrect / totalStats.totalAttempts) * 100)
                : 0
        };

        console.log('[getAllBanksStats] Final stats:', result);
        return result;
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
} 