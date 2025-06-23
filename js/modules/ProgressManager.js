// 进度管理模块
export default class ProgressManager {
    constructor() {
        this.progress = 0;
        this.status = 'idle';
        this.message = '';
        this.error = null;
        this.listeners = new Set();
    }

    // 添加状态监听器
    addListener(callback) {
        this.listeners.add(callback);
    }

    // 移除状态监听器
    removeListener(callback) {
        this.listeners.delete(callback);
    }

    // 通知所有监听器
    notifyListeners() {
        const state = {
            progress: this.progress,
            status: this.status,
            message: this.message,
            error: this.error
        };
        this.listeners.forEach(callback => callback(state));
    }

    // 开始加载
    start(message = 'Loading...') {
        this.progress = 0;
        this.status = 'loading';
        this.message = message;
        this.error = null;
        this.notifyListeners();
    }

    // 更新进度
    update(progress, message = null) {
        this.progress = Math.min(Math.max(progress, 0), 100);
        if (message) {
            this.message = message;
        }
        this.notifyListeners();
    }

    // 完成加载
    complete(message = 'Complete') {
        this.progress = 100;
        this.status = 'complete';
        this.message = message;
        this.error = null;
        this.notifyListeners();
    }

    // 设置错误状态
    setError(error, message = 'Error occurred') {
        this.status = 'error';
        this.message = message;
        this.error = error;
        this.notifyListeners();
    }

    // 重置状态
    reset() {
        this.progress = 0;
        this.status = 'idle';
        this.message = '';
        this.error = null;
        this.notifyListeners();
    }

    // 获取当前状态
    getState() {
        return {
            progress: this.progress,
            status: this.status,
            message: this.message,
            error: this.error
        };
    }

    // 是否正在加载
    isLoading() {
        return this.status === 'loading';
    }

    // 是否已完成
    isComplete() {
        return this.status === 'complete';
    }

    // 是否出错
    hasError() {
        return this.status === 'error';
    }
} 