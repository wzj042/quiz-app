export default class NavigationManager {
    constructor(appState, urlManager, questionManager) {
        this.appState = appState;
        this.urlManager = urlManager;
        this.questionManager = questionManager;
        this.handleGlobalBackShortcut = this.handleGlobalBackShortcut.bind(this);
    }

    async init() {
        window.addEventListener('keydown', this.handleGlobalBackShortcut);
        return Promise.resolve();
    }

    cleanup() {
        window.removeEventListener('keydown', this.handleGlobalBackShortcut);
    }

    goBack() {
        console.log('[goBack] Called, pageState:', this.appState.pageState, 'isEditing:', this.appState.isEditing);
        if (this.appState.isEditing) {
            if (this.questionManager.checkUnsavedChanges()) {
                this.showUnsavedDialog('setDescription');
                return;
            } else {
                this.exitEntireEditMode();
            }
        }
        
        // 获取当前题库文件名
        const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet?.name)?.file;
        console.log('[goBack] Current bank file:', currentFile);
        
        // 返回题库描述页面时保持bank参数
        console.log('[goBack] updatePageState to setDescription');
        this.updatePageState('setDescription', { bank: currentFile });
    }

    goHome() {
        console.log('[goHome] Called, pageState:', this.appState.pageState);
        if (this.appState.isEditing) {
            this.exitEntireEditMode();
        }
        // 清除所有状态和URL参数
        this.appState.setState('chosenSet', null);
        this.questionManager.clearEditHistory();
        this.appState.setState('showExportButton', false);
        this.updatePageState('home');
    }

    updatePageState(newState, params = {}) {
        console.log('[updatePageState] from:', this.appState.pageState, 'to:', newState, 'params:', params);
        
        // 检查未导出的修改
        if (this.appState.modifiedCount > 0 && !this.appState.dontShowExportReminder && 
            (!this.appState.lastExportTimestamp || Date.now() - this.appState.lastExportTimestamp > 1000) &&
            !this.appState.isEditing) {
            const hasUnsaved = this.checkModifiedQuestions();
            if (hasUnsaved) {
                return;
            }
        }
        
        // 检查未保存的编辑
        if (this.appState.isEditing && this.questionManager.checkUnsavedChanges()) {
            this.showUnsavedDialog(newState);
            return;
        }
        
        this.appState.setState('pageState', newState);
        
        // 更新URL参数
        this.urlManager.updateUrlParams(newState, params);
        
        if (newState === 'home') {
            this.questionManager.clearEditHistory();
            this.appState.setState('showExportButton', false);
        }
    }

    showUnsavedDialog(action) {
        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';
        dialog.innerHTML = `
            <div class="modal-content modal-btn">
                <h3>未保存的修改</h3>
                <p>当前题目有未保存的修改，请选择操作：</p>
                <div class="modal-btn-group">
                    <button class="btn btn-continue-edit" id="continueEdit">继续编辑</button>
                    <button class="btn btn-save-export" id="saveAndExport">保存导出</button>
                    <button class="btn btn-discard" id="discardAndContinue">放弃修改</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // 点击遮罩层关闭对话框（继续编辑）
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
            }
        });

        // 继续编辑
        dialog.querySelector('#continueEdit').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });

        // 保存并导出
        dialog.querySelector('#saveAndExport').addEventListener('click', () => {
            this.questionManager.saveCurrentEdit();
            this.exportModifiedData();
            document.body.removeChild(dialog);
            this.handleActionAfterSave(action);
        });

        // 放弃修改并继续
        dialog.querySelector('#discardAndContinue').addEventListener('click', () => {
            this.questionManager.cancelEditing();
            document.body.removeChild(dialog);
            this.handleActionAfterSave(action);
        });
    }

    handleActionAfterSave(action) {
        switch(action) {
            case 'next':
                this.practiceManager.currentIndex++;
                this.questionManager.startEditing(this.practiceManager.questions[this.practiceManager.currentIndex]);
                break;
            case 'prev':
                this.practiceManager.currentIndex--;
                this.questionManager.startEditing(this.practiceManager.questions[this.practiceManager.currentIndex]);
                break;
            case 'setDescription':
            case 'home':
                this.exitEntireEditMode();
                this.appState.setState('pageState', action);
                break;
        }
        
        // 更新URL参数
        if (action === 'next' || action === 'prev') {
            this.urlManager.updateUrlParams('quiz', {
                mode: this.getCurrentMode(),
                qid: this.practiceManager.currentIndex + 1
            });
        }
    }

    exitEntireEditMode() {
        if (this.appState.editingField) {
            this.questionManager.exitEditMode();
        }
        this.appState.setState('isEditing', false);
        this.appState.setState('showAnswer', false);
        this.appState.setState('showExportButton', false);
        this.questionManager.cancelEditing();
    }

    getCurrentMode() {
        if (!this.practiceManager) return 'all';
        if (this.appState.isEditing) return 'preview';
        if (this.practiceManager.mode === 'random') return 'random';
        if (this.practiceManager.mode === 'error-rate') return 'wrong';
        return 'all';
    }

    handleGlobalBackShortcut(e) {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        if (e.altKey && (e.key === 'h' || e.key === 'H')) {
            console.log('[handleGlobalBackShortcut] Alt+H detected, pageState:', this.appState.pageState);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            switch (this.appState.pageState) {
                case 'quiz':
                case 'orderQuiz':
                case 'randomQuiz':
                    if (!this.appState.isEditing) {
                        this.goBack();
                    }
                    break;
                case 'setDescription':
                    this.goHome();
                    break;
            }
            return false;
        }
    }
} 