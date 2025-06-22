// 键盘事件处理模块
export default class KeyboardManager {
    constructor(app) {
        this.app = app;
        this.currentFocusIndex = -1;
        this.init();
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
        const focusable = this.getFocusableElements();
        
        // 处理方向键导航
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            this.handleArrowKeys(e, focusable);
        }

        // 处理答题界面的键盘操作
        if (this.app.pageState === 'quiz' || this.app.pageState === 'orderQuiz' || this.app.pageState === 'randomQuiz') {
            this.handleQuizKeys(e, focusable);
        }

        // 结果页面的空格键处理
        if (this.app.pageState === 'result' && (e.code === 'Space' || e.code === 'Enter')) {
            e.preventDefault();
            this.app.pageState = 'home';
        }

        // 主页的空格键处理
        if (this.app.pageState === 'home' && (e.code === 'Space' || e.code === 'Enter')) {
            e.preventDefault();
            window.location.reload();
        }
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

    handleQuizKeys(e, focusable) {
        // 数字键处理选项
        if (e.key >= '1' && e.key <= '4') {
            this.handleNumberKeys(e);
        }

        // 空格键处理
        if (e.code === 'Space') {
            this.handleSpaceKey(e, focusable);
        }

        // Alt + C 切换显示答案
        if (e.altKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            this.app.showAnswer = !this.app.showAnswer;
        }
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
} 