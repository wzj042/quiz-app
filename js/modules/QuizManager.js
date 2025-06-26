export default class QuizManager {
    constructor(appState, practiceManager, storageManager) {
        this.appState = appState;
        this.practiceManager = practiceManager;
        this.storageManager = storageManager;
        this.chosenAnswer = '';
        this.chosenAnswers = [];
        this.shortAnswerText = '';
        this.fillInAnswers = [];
        this.currentSessionCompleted = new Set();
    }

    submitAnswer() {
        const currentQuestion = this.practiceManager.getCurrentQuestion();
        if (!currentQuestion) return;

        let answer;
        let isCorrect = false;

        switch (currentQuestion.type) {
            case 'single-choice':
                answer = this.chosenAnswer;
                isCorrect = currentQuestion.correct_answer.includes(answer);
                break;
            case 'multiple-choice':
                answer = [...this.chosenAnswers].sort();
                isCorrect = this.compareArrays(answer, currentQuestion.correct_answer);
                break;
            case 'fill-in-blank':
                answer = this.fillInAnswers;
                isCorrect = this.compareArrays(answer, currentQuestion.correct_answer);
                break;
            case 'short-answer':
                answer = this.shortAnswerText;
                isCorrect = currentQuestion.correct_answer.some(ans => 
                    answer.toLowerCase().includes(ans.toLowerCase())
                );
                break;
        }

        // 记录完成状态
        this.currentSessionCompleted.add(currentQuestion.uniqueId);
        
        // 更新题目完成状态
        const setId = this.appState.chosenSet.isCrossPractice ? 
            currentQuestion.sourceBank : this.appState.chosenSet.id;
        this.storageManager.updateQuestionCompletion(setId, currentQuestion.uniqueId, isCorrect);
        
        this.appState.setState('showAnswer', true);
        return isCorrect;
    }

    handleOptionChange(option, isSingleChoice) {
        if (isSingleChoice) {
            this.chosenAnswer = option;
        } else {
            const index = this.chosenAnswers.indexOf(option);
            if (index === -1) {
                this.chosenAnswers.push(option);
            } else {
                this.chosenAnswers.splice(index, 1);
            }
        }
    }

    isChosenOptionSingle(opt) {
        return String(this.chosenAnswer) === String(opt);
    }

    isCorrectOptionMulti(opt) {
        const currentQuestion = this.practiceManager.getCurrentQuestion();
        const ans = currentQuestion?.correct_answer || [];
        return ans.some(a => String(a) === String(opt));
    }

    isCorrectOptionSingle(opt) {
        const currentQuestion = this.practiceManager.getCurrentQuestion();
        const ans = currentQuestion?.correct_answer || [];
        return ans.length > 0 && String(ans[0]) === String(opt);
    }

    resetQuizState() {
        this.chosenAnswer = '';
        this.chosenAnswers = [];
        this.shortAnswerText = '';
        this.fillInAnswers = [];
        this.currentSessionCompleted.clear();
        this.appState.setState('showAnswer', false);
    }

    compareArrays(arr1, arr2) {
        if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
        if (arr1.length !== arr2.length) return false;
        const sorted1 = [...arr1].sort();
        const sorted2 = [...arr2].sort();
        return sorted1.every((val, idx) => String(val) === String(sorted2[idx]));
    }

    getCompletedCount() {
        return this.currentSessionCompleted.size;
    }
} 