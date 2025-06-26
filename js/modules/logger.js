/**
 * 日志级别枚举
 */
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

/**
 * 日志级别对应的样式
 */
const LOG_STYLES = {
    [LogLevel.DEBUG]: 'color: #7f7f7f',
    [LogLevel.INFO]: 'color: #0077cc',
    [LogLevel.WARN]: 'color: #ff9900',
    [LogLevel.ERROR]: 'color: #cc0000'
};

/**
 * 日志级别对应的标签
 */
const LOG_LABELS = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR'
};

/**
 * 检查是否为生产环境
 * @returns {boolean}
 */
function isProduction() {
    // 如果是本地开发环境，hostname通常是localhost或127.0.0.1
    const hostname = window.location.hostname;
    return !['localhost', '127.0.0.1', ''].includes(hostname);
}

class Logger {
    constructor() {
        // 全局日志级别，默认为INFO
        this.globalLevel = LogLevel.INFO;
        // 模块日志级别配置
        this.moduleConfig = new Map();
        // 是否启用日志
        this.enabled = true;
        // 是否在生产环境
        this.isProduction = isProduction();
    }

    /**
     * 设置全局日志级别
     * @param {LogLevel} level 日志级别
     */
    setGlobalLevel(level) {
        this.globalLevel = level;
    }

    /**
     * 设置模块日志级别
     * @param {string} module 模块名称
     * @param {LogLevel} level 日志级别
     */
    setModuleLevel(module, level) {
        this.moduleConfig.set(module, level);
    }

    /**
     * 启用/禁用日志
     * @param {boolean} enabled 是否启用
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * 获取模块的日志级别
     * @param {string} module 模块名称
     * @returns {LogLevel} 日志级别
     */
    getModuleLevel(module) {
        return this.moduleConfig.get(module) ?? this.globalLevel;
    }

    /**
     * 创建模块日志记录器
     * @param {string} module 模块名称
     * @returns {Object} 日志记录器对象
     */
    getLogger(module) {
        return {
            debug: (...args) => this.log(module, LogLevel.DEBUG, ...args),
            info: (...args) => this.log(module, LogLevel.INFO, ...args),
            warn: (...args) => this.log(module, LogLevel.WARN, ...args),
            error: (...args) => this.log(module, LogLevel.ERROR, ...args)
        };
    }

    /**
     * 记录日志
     * @param {string} module 模块名称
     * @param {LogLevel} level 日志级别
     * @param {...any} args 日志参数
     */
    log(module, level, ...args) {
        // 如果日志被禁用或在生产环境且不是错误日志，则不记录
        if (!this.enabled || (this.isProduction && level < LogLevel.ERROR)) {
            return;
        }

        // 检查日志级别
        const moduleLevel = this.getModuleLevel(module);
        if (level < moduleLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const label = LOG_LABELS[level];
        const style = LOG_STYLES[level];

        // 格式化日志消息
        const prefix = `%c[${timestamp}] [${label}] [${module}]`;
        
        // 如果第一个参数是对象，使用更好的格式化
        if (args.length === 1 && typeof args[0] === 'object') {
            console.groupCollapsed(`${prefix} →`, style);
            console.log(args[0]);
            console.groupEnd();
        } else {
            console.log(prefix, style, ...args);
        }
    }
}

// 创建单例实例
const logger = new Logger();

// 在开发环境下，将logger暴露到全局，方便调试
if (!logger.isProduction) {
    window.__logger = logger;
}

export default logger; 