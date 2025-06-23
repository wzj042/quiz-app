// 键盘事件处理模块
export default class KeyboardManager {
    constructor(app) {
        this.app = app;
        this.currentFocusIndex = -1;
        this.enabled = true;
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.addEventListeners();
    }

    addEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    getFocusableElements() {
        const { pageState } = this.app;
        if (pageState === 'home') {
            return document.querySelectorAll('#app .quiz-item');
        }
        if (pageState === 'setDescription') {
            return document.querySelectorAll('#app .btn');
        }
        if (['quiz', 'orderQuiz', 'randomQuiz'].includes(pageState)) {
            const elements = [];
            const options = document.querySelectorAll('#app .option-item');
            const submitBtn = document.querySelector('#app .btn');
            options.forEach(el => elements.push(el));
            if (submitBtn) {
                elements.push(submitBtn);
            }
            return elements;
        }
        if (pageState === 'result') {
            return document.querySelectorAll('#app .btn');
        }
        return [];
    }

    handleKeyDown(e) {
        // 如果快捷键被禁用或正在编辑，直接返回
        if (!this.enabled || this.app.isEditing) {
            return;
        }

        const focusable = this.getFocusableElements();
        
        // 预览模式下的快捷键
        if (this.app.practiceManager?.isPreviewMode) {
            if (e.key === 'q') {
                this.app.practiceManager.previousQuestion();
                e.preventDefault();
                return;
            }
            if (e.key === 'e') {
                this.app.practiceManager.nextQuestion();
                e.preventDefault();
                return;
            }
            // 在预览模式下，不处理其他快捷键
            return;
        }

        // 数字键1-4选择选项
        if (/^[1-4]$/.test(e.key)) {
            const idx = parseInt(e.key) - 1;
            const currentQuestion = this.app.practiceManager?.getCurrentQuestion();
            if (currentQuestion?.type === 'single-choice') {
                if (idx < currentQuestion.options.length) {
                    this.app.chosenAnswer = currentQuestion.options[idx];
                }
            } else if (currentQuestion?.type === 'multiple-choice') {
                if (idx < currentQuestion.options.length) {
                    const option = currentQuestion.options[idx];
                    const index = this.app.chosenAnswers.indexOf(option);
                    if (index === -1) {
                        this.app.chosenAnswers.push(option);
                    } else {
                        this.app.chosenAnswers.splice(index, 1);
                    }
                }
            }
            e.preventDefault();
            return;
        }

        // 空格键提交/下一题
        if (e.key === ' ' || e.key === 'Spacebar') {
            if (!this.app.showAnswer) {
                this.app.submitAnswer();
            } else {
                this.app.nextQuestion();
            }
            e.preventDefault();
            return;
        }

        // 上下左右键导航
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            if (focusable.length === 0) return;

            e.preventDefault();
            
            if (this.currentFocusIndex === -1) {
                this.currentFocusIndex = 0;
            } else {
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    this.currentFocusIndex = (this.currentFocusIndex + 1) % focusable.length;
                } else {
                    this.currentFocusIndex = (this.currentFocusIndex - 1 + focusable.length) % focusable.length;
                }
            }

            focusable[this.currentFocusIndex].focus();
            return;
        }

        // Shift+C 切换解析显示
        if (e.key === 'C' && e.shiftKey) {
            this.app.showAnswer = !this.app.showAnswer;
            e.preventDefault();
            return;
        }
    }

    // 启用快捷键
    enable() {
        this.enabled = true;
    }

    // 禁用快捷键
    disable() {
        this.enabled = false;
    }
} 