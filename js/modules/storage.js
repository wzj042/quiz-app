// 本地存储管理模块
export default class StorageManager {
    constructor() {
        this.STORAGE_KEY = 'quiz-app-storage';
        this.version = '1.0.0';
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1秒
        this.currentSetId = null; // Track current setId
        try {
            const savedData = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
            this.data = savedData?.data || {};
        } catch (error) {
            console.error('Failed to load storage:', error);
            this.data = {};
        }
    }

    // Set current setId
    setCurrentSetId(setId) {
        if (!setId) {
            console.warn('[setCurrentSetId] Invalid setId:', setId);
            return;
        }
        
        // Normalize the setId by removing .json and any leading/trailing slashes
        this.currentSetId = setId
            .replace('.json', '')
            .replace(/^\/+|\/+$/g, '');
            
        // Validate the format
        if (!this.currentSetId.match(/^[a-zA-Z0-9\-_/]+$/)) {
            console.warn('[setCurrentSetId] Invalid setId format:', this.currentSetId);
            this.currentSetId = null;
            return;
        }
        
        console.log('[setCurrentSetId] Set current setId:', this.currentSetId);
    }

    // Get current setId
    getCurrentSetId() {
        return this.currentSetId;
    }

    async loadData() {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const savedData = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
                if (!savedData) return {};
                return savedData.data || {};
            } catch (error) {
                console.error(`[loadData] Failed to load data (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        console.error('[loadData] Max retries reached, returning empty data');
        return {};
    }

    async saveData() {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                console.log('[saveData] Saving data to localStorage:', this.data);
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                    version: this.version,
                    data: this.data
                }));
                return true;
            } catch (error) {
                console.error(`[saveData] Failed to save data (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        console.error('[saveData] Max retries reached, failed to save data');
        return false;
    }

    getQuestionCompletion(setId, questionId) {
        try {
            // Try to use provided setId, fallback to current setId
            const effectiveSetId = setId || this.currentSetId;
            
            // Early validation with detailed logging
            if (!effectiveSetId) {
                console.warn('[getQuestionCompletion] No setId provided and no current setId set');
                return null;
            }
            
            // If questionId is a number, convert it to string
            const questionKey = questionId?.toString();
            if (!questionKey) {
                console.warn('[getQuestionCompletion] No questionId provided');
                return null;
            }

            // Log the actual values being used
            console.log('[getQuestionCompletion] Using values:', {
                providedSetId: setId,
                currentSetId: this.currentSetId,
                effectiveSetId,
                questionKey
            });

            const storageKey = effectiveSetId.replace('.json', '');
            const result = this.data[storageKey]?.[questionKey];
            
            console.log('[getQuestionCompletion] Result:', {
                storageKey,
                hasData: !!this.data[storageKey],
                hasQuestionData: !!result
            });
            
            return result || null;
        } catch (error) {
            console.error('[getQuestionCompletion] Error:', error);
            return null;
        }
    }

    async updateQuestionCompletion(setId, questionId, isCorrect) {
        if (!setId) {
            console.error('[updateQuestionCompletion] Missing setId');
            return null;
        }

        // If questionId is a number, convert it to string
        const questionKey = questionId?.toString();
        if (!questionKey) {
            console.error('[updateQuestionCompletion] Missing questionId');
            return null;
        }

        try {
            console.log('[updateQuestionCompletion] Updating stats:', { setId, questionKey, isCorrect });
            
            // Normalize the storage key
            const storageKey = setId.replace('.json', '');
            console.log('[updateQuestionCompletion] Using storage key:', storageKey);
            
            // Initialize data structure if needed
            if (!this.data[storageKey]) {
                this.data[storageKey] = {};
            }
            
            // Initialize question stats if needed
            if (!this.data[storageKey][questionKey]) {
                this.data[storageKey][questionKey] = {
                    totalAttempts: 0,
                    correctCount: 0,
                    incorrectCount: 0,
                    consecutiveCorrect: 0,
                    lastAttemptDate: null,
                    lastCorrect: false,
                    firstAttemptDate: null,
                    completed: false,
                    todayAttempts: 0,
                    todayCorrect: 0,
                    todayIncorrect: 0,
                    lastSubmissionTime: null
                };
            }

            const stats = this.data[storageKey][questionKey];
            const now = new Date().toISOString();
            const today = now.split('T')[0];

            // Only check for duplicate submissions if it's the same answer type (correct/incorrect)
            const isDuplicateSubmission = stats.lastSubmissionTime && 
                (new Date(now) - new Date(stats.lastSubmissionTime)) < 2000 &&
                stats.lastCorrect === isCorrect;
                
            if (isDuplicateSubmission) {
                console.log('[updateQuestionCompletion] Duplicate submission detected, skipping update');
                return stats;
            }

            // Reset daily stats if it's a new day
            if (stats.lastAttemptDate && !stats.lastAttemptDate.startsWith(today)) {
                console.log('[updateQuestionCompletion] New day detected, resetting daily stats');
                stats.todayAttempts = 0;
                stats.todayCorrect = 0;
                stats.todayIncorrect = 0;
            }

            // Update stats
            stats.totalAttempts++;
            stats.todayAttempts++;
            stats.completed = true;

            if (isCorrect) {
                stats.correctCount++;
                stats.todayCorrect++;
                stats.consecutiveCorrect++;
                stats.lastCorrect = true;
            } else {
                stats.incorrectCount++;
                stats.todayIncorrect++;
                stats.consecutiveCorrect = 0;
                stats.lastCorrect = false;
            }

            // Update timestamps
            if (!stats.firstAttemptDate) {
                stats.firstAttemptDate = now;
            }
            stats.lastAttemptDate = now;
            stats.lastSubmissionTime = now;

            console.log('[updateQuestionCompletion] Updated stats:', stats);
            
            // Save data
            const saved = await this.saveData();
            if (!saved) {
                throw new Error('Failed to save data after multiple retries');
            }
            
            return stats;
        } catch (error) {
            console.error('[updateQuestionCompletion] Error:', error);
            return null;
        }
    }

    getQuestionStats(setId, questionId) {
        try {
            if (!setId || !questionId) {
                console.error('[getQuestionStats] Invalid parameters:', { setId, questionId });
                return null;
            }

            const storageKey = setId.replace('.json', '');
            console.log('[getQuestionStats] Getting stats for:', {
                setId,
                storageKey,
                questionId,
                hasData: this.data[storageKey] && this.data[storageKey][questionId]
            });
            
            return this.data[storageKey]?.[questionId] || null;
        } catch (error) {
            console.error('[getQuestionStats] Error:', error);
            return null;
        }
    }

    getSetStats(setId, questions) {
        try {
            if (!setId || !Array.isArray(questions)) {
                console.error('[getSetStats] Invalid parameters:', { setId, hasQuestions: !!questions });
                return null;
            }

            const storageKey = setId.replace('.json', '');
            const setData = this.data[storageKey] || {};
            
            const stats = {
                totalQuestions: questions.length,
                completedQuestions: 0,
                correctQuestions: 0,
                totalAttempts: 0,
                correctAttempts: 0,
                incorrectAttempts: 0,
                averageAccuracy: 0,
                todayAttempts: 0,
                todayCorrect: 0,
                todayIncorrect: 0
            };

            // 获取今天的日期
            const today = new Date().toISOString().split('T')[0];

            // 遍历题目数组
            for (const question of questions) {
                const questionId = question.uniqueId;
                if (!questionId) {
                    console.warn('[getSetStats] Question missing uniqueId:', question);
                    continue;
                }

                const questionStats = setData[questionId];
                if (questionStats) {
                    stats.totalAttempts += questionStats.totalAttempts;
                    stats.correctAttempts += questionStats.correctCount;
                    stats.incorrectAttempts += questionStats.incorrectCount;

                    if (questionStats.completed) {
                        stats.completedQuestions++;
                    }
                    if (questionStats.lastCorrect) {
                        stats.correctQuestions++;
                    }

                    // 统计今日数据
                    if (questionStats.lastAttemptDate?.startsWith(today)) {
                        stats.todayAttempts += questionStats.todayAttempts;
                        stats.todayCorrect += questionStats.todayCorrect;
                        stats.todayIncorrect += questionStats.todayIncorrect;
                    }
                }
            }

            // 计算正确率
            stats.averageAccuracy = stats.totalAttempts > 0
                ? Math.round((stats.correctAttempts / stats.totalAttempts) * 100)
                : 0;

            console.log('[getSetStats] Calculated stats:', {
                setId,
                storageKey,
                stats
            });

            return stats;
        } catch (error) {
            console.error('[getSetStats] Error:', error);
            return null;
        }
    }

    getAllBanksStats() {
        try {
            console.log('[getAllBanksStats] Starting calculation');
            const stats = {
                completedQuestions: 0,
                totalAttempts: 0,
                averageAccuracy: 0,
                todayPracticed: 0
            };

            let totalCorrect = 0;
            const today = new Date().toISOString().split('T')[0];

            // 遍历所有题库的数据
            for (const [bankKey, bankData] of Object.entries(this.data)) {
                // 跳过非题库数据
                if (bankKey === 'settings' || !bankData) continue;

                // 遍历题库中的每个题目
                for (const [questionKey, questionStats] of Object.entries(bankData)) {
                    if (questionStats.completed) {
                        stats.completedQuestions++;
                    }
                    stats.totalAttempts += questionStats.totalAttempts;
                    totalCorrect += questionStats.correctCount;

                    // 统计今日练习题目数
                    if (questionStats.lastAttemptDate?.startsWith(today)) {
                        stats.todayPracticed++;
                    }
                }
            }

            // 计算平均正确率
            stats.averageAccuracy = stats.totalAttempts > 0
                ? Math.round((totalCorrect / stats.totalAttempts) * 100)
                : 0;

            console.log('[getAllBanksStats] Calculated stats:', stats);
            return stats;
        } catch (error) {
            console.error('[getAllBanksStats] Error:', error);
            return {
                completedQuestions: 0,
                totalAttempts: 0,
                averageAccuracy: 0,
                todayPracticed: 0
            };
        }
    }

    async getBankStats(fileName, jsonLoader) {
        try {
            if (!fileName || !jsonLoader) {
                console.error('[getBankStats] Missing parameters:', { fileName, hasJsonLoader: !!jsonLoader });
                return null;
            }

            console.log('[getBankStats] Checking stats for:', fileName);

            // 获取题库数据
            const data = await jsonLoader.loadFile(fileName);
            if (!data || !data.questions || !Array.isArray(data.questions)) {
                console.error('[getBankStats] Failed to load questions');
                return null;
            }

            // 获取题库统计数据
            return this.getSetStats(fileName, data.questions);
        } catch (error) {
            console.error('[getBankStats] Error:', error);
            return null;
        }
    }

    // 清除所有数据
    async clearAll() {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                await localStorage.removeItem(this.STORAGE_KEY);
                this.data = {};
                return true;
            } catch (error) {
                console.error(`[clearAll] Failed to clear storage (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        console.error('[clearAll] Max retries reached, failed to clear storage');
        return false;
    }
} 