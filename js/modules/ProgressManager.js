// 进度管理模块
export default class ProgressManager {
    constructor() {
        this.progress = 0;
        this.status = 'idle';
        this.message = '';
        this.error = null;
        this.listeners = new Set();
        this.maxListeners = 100;
        this.maxMessageLength = 1000;
        this.notifyTimeout = 100; // 100ms
        this.lastNotifyTime = 0;
        this.pendingNotification = false;
        this.validStatuses = ['idle', 'loading', 'complete', 'error'];
    }

    // 添加状态监听器
    addListener(callback) {
        try {
            if (typeof callback !== 'function') {
                throw new Error('Listener must be a function');
            }

            if (this.listeners.size >= this.maxListeners) {
                throw new Error('Maximum number of listeners exceeded');
            }

            this.listeners.add(callback);
            return true;
        } catch (error) {
            console.error('[addListener] Failed:', error);
            return false;
        }
    }

    // 移除状态监听器
    removeListener(callback) {
        try {
            if (typeof callback !== 'function') {
                console.warn('[removeListener] Invalid callback');
                return false;
            }

            return this.listeners.delete(callback);
        } catch (error) {
            console.error('[removeListener] Failed:', error);
            return false;
        }
    }

    // 通知所有监听器
    notifyListeners() {
        try {
            const now = Date.now();
            
            // 如果距离上次通知时间太短，延迟通知
            if (now - this.lastNotifyTime < this.notifyTimeout) {
                if (!this.pendingNotification) {
                    this.pendingNotification = true;
                    setTimeout(() => {
                        this.pendingNotification = false;
                        this.lastNotifyTime = Date.now();
                        this._executeNotification();
                    }, this.notifyTimeout);
                }
                return;
            }

            this.lastNotifyTime = now;
            this._executeNotification();
        } catch (error) {
            console.error('[notifyListeners] Failed:', error);
        }
    }

    // 执行通知
    _executeNotification() {
        try {
            const state = this.getState();
            const deadListeners = new Set();

            // 通知所有监听器
            this.listeners.forEach(callback => {
                try {
                    callback(state);
                } catch (error) {
                    console.error('[_executeNotification] Listener failed:', error);
                    deadListeners.add(callback);
                }
            });

            // 移除失败的监听器
            deadListeners.forEach(callback => {
                this.listeners.delete(callback);
            });
        } catch (error) {
            console.error('[_executeNotification] Failed:', error);
        }
    }

    // 开始加载
    start(message = 'Loading...') {
        try {
            if (typeof message !== 'string') {
                message = 'Loading...';
            }

            message = this._sanitizeMessage(message);

            this.progress = 0;
            this.status = 'loading';
            this.message = message;
            this.error = null;
            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('[start] Failed:', error);
            return false;
        }
    }

    // 更新进度
    update(progress, message = null) {
        try {
            // 验证进度值
            if (typeof progress !== 'number' || isNaN(progress)) {
                throw new Error('Invalid progress value');
            }

            this.progress = Math.min(Math.max(progress, 0), 100);

            if (message !== null) {
                if (typeof message !== 'string') {
                    throw new Error('Message must be a string');
                }
                this.message = this._sanitizeMessage(message);
            }

            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('[update] Failed:', error);
            return false;
        }
    }

    // 完成加载
    complete(message = 'Complete') {
        try {
            if (typeof message !== 'string') {
                message = 'Complete';
            }

            message = this._sanitizeMessage(message);

            this.progress = 100;
            this.status = 'complete';
            this.message = message;
            this.error = null;
            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('[complete] Failed:', error);
            return false;
        }
    }

    // 设置错误状态
    setError(error, message = 'Error occurred') {
        try {
            if (typeof message !== 'string') {
                message = 'Error occurred';
            }

            message = this._sanitizeMessage(message);

            this.status = 'error';
            this.message = message;
            this.error = error instanceof Error ? error : new Error(String(error));
            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('[setError] Failed:', error);
            return false;
        }
    }

    // 重置状态
    reset() {
        try {
            this.progress = 0;
            this.status = 'idle';
            this.message = '';
            this.error = null;
            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('[reset] Failed:', error);
            return false;
        }
    }

    // 获取当前状态
    getState() {
        try {
            return {
                progress: this.progress,
                status: this.validStatuses.includes(this.status) ? this.status : 'error',
                message: this.message || '',
                error: this.error
            };
        } catch (error) {
            console.error('[getState] Failed:', error);
            return {
                progress: 0,
                status: 'error',
                message: 'Failed to get state',
                error: error
            };
        }
    }

    // 是否正在加载
    isLoading() {
        try {
            return this.status === 'loading';
        } catch (error) {
            console.error('[isLoading] Failed:', error);
            return false;
        }
    }

    // 是否已完成
    isComplete() {
        try {
            return this.status === 'complete';
        } catch (error) {
            console.error('[isComplete] Failed:', error);
            return false;
        }
    }

    // 是否出错
    hasError() {
        try {
            return this.status === 'error';
        } catch (error) {
            console.error('[hasError] Failed:', error);
            return false;
        }
    }

    // 清理消息内容
    _sanitizeMessage(message) {
        try {
            if (typeof message !== 'string') {
                return '';
            }

            // 移除可能的XSS内容
            message = message
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+="[^"]*"/g, '')
                .replace(/javascript:/gi, '')
                .trim();

            // 限制长度
            return message.length > this.maxMessageLength ? 
                message.substring(0, this.maxMessageLength) + '...' : 
                message;
        } catch (error) {
            console.error('[_sanitizeMessage] Failed:', error);
            return '';
        }
    }
} 