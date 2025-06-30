// 键盘事件处理模块
export default class KeyboardManager {
    constructor(app) {
        this.app = app;
        this.currentFocusIndex = -1;
        this.enabled = true;
        this.lastKeyPressTime = 0;
        this.keyPressThrottle = 100; // 100ms
        this.maxKeyPressPerSecond = 10;
        this.keyPressCount = 0;
        this.keyPressResetTime = 0;
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.addEventListeners();
    }

    addEventListeners() {
        try {
            document.addEventListener('keydown', this.handleKeyDown);
        } catch (error) {
            console.error('[KeyboardManager:addEventListeners] Failed to add event listener:', error);
        }
    }

    destroy() {
        try {
            document.removeEventListener('keydown', this.handleKeyDown);
        } catch (error) {
            console.error('[KeyboardManager:destroy] Failed to remove event listener:', error);
        }
    }

    getFocusableElements() {
        try {
            const { pageState } = this.app;
            if (!pageState) return [];

            let elements = [];
            
            switch (pageState) {
                case 'home':
                    elements = document.querySelectorAll('#app .quiz-item');
                    break;
                case 'setDescription':
                    elements = document.querySelectorAll('#app .btn');
                    break;
                case 'quiz':
                case 'orderQuiz':
                case 'randomQuiz':
                    const options = document.querySelectorAll('#app .option-item');
                    const submitBtn = document.querySelector('#app .btn');
                    elements = Array.from(options);
                    if (submitBtn) elements.push(submitBtn);
                    break;
                case 'result':
                    elements = document.querySelectorAll('#app .btn');
                    break;
                default:
                    elements = [];
            }

            return Array.from(elements).filter(el => el && el.offsetParent !== null); // 只返回可见元素
        } catch (error) {
            console.error('[KeyboardManager:getFocusableElements] Error:', error);
            return [];
        }
    }

    // 检查按键频率限制
    checkKeyPressLimit() {
        const now = Date.now();
        
        // 重置计数器
        if (now - this.keyPressResetTime >= 1000) {
            this.keyPressCount = 0;
            this.keyPressResetTime = now;
        }

        // 检查频率限制
        if (this.keyPressCount >= this.maxKeyPressPerSecond) {
            console.warn('[KeyboardManager] Key press limit exceeded');
            return false;
        }

        // 检查节流
        if (now - this.lastKeyPressTime < this.keyPressThrottle) {
            return false;
        }

        this.keyPressCount++;
        this.lastKeyPressTime = now;
        return true;
    }

    handleKeyDown(e) {
        try {
            // 检查按键频率限制
            if (!this.checkKeyPressLimit()) {
                e.preventDefault();
                return;
            }

            // 检查当前焦点元素是否为输入框
            const activeElement = document.activeElement;
            if (!activeElement) return;

            const isInputFocused = activeElement.tagName === 'INPUT' || 
                                 activeElement.tagName === 'TEXTAREA' || 
                                 activeElement.isContentEditable ||
                                 activeElement.closest('.modal-content'); // 检查是否在模态框内
            
            // 如果输入框获得焦点或在模态框内，不拦截任何按键
            if (isInputFocused) {
                // 特殊处理：Ctrl+S 保存
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    if (this.app.isEditing && this.app.questionManager?.checkUnsavedChanges()) {
                        this.app.saveCurrentEdit();
                    }
                }
                return;
            }

            const focusable = this.getFocusableElements();
            
            // 上一题/下一题快捷键
            if (e.key === 'q') {
                if (this.app.practiceManager?.currentIndex > 0) {
                    this.app.prevQuestion();
                    e.preventDefault();
                }
                return;
            }
            if (e.key === 'e') {
                if (this.app.practiceManager?.currentIndex < (this.app.practiceManager?.questions?.length || 0) - 1) {
                    this.app.nextQuestion();
                    e.preventDefault();
                }
                return;
            }

            // 如果快捷键被禁用或正在编辑，对其他快捷键不响应
            if (!this.enabled || this.app.isEditing) {
                return;
            }

            // 数字键1-4选择选项
            if (/^[1-4]$/.test(e.key)) {
                const idx = parseInt(e.key) - 1;
                const currentQuestion = this.app.practiceManager?.getCurrentQuestion();
                if (!currentQuestion) return;

                if (currentQuestion.type === 'single-choice') {
                    if (idx < (currentQuestion.options?.length || 0)) {
                        this.app.chosenAnswer = currentQuestion.options[idx];
                    }
                } else if (currentQuestion.type === 'multiple-choice') {
                    if (idx < (currentQuestion.options?.length || 0)) {
                        const option = currentQuestion.options[idx];
                        if (!Array.isArray(this.app.chosenAnswers)) {
                            this.app.chosenAnswers = [];
                        }
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

            // 空格键提交/下一题/返回题目选择
            if (e.key === ' ' || e.key === 'Spacebar') {
                if (this.app.pageState === 'result') {
                    this.app.pageState = 'home';
                } else if (!this.app.showAnswer) {
                    // 检查是否已选择选项
                    if (this.app.hasAnswer()) {
                        this.app.submitAnswer();
                    }
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

                const targetElement = focusable[this.currentFocusIndex];
                if (targetElement && typeof targetElement.focus === 'function') {
                    targetElement.focus();
                }
                return;
            }

            // Shift+C 切换解析显示
            if (e.key === 'C' && e.shiftKey) {
                this.app.showAnswer = !this.app.showAnswer;
                e.preventDefault();
                return;
            }
        } catch (error) {
            console.error('[KeyboardManager:handleKeyDown] Error:', error);
            // 出错时禁用键盘事件处理器
            this.disable();
        }
    }

    // 启用快捷键
    enable() {
        try {
            this.enabled = true;
            this.keyPressCount = 0;
            this.keyPressResetTime = Date.now();
        } catch (error) {
            console.error('[KeyboardManager:enable] Error:', error);
        }
    }

    // 禁用快捷键
    disable() {
        try {
            this.enabled = false;
        } catch (error) {
            console.error('[KeyboardManager:disable] Error:', error);
        }
    }
} 