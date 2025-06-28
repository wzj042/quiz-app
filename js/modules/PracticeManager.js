// 练习状态管理模块
import AIManager from './AIManager.js';

export default class PracticeManager {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.currentMode = null; // 'sequence', 'error-rate', 'random'
        this.currentIndex = -1; // Initialize to -1 to indicate no question selected yet
        this.questions = [];
        this.answers = new Map(); // 存储当前练习的答案
        this.isPreviewMode = false;
        this.maxShuffleAttempts = 100; // 防止无限循环
        this.initialized = false;
        this.aiManager = null; // AI管理器实例
    }

    // 设置AI管理器
    setAIManager(aiManager) {
        if (!AIManager.isAIManager(aiManager)) {
            console.error('[PracticeManager:setAIManager] Invalid AIManager instance');
            return;
        }
        this.aiManager = aiManager;
        console.log('[PracticeManager:setAIManager] AIManager instance set successfully');
    }

    // Initialize practice session
    initPractice(questions, mode = 'sequence') {
        if (!Array.isArray(questions) || questions.length === 0) {
            console.error('[PracticeManager:initPractice] Invalid questions array');
            return false;
        }

        if (!['sequence', 'error-rate', 'random'].includes(mode)) {
            console.error('[PracticeManager:initPractice] Invalid mode:', mode);
            return false;
        }

        try {
            this.questions = [...questions];
            this.currentMode = mode;
            this.currentIndex = 0;
            this.answers.clear();
            this.isPreviewMode = false;

            // Sort questions based on mode
            if (mode === 'error-rate') {
                this.questions.sort((a, b) => {
                    const statsA = this.storageManager.getQuestionStats(a.uniqueId);
                    const statsB = this.storageManager.getQuestionStats(b.uniqueId);
                    const errorRateA = statsA ? statsA.errors / Math.max(1, statsA.attempts) : 0;
                    const errorRateB = statsB ? statsB.errors / Math.max(1, statsB.attempts) : 0;
                    return errorRateB - errorRateA; // Higher error rate first
                });
            } else if (mode === 'random') {
                // Shuffle questions
                for (let i = this.questions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.questions[i], this.questions[j]] = [this.questions[j], this.questions[i]];
                }
            }

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('[PracticeManager:initPractice] Failed:', error);
            this.reset();
            return false;
        }
    }

    // 获取当前题目
    getCurrentQuestion() {
        // Check initialization state
        if (!this.initialized) {
            console.warn('[PracticeManager:getCurrentQuestion] Practice not initialized');
            return null;
        }

        // Validate current index
        if (this.currentIndex < 0 || this.currentIndex >= this.questions.length) {
            console.error('[PracticeManager:getCurrentQuestion] Invalid current index:', this.currentIndex);
            return null;
        }

        const question = this.questions[this.currentIndex];
        if (!question) {
            console.error('[PracticeManager:getCurrentQuestion] No question found at index:', this.currentIndex);
            return null;
        }

        // Add questionIndex to the question object
        question.questionIndex = this.currentIndex + 1;
        return question;
    }

    // 按错误率排序
    sortByErrorRate() {
        try {
            if (!Array.isArray(this.questions) || this.questions.length === 0) {
                throw new Error('无效的题目列表');
            }

            this.questions.sort((a, b) => {
                if (!a || !b || !a.uniqueId || !b.uniqueId) {
                    throw new Error('无效的题目数据');
                }

                const statsA = this.storageManager.getQuestionCompletion(a.uniqueId);
                const statsB = this.storageManager.getQuestionCompletion(b.uniqueId);
                
                const errorRateA = statsA ? statsA.errors / Math.max(1, statsA.attempts) : 0;
                const errorRateB = statsB ? statsB.errors / Math.max(1, statsB.attempts) : 0;
                
                return errorRateB - errorRateA; // 错误率高的排前面
            });
        } catch (error) {
            console.error('[PracticeManager:sortByErrorRate] Failed to sort questions:', error);
            // 如果排序失败，回退到原始顺序
            this.questions = [...this.questions];
        }
    }

    // 随机打乱题目
    shuffleQuestions() {
        if (!Array.isArray(this.questions) || this.questions.length === 0) {
            console.error('[PracticeManager:shuffleQuestions] Invalid questions array');
            return;
        }

        let attempts = 0;
        const originalQuestions = this.questions.map(q => ({...q}));

        try {
            while (attempts < this.maxShuffleAttempts) {
                attempts++;
                
                // 打乱题目顺序
                for (let i = this.questions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.questions[i], this.questions[j]] = [this.questions[j], this.questions[i]];
                }

                // 检查是否真的打乱了（避免完全相同的顺序）
                let isDifferent = false;
                for (let i = 0; i < this.questions.length; i++) {
                    if (this.questions[i].uniqueId !== originalQuestions[i].uniqueId) {
                        isDifferent = true;
                        break;
                    }
                }

                if (isDifferent) {
                    // 打乱选项
                    this.questions.forEach(q => {
                        if ((q.type === 'single-choice' || q.type === 'multiple-choice') && Array.isArray(q.options)) {
                            try {
                                const originalOptions = [...q.options];
                                const originalCorrectAnswer = [...q.correct_answer];
                                const shuffledOptions = [...originalOptions];
                                
                                // 打乱选项
                                for (let k = shuffledOptions.length - 1; k > 0; k--) {
                                    const l = Math.floor(Math.random() * (k + 1));
                                    [shuffledOptions[k], shuffledOptions[l]] = [shuffledOptions[l], shuffledOptions[k]];
                                }
                                
                                // 更新正确答案
                                if (q.type === 'single-choice') {
                                    const oldCorrectAnswer = originalCorrectAnswer[0];
                                    const newIndex = shuffledOptions.indexOf(oldCorrectAnswer);
                                    if (newIndex === -1) throw new Error('选项打乱后找不到正确答案');
                                    q.correct_answer = [shuffledOptions[newIndex]];
                                } else {
                                    q.correct_answer = originalCorrectAnswer.map(ans => {
                                        const newAns = shuffledOptions[originalOptions.indexOf(ans)];
                                        if (newAns === undefined) throw new Error('选项打乱后找不到正确答案');
                                        return newAns;
                                    });
                                }
                                q.options = shuffledOptions;
                            } catch (error) {
                                console.error('[PracticeManager:shuffleQuestions] Failed to shuffle options:', error);
                                // 如果打乱选项失败，恢复原始选项和答案
                                q.options = originalOptions;
                                q.correct_answer = originalCorrectAnswer;
                            }
                        }
                    });
                    break;
                }
            }

            if (attempts >= this.maxShuffleAttempts) {
                console.warn('[PracticeManager:shuffleQuestions] Max shuffle attempts reached');
            }
        } catch (error) {
            console.error('[PracticeManager:shuffleQuestions] Failed to shuffle questions:', error);
            // 如果打乱失败，恢复原始顺序
            this.questions = originalQuestions;
        }
    }

    // 保存答案
    saveAnswer(answer) {
        const question = this.getCurrentQuestion();
        if (!question || this.isPreviewMode) {
            console.warn('[PracticeManager:saveAnswer] Cannot save answer:', {
                hasQuestion: !!question,
                isPreviewMode: this.isPreviewMode
            });
            return;
        }
        
        // Use question index as key
        const questionIndex = this.currentIndex + 1;
        console.log('[PracticeManager:saveAnswer] Saving answer:', {
            questionIndex,
            answer: answer
        });
        
        this.answers.set(questionIndex, answer);
    }

    // 检查答案
    async checkAnswer(answer) {
        const question = this.getCurrentQuestion();
        if (!question) {
            console.warn('[PracticeManager:checkAnswer] No current question');
            return false;
        }

        console.log('[PracticeManager:checkAnswer] Checking answer:', {
            questionIndex: this.currentIndex + 1,
            questionType: question.type,
            providedAnswer: answer,
            correctAnswer: question.correct_answer
        });

        try {
            let isCorrect = false;
            switch (question.type) {
                case 'single-choice':
                case 'multiple-choice':
                    isCorrect = this.compareArrays(
                        Array.isArray(answer) ? answer : [answer],
                        question.correct_answer
                    );
                    break;
                case 'fill-in-blank':
                case 'short-answer':
                    // 对填空题和简答题使用 AI 评分
                    if (this.aiManager) {
                        isCorrect = await this.checkAnswerWithAI(answer, question);
                    } else {
                        // 如果 AI 不可用，回退到基本比较
                        isCorrect = this.compareArrays(
                            Array.isArray(answer) ? answer : [answer],
                            question.correct_answer
                        );
                    }
                    break;
                default:
                    console.error('[PracticeManager:checkAnswer] Unknown question type:', question.type);
                    return false;
            }

            if (!this.isPreviewMode) {
                this.storageManager.updateQuestionCompletion(
                    question.uniqueId,
                    isCorrect
                );
            }

            console.log('[PracticeManager:checkAnswer] Answer check result:', {
                questionIndex: this.currentIndex + 1,
                isCorrect: isCorrect
            });

            return isCorrect;
        } catch (error) {
            console.error('[PracticeManager:checkAnswer] Error checking answer:', error);
            return false;
        }
    }

    // 比较数组是否相等（不考虑顺序）
    compareArrays(arr1, arr2) {
        if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
        if (arr1.length !== arr2.length) return false;
        const set1 = new Set(arr1.map(String)); // Convert to strings for consistent comparison
        return arr2.every(item => set1.has(String(item)));
    }

    // 移动到下一题
    nextQuestion() {
        if (!this.initialized) {
            console.warn('[PracticeManager:nextQuestion] Practice not initialized');
            return false;
        }

        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            return true;
        }
        return false;
    }

    // 移动到上一题
    previousQuestion() {
        if (!this.initialized) {
            console.warn('[PracticeManager:previousQuestion] Practice not initialized');
            return false;
        }

        if (this.currentIndex > 0) {
            this.currentIndex--;
            return true;
        }
        return false;
    }

    // 获取练习统计信息
    getPracticeStats() {
        if (!this.initialized) {
            return {
                total: 0,
                attempted: 0,
                correct: 0,
                accuracy: 0
            };
        }

        const total = this.questions.length;
        const attempted = this.answers.size;
        const correct = Array.from(this.answers.entries()).filter(
            ([questionId, answer]) => this.checkAnswer(answer)
        ).length;

        return {
            total,
            attempted,
            correct,
            accuracy: attempted ? Math.round((correct / attempted) * 100) : 0
        };
    }

    // 切换预览模式
    togglePreviewMode(enabled) {
        this.isPreviewMode = enabled;
        if (enabled) {
            this.answers.clear();
        }
    }

    // 重置当前练习
    reset() {
        this.currentMode = null;
        this.currentIndex = -1;
        this.questions = [];
        this.answers.clear();
        this.isPreviewMode = false;
        this.initialized = false;
    }

    // 获取当前模式的中文名称
    getModeDisplayName() {
        switch (this.currentMode) {
            case 'sequence':
                return '顺序练习';
            case 'error-rate':
                return '错误率练习';
            case 'random':
                return '随机练习';
            default:
                return '';
        }
    }

    // 使用AI检查答案
    async checkAnswerWithAI(answer, question) {
        try {
            console.log('[PracticeManager:checkAnswerWithAI] Starting AI scoring', {
                questionType: question.type,
                answer: answer,
                aiManager: this.aiManager
            });

            if (!this.aiManager) {
                console.error('[PracticeManager:checkAnswerWithAI] AI Manager not initialized');
                throw new Error('AI Manager not initialized');
            }

            const systemPrompt = `你是一个专业的教育评分系统。你需要根据提供的题目、参考答案和学生答案进行评分。
你必须以JSON格式返回结果，包含以下字段：
{
    "score": 0到1之间的分数,
    "explanation": "评分理由（100字以内）。你可以使用LaTeX公式，用 $...$ 包裹行内公式，用 $$...$$ 包裹独立公式。"
}`;

            const userPrompt = `题目：${question.content}
参考答案：${question.correct_answer.join('\n')}
学生答案：${answer}`;

            console.log('[PracticeManager:checkAnswerWithAI] Sending prompt to AI', {
                systemPrompt,
                userPrompt
            });

            const response = await this.aiManager.streamChat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], {
                response_format: { type: 'json_object' }
            });

            let fullContent = '';
            let partialContent = '';
            let result = null;
            let isReasoningPhase = false;
            const threshold = 0.9;

            // 初始化评分解释字段
            if (!question.aiScoreExplanation) {
                question.aiScoreExplanation = '';
            }

            for await (const chunk of response) {
                console.log('[PracticeManager:checkAnswerWithAI] Received chunk:', chunk);
                
                switch (chunk.type) {
                    case 'reasoning': {
                        isReasoningPhase = true;
                        question.aiScoreExplanation = '正在评分中...\n' + chunk.content;
                        break;
                    }
                    case 'answer': {
                        fullContent += chunk.content;
                        
                        try {
                            // 尝试解析完整的 JSON
                            const parsed = JSON.parse(fullContent);
                            if (parsed.score !== undefined && parsed.explanation) {
                                result = parsed;
                                question.aiScore = result.score;
                                question.aiScoreThreshold = threshold;
                                question.aiScoreExplanation = `得分：${Math.round(result.score * 100)}分（及格线：${Math.round(threshold * 100)}分）\n${result.explanation}`;
                            }
                        } catch (error) {
                            // JSON 还不完整，继续累积内容
                            if (!isReasoningPhase) {
                                partialContent += chunk.content;
                                
                                // 尝试从部分内容中提取有意义的文本
                                let cleanContent = partialContent
                                    .replace(/^{?\s*"(score|explanation)":\s*"?/, '')
                                    .replace(/\\n/g, '\n')
                                    .replace(/\\"/, '"')
                                    .replace(/"}$/, '')
                                    .replace(/,$/, '')
                                    .trim();
                                
                                if (cleanContent) {
                                    question.aiScoreExplanation = '正在评分中...\n' + cleanContent;
                                }
                            }
                        }
                        break;
                    }
                    case 'finish': {
                        console.log('[PracticeManager:checkAnswerWithAI] Stream finished:', chunk.reason);
                        break;
                    }
                    case 'tool_calls': {
                        console.log('[PracticeManager:checkAnswerWithAI] Tool calls received:', chunk.content);
                        break;
                    }
                }
            }

            // 最后一次尝试解析
            if (!result && fullContent) {
                try {
                    const parsed = JSON.parse(fullContent);
                    if (parsed.score !== undefined && parsed.explanation) {
                        result = parsed;
                        question.aiScore = result.score;
                        question.aiScoreThreshold = threshold;
                        question.aiScoreExplanation = `得分：${Math.round(result.score * 100)}分（及格线：${Math.round(threshold * 100)}分）\n${result.explanation}`;
                    }
                } catch (error) {
                    console.error('[PracticeManager:checkAnswerWithAI] Failed to parse final response:', error);
                    throw new Error('Invalid AI score response');
                }
            }

            if (!result || result.score === undefined || typeof result.score !== 'number' || result.score < 0 || result.score > 1) {
                console.error('[PracticeManager:checkAnswerWithAI] Invalid AI score response', { result });
                throw new Error('Invalid AI score response');
            }

            console.log('[PracticeManager:checkAnswerWithAI] AI scoring completed', {
                score: result.score,
                threshold: threshold,
                explanation: result.explanation
            });

            return result.score >= threshold;
        } catch (error) {
            console.error('[PracticeManager:checkAnswerWithAI] Error:', error);
            return false;
        }
    }

    // 获取AI解析
    async getAIAnalysis(answer, question) {
        try {
            console.log('[PracticeManager:getAIAnalysis] Starting AI analysis', {
                questionType: question.type,
                answer: answer,
                aiManager: this.aiManager
            });

            if (!AIManager.isAIManager(this.aiManager)) {
                console.error('[PracticeManager:getAIAnalysis] Invalid AIManager instance');
                throw new Error('Invalid AIManager instance');
            }

            const systemPrompt = `你是一个专业的题目解析系统。你需要解释为什么给定的答案是正确的。
你必须以JSON格式返回结果，包含以下字段：
{
    "analysis": "直接给出解析内容，不要包含任何提示词或格式说明。解析应该：聚焦答案路径，解释关键概念，使用简短有力的语句，语言朴实易懂。你可以使用LaTeX公式，用 $...$ 包裹行内公式，用 $$...$$ 包裹独立公式。"
}`;

            const userPrompt = `题目：${question.content}
参考答案：${question.correct_answer.join('\n')}`;

            console.log('[PracticeManager:getAIAnalysis] Sending prompt to AI', {
                systemPrompt,
                userPrompt
            });

            // 直接返回流式响应
            return this.aiManager.streamChat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], {
                response_format: { type: 'json_object' }
            });

        } catch (error) {
            console.error('[PracticeManager:getAIAnalysis] Error:', error);
            throw error;
        }
    }
} 