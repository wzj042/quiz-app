// 数据管理模块
export default class DataManager {
    constructor() {
        this.STORAGE_VERSION = 2;
        this.STORAGE_KEY = 'quiz_data';
        this.BACKUP_KEY = 'quiz_data_backup';
        this.storage = window.localStorage;
        this.cache = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1秒
        this.maxHistoryLength = 100;
        this.maxStorageSize = 5 * 1024 * 1024; // 5MB
        this.initStorage();
    }

    // 初始化存储
    async initStorage() {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const data = this.storage.getItem(this.STORAGE_KEY);
                if (!data) {
                    await this.resetStorage();
                    return;
                }

                const parsed = JSON.parse(data);
                if (!this.validateData(parsed)) {
                    throw new Error('Invalid data structure');
                }

                if (parsed.version < this.STORAGE_VERSION) {
                    await this.migrateData(parsed);
                }
                return;
            } catch (error) {
                console.error(`[initStorage] Failed (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    // 尝试从备份恢复
                    try {
                        const restored = await this.restoreFromBackup();
                        if (restored) return;
                    } catch (backupError) {
                        console.error('[initStorage] Backup restoration failed:', backupError);
                    }
                }
            }
        }
        // 如果所有尝试都失败，重置存储
        await this.resetStorage();
    }

    // 验证数据结构
    validateData(data) {
        try {
            if (!data || typeof data !== 'object') return false;
            if (typeof data.version !== 'number') return false;
            if (!data.lastUpdate || !Date.parse(data.lastUpdate)) return false;
            if (!data.completion || typeof data.completion !== 'object') return false;
            if (!data.settings || typeof data.settings !== 'object') return false;
            
            // 验证设置
            const { settings } = data;
            if (typeof settings.theme !== 'string') return false;
            if (typeof settings.fontSize !== 'string') return false;
            if (typeof settings.showHints !== 'boolean') return false;

            return true;
        } catch (error) {
            console.error('[validateData] Error:', error);
            return false;
        }
    }

    // 重置存储
    async resetStorage() {
        const initialData = {
            version: this.STORAGE_VERSION,
            lastUpdate: new Date().toISOString(),
            completion: {},
            settings: {
                theme: 'light',
                fontSize: 'medium',
                showHints: true
            }
        };

        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                await this.saveData(initialData);
                return;
            } catch (error) {
                console.error(`[resetStorage] Failed (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        throw new Error('Failed to initialize storage after multiple attempts');
    }

    // 数据迁移
    async migrateData(oldData) {
        try {
            // 创建备份
            await this.createBackup();

            // 执行迁移
            const newData = {
                version: this.STORAGE_VERSION,
                lastUpdate: new Date().toISOString(),
                completion: {},
                settings: {
                    theme: 'light',
                    fontSize: 'medium',
                    showHints: true
                }
            };

            // 迁移完成数据
            if (oldData.data && typeof oldData.data === 'object') {
                for (const [key, value] of Object.entries(oldData.data)) {
                    if (!value || typeof value !== 'object') continue;

                    newData.completion[key] = {
                        completed: Number(value.completed) || 0,
                        attempts: Number(value.attempts) || 0,
                        errors: Number(value.errors) || 0,
                        lastAttempt: value.lastAttemptDate || null,
                        history: Array.isArray(value.history) ? value.history.slice(-this.maxHistoryLength) : []
                    };
                }
            }

            // 保存新数据
            await this.saveData(newData);
        } catch (error) {
            console.error('[migrateData] Failed:', error);
            // 恢复备份
            const restored = await this.restoreFromBackup();
            if (!restored) {
                throw new Error('Failed to migrate data and restore backup');
            }
        }
    }

    // 创建备份
    async createBackup() {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const currentData = this.storage.getItem(this.STORAGE_KEY);
                if (currentData) {
                    if (currentData.length > this.maxStorageSize) {
                        throw new Error('Data size exceeds limit');
                    }
                    this.storage.setItem(this.BACKUP_KEY, currentData);
                }
                return;
            } catch (error) {
                console.error(`[createBackup] Failed (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        throw new Error('Failed to create backup after multiple attempts');
    }

    // 从备份恢复
    async restoreFromBackup() {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const backup = this.storage.getItem(this.BACKUP_KEY);
                if (!backup) return false;

                const parsed = JSON.parse(backup);
                if (!this.validateData(parsed)) {
                    throw new Error('Invalid backup data');
                }

                this.storage.setItem(this.STORAGE_KEY, backup);
                return true;
            } catch (error) {
                console.error(`[restoreFromBackup] Failed (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        return false;
    }

    // 保存数据
    async saveData(data) {
        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                // 验证数据
                if (!this.validateData(data)) {
                    throw new Error('Invalid data structure');
                }

                // 检查存储空间
                if (!this.hasEnoughStorage()) {
                    await this.cleanupOldData();
                    if (!this.hasEnoughStorage()) {
                        throw new Error('Insufficient storage space');
                    }
                }

                const serialized = JSON.stringify(data);
                if (serialized.length > this.maxStorageSize) {
                    throw new Error('Data size exceeds limit');
                }

                this.storage.setItem(this.STORAGE_KEY, serialized);
                return;
            } catch (error) {
                console.error(`[saveData] Failed (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        throw new Error('Failed to save data after multiple attempts');
    }

    // 检查存储空间
    hasEnoughStorage() {
        try {
            const testKey = '___test___';
            const testData = 'x'.repeat(1024 * 1024); // 1MB
            this.storage.setItem(testKey, testData);
            this.storage.removeItem(testKey);
            return true;
        } catch (error) {
            console.error('[hasEnoughStorage] Failed:', error);
            return false;
        }
    }

    // 清理旧数据
    async cleanupOldData() {
        try {
            const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
            if (!data || !data.completion) {
                throw new Error('Invalid data structure');
            }

            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

            let totalSize = 0;
            const processedKeys = new Set();

            // 清理超过一个月的历史记录
            for (const key in data.completion) {
                if (processedKeys.has(key)) continue;
                processedKeys.add(key);

                const completion = data.completion[key];
                if (!completion || !Array.isArray(completion.history)) continue;

                // 保留最近一个月的记录
                completion.history = completion.history
                    .filter(record => {
                        try {
                            return new Date(record.date) > oneMonthAgo;
                        } catch (error) {
                            return false;
                        }
                    })
                    .slice(-this.maxHistoryLength);

                // 计算大小
                totalSize += JSON.stringify(completion).length;
                if (totalSize > this.maxStorageSize) {
                    // 如果超过大小限制，进一步清理
                    completion.history = completion.history.slice(-50);
                }
            }

            await this.saveData(data);
        } catch (error) {
            console.error('[cleanupOldData] Failed:', error);
            throw new Error('Failed to cleanup old data');
        }
    }

    // 获取题目完成状态
    getQuestionCompletion(questionId) {
        try {
            if (!questionId) {
                console.error('[getQuestionCompletion] Invalid questionId');
                return null;
            }

            // 尝试从缓存获取
            if (this.cache.has(questionId)) {
                return this.cache.get(questionId);
            }

            const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
            if (!data || !data.completion) {
                throw new Error('Invalid data structure');
            }

            const completion = data.completion[questionId] || null;
            
            // 缓存结果
            this.cache.set(questionId, completion);
            
            return completion;
        } catch (error) {
            console.error('[getQuestionCompletion] Failed:', error);
            return null;
        }
    }

    // 更新题目完成状态
    async updateQuestionCompletion(questionId, result) {
        if (!questionId || !result) {
            console.error('[updateQuestionCompletion] Invalid parameters:', { questionId, result });
            return;
        }

        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
                if (!data || !data.completion) {
                    throw new Error('Invalid data structure');
                }

                const now = new Date().toISOString();

                if (!data.completion[questionId]) {
                    data.completion[questionId] = {
                        completed: 0,
                        attempts: 0,
                        errors: 0,
                        lastAttempt: null,
                        history: []
                    };
                }

                const completion = data.completion[questionId];
                completion.attempts = Number(completion.attempts || 0) + 1;
                if (!result.isCorrect) {
                    completion.errors = Number(completion.errors || 0) + 1;
                }
                completion.completed = 1;
                completion.lastAttempt = now;

                // 添加到历史记录
                const historyEntry = {
                    date: now,
                    isCorrect: Boolean(result.isCorrect),
                    timeSpent: Number(result.timeSpent) || 0,
                    answer: result.answer
                };

                if (!Array.isArray(completion.history)) {
                    completion.history = [];
                }
                completion.history.push(historyEntry);

                // 只保留最近的记录
                completion.history = completion.history.slice(-this.maxHistoryLength);

                // 更新缓存
                this.cache.set(questionId, completion);

                await this.saveData(data);
                return;
            } catch (error) {
                console.error(`[updateQuestionCompletion] Failed (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        throw new Error('Failed to update question completion after multiple attempts');
    }

    // 获取设置
    getSettings() {
        try {
            const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
            if (!data || !data.settings) {
                throw new Error('Invalid data structure');
            }
            return { ...data.settings };
        } catch (error) {
            console.error('[getSettings] Failed:', error);
            return {
                theme: 'light',
                fontSize: 'medium',
                showHints: true
            };
        }
    }

    // 更新设置
    async updateSettings(settings) {
        if (!settings || typeof settings !== 'object') {
            console.error('[updateSettings] Invalid settings:', settings);
            return;
        }

        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
                if (!data || !data.settings) {
                    throw new Error('Invalid data structure');
                }

                // 验证设置值
                const newSettings = { ...data.settings };
                if (settings.theme && typeof settings.theme === 'string') {
                    newSettings.theme = settings.theme;
                }
                if (settings.fontSize && typeof settings.fontSize === 'string') {
                    newSettings.fontSize = settings.fontSize;
                }
                if (typeof settings.showHints === 'boolean') {
                    newSettings.showHints = settings.showHints;
                }

                data.settings = newSettings;
                await this.saveData(data);
                return;
            } catch (error) {
                console.error(`[updateSettings] Failed (attempt ${retries + 1}):`, error);
                retries++;
                if (retries < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        throw new Error('Failed to update settings after multiple attempts');
    }

    async submitAnswer(setId, questionId, answer) {
        try {
            console.log('[DataManager:submitAnswer] Submitting answer:', {
                setId,
                questionId,
                answer
            });

            if (!setId || !questionId) {
                console.error('[DataManager:submitAnswer] Missing required parameters:', {
                    setId,
                    questionId
                });
                return null;
            }

            // Get the question from storage
            const question = await this.getQuestion(setId, questionId);
            if (!question) {
                console.error('[DataManager:submitAnswer] Question not found');
                return null;
            }

            // Check if the answer is correct
            let isCorrect = false;
            switch (question.type) {
                case 'single-choice':
                case 'multiple-choice':
                    isCorrect = this.compareArrays(
                        Array.isArray(answer) ? answer : [answer],
                        question.correct_answer
                    );
                    break;
                // ... existing code for other question types ...
            }

            console.log('[DataManager:submitAnswer] Answer check result:', {
                setId,
                questionId,
                isCorrect
            });

            // Update completion status
            const stats = await this.storageManager.updateQuestionCompletion(setId, questionId, isCorrect);
            
            console.log('[DataManager:submitAnswer] Updated completion stats:', {
                setId,
                questionId,
                stats
            });

            return stats;
        } catch (error) {
            console.error('[DataManager:submitAnswer] Error:', error);
            return null;
        }
    }

    async getQuestion(setId, questionId) {
        try {
            console.log('[DataManager:getQuestion] Getting question:', {
                setId,
                questionId
            });

            // ... existing code ...

            return question;
        } catch (error) {
            console.error('[DataManager:getQuestion] Error:', error);
            return null;
        }
    }
} 