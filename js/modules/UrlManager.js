export default class UrlManager {
    constructor() {
        this.currentState = null;
        this.currentParams = {};
    }

    async init() {
        window.addEventListener('popstate', this.handlePopState.bind(this));
        window.addEventListener('hashchange', this.handleUrlChange.bind(this));
        window.addEventListener('popstate', this.handleUrlChange.bind(this));
        return Promise.resolve();
    }

    cleanup() {
        window.removeEventListener('popstate', this.handlePopState.bind(this));
        window.removeEventListener('hashchange', this.handleUrlChange.bind(this));
        window.removeEventListener('popstate', this.handleUrlChange.bind(this));
    }

    handlePopState(event) {
        // 处理浏览器的前进/后退
        console.log('[handlePopState] State changed:', event.state);
        if (event.state) {
            this.currentState = event.state.state;
            this.currentParams = event.state.params;
        }
    }

    handleUrlChange(event) {
        // 处理URL变化
        console.log('[handleUrlChange] URL changed:', event);
        const urlParams = new URLSearchParams(window.location.search);
        this.currentState = urlParams.get('state') || 'home';
        
        // 更新当前参数
        this.currentParams = {};
        for (const [key, value] of urlParams.entries()) {
            if (key !== 'state') {
                this.currentParams[key] = value;
            }
        }
    }

    updateUrlParams(state, params = {}) {
        this.currentState = state;
        this.currentParams = { ...params };

        const urlParams = new URLSearchParams();
        urlParams.set('state', state);
        
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                urlParams.set(key, value);
            }
        }
        
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        window.history.pushState({ state, params }, '', newUrl);
    }

    getCurrentState() {
        return this.currentState;
    }

    getCurrentParams() {
        return this.currentParams;
    }

    getParam(key) {
        return this.currentParams[key];
    }

    async handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const bankParam = urlParams.get('bank');
        const stateParam = urlParams.get('state');
        const modeParam = urlParams.get('mode');
        const qidParam = urlParams.get('qid');
        
        console.log('[handleUrlParams] Processing URL parameters:', {
            bank: bankParam,
            state: stateParam,
            mode: modeParam,
            qid: qidParam
        });
        
        if (!bankParam) {
            console.log('[handleUrlParams] No bank parameter, staying on home page');
            return;
        }

        // 验证题库是否存在
        const bankExists = this.appState.fileList.some(f => f.file === bankParam);
        if (!bankExists) {
            console.error('[handleUrlParams] Bank not found:', bankParam);
            throw new Error('找不到指定的题库');
        }

        return {
            bank: bankParam,
            state: stateParam,
            mode: modeParam,
            qid: qidParam
        };
    }

    getCurrentUrl() {
        return window.location.href;
    }

    getUrlParams() {
        return new URLSearchParams(window.location.search);
    }
} 