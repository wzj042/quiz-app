class ComboAudioManager {
    constructor(options = {}) {
        // Configuration
        this.comboWindowMs = options.comboWindowMs || 3000; // 连杀时间窗口
        this.comboResetTimeoutMs = options.comboResetTimeoutMs || 5000; // 重置时间
        this.minScoreForSound = options.minScoreForSound || 1;
        this.baseWindow = 4500; // 基础时间窗口4.5秒

        // State
        this.killStreak = 0; // 连杀数
        this.comboTimer = null;
        this.resetTimer = null;
        this.comboEndTime = 0; // 连击结束时间

        // Audio elements pool - 连杀音效
        this.positiveAudios = Array.from({length: 5}, (_, i) => {
            const audio = new Audio(`/sounds/p${i + 1}.MP3`);
            audio.preload = 'auto';
            return audio;
        });

        // Audio elements pool - 被击败音效
        this.negativeAudios = Array.from({length: 5}, (_, i) => {
            const audio = new Audio(`/sounds/n${i + 1}.MP3`);
            audio.preload = 'auto';
            return audio;
        });
    }

    // 击杀，增加连杀数
    addPoints(points) {
        const now = Date.now();
        const isInWindow = this.comboEndTime > now;
        const currentStreak = this.killStreak || 0; // 确保当前连杀数不为undefined
        
        console.log('addPoints - 开始', {
            当前连杀: currentStreak,
            传入分数: points,
            时间窗口状态: isInWindow ? '活跃' : '超时',
            剩余时间: isInWindow ? (this.comboEndTime - now) / 1000 + '秒' : '已超时'
        });

        // 如果当前是负数，从1开始
        if (currentStreak < 0) {
            console.log('addPoints - 重置为1', {
                原因: '当前为负数'
            });
            this.killStreak = 1;
        } else if (!isInWindow || currentStreak === 0) {
            // 如果超出时间窗口或是初始状态，从1开始
            console.log('addPoints - 重置为1', {
                原因: currentStreak === 0 ? '初始状态' : '超出时间窗口'
            });
            this.killStreak = 1;
        } else {
            // 在连杀窗口内继续叠加连杀数
            this.killStreak = currentStreak + 1;
            console.log('addPoints - 累加', {
                新连杀数: this.killStreak
            });
        }

        // 播放对应等级的连杀音效
        if (this.killStreak >= this.minScoreForSound) {
            const index = Math.min(Math.floor(this.killStreak) - 1, 4);
            console.log('addPoints - 播放音效', {
                连杀数: this.killStreak,
                音效索引: index
            });
            this._playSound(this.positiveAudios[index]);
        }

        this._setTimers();
        console.log('addPoints - 结束', {
            最终连杀数: this.killStreak,
            新时间窗口: (this.comboEndTime - Date.now()) / 1000 + '秒'
        });
    }

    // 被击杀，开始负数计数
    subtractPoints(points) {
        const now = Date.now();
        const isInWindow = this.comboEndTime > now;
        const currentStreak = this.killStreak || 0; // 确保当前连杀数不为undefined
        
        console.log('subtractPoints - 开始', {
            当前连杀: currentStreak,
            传入分数: points,
            时间窗口状态: isInWindow ? '活跃' : '超时',
            剩余时间: isInWindow ? (this.comboEndTime - now) / 1000 + '秒' : '已超时'
        });

        // 如果当前是正数，从-1开始
        if (currentStreak > 0) {
            console.log('subtractPoints - 重置为-1', {
                原因: '当前为正数'
            });
            this.killStreak = -1;
        } else if (!isInWindow || currentStreak === 0) {
            // 如果超出时间窗口或是初始状态，从-1开始
            console.log('subtractPoints - 重置为-1', {
                原因: currentStreak === 0 ? '初始状态' : '超出时间窗口'
            });
            this.killStreak = -1;
        } else {
            // 在连杀窗口内继续累减
            const oldStreak = currentStreak;
            this.killStreak = Math.max(-5, oldStreak - 1);
            console.log('subtractPoints - 累减', {
                原连杀数: oldStreak,
                新连杀数: this.killStreak,
                是否达到下限: this.killStreak === -5
            });
        }
        
        // 播放被击败音效，音效等级取决于当前负数的绝对值
        if (Math.abs(this.killStreak) >= this.minScoreForSound) {
            const index = Math.min(Math.floor(Math.abs(this.killStreak)) - 1, 4);
            console.log('subtractPoints - 播放音效', {
                连杀数: this.killStreak,
                音效索引: index
            });
            this._playSound(this.negativeAudios[index]);
        }

        this._setTimers();
        console.log('subtractPoints - 结束', {
            最终连杀数: this.killStreak,
            新时间窗口: (this.comboEndTime - Date.now()) / 1000 + '秒'
        });
    }

    // Private method to clear existing timers
    _clearTimers() {
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
            this.comboTimer = null;
        }
        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = null;
        }
    }

    // Private method to set combo and reset timers
    _setTimers() {
        // 计算当前连杀数对应的时间窗口
        let adjustedWindow;
        
        if (this.killStreak === 0) {
            // 连杀数为0时不设置时间窗口
            this.comboEndTime = 0;
            return;
        } else if (Math.abs(this.killStreak) <= 1) {
            // 连杀数为1/-1时使用基础时间
            adjustedWindow = this.baseWindow;
        } else {
            // 连杀数大于1时，每级增加50%
            // 使用(连杀数-1)是因为第一级不增加时间
            const multiplier = 1 + (Math.abs(this.killStreak) - 1) * 0.5;
            adjustedWindow = this.baseWindow * multiplier;
        }

        // Update combo end time with adjusted window
        const now = Date.now();
        this.comboEndTime = now + adjustedWindow;

        // Set combo window timer
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
        }
        this.comboTimer = setTimeout(() => {
            this.comboTimer = null;
            // 不要在这里重置 comboEndTime，让它保持到下一次操作
        }, adjustedWindow);

        // Set reset timer
        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
        }
        this.resetTimer = setTimeout(() => {
            this.reset();
        }, this.comboResetTimeoutMs);
    }

    // Private method to play a sound
    _playSound(audioElement) {
        if (!audioElement) return;
        
        // Reset audio to start if it's already playing
        audioElement.currentTime = 0;
        audioElement.play().catch(err => console.warn('Audio playback failed:', err));
    }

    // Reset the combo system
    reset() {
        this._clearTimers();
        this.killStreak = 0;
        this.comboEndTime = 0;
    }

    // Get current streak
    getScore() {
        return this.killStreak;
    }
}

// Export the module
export default ComboAudioManager; 