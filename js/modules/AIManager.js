class AIManager {
    constructor() {
        this.selectedPresetId = localStorage.getItem('AI_SELECTED_PRESET') || 'glm-4-flash';
        this.logLevel = localStorage.getItem('AI_LOG_LEVEL') || 'info';
        this.autoScoring = localStorage.getItem('AI_AUTO_SCORING') === 'true';
        this.logs = [];
        this.maxLogs = 100; // 最多保存100条日志
        
        this.log('Initializing AIManager...', 'info');
        this.log(`Log level set to ${this.logLevel}`, 'debug');
        this.log(`Auto scoring set to ${this.autoScoring}`, 'debug');

        // 预设模型配置
        this.presets = {
            'deepseek-chat': {
                name: 'DeepSeek Chat',
                endpoint: 'https://api.deepseek.com/v1/chat/completions',
                model: 'deepseek-chat',
                provider: 'deepseek'
            },
            // 'deepseek-reasoner': {
            //     name: 'DeepSeek Reasoner',
            //     endpoint: 'https://api.deepseek.com/v1/chat/completions',
            //     model: 'deepseek-reasoner',
            //     provider: 'deepseek'
            // },
            // 'glm-4-flash': {
            //     name: 'GLM-4-Flash',
            //     endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions/v1',
            //     model: 'glm-4-flash-250414',
            //     provider: 'zhipu'
            // }
        };
        this.log('Default presets initialized', 'debug', this.presets);

        // 从本地存储加载配置
        this.loadConfig();
        this.log('AIManager initialization completed', 'info');

        // 添加一个标记来识别实例
        Object.defineProperty(this, '_isAIManager', {
            value: true,
            writable: false,
            enumerable: true,
            configurable: false
        });
    }

    // 检查是否是 AIManager 实例（包括 Vue Proxy）
    static isAIManager(obj) {
        return obj && obj._isAIManager === true;
    }

    // 日志相关方法
    log(message, level = 'info', data = null) {
        const levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };

        if (levels[level] >= levels[this.logLevel]) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level,
                message,
                data
            };

            // 添加日志到数组
            this.logs.unshift(logEntry);
            
            // 限制日志数量
            if (this.logs.length > this.maxLogs) {
                this.logs.pop();
            }

            // 控制台输出
            const logStyle = {
                debug: 'color: #6c757d',
                info: 'color: #17a2b8',
                warn: 'color: #ffc107',
                error: 'color: #dc3545'
            };

            console.log(
                `%c[${level.toUpperCase()}] ${logEntry.timestamp}`,
                logStyle[level],
                message,
                data || ''
            );
        }
    }

    // 获取日志
    getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return this.logs;
    }

    // 清除日志
    clearLogs() {
        this.logs = [];
        this.log('Logs cleared', 'info');
    }

    // 设置日志级别
    setLogLevel(level) {
        if (['debug', 'info', 'warn', 'error'].includes(level)) {
            this.logLevel = level;
            localStorage.setItem('AI_LOG_LEVEL', level);
            this.log(`Log level set to ${level}`, 'info');
        } else {
            this.log(`Invalid log level: ${level}`, 'error');
        }
    }

    // 加载配置
    loadConfig() {
        try {
            // 加载自定义预设
            const customPresets = JSON.parse(localStorage.getItem('AI_CUSTOM_PRESETS') || '{}');
            this.log('Loading custom presets from storage', 'debug', customPresets);
            
            if (Object.keys(customPresets).length > 0) {
                this.presets = { ...this.presets, ...customPresets };
                this.log('Custom presets merged with defaults', 'info', {
                    totalPresets: Object.keys(this.presets).length,
                    customPresets: Object.keys(customPresets)
                });
            }

            // 加载当前配置
            const savedConfig = JSON.parse(localStorage.getItem('AI_CONFIG') || '{}');
            this.log('Loading saved configuration', 'debug', savedConfig);

            // 确保使用当前选中的预设
            const currentPreset = this.getCurrentPreset();
            if (!currentPreset) {
                throw new Error('Invalid preset selected');
            }

            this.currentConfig = currentPreset;
            this.API_KEY = this.getApiKey(currentPreset.provider) || '';

            this.log('Configuration loaded successfully', 'info', {
                currentModel: this.currentConfig?.model,
                hasApiKey: !!this.API_KEY,
                selectedPreset: this.currentConfig?.name,
                provider: this.currentConfig?.provider
            });
        } catch (error) {
            this.log('Failed to load configuration', 'error', {
                error: error.message,
                stack: error.stack
            });
            // 设置默认配置
            this.currentConfig = this.presets['deepseek-chat'];
            this.API_KEY = '';
            this.log('Fallback to default configuration', 'warn', {
                model: this.currentConfig.model
            });
        }
    }

    // 保存配置
    saveConfig() {
        localStorage.setItem('AI_CONFIG', JSON.stringify({
            config: this.currentConfig,
            apiKey: this.API_KEY
        }));
    }

    // 获取所有预设
    getPresets() {
        return this.presets;
    }

    // 获取指定 provider 的 API Key
    getApiKey(provider) {
        return localStorage.getItem(`AI_API_KEY_${provider}`) || '';
    }

    // 设置指定 provider 的 API Key
    setApiKey(provider, key) {
        localStorage.setItem(`AI_API_KEY_${provider}`, key);
        this.log('debug', `API Key updated for provider: ${provider}`);
    }

    // 删除指定 provider 的 API Key
    deleteApiKey(provider) {
        localStorage.removeItem(`AI_API_KEY_${provider}`);
        // 如果删除的是当前 provider 的 key，同时禁用自动评分
        if (provider === this.getCurrentProvider()) {
            this.setAutoScoring(false);
        }
        this.log('debug', `API Key deleted for provider: ${provider}`);
    }

    // 获取当前选中预设的 provider
    getCurrentProvider() {
        const preset = this.getCurrentPreset();
        return preset ? preset.provider : null;
    }

    // 设置选中的预设
    setSelectedPreset(presetId) {
        if (this.presets[presetId]) {
            this.selectedPresetId = presetId;
            this.currentConfig = this.presets[presetId];
            localStorage.setItem('AI_SELECTED_PRESET', presetId);
            this.log('debug', `Selected preset changed to ${presetId}`, this.currentConfig);
            this.saveConfig();
        } else {
            throw new Error('Invalid preset ID');
        }
    }

    // 获取当前选中的预设
    getCurrentPreset() {
        return this.presets[this.selectedPresetId];
    }

    // 生成请求头
    _generateHeaders() {
        if (!this.hasApiKey()) {
            throw new Error('API Key not set');
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        // 根据不同提供商设置不同的认证头
        if (this.currentConfig.provider === 'zhipu') {
            headers['Authorization'] = `Bearer ${this.API_KEY}`;
        } else {
            headers['Authorization'] = `Bearer ${this.API_KEY}`;
        }

        return headers;
    }

    // 流式调用
    async *streamChat(messages, options = {}) {
        const preset = this.getCurrentPreset();
        if (!preset) {
            throw new Error('Invalid preset selected');
        }

        const apiKey = this.getApiKey(preset.provider);
        if (!apiKey) {
            throw new Error(`API Key not set for provider: ${preset.provider}`);
        }
        
        this.log('debug', `Streaming chat with ${preset.name}`, {
            provider: preset.provider,
            model: preset.model
        });

        const requestBody = {
            model: preset.model,
            messages: Array.isArray(messages) ? messages : [{ role: 'user', content: messages }],
            stream: true,
            ...options
        };

        try {
            const response = await fetch(preset.endpoint, {
                method: 'POST',
                headers: this._generateHeaders(),
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.log('error', `API request failed: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (!line.startsWith('data:')) continue;

                    const data = line.slice(5).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        
                        // 根据不同提供商处理流式响应
                        switch (preset.provider) {
                            case 'deepseek': {
                                // DeepSeek的流式响应处理
                                if (json.choices && json.choices[0]) {
                                    const { delta } = json.choices[0];
                                    if (delta) {
                                        // 处理思维链内容
                                        if (delta.reasoning_content) {
                                            this.log('debug', 'Received reasoning content chunk', delta.reasoning_content);
                                            yield {
                                                type: 'reasoning',
                                                content: delta.reasoning_content
                                            };
                                        }
                                        // 处理最终答案内容
                                        if (delta.content) {
                                            this.log('debug', 'Received content chunk', delta.content);
                                            yield {
                                                type: 'answer',
                                                content: delta.content
                                            };
                                        }
                                    }
                                }
                                break;
                            }
                            case 'zhipu': {
                                // 智谱AI的流式响应处理
                                if (json.choices && json.choices[0]) {
                                    const { delta, finish_reason } = json.choices[0];
                                    
                                    if (delta) {
                                        // 处理内容
                                        if (delta.content) {
                                            this.log('debug', 'Received content chunk', delta.content);
                                            yield {
                                                type: 'answer',
                                                content: delta.content
                                            };
                                        }
                                        // 处理工具调用
                                        if (delta.tool_calls) {
                                            this.log('debug', 'Received tool calls', delta.tool_calls);
                                            yield {
                                                type: 'tool_calls',
                                                content: delta.tool_calls
                                            };
                                        }
                                    }
                                    
                                    // 处理结束原因
                                    if (finish_reason) {
                                        this.log('debug', 'Stream finished', { reason: finish_reason });
                                        yield {
                                            type: 'finish',
                                            reason: finish_reason
                                        };
                                    }
                                }
                                break;
                            }
                            default: {
                                // 默认处理方式
                                if (json.choices && json.choices[0]) {
                                    const { delta } = json.choices[0];
                                    if (delta && delta.content) {
                                        this.log('debug', 'Received content chunk', delta.content);
                                        yield {
                                            type: 'answer',
                                            content: delta.content
                                        };
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        this.log('warn', 'Failed to parse streaming response', { line, error });
                        continue;
                    }
                }
            }
        } catch (error) {
            this.log('error', 'Stream chat error', error);
            throw error;
        }
    }

    // 非流式调用
    async chat(messages, options = {}) {
        try {
            const preset = this.getCurrentPreset();
            if (!preset) {
                this.log('error', 'No preset selected');
                throw new Error('No preset selected');
            }

            this.log('debug', 'Starting chat request', {
                messages: messages,
                options: options,
                preset: preset,
                hasApiKey: this.hasApiKey()
            });

            const apiKey = this.getApiKey(preset.provider);
            if (!apiKey) {
                this.log('error', `API Key not set for provider: ${preset.provider}`);
                throw new Error(`API Key not set for provider: ${preset.provider}`);
            }

            // 处理 Vue Proxy 对象
            const processedMessages = messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const requestBody = {
                model: preset.model,
                messages: processedMessages,
                stream: false,
                ...options
            };

            // 如果是 JSON 输出模式，确保 response_format 正确设置
            if (options.response_format?.type === 'json_object') {
                requestBody.response_format = { type: 'json_object' };
            }

            const response = await fetch(preset.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.log('error', 'API request failed', {
                    status: response.status,
                    error: errorText
                });
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.log('debug', 'Received API response', data);

            return data.choices[0]?.message?.content || '';
        } catch (error) {
            this.log('error', 'Chat error:', error);
            throw error;
        }
    }

    async sendMessage(message) {
        if (!this.API_KEY) {
            throw new Error('API Key not set');
        }
        
        const preset = this.presets['deepseek-reasoner'];
        if (!preset) {
            throw new Error('Invalid preset selected');
        }
        
        this.log('debug', `Sending message to ${preset.name}`);
        
        const messages = [{
            role: 'user',
            content: message
        }];
        
        try {
            const response = await fetch(preset.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.API_KEY}`
                },
                body: JSON.stringify({
                    model: preset.model,
                    messages: messages,
                    stream: false // 对于 Reasoner 模型，我们需要完整响应来获取思维链
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }
            
            const data = await response.json();
            this.log('debug', 'Received response from API');
            
            return data;
        } catch (error) {
            this.log('error', `API Error: ${error.message}`);
            throw error;
        }
    }

    // 检查是否已设置 API Key
    hasApiKey() {
        const hasKey = !!this.API_KEY;
        this.log('debug', `Checking API Key availability: ${hasKey}`);
        return hasKey;
    }

    // 获取自动评分设置
    getAutoScoring() {
        return this.autoScoring;
    }

    // 设置自动评分
    setAutoScoring(enabled) {
        this.autoScoring = enabled;
        localStorage.setItem('AI_AUTO_SCORING', enabled);
        this.log(`Auto scoring set to ${enabled}`, 'info');
    }
}

// 导出单例实例和类
export const aiManager = new AIManager();
export default AIManager;