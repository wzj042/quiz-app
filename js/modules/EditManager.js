export default class EditManager {
    constructor(appState, questionManager) {
        this.appState = appState;
        this.questionManager = questionManager;
    }

    editQuestion() {
        if (this.appState.isPreviewMode) return;
        console.log('Starting edit mode for question:', this.appState.currentQuestion);
        this.questionManager.startEditing(this.appState.currentQuestion);
        this.appState.setState('isEditing', true);
        this.appState.setState('showExportButton', true);
        // 自动切换到解析模式
        this.appState.setState('showAnswer', true);
    }

    enterEditMode(field, content) {
        if (this.appState.isPreviewMode) return;
        console.log('Entering edit mode:', {
            field,
            content,
            currentContent: content || '点击编辑'
        });
        this.appState.setState('editingField', field);
        this.appState.setState('editingContent', content || '');
    }

    exitEditMode() {
        console.log('Exiting edit mode:', {
            field: this.appState.editingField,
            content: this.appState.editingContent,
            question: this.appState.currentQuestion
        });
        
        if (this.appState.editingField && this.appState.editingContent !== undefined) {
            const question = this.appState.currentQuestion;
            if (this.appState.editingField === 'content') {
                question.content = this.appState.editingContent;
            } else if (this.appState.editingField === 'analysis') {
                question.analysis = this.appState.editingContent;
            } else if (this.appState.editingField.startsWith('option-')) {
                const idx = parseInt(this.appState.editingField.split('-')[1]);
                question.options[idx] = this.appState.editingContent;
            }
            this.questionManager.saveCurrentEdit();
            // 更新修改计数
            this.appState.setState('modifiedCount', this.questionManager.getModifiedQuestions().length);
        }
        this.appState.setState('editingField', null);
        this.appState.setState('editingContent', '');
    }

    exitEntireEditMode() {
        if (this.appState.editingField) {
            this.exitEditMode();
        }
        this.appState.setState('isEditing', false);
        this.appState.setState('showAnswer', false);
        this.appState.setState('showExportButton', false);
        this.questionManager.cancelEditing();
    }

    handleExport(questions) {
        const exportData = {
            questions: questions,
            sets: [this.appState.chosenSet]
        };

        const blob = new Blob([JSON.stringify(exportData, null, 4)], 
            { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // 从fileList中获取当前题库的文件名
        const currentFile = this.appState.fileList.find(f => f.name === this.appState.chosenSet.name)?.file;
        a.download = this.questionManager.generateExportFileName(currentFile || 'export');
        a.click();
        URL.revokeObjectURL(url);

        // 更新导出状态
        this.appState.setState('lastExportTimestamp', Date.now());
        this.appState.setState('modifiedCount', 0);
        this.questionManager.clearModifiedQuestions();
        this.appState.setState('showExportButton', false);
        this.appState.setState('isEditing', false);
        this.appState.setState('showUnsavedModal', false);
    }

    exportModifiedData() {
        const modifiedQuestions = this.questionManager.getModifiedQuestions();
        const questions = this.appState.jsonLoader.questions.map(q => {
            if (modifiedQuestions.includes(q.uniqueId)) {
                return { ...q };
            }
            return q;
        });
        this.handleExport(questions);
    }

    checkModifiedQuestions() {
        const modifiedQuestions = this.questionManager.getModifiedQuestions();
        if (modifiedQuestions.length > 0 && !this.appState.dontShowExportReminder) {
            // 只显示当前题库的修改题目
            this.appState.setState('groupedModifiedQuestions', 
                this.appState.jsonLoader.questions.filter(q => modifiedQuestions.includes(q.uniqueId))
            );
            
            // 显示未导出提示模态框
            this.appState.setState('showUnsavedModal', true);
            return true;
        }
        return false;
    }
} 