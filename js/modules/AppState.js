export default class AppState {
    constructor() {
        // Initialize the state container
        this._state = {};
        this._subscribers = new Set();
        
        // Define all properties once
        this._defineStateProperties();
        
        // Initialize state values
        this.initState();
    }

    _defineStateProperties() {
        const stateProperties = [
            // Page state
            'pageState',
            'isLoading',
            'loadError',

            // Data state
            'fileList',
            'groupedFileList',
            'chosenSet',
            'bankStats',
            'updateTime',

            // UI state
            'showAnswer',
            'isEditing',
            'editingField',
            'editingContent',
            'showExportButton',
            'showUnsavedModal',
            'showTagsModal',

            // Edit state
            'modifiedCount',
            'dontShowExportReminder',
            'groupedModifiedQuestions',
            'lastExportTimestamp',

            // Filter state
            'selectedTags',
            'topTags',
            'allTags'
        ];

        stateProperties.forEach(key => {
            Object.defineProperty(this, key, {
                get: () => this._state[key],
                set: (value) => {
                    this._state[key] = value;
                    this._notifySubscribers(key, value);
                }
            });
        });
    }

    initState() {
        // Just set the values without redefining properties
        this._state = {
            // Page state
            pageState: 'home',
            isLoading: false,
            loadError: null,

            // Data state
            fileList: [],
            groupedFileList: [],
            chosenSet: null,
            bankStats: {},
            updateTime: null,

            // UI state
            showAnswer: false,
            isEditing: false,
            editingField: null,
            editingContent: '',
            showExportButton: false,
            showUnsavedModal: false,
            showTagsModal: false,

            // Edit state
            modifiedCount: 0,
            dontShowExportReminder: false,
            groupedModifiedQuestions: {},
            lastExportTimestamp: null,

            // Filter state
            selectedTags: [],
            topTags: [],
            allTags: []
        };

        // Notify subscribers of reset
        this._notifySubscribers('reset', null);
    }

    setState(key, value) {
        if (this._state[key] !== undefined) {
            this._state[key] = value;
            this._notifySubscribers(key, value);
            return true;
        }
        return false;
    }

    getState(key) {
        return this._state[key];
    }

    resetState() {
        console.log('[AppState] Resetting state');
        this.initState();
        console.log('[AppState] State reset completed');
    }

    updateBankStats(bankFile, stats) {
        const newBankStats = { ...this._state.bankStats, [bankFile]: stats };
        this.setState('bankStats', newBankStats);
    }

    getBankStats(bankFile) {
        return this._state.bankStats[bankFile] || {
            completed: 0,
            total: 0,
            accuracy: 0
        };
    }

    setUpdateTime(time) {
        this.setState('updateTime', time);
    }

    getUpdateTime() {
        return this._state.updateTime;
    }

    updateTags(topTags, allTags) {
        this.setState('topTags', topTags);
        this.setState('allTags', allTags);
    }

    toggleTag(tag) {
        const selectedTags = [...this._state.selectedTags];
        const index = selectedTags.indexOf(tag);
        if (index === -1) {
            selectedTags.push(tag);
        } else {
            selectedTags.splice(index, 1);
        }
        this.setState('selectedTags', selectedTags);
    }

    clearTags() {
        this.setState('selectedTags', []);
    }

    // Subscribe to state changes
    subscribe(callback) {
        this._subscribers.add(callback);
        return () => this._subscribers.delete(callback);
    }

    // Notify all subscribers of state changes
    _notifySubscribers(key, value) {
        this._subscribers.forEach(callback => callback(key, value));
    }
} 