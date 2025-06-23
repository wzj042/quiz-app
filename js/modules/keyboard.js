// 键盘事件处理模块
export default class KeyboardManager {
    constructor(app) {
        this.app = app;
        this.currentFocusIndex = -1;
        this.enabled = true;
        this.handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this.handleKeyDown);
    }

    init() {
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    destroy() {
        window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    }

    getFocusableElements() {
        const { pageState } = this.app;
        if (pageState === 'home') {
            return document.querySelectorAll('#app .quiz-item');
        }
        if(pageState === 'setDescription'){
            return document.querySelectorAll('#app .btn');
        }
        if (pageState === 'quiz' || pageState === 'orderQuiz' || pageState === 'randomQuiz') {
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
        // 如果快捷键被禁用，直接返回
        if (!this.enabled) {
            return;
        }

        const focusable = this.getFocusableElements();
        
        // 预览模式下的快捷键
        if (this.app.isPreviewMode) {
            if (e.key === 'q') {
                this.prevQuestion();
                e.preventDefault();
                return;
            }
            if (e.key === 'e') {
                this.nextQuestion();
                e.preventDefault();
                return;
            }
            // 在预览模式下，不处理其他快捷键
            return;
        }

        // 数字键1-4选择选项
        if (/^[1-4]$/.test(e.key)) {
            this.handleNumberKeys(e);
            return;
        }

        // 空格键提交/下一题
        if (e.key === ' ' || e.key === 'Spacebar') {
            this.handleSpaceKey(e, focusable);
            return;
        }

        // 上下左右键导航
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            this.handleArrowKeys(e, focusable);
            return;
        }

        // Shift+C 切换解析显示
        if (e.key === 'C' && e.shiftKey) {
            this.app.showAnswer = !this.app.showAnswer;
            e.preventDefault();
            return;
        }
    }

    isEditingSubjectiveQuestion() {
        const { currentQuestion, pageState } = this.app;
        if (!currentQuestion || !['quiz', 'orderQuiz', 'randomQuiz'].includes(pageState)) {
            return false;
        }

        // 检查是否正在编辑填空题或简答题
        if (currentQuestion.type === 'short-answer') {
            const textarea = document.querySelector('textarea');
            return textarea && document.activeElement === textarea;
        }

        if (currentQuestion.type === 'fill-in-blank') {
            const inputs = document.querySelectorAll('.fill-blank-item input');
            return Array.from(inputs).some(input => document.activeElement === input);
        }

        return false;
    }

    handleArrowKeys(e, focusable) {
        e.preventDefault();
        if (focusable.length === 0) return;

        if(this.currentFocusIndex === -1) {
            this.currentFocusIndex = 0;
        } else {
            let nextIndex;
            if(e.key === 'ArrowUp' || e.key === 'ArrowLeft'){
                nextIndex = this.currentFocusIndex - 1;
            } else {
                nextIndex = this.currentFocusIndex + 1;
            }
            if(nextIndex < 0){
                nextIndex = focusable.length - 1;
            } else if (nextIndex >= focusable.length) {
                nextIndex = 0;
            }
            this.currentFocusIndex = nextIndex;
        }

        focusable[this.currentFocusIndex].focus();
    }

    handleNumberKeys(e) {
        const idx = parseInt(e.key, 10) - 1;
        const opts = this.app.currentQuestion.options || [];
        if (idx < 0 || idx >= opts.length) return;

        if (this.app.currentQuestion.type === 'single-choice') {
            if (!this.app.showAnswer) {
                this.app.chosenAnswer = opts[idx];
            }
        } else if (this.app.currentQuestion.type === 'multiple-choice') {
            const val = opts[idx];
            const foundIndex = this.app.chosenAnswers.indexOf(val);
            if (foundIndex === -1) {
                this.app.chosenAnswers.push(val);
            } else {
                this.app.chosenAnswers.splice(foundIndex, 1);
            }
        }
    }

    handleSpaceKey(e, focusable) {
        e.preventDefault();
        if(focusable[this.currentFocusIndex]?.classList?.contains('option-item')) {
            this.handleOptionSelection(focusable[this.currentFocusIndex]);
        } else {
            if (!this.app.showAnswer) {
                this.app.submitAnswer();
            } else {
                this.app.nextQuestion();
            }
        }
    }

    handleOptionSelection(element) {
        if (this.app.currentQuestion.type === 'single-choice') {
            if (!this.app.showAnswer) {
                const opt = element.querySelector('input').value;
                this.app.chosenAnswer = opt;
            }
        } else if (this.app.currentQuestion.type === 'multiple-choice') {
            const opt = element.querySelector('input').value;
            const foundIndex = this.app.chosenAnswers.indexOf(opt);
            if (foundIndex === -1) {
                this.app.chosenAnswers.push(opt);
            } else {
                this.app.chosenAnswers.splice(foundIndex, 1);
            }
        }
    }

    prevQuestion() {
        if (this.app.currentIndex > 0) {
            this.app.currentIndex--;
            this.app.resetAnswerState();
            this.app.showAnswer = true; // 在预览模式下自动显示答案
        }
    }

    nextQuestion() {
        if (this.app.currentIndex < this.app.quizList.length - 1) {
            this.app.currentIndex++;
            this.app.resetAnswerState();
            this.app.showAnswer = true; // 在预览模式下自动显示答案
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