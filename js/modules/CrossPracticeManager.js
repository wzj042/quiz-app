export default class CrossPracticeManager {
    constructor(appState, practiceManager, storageManager) {
        this.appState = appState;
        this.practiceManager = practiceManager;
        this.storageManager = storageManager;
        this.showModal = false;
        this.selectedQuestionTypes = ['single-choice', 'multiple-choice', 'fill-in-blank', 'short-answer'];
        this.crossPracticeMode = 'random';
        this.crossPracticeCount = 30;
        this.filteredBankDistribution = [];
    }

    async init() {
        // 初始化时不需要特别的异步操作
        return Promise.resolve();
    }

    async startCrossPractice() {
        if (!this.canStartCrossPractice()) return;
        
        try {
            this.appState.setState('isLoading', true);
            
            // 先加载所有需要的题库
            const banksToLoad = this.filteredBankDistribution
                .filter(bank => !this.practiceManager.loadedBanks.has(bank.file))
                .map(bank => bank.file);
            
            if (banksToLoad.length > 0) {
                await this.practiceManager.loadMultipleBanks(banksToLoad);
            }

            // 收集所有符合条件的题目
            let allQuestions = [];
            this.filteredBankDistribution.forEach(bank => {
                const bankQuestions = this.practiceManager.getQuestionsFromBank(bank.file)
                    .filter(q => this.selectedQuestionTypes.includes(q.type));
                allQuestions = allQuestions.concat(bankQuestions);
            });

            if (allQuestions.length === 0) {
                throw new Error('没有找到符合条件的题目');
            }

            if (this.crossPracticeCount > allQuestions.length) {
                this.crossPracticeCount = allQuestions.length;
            }

            // 根据模式排序题目
            if (this.crossPracticeMode === 'error-rate') {
                allQuestions.sort((a, b) => {
                    const statsA = this.storageManager.getQuestionStats(this.getBankByQuestion(a).file, a.uniqueId);
                    const statsB = this.storageManager.getQuestionStats(this.getBankByQuestion(b).file, b.uniqueId);
                    const errorRateA = statsA ? 1 - (statsA.correct / statsA.attempts) : 1;
                    const errorRateB = statsB ? 1 - (statsB.correct / statsB.attempts) : 1;
                    return errorRateB - errorRateA;
                });
            } else {
                allQuestions = this.shuffleArray(allQuestions);
            }

            // 选择指定数量的题目
            const selectedQuestions = allQuestions.slice(0, this.crossPracticeCount);

            // 为每个题目添加来源题库信息
            const questionsWithSource = selectedQuestions.map(q => ({
                ...q,
                sourceBank: this.getBankByQuestion(q).name || '未知题库'
            }));

            // 创建虚拟题库集合
            const virtualSet = {
                id: 'cross-practice-' + Date.now(),
                name: '跨卷练习',
                description: `从${this.filteredBankDistribution.length}个题库中选择的${this.crossPracticeCount}道题目\n\n包含题库：\n${this.filteredBankDistribution.map(bank => `- ${bank.name} (${bank.questionCount}题)`).join('\n')}`,
                isCrossPractice: true
            };

            return {
                questions: questionsWithSource,
                virtualSet
            };
        } finally {
            this.appState.setState('isLoading', false);
        }
    }

    updateBankDistribution() {
        const totalRequestedQuestions = this.crossPracticeCount;
        let remainingQuestions = totalRequestedQuestions;
        
        // 首先计算每个题库实际可用的题目数量
        this.filteredBankDistribution.forEach(bank => {
            const bankQuestions = this.practiceManager.getQuestionsFromBank(bank.file)
                .filter(q => this.selectedQuestionTypes.includes(q.type));
            bank.availableQuestions = bankQuestions.length;
        });

        // 根据策略计算每个题库的题目数
        if (this.crossPracticeMode === 'error-rate') {
            // 根据错误率和可用题目数分配
            let totalWeight = 0;
            this.filteredBankDistribution.forEach(bank => {
                const errorRate = 1 - (bank.stats.accuracy || 0) / 100;
                bank.weight = errorRate * bank.availableQuestions;
                totalWeight += bank.weight;
            });

            this.filteredBankDistribution.forEach(bank => {
                const proportion = bank.weight / totalWeight;
                bank.questionCount = Math.min(
                    Math.round(totalRequestedQuestions * proportion),
                    bank.availableQuestions
                );
                remainingQuestions -= bank.questionCount;
            });
        } else {
            // 平均分配题目，但考虑每个题库的可用题目数
            const banksWithQuestions = this.filteredBankDistribution.filter(bank => bank.availableQuestions > 0);
            let avgQuestions = Math.floor(remainingQuestions / banksWithQuestions.length);

            this.filteredBankDistribution.forEach(bank => {
                if (bank.availableQuestions > 0) {
                    bank.questionCount = Math.min(avgQuestions, bank.availableQuestions);
                    remainingQuestions -= bank.questionCount;
                } else {
                    bank.questionCount = 0;
                }
            });
        }

        // 处理剩余的题目
        if (remainingQuestions > 0) {
            for (let bank of this.filteredBankDistribution) {
                const canAddMore = bank.availableQuestions - bank.questionCount;
                if (canAddMore > 0) {
                    const toAdd = Math.min(remainingQuestions, canAddMore);
                    bank.questionCount += toAdd;
                    remainingQuestions -= toAdd;
                    if (remainingQuestions === 0) break;
                }
            }
        }

        return this.filteredBankDistribution;
    }

    getBankByQuestion(question) {
        return this.filteredBankDistribution.find(
            bank => bank.questions.some(q => q.uniqueId === question.uniqueId)
        );
    }

    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    canStartCrossPractice() {
        return this.selectedQuestionTypes.length > 0 && 
               this.crossPracticeCount > 0 && 
               this.crossPracticeCount <= this.getMaxQuestionCount() &&
               this.filteredBankDistribution.length > 0;
    }

    getMaxQuestionCount() {
        return this.filteredBankDistribution.reduce(
            (sum, bank) => sum + bank.questionCount, 
            0
        );
    }

    setQuestionCount(count) {
        this.crossPracticeCount = count;
        this.updateBankDistribution();
    }

    setMode(mode) {
        this.crossPracticeMode = mode;
        this.updateBankDistribution();
    }

    setQuestionTypes(types) {
        this.selectedQuestionTypes = types;
        this.updateBankDistribution();
    }
} 