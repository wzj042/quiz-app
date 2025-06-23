// 数据管理模块
export default class DataManager {
    constructor() {
        this.STORAGE_VERSION = 2;
        this.STORAGE_KEY = 'quiz_data';
        this.BACKUP_KEY = 'quiz_data_backup';
        this.storage = window.localStorage;
        this.cache = new Map();
        this.initStorage();
    }

    // 初始化存储
    async initStorage() {
        try {
            const data = this.storage.getItem(this.STORAGE_KEY);
            if (!data) {
                await this.resetStorage();
                return;
            }

            const parsed = JSON.parse(data);
            if (parsed.version < this.STORAGE_VERSION) {
                await this.migrateData(parsed);
            }
        } catch (error) {
            console.error('Storage initialization failed:', error);
            // 尝试从备份恢复
            await this.restoreFromBackup();
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

        try {
            await this.saveData(initialData);
        } catch (error) {
            console.error('Failed to reset storage:', error);
            throw new Error('Failed to initialize storage');
        }
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
            if (oldData.data) {
                for (const [key, value] of Object.entries(oldData.data)) {
                    newData.completion[key] = {
                        completed: value.completed || 0,
                        attempts: value.attempts || 0,
                        errors: value.errors || 0,
                        lastAttempt: value.lastAttemptDate || null,
                        history: []
                    };
                }
            }

            // 保存新数据
            await this.saveData(newData);
        } catch (error) {
            console.error('Data migration failed:', error);
            // 恢复备份
            await this.restoreFromBackup();
            throw new Error('Failed to migrate data');
        }
    }

    // 创建备份
    async createBackup() {
        try {
            const currentData = this.storage.getItem(this.STORAGE_KEY);
            if (currentData) {
                this.storage.setItem(this.BACKUP_KEY, currentData);
            }
        } catch (error) {
            console.error('Failed to create backup:', error);
            throw new Error('Failed to create data backup');
        }
    }

    // 从备份恢复
    async restoreFromBackup() {
        try {
            const backup = this.storage.getItem(this.BACKUP_KEY);
            if (backup) {
                this.storage.setItem(this.STORAGE_KEY, backup);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to restore from backup:', error);
            throw new Error('Failed to restore data from backup');
        }
    }

    // 保存数据
    async saveData(data) {
        try {
            // 检查存储空间
            if (!this.hasEnoughStorage()) {
                await this.cleanupOldData();
            }

            const serialized = JSON.stringify(data);
            this.storage.setItem(this.STORAGE_KEY, serialized);
        } catch (error) {
            console.error('Failed to save data:', error);
            throw new Error('Failed to save data');
        }
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
            return false;
        }
    }

    // 清理旧数据
    async cleanupOldData() {
        try {
            const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

            // 清理超过一个月的历史记录
            for (const key in data.completion) {
                const completion = data.completion[key];
                if (completion.history) {
                    completion.history = completion.history.filter(record => 
                        new Date(record.date) > oneMonthAgo
                    );
                }
            }

            await this.saveData(data);
        } catch (error) {
            console.error('Failed to cleanup old data:', error);
            throw new Error('Failed to cleanup old data');
        }
    }

    // 获取题目完成状态
    getQuestionCompletion(questionId) {
        try {
            const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
            return data.completion[questionId] || null;
        } catch (error) {
            console.error('Failed to get question completion:', error);
            return null;
        }
    }

    // 更新题目完成状态
    async updateQuestionCompletion(questionId, result) {
        try {
            const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
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
            completion.attempts++;
            if (!result.isCorrect) {
                completion.errors++;
            }
            completion.completed = 1;
            completion.lastAttempt = now;

            // 添加到历史记录
            completion.history.push({
                date: now,
                isCorrect: result.isCorrect,
                timeSpent: result.timeSpent,
                answer: result.answer
            });

            // 只保留最近的100条记录
            if (completion.history.length > 100) {
                completion.history = completion.history.slice(-100);
            }

            await this.saveData(data);
        } catch (error) {
            console.error('Failed to update question completion:', error);
            throw new Error('Failed to update question completion');
        }
    }

    // 获取设置
    getSettings() {
        try {
            const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
            return data.settings || {};
        } catch (error) {
            console.error('Failed to get settings:', error);
            return {};
        }
    }

    // 更新设置
    async updateSettings(settings) {
        try {
            const data = JSON.parse(this.storage.getItem(this.STORAGE_KEY));
            data.settings = { ...data.settings, ...settings };
            await this.saveData(data);
        } catch (error) {
            console.error('Failed to update settings:', error);
            throw new Error('Failed to update settings');
        }
    }
} 