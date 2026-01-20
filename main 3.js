// 量子跃迁者 - 游戏主逻辑
class QuantumJumper {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.currentLevel = 1;
        this.gameMode = null;
        this.progress = { challenge: { level: 1 }, casual: { level: 11 } };
        this.quantumShards = 0;
        this.energy = 100;
        this.maxEnergy = 100;
        
        // 反重力边界警告相关
        this.outOfBoundsTimer = 0;
        this.isOutOfBoundsWarning = false;
        this.outOfBoundsWarningTime = 5000;
        
        // 维度系统 - 颜色微调为更具赛博感
        this.currentDimension = 0;
        this.dimensions = [
            { name: '正常维度', color: '#00d9ff', gravity: 0.5, timeScale: 1 }, // 青色
            { name: '反重力', color: '#b957ff', gravity: -0.5, timeScale: 1 }, // 紫色
            { name: '时间扭曲', color: '#00ff9d', gravity: 0.6, timeScale: 2 }, // 荧光绿
            { name: '能量场', color: '#ff2a6d', gravity: 0.5, timeScale: 1, forceField: true } // 玫红
        ];
        
        // 背景系统
        this.stars = [];
        this.gridOffset = 0;
        this.generateStars();
        
        // 玩家对象
        this.player = {
            x: 100,
            y: 300,
            width: 20,
            height: 20,
            vx: 0,
            vy: 0,
            speed: 5,
            onGround: false,
            trail: []
        };
        
        // 游戏对象数组
        this.platforms = [];
        this.collectibles = [];
        this.hazards = [];
        this.portals = [];
        
        // 粒子系统
        this.particles = [];
        
        // 音效系统
        this.sounds = {};
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;
        this.backgroundMusic = null;
        
        // 关卡完成状态标志
        this.isLevelComplete = false;
        
        // 输入处理
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        
        // 游戏循环
        this.lastTime = 0;
        
        // 视觉特效系统
        this.screenShake = 0;
        this.shakeDecay = 0.9;
        this.flashIntensity = 0;
        this.flashDecay = 0.85;
        
        // 霓虹回响系统 (Neon Echo)
        this.lightPulses = []; // {x, y, radius, maxRadius, color, speed}
        this.baseVisibilityRadius = 150; // 玩家周围的基础可视范围
        
        this.init();
    }
    
    generateStars() {
        for(let i=0; i<100; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 1.5,
                brightness: Math.random(),
                speed: Math.random() * 0.2 + 0.05
            });
        }
    }
    
    init() {
        this.setupEventListeners();
        this.loadSounds();
        this.generateParticles();
        this.loadLevel(1);
        this.gameLoop();
        // 移除自动播放背景音乐，改为在用户交互后播放
    }
    
    setupEventListeners() {
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            // 防止重复触发
            if (this.keys[e.key.toLowerCase()]) return;
            
            this.keys[e.key.toLowerCase()] = true;
            
            // 维度切换
            if (e.key >= '1' && e.key <= '4') {
                this.switchDimension(parseInt(e.key) - 1);
            }
            
            // 暂停
            if (e.key === 'Escape') {
                this.togglePause();
            }
            
            // 快速切换
            if (e.key === ' ' && this.gameState === 'playing') {
                this.quickSwitch();
                e.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // 鼠标事件
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const direction = e.deltaY > 0 ? 1 : -1;
            this.cycleDimension(direction);
        });
        
        // UI事件
        const casualBtn = document.getElementById('casualModeBtn');
        if (casualBtn) casualBtn.addEventListener('click', () => this.startMode('casual'));
        document.getElementById('resumeBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('quitBtn').addEventListener('click', () => this.quitGame());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('closeSettings').addEventListener('click', () => this.hideSettings());
        document.getElementById('nextLevelBtn').addEventListener('click', () => this.nextLevel());
        const restartVictoryBtn = document.getElementById('restartFromVictoryBtn');
        const quitVictoryBtn = document.getElementById('quitFromVictoryBtn');
        if (restartVictoryBtn) restartVictoryBtn.addEventListener('click', () => this.restartGame());
        if (quitVictoryBtn) quitVictoryBtn.addEventListener('click', () => this.returnToModeSelect());
        
        // 维度按钮
        document.querySelectorAll('.dimension-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const dimension = parseInt(btn.dataset.dimension);
                this.switchDimension(dimension);
            });
        });
    }
    
    generateParticles() {
        const particlesContainer = document.getElementById('particles');
        
        setInterval(() => {
            if (this.particles.length < 20) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 6 + 's';
                particle.style.animationDuration = (6 + Math.random() * 4) + 's';
                
                particlesContainer.appendChild(particle);
                
                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, 10000);
            }
        }, 500);
    }
    
    loadSounds() {
        // 使用相对路径，确保在不同环境下都能正确加载
        const basePath = './resources/';
        
        // 加载音效文件
        this.sounds.dimensionSwitch = new Audio(basePath + 'dimension_switch.mp3');
        this.sounds.collectShard = new Audio(basePath + 'collect_shard.mp3');
        this.sounds.playerJump = new Audio(basePath + 'player_jump.mp3');
        this.sounds.hazardHit = new Audio(basePath + 'hazard_hit.mp3');
        
        // 背景音乐采用更健壮的加载方式
        this.sounds.backgroundAmbient = new Audio();
        this.sounds.backgroundAmbient.src = basePath + 'background_ambient.mp3';
        this.sounds.backgroundAmbient.crossOrigin = 'anonymous'; // 解决CORS问题
        
        // 设置音量
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.sfxVolume;
        });
        
        this.sounds.backgroundAmbient.volume = this.musicVolume;
        this.sounds.backgroundAmbient.loop = true;
        
        // 预加载音频
        this.preloadAudio();
    }
    
    preloadAudio() {
        // 预加载所有音频资源
        for (const soundName in this.sounds) {
            const sound = this.sounds[soundName];
            try {
                // Audio.load() 不返回Promise，我们直接调用它
                sound.load();
            } catch (e) {
                console.warn(`Failed to preload ${soundName}:`, e);
            }
        }
    }
    
    startBackgroundMusic() {
        if (this.sounds.backgroundAmbient) {
            // 尝试多次播放以提高成功率
            const tryPlayMusic = () => {
                this.sounds.backgroundAmbient.play().catch(e => {
                    console.warn('Background music play attempt failed:', e);
                    // 如果失败，尝试重置音频并重新播放
                    this.sounds.backgroundAmbient.currentTime = 0;
                    setTimeout(() => {
                        this.sounds.backgroundAmbient.play().catch(err => {
                            console.warn('Background music play failed after retry:', err);
                        });
                    }, 100);
                });
            };
            
            tryPlayMusic();
        }
    }
    
    playSound(soundName) {
        if (this.sounds[soundName]) {
            const sound = this.sounds[soundName].cloneNode();
            sound.volume = this.sfxVolume;
            sound.play().catch(e => {
                console.log('Sound play failed:', e);
            });
        }
    }
    
    startGame() {
        this.gameState = 'playing';
        document.getElementById('gameOverlay').classList.add('hidden');
        this.resetPlayer();
        this.loadLevel(this.currentLevel);
        // 在用户开始游戏时播放背景音乐
        this.startBackgroundMusic();
        this.saveProgress();
    }

    startMode(mode) {
        this.gameMode = mode;
        this.loadProgress(mode);
        this.startGame();
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.getElementById('pauseMenu').classList.remove('hidden');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            document.getElementById('pauseMenu').classList.add('hidden');
        }
    }
    
    restartGame() {
        this.currentLevel = this.gameMode === 'casual' ? 11 : 1;
        this.quantumShards = 0;
        this.energy = this.maxEnergy;
        this.currentDimension = 0;
        this.gameState = 'playing';
        document.getElementById('pauseMenu').classList.add('hidden');
        this.resetPlayer();
        this.loadLevel(this.currentLevel);
        this.updateUI();
        this.saveProgress();
    }
    
    quitGame() {
        this.gameState = 'menu';
        document.getElementById('pauseMenu').classList.add('hidden');
        document.getElementById('gameOverlay').classList.remove('hidden');
        const victoryOverlay = document.getElementById('victoryOverlay');
        if (victoryOverlay) victoryOverlay.classList.add('hidden');
    }
    
    showSettings() {
        document.getElementById('settingsModal').classList.remove('hidden');
    }
    
    hideSettings() {
        document.getElementById('settingsModal').classList.add('hidden');
    }
    
    switchDimension(dimension) {
        if (dimension >= 0 && dimension < this.dimensions.length && this.gameState === 'playing') {
            this.currentDimension = dimension;
            this.updateDimensionButtons();
            this.createDimensionSwitchEffect();
            this.playSound('dimensionSwitch');
            this.updateUI();
            
            // 触发视觉冲击
            this.screenShake = 15;
            this.flashIntensity = 0.4;
            
            // 触发声呐光波
            this.createPulse(
                this.player.x + this.player.width/2, 
                this.player.y + this.player.height/2, 
                this.dimensions[this.currentDimension].color,
                15 // 快速爆发
            );
             
            // 重置越界警告计时器
            if (this.isOutOfBoundsWarning) {
                // 检查是否切换到非反重力维度，如果玩家回到屏幕内则重置警告
                if (dimension !== 1 && this.player.y > -this.player.height) {
                    this.outOfBoundsTimer = 0;
                    this.isOutOfBoundsWarning = false;
                }
            }
        }
    }
    
    cycleDimension(direction) {
        this.currentDimension = (this.currentDimension + direction + this.dimensions.length) % this.dimensions.length;
        this.updateDimensionButtons();
        this.createDimensionSwitchEffect();
        this.playSound('dimensionSwitch');
        this.updateUI();
    }
    
    quickSwitch() {
        // 在当前维度和前一个维度间切换
        const prevDimension = this.currentDimension;
        this.currentDimension = (this.currentDimension + 1) % this.dimensions.length;
        this.updateDimensionButtons();
        this.createDimensionSwitchEffect();
        this.updateUI();
    }
    
    updateDimensionButtons() {
        document.querySelectorAll('.dimension-button').forEach((btn, index) => {
            if (index === this.currentDimension) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    createDimensionSwitchEffect() {
        // 创建维度切换的视觉效果 - 增强版
        // 1. 冲击波圆环
        const ringCount = 3;
        for(let r=0; r<ringCount; r++) {
             // 模拟圆环粒子
             const particleCount = 20;
             const angleStep = (Math.PI * 2) / particleCount;
             const speed = 5 + r * 2;
             
             for (let i = 0; i < particleCount; i++) {
                const angle = i * angleStep;
                this.particles.push({
                    x: this.player.x + this.player.width/2,
                    y: this.player.y + this.player.height/2,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 20 + r * 5,
                    maxLife: 30,
                    color: this.dimensions[this.currentDimension].color,
                    size: Math.random() * 3 + 2
                });
            }
        }
        
        // 2. 原有的随机散射粒子
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: this.player.x + Math.random() * 40 - 20,
                y: this.player.y + Math.random() * 40 - 20,
                vx: (Math.random() - 0.5) * 15, // 更快的速度
                vy: (Math.random() - 0.5) * 15,
                life: 40,
                maxLife: 40,
                color: '#ffffff', // 混合白色火花
                size: Math.random() * 3 + 1
            });
        }
    }

    createJumpDust() {
        // 跳跃尘埃
        const dimension = this.dimensions[this.currentDimension];
        const isAntiGravity = dimension.gravity < 0;
        const dustY = isAntiGravity ? this.player.y : this.player.y + this.player.height;
        
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: this.player.x + Math.random() * this.player.width,
                y: dustY + (Math.random() - 0.5) * 5,
                vx: (Math.random() - 0.5) * 4,
                vy: (isAntiGravity ? 1 : -1) * Math.random() * 2, // 向反方向飘散
                life: 15,
                maxLife: 15,
                color: '#ffffff80',
                size: Math.random() * 4 + 1
            });
        }
    }
    
    resetPlayer() {
        this.player.x = 100;
        this.player.y = 300;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.trail = [];
        this.currentDimension = 0; // 重置为正常维度
        this.updateDimensionButtons(); // 更新维度按钮状态
    }
    
    loadLevel(level) {
        this.platforms = [];
        this.collectibles = [];
        this.hazards = [];
        this.portals = [];
        
        // 根据关卡生成不同的布局
        switch (level) {
            case 1:
                // 简单关卡，基础平台
                this.platforms.push(
                    { x: 0, y: 550, width: 800, height: 50, dimension: 0 },
                    { x: 200, y: 450, width: 100, height: 20, dimension: 0 },
                    { x: 400, y: 350, width: 100, height: 20, dimension: 0 },
                    { x: 600, y: 250, width: 100, height: 20, dimension: 0 }
                );
                
                this.collectibles.push(
                    { x: 250, y: 400, width: 15, height: 15, collected: false },
                    { x: 450, y: 300, width: 15, height: 15, collected: false },
                    { x: 650, y: 200, width: 15, height: 15, collected: false }
                );
                break;
                
            case 2:
                // 引入反重力维度
                this.platforms.push(
                    { x: 0, y: 550, width: 300, height: 50, dimension: 0 },
                    { x: 500, y: 550, width: 300, height: 50, dimension: 0 },
                    { x: 350, y: 300, width: 100, height: 20, dimension: 1 }, // 反重力平台
                    { x: 200, y: 150, width: 100, height: 20, dimension: 0 },
                    { x: 500, y: 150, width: 100, height: 20, dimension: 0 }
                );
                
                this.collectibles.push(
                    { x: 400, y: 250, width: 15, height: 15, collected: false },
                    { x: 250, y: 100, width: 15, height: 15, collected: false },
                    { x: 550, y: 100, width: 15, height: 15, collected: false }
                );
                break;
                
            case 3:
                // 时间扭曲维度
                this.platforms.push(
                    { x: 0, y: 550, width: 200, height: 50, dimension: 0 },
                    { x: 300, y: 450, width: 100, height: 20, dimension: 2 }, // 时间扭曲平台
                    { x: 500, y: 350, width: 100, height: 20, dimension: 0 },
                    { x: 700, y: 250, width: 100, height: 20, dimension: 0 }
                );
                
                this.hazards.push(
                    { x: 250, y: 500, width: 300, height: 20, dimension: 0, type: 'laser' }
                );
                
                this.collectibles.push(
                    { x: 350, y: 400, width: 15, height: 15, collected: false },
                    { x: 550, y: 300, width: 15, height: 15, collected: false },
                    { x: 750, y: 200, width: 15, height: 15, collected: false }
                );
                break;
                
            case 4:
                // 第4关：能量场维度引入 - 动态能量波动
                this.platforms.push(
                    { x: 0, y: 550, width: 200, height: 50, dimension: 0 }, // 宽敞安全的起始平台
                    { x: 350, y: 450, width: 100, height: 20, dimension: 0 },
                    { x: 150, y: 350, width: 120, height: 20, dimension: 3, active: true, pulseRate: 3000 }, // 能量场平台（脉冲效果）
                    { x: 450, y: 300, width: 100, height: 20, dimension: 1 }, // 反重力平台
                    { x: 650, y: 250, width: 120, height: 20, dimension: 0, moving: true, moveX: 100, moveSpeed: 2 } // 移动平台
                );
                
                // 动态危险区域，初始位置远离玩家
                this.hazards.push(
                    { x: 500, y: 420, width: 150, height: 20, dimension: 0, type: 'laser', active: true, blinkRate: 2000 }, // 闪烁危险区域
                    { x: 200, y: 220, width: 100, height: 20, dimension: 0, type: 'laser', active: false, delay: 2000 } // 延迟激活的危险区域
                );
                
                this.collectibles.push(
                    { x: 380, y: 400, width: 15, height: 15, collected: false },
                    { x: 180, y: 300, width: 15, height: 15, collected: false }, // 需要使用能量场
                    { x: 480, y: 250, width: 15, height: 15, collected: false }, // 需要使用反重力
                    { x: 680, y: 200, width: 15, height: 15, collected: false }  // 移动平台上的收集品
                );
                break;
                
            case 5:
                // 第5关：反重力探索 - 重力切换挑战
                this.platforms.push(
                    { x: 0, y: 550, width: 220, height: 50, dimension: 0 }, // 宽敞安全的起始平台
                    { x: 420, y: 450, width: 120, height: 20, dimension: 0 },
                    { x: 200, y: 350, width: 100, height: 20, dimension: 1, gravityToggle: true, toggleRate: 4000 }, // 重力切换平台
                    { x: 520, y: 250, width: 120, height: 20, dimension: 1 }, // 稳定反重力平台
                    { x: 350, y: 150, width: 120, height: 20, dimension: 0 },
                    { x: 620, y: 500, width: 150, height: 20, dimension: 0 }
                );
                
                // 移动和闪烁的危险区域
                this.hazards.push(
                    { x: 270, y: 500, width: 120, height: 20, dimension: 0, type: 'laser', moving: true, moveY: 100, moveSpeed: 1 }, // 上下移动危险区
                    { x: 420, y: 380, width: 100, height: 20, dimension: 0, type: 'laser', active: true, blinkRate: 1500 }, // 快速闪烁危险区
                    { x: 300, y: 180, width: 100, height: 20, dimension: 0, type: 'laser', active: false, delay: 3000 } // 延迟激活危险区
                );
                
                // 策略性放置的收集品
                this.collectibles.push(
                    { x: 450, y: 400, width: 15, height: 15, collected: false },
                    { x: 230, y: 300, width: 15, height: 15, collected: false }, // 需要把握重力切换时机
                    { x: 550, y: 200, width: 15, height: 15, collected: false }, // 需要熟练使用反重力
                    { x: 380, y: 100, width: 15, height: 15, collected: false },
                    { x: 650, y: 450, width: 15, height: 15, collected: false }
                );
                break;
                
            case 6:
                // 第6关：时间迷宫 - 动态时间循环
                this.platforms.push(
                    { x: 0, y: 550, width: 200, height: 50, dimension: 0 }, // 宽敞安全的起始平台
                    { x: 320, y: 480, width: 120, height: 20, dimension: 0, moving: true, moveX: 150, moveSpeed: 1 }, // 水平移动平台
                    { x: 520, y: 400, width: 120, height: 20, dimension: 2, timeIntensity: 2 }, // 强化时间扭曲平台
                    { x: 220, y: 350, width: 100, height: 20, dimension: 0 },
                    { x: 420, y: 280, width: 100, height: 20, dimension: 2, timePulse: true, pulseRate: 3000 }, // 脉冲时间平台
                    { x: 620, y: 220, width: 120, height: 20, dimension: 0 },
                    { x: 320, y: 150, width: 120, height: 20, dimension: 2 } // 终点前时间平台
                );
                
                // 速度变化的危险区域
                this.hazards.push(
                    { x: 220, y: 520, width: 80, height: 20, dimension: 0, type: 'laser', blinkRate: 1000 }, // 快速闪烁
                    { x: 370, y: 430, width: 120, height: 20, dimension: 0, type: 'laser', moving: true, moveY: 120, moveSpeed: 1.5 }, // 快速移动
                    { x: 120, y: 300, width: 100, height: 20, dimension: 0, type: 'laser', active: false, delay: 2500 }, // 延迟激活
                    { x: 470, y: 200, width: 100, height: 20, dimension: 0, type: 'laser', timeEffect: true } // 受时间影响的危险区
                );
                
                // 分布需要时间精准控制的收集品
                this.collectibles.push(
                    { x: 350, y: 430, width: 15, height: 15, collected: false },
                    { x: 550, y: 350, width: 15, height: 15, collected: false }, // 需要精准使用时间扭曲
                    { x: 250, y: 300, width: 15, height: 15, collected: false },
                    { x: 450, y: 230, width: 15, height: 15, collected: false }, // 需要把握时间脉冲
                    { x: 650, y: 170, width: 15, height: 15, collected: false },
                    { x: 350, y: 100, width: 15, height: 15, collected: false } // 终点收集品
                );
                break;
                
            case 7:
                // 第7关：能量场冒险 - 动态能量风暴
                this.platforms.push(
                    { x: 0, y: 550, width: 200, height: 50, dimension: 0 }, // 宽敞安全的起始平台
                    { x: 320, y: 450, width: 120, height: 20, dimension: 3, energyBurst: true, burstRate: 2500 }, // 能量爆发平台
                    { x: 170, y: 350, width: 120, height: 20, dimension: 0 },
                    { x: 470, y: 300, width: 120, height: 20, dimension: 3, energyDirection: 'up', intensity: 1.5 }, // 定向能量平台
                    { x: 270, y: 220, width: 120, height: 20, dimension: 0 },
                    { x: 570, y: 200, width: 120, height: 20, dimension: 3, energyDirection: 'right', intensity: 1.8 }, // 横向能量平台
                    { x: 420, y: 100, width: 150, height: 20, dimension: 0 } // 宽敞终点平台
                );
                
                // 能量驱动的危险区域
                this.hazards.push(
                    { x: 200, y: 500, width: 100, height: 20, dimension: 0, type: 'laser', active: true, blinkRate: 1500 }, // 闪烁危险区
                    { x: 420, y: 400, width: 120, height: 20, dimension: 0, type: 'laser', energyLinked: true }, // 能量关联危险区
                    { x: 320, y: 350, width: 150, height: 20, dimension: 0, type: 'laser', moving: true, moveX: 100, moveSpeed: 1 }, // 移动危险区
                    { x: 520, y: 150, width: 100, height: 20, dimension: 0, type: 'laser', active: false, delay: 3500 } // 延迟危险区
                );
                
                // 需要精准把握能量时机的收集品
                this.collectibles.push(
                    { x: 350, y: 400, width: 15, height: 15, collected: false }, // 需要能量爆发助力
                    { x: 200, y: 300, width: 15, height: 15, collected: false },
                    { x: 500, y: 250, width: 15, height: 15, collected: false }, // 需要利用定向能量
                    { x: 300, y: 170, width: 15, height: 15, collected: false },
                    { x: 600, y: 150, width: 15, height: 15, collected: false }, // 需要利用横向能量
                    { x: 450, y: 50, width: 15, height: 15, collected: false } // 终点收集品
                );
                break;
                
            case 8:
                // 第8关：维度交错 - 动态维度变换
                this.platforms.push(
                    { x: 0, y: 550, width: 200, height: 50, dimension: 0 }, // 宽敞安全的起始平台
                    { x: 320, y: 500, width: 120, height: 20, dimension: 1, gravityToggle: true, toggleRate: 3500 }, // 动态重力平台
                    { x: 520, y: 450, width: 120, height: 20, dimension: 2, timePulse: true, pulseRate: 2500 }, // 脉动时间平台
                    { x: 220, y: 400, width: 120, height: 20, dimension: 3, energyBurst: true, burstRate: 3000 }, // 爆发能量平台
                    { x: 420, y: 350, width: 120, height: 20, dimension: 0, moving: true, moveX: 120, moveSpeed: 1.2 }, // 移动正常平台
                    { x: 620, y: 300, width: 120, height: 20, dimension: 1 }, // 稳定反重力平台
                    { x: 320, y: 250, width: 120, height: 20, dimension: 2 }, // 稳定时间平台
                    { x: 520, y: 200, width: 120, height: 20, dimension: 3, energyDirection: 'up', intensity: 1.6 }, // 定向能量平台
                    { x: 220, y: 150, width: 150, height: 20, dimension: 0 }, // 宽敞终点前平台
                    { x: 420, y: 100, width: 150, height: 20, dimension: 0 } // 宽敞终点平台
                );
                
                // 复杂动态危险区域网络
                this.hazards.push(
                    { x: 220, y: 530, width: 80, height: 20, dimension: 0, type: 'laser', active: true, blinkRate: 1200 }, // 快速闪烁
                    { x: 420, y: 480, width: 80, height: 20, dimension: 0, type: 'laser', moving: true, moveY: 80, moveSpeed: 1.5 }, // 上下移动
                    { x: 120, y: 430, width: 120, height: 20, dimension: 0, type: 'laser', active: false, delay: 2000 }, // 延迟激活
                    { x: 320, y: 380, width: 120, height: 20, dimension: 0, type: 'laser', energyLinked: true }, // 能量关联
                    { x: 520, y: 330, width: 120, height: 20, dimension: 0, type: 'laser', timeEffect: true }, // 时间影响
                    { x: 220, y: 280, width: 120, height: 20, dimension: 0, type: 'laser', moving: true, moveX: 100, moveSpeed: 1 }, // 左右移动
                    { x: 420, y: 230, width: 120, height: 20, dimension: 0, type: 'laser', blinkRate: 1800 } // 慢速闪烁
                );
                
                // 每个维度都有动态收集品
                this.collectibles.push(
                    { x: 350, y: 450, width: 15, height: 15, collected: false }, // 需把握重力切换
                    { x: 550, y: 400, width: 15, height: 15, collected: false }, // 需把握时间脉动
                    { x: 250, y: 350, width: 15, height: 15, collected: false }, // 需把握能量爆发
                    { x: 450, y: 300, width: 15, height: 15, collected: false }, // 需把握移动平台
                    { x: 650, y: 250, width: 15, height: 15, collected: false }, // 反重力区域
                    { x: 350, y: 200, width: 15, height: 15, collected: false }, // 时间区域
                    { x: 550, y: 150, width: 15, height: 15, collected: false }, // 能量区域
                    { x: 250, y: 100, width: 15, height: 15, collected: false }, // 终点收集品
                    { x: 450, y: 50, width: 15, height: 15, collected: false } // 终点收集品
                );
                break;
                
            case 9:
                // 第9关：平衡挑战 - 动态维度循环
                this.platforms.push(
                    { x: 0, y: 550, width: 220, height: 50, dimension: 0 }, // 宽敞安全的起始平台
                    { x: 420, y: 520, width: 120, height: 20, dimension: 0, moving: true, moveX: 100, moveSpeed: 0.8 }, // 慢速移动平台
                    { x: 220, y: 450, width: 120, height: 20, dimension: 3, energyBurst: true, burstRate: 2000 }, // 快速能量爆发
                    { x: 520, y: 400, width: 120, height: 20, dimension: 1, gravityToggle: true, toggleRate: 3000 }, // 重力切换
                    { x: 320, y: 350, width: 120, height: 20, dimension: 2, timeIntensity: 2.5 }, // 高强度时间扭曲
                    { x: 620, y: 300, width: 120, height: 20, dimension: 0 },
                    { x: 420, y: 250, width: 120, height: 20, dimension: 3, energyDirection: 'left', intensity: 2 }, // 左向能量
                    { x: 170, y: 200, width: 120, height: 20, dimension: 1 }, // 稳定反重力
                    { x: 520, y: 150, width: 120, height: 20, dimension: 2, timePulse: true, pulseRate: 2500 }, // 时间脉冲
                    { x: 320, y: 100, width: 180, height: 20, dimension: 0 } // 非常宽敞的终点平台
                );
                
                // 智能组合的动态危险区域
                this.hazards.push(
                    { x: 240, y: 530, width: 130, height: 20, dimension: 0, type: 'laser', active: true, blinkRate: 1000 }, // 超快速闪烁
                    { x: 120, y: 480, width: 120, height: 20, dimension: 0, type: 'laser', active: false, delay: 1500 }, // 快速延迟
                    { x: 370, y: 430, width: 130, height: 20, dimension: 0, type: 'laser', moving: true, moveY: 60, moveSpeed: 2 }, // 快速移动
                    { x: 220, y: 380, width: 120, height: 20, dimension: 0, type: 'laser', energyLinked: true }, // 能量关联
                    { x: 470, y: 330, width: 130, height: 20, dimension: 0, type: 'laser', timeEffect: true }, // 时间影响
                    { x: 120, y: 280, width: 120, height: 20, dimension: 0, type: 'laser', moving: true, moveX: 80, moveSpeed: 1.5 }, // 快速左右
                    { x: 370, y: 230, width: 120, height: 20, dimension: 0, type: 'laser', blinkRate: 2500 }, // 慢速闪烁
                    { x: 220, y: 180, width: 120, height: 20, dimension: 0, type: 'laser', active: false, delay: 4000 }, // 延迟激活
                    { x: 470, y: 130, width: 120, height: 20, dimension: 0, type: 'laser', active: true, blinkRate: 1800 } // 中速闪烁
                );
                
                // 战略性放置的收集品
                this.collectibles.push(
                    { x: 450, y: 470, width: 15, height: 15, collected: false }, // 把握移动平台
                    { x: 250, y: 400, width: 15, height: 15, collected: false }, // 把握能量爆发
                    { x: 550, y: 350, width: 15, height: 15, collected: false }, // 把握重力切换
                    { x: 350, y: 300, width: 15, height: 15, collected: false }, // 把握时间减速
                    { x: 650, y: 250, width: 15, height: 15, collected: false },
                    { x: 450, y: 200, width: 15, height: 15, collected: false }, // 利用左向能量
                    { x: 200, y: 150, width: 15, height: 15, collected: false }, // 反重力区域
                    { x: 550, y: 100, width: 15, height: 15, collected: false }, // 时间脉冲区域
                    { x: 380, y: 50, width: 15, height: 15, collected: false } // 终点收集品
                );
                break;
                
            case 10:
                // 第10关：维度大师 - 动态维度交响乐
                this.platforms.push(
                    { x: 0, y: 550, width: 250, height: 50, dimension: 0 }, // 非常宽敞安全的起始平台
                    { x: 420, y: 500, width: 150, height: 20, dimension: 1, gravityToggle: true, toggleRate: 2500 }, // 快速重力切换
                    { x: 170, y: 450, width: 120, height: 20, dimension: 2, timeIntensity: 3 }, // 超强时间扭曲
                    { x: 520, y: 400, width: 120, height: 20, dimension: 3, energyBurst: true, burstRate: 1500 }, // 高频能量爆发
                    { x: 320, y: 350, width: 150, height: 20, dimension: 0, moving: true, moveX: 150, moveY: 50, moveSpeed: 1.5 }, // 对角线移动
                    { x: 620, y: 300, width: 120, height: 20, dimension: 1, moving: true, moveY: 80, moveSpeed: 1.2 }, // 垂直移动
                    { x: 220, y: 250, width: 120, height: 20, dimension: 2, timePulse: true, pulseRate: 2000 }, // 快速时间脉冲
                    { x: 470, y: 200, width: 150, height: 20, dimension: 3, energyDirection: 'up', intensity: 2.2 }, // 强力上向能量
                    { x: 320, y: 120, width: 220, height: 20, dimension: 0 } // 超宽敞终点平台
                );
                
                // 精心编排的动态危险网络
                this.hazards.push(
                    { x: 290, y: 530, width: 100, height: 20, dimension: 0, type: 'laser', active: true, blinkRate: 800 }, // 极快速闪烁
                    { x: 120, y: 480, width: 100, height: 20, dimension: 0, type: 'laser', active: false, delay: 1200 }, // 极短延迟
                    { x: 420, y: 430, width: 120, height: 20, dimension: 0, type: 'laser', moving: true, moveY: 70, moveSpeed: 2.5 }, // 高速上下
                    { x: 220, y: 380, width: 100, height: 20, dimension: 0, type: 'laser', energyLinked: true }, // 能量联动
                    { x: 470, y: 330, width: 100, height: 20, dimension: 0, type: 'laser', timeEffect: true }, // 时间影响
                    { x: 120, y: 280, width: 100, height: 20, dimension: 0, type: 'laser', moving: true, moveX: 120, moveSpeed: 2 }, // 高速左右
                    { x: 520, y: 250, width: 100, height: 20, dimension: 0, type: 'laser', blinkRate: 2000 }, // 中速闪烁
                    { x: 370, y: 170, width: 100, height: 20, dimension: 0, type: 'laser', active: false, delay: 3000 } // 延迟激活
                );
                
                // 每个维度都有需要技巧的收集品
                this.collectibles.push(
                    { x: 470, y: 450, width: 15, height: 15, collected: false }, // 把握快速重力切换
                    { x: 200, y: 400, width: 15, height: 15, collected: false }, // 把握超强时间
                    { x: 550, y: 350, width: 15, height: 15, collected: false }, // 把握高频能量爆发
                    { x: 350, y: 300, width: 15, height: 15, collected: false }, // 把握对角线移动
                    { x: 650, y: 250, width: 15, height: 15, collected: false }, // 把握垂直移动
                    { x: 250, y: 200, width: 15, height: 15, collected: false }, // 把握时间脉冲
                    { x: 500, y: 150, width: 15, height: 15, collected: false }, // 把握强力上向能量
                    { x: 370, y: 70, width: 15, height: 15, collected: false }, // 终点收集品
                    { x: 470, y: 70, width: 15, height: 15, collected: false } // 终点收集品
                );
                break;
                
            default:
                // 随机生成更复杂的关卡
                this.generateRandomLevel(level);
        }
    }
    
    generateRandomLevel(level) {
        // 基础平台
        this.platforms.push({ x: 0, y: 550, width: 200, height: 50, dimension: 0 });
        
        // 随机生成平台和障碍物
        const numPlatforms = 5 + Math.floor(level / 2);
        for (let i = 0; i < numPlatforms; i++) {
            const dimension = Math.floor(Math.random() * Math.min(4, 1 + Math.floor(level / 3)));
            this.platforms.push({
                x: 200 + i * 120 + Math.random() * 60,
                y: 100 + Math.random() * 400,
                width: 80 + Math.random() * 40,
                height: 20,
                dimension: dimension
            });
        }
        
        // 生成收集品
        const numCollectibles = Math.max(1, 3 + Math.floor(level / 2)); // 确保至少有一个收集品
        for (let i = 0; i < numCollectibles; i++) {
            this.collectibles.push({
                x: 150 + i * 200 + Math.random() * 100,
                y: 50 + Math.random() * 450,
                width: 15,
                height: 15,
                collected: false
            });
        }
        
        // 生成危险区域
        if (level > 3) {
            const numHazards = Math.floor(level / 3);
            for (let i = 0; i < numHazards; i++) {
                this.hazards.push({
                    x: 300 + i * 200 + Math.random() * 100,
                    y: 400 + Math.random() * 100,
                    width: 60 + Math.random() * 40,
                    height: 20,
                    dimension: Math.floor(Math.random() * 4),
                    type: 'laser'
                });
            }
        }
    }
    
    createPulse(x, y, color, speed = 5) {
        this.lightPulses.push({
            x: x,
            y: y,
            radius: 10,
            color: color,
            speed: speed,
            alpha: 1.0
        });
    }

    update(deltaTime) {
        // 视觉特效更新 (即使暂停或菜单界面也更新，保持动态感)
        this.updateVisuals(deltaTime);

        if (this.gameState === 'menu') {
            // 菜单界面的环境光波
            if (Math.random() < 0.02) {
                 this.createPulse(
                    Math.random() * this.canvas.width, 
                    Math.random() * this.canvas.height, 
                    this.dimensions[Math.floor(Math.random()*4)].color,
                    3 + Math.random() * 2
                );
            }
        }

        if (this.gameState !== 'playing') return;
        
        const dimension = this.dimensions[this.currentDimension];
        const timeScale = dimension.timeScale;
        
        // 更新玩家
        this.updatePlayer(deltaTime * timeScale);
        
        // 碰撞检测
        this.checkCollisions();
        
        // 检查胜利条件
        this.checkWinCondition();
    }
    
    updateVisuals(deltaTime) {
        // 更新屏幕震动
        if (this.screenShake > 0) {
            this.screenShake *= this.shakeDecay;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }
        
        // 更新闪光
        if (this.flashIntensity > 0) {
            this.flashIntensity *= this.flashDecay;
            if (this.flashIntensity < 0.05) this.flashIntensity = 0;
        }
        
        // 更新光波
        for (let i = this.lightPulses.length - 1; i >= 0; i--) {
            const pulse = this.lightPulses[i];
            pulse.radius += pulse.speed;
            pulse.alpha -= 0.008; // 稍微减慢衰减，让光波更持久
            if (pulse.alpha <= 0) {
                this.lightPulses.splice(i, 1);
            }
        }
        
        // 更新背景星空
        this.stars.forEach(star => {
            star.y += star.speed;
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
            // 闪烁效果
            star.brightness += (Math.random() - 0.5) * 0.1;
            if(star.brightness > 1) star.brightness = 1;
            if(star.brightness < 0.2) star.brightness = 0.2;
        });
        
        // 动态网格移动
        this.gridOffset = (this.gridOffset + 0.5) % 40;
        
        // 更新玩家拖尾
        if (this.gameState === 'playing') {
            // 只有在玩家移动时才生成拖尾
            if (Math.abs(this.player.vx) > 0.5 || Math.abs(this.player.vy) > 0.5) {
                this.player.trail.push({
                    x: this.player.x,
                    y: this.player.y,
                    alpha: 0.8, // 提高初始透明度，让拖尾更明显
                    color: this.dimensions[this.currentDimension].color,
                    width: this.player.width,
                    height: this.player.height
                });
                // 增加拖尾长度，让效果更流畅
                if (this.player.trail.length > 15) {
                    this.player.trail.shift();
                }
            }
            // 平滑的透明度衰减
            this.player.trail.forEach(t => {
                t.alpha *= 0.88; // 调整衰减速度，让拖尾更自然
                // 确保拖尾不会完全透明
                if (t.alpha < 0.1) {
                    t.alpha = 0.1;
                }
            });
        }

        // 更新粒子
        this.updateParticles();
    }
    
    updatePlayer(deltaTime) {
        // 水平移动
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.player.vx = -this.player.speed;
        } else if (this.keys['d'] || this.keys['arrowright']) {
            this.player.vx = this.player.speed;
        } else {
            this.player.vx *= 0.8; // 摩擦力
        }
        
        // 跳跃 - 根据当前维度的重力方向调整跳跃方向
        if ((this.keys['w'] || this.keys['arrowup'] || this.keys[' ']) && this.player.onGround) {
            // 获取当前维度信息
            const dimension = this.dimensions[this.currentDimension];
            
            // 根据重力方向决定跳跃方向
            // 正重力模式：向上跳（负的vy值）
            // 反重力模式：向下跳（正的vy值）
            const jumpForce = dimension.gravity > 0 ? -12 : 12;
            
            this.player.vy = jumpForce;
            this.player.onGround = false;
            this.playSound('playerJump');
            this.createJumpDust(); // 新增跳跃尘埃
            
            // 跳跃光波
            this.createPulse(
                this.player.x + this.player.width/2, 
                this.player.y + this.player.height/2, 
                dimension.color,
                8
            );
        }
        
        // 获取当前维度信息
        const dimension = this.dimensions[this.currentDimension];
        
        // 应用重力 - 时间扭曲模式下上升时加速度变为一半，下落时加速度变为4倍
        let gravityMultiplier = 1;
        if (this.currentDimension === 2) { // 时间扭曲模式
            if (this.player.vy > 0) { // 下落时
                gravityMultiplier = 4;
            } else if (this.player.vy < 0) { // 上升时
                gravityMultiplier = 0.5;
            }
        }
        this.player.vy += dimension.gravity * gravityMultiplier;
        
        // 能量场效果
        if (dimension.forceField) {
            // 模拟能量场推动效果
            this.player.vx += Math.sin(Date.now() * 0.001) * 0.15; // 增加到原来的1.5倍
            this.player.vy += Math.cos(Date.now() * 0.0015) * 0.15; // 增加到原来的1.5倍
        }
        
        // 更新位置
        this.player.x += this.player.vx;
        this.player.y += this.player.vy;
        
        // 边界检查
        if (this.player.x < 0) this.player.x = 0;
        if (this.player.x > this.canvas.width - this.player.width) this.player.x = this.canvas.width - this.player.width;
        
        // 反重力模式下的上边界特殊处理
        if (dimension.gravity < 0) { // 反重力模式
            // 限制反重力模式下的最大上升速度
            if (this.player.vy < -8) { // 限制最大上升速度，防止飞得太快
                this.player.vy = -8;
            }
            
            // 设置上界阻隔 - 比游戏界面高一点，让玩家恰好不出现在游戏界面中
            const upperBoundary = -60; // 上界位置，比玩家高度再低一些
            
            // 上界碰撞检测 - 反重力模式下，玩家会落在上界的下表面
            if (this.player.y < upperBoundary && this.player.vy < 0) {
                // 玩家与上界碰撞
                this.player.y = upperBoundary;
                this.player.vy = 0;
                this.player.onGround = true; // 视为着地状态，允许跳跃
                
                // 开始计时警告
                if (!this.isOutOfBoundsWarning) {
                    this.isOutOfBoundsWarning = true;
                    this.outOfBoundsTimer = 0;
                } else {
                    this.outOfBoundsTimer += deltaTime;
                    
                    // 超过5秒未返回，游戏失败
                    if (this.outOfBoundsTimer > this.outOfBoundsWarningTime) {
                        this.gameOver();
                    }
                }
            } else if (this.isOutOfBoundsWarning && this.player.y > -this.player.height) {
                // 玩家回到安全区域，重置警告
                this.outOfBoundsTimer = 0;
                this.isOutOfBoundsWarning = false;
            }
        } else if (this.isOutOfBoundsWarning) {
            // 切换到非反重力维度，重置警告
            this.outOfBoundsTimer = 0;
            this.isOutOfBoundsWarning = false;
        }
        
        // 轨迹更新已移至 updateVisuals 方法统一处理
        
        this.player.onGround = false;
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    checkCollisions() {
        // 平台碰撞
        this.platforms.forEach(platform => {
            if (platform.dimension === this.currentDimension || platform.dimension === undefined) {
                // 更精确的碰撞检测，考虑高速穿透问题
                const dimension = this.dimensions[this.currentDimension];
                
                // 标准重力模式：玩家从上方落在平台上
                if (dimension.gravity > 0) {
                    // 预测玩家下一帧的位置，防止高速穿透
                    const nextY = this.player.y + this.player.vy;
                    const nextBottom = nextY + this.player.height;
                    
                    // 检查玩家是否会在下一帧落在平台上
                    if (this.player.vy > 0 && 
                        nextBottom >= platform.y && 
                        this.player.y + this.player.height <= platform.y &&
                        this.player.x < platform.x + platform.width && 
                        this.player.x + this.player.width > platform.x) {
                        
                        // 精确放置在平台上
                        this.player.y = platform.y - this.player.height;
                        this.player.vy = 0;
                        this.player.onGround = true;
                    }
                    // 传统的矩形碰撞检测作为后备
                    else if (this.isColliding(this.player, platform) && this.player.vy > 0 && this.player.y < platform.y) {
                        this.player.y = platform.y - this.player.height;
                        this.player.vy = 0;
                        this.player.onGround = true;
                    }
                }
                // 反重力模式：玩家从下方落在平台上
                else if (dimension.gravity < 0) {
                    // 预测玩家下一帧的位置，防止高速穿透
                    const nextY = this.player.y + this.player.vy;
                    
                    // 检查玩家是否会在下一帧落在平台上
                    if (this.player.vy < 0 && 
                        nextY <= platform.y + platform.height && 
                        this.player.y >= platform.y + platform.height &&
                        this.player.x < platform.x + platform.width && 
                        this.player.x + this.player.width > platform.x) {
                        
                        // 精确放置在平台上
                        this.player.y = platform.y + platform.height;
                        this.player.vy = 0;
                        this.player.onGround = true;
                    }
                    // 传统的矩形碰撞检测作为后备
                    else if (this.isColliding(this.player, platform) && this.player.vy < 0 && this.player.y > platform.y) {
                        this.player.y = platform.y + platform.height;
                        this.player.vy = 0;
                        this.player.onGround = true;
                    }
                }
            }
        });
        
        // 收集品碰撞
        this.collectibles.forEach((collectible, index) => {
            if (!collectible.collected && this.isColliding(this.player, collectible)) {
                collectible.collected = true;
                this.quantumShards++;
                this.energy = Math.min(this.energy + 10, this.maxEnergy);
                this.createCollectionEffect(collectible);
            }
        });
        
        // 危险区域碰撞
        this.hazards.forEach(hazard => {
            if (hazard.dimension === this.currentDimension && this.isColliding(this.player, hazard)) {
                this.takeDamage(20);
            }
        });
        
        // 掉落检测
        // 只有当玩家完全掉出屏幕且没有落在任何平台上时才触发
        // 确保掉落回来时只要落在可落表面上就不扣能量
        let isOnAnyPlatform = this.player.onGround;
        if (!isOnAnyPlatform && this.player.y > this.canvas.height) {
            // 额外检查玩家是否真的没有落在任何平台上
            // 获取当前维度
            const dimension = this.dimensions[this.currentDimension];
            
            // 再次确认是否真的不在任何平台上
            // 计算玩家底部（标准重力）或顶部（反重力）的位置
            let playerContactY = dimension.gravity > 0 ? this.player.y + this.player.height : this.player.y;
            
            // 检查是否有任何平台可能会接住玩家
            let willLandOnPlatform = false;
            this.platforms.forEach(platform => {
                if ((platform.dimension === this.currentDimension || platform.dimension === undefined) && 
                    this.player.x < platform.x + platform.width && 
                    this.player.x + this.player.width > platform.x) {
                    // 标准重力：检查平台顶部
                    if (dimension.gravity > 0 && platform.y >= playerContactY) {
                        willLandOnPlatform = true;
                    }
                    // 反重力：检查平台底部
                    else if (dimension.gravity < 0 && platform.y + platform.height <= playerContactY) {
                        willLandOnPlatform = true;
                    }
                }
            });
            
            // 只有当玩家真的没有落在任何平台上时才扣能量
            if (!willLandOnPlatform) {
                this.takeDamage(50);
                this.resetPlayer();
            }
        }
    }
    
    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    createCollectionEffect(collectible) {
        this.playSound('collectShard');
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: collectible.x + collectible.width/2,
                y: collectible.y + collectible.height/2,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 40,
                maxLife: 40,
                color: '#00ff00',
                size: Math.random() * 3 + 1
            });
        }
    }
    
    takeDamage(amount) {
        // 在反重力模式下从边界返回时不扣除能量
        const dimension = this.dimensions[this.currentDimension];
        if (!(dimension.gravity < 0 && this.isOutOfBoundsWarning)) {
            this.energy -= amount;
            this.playSound('hazardHit');
            if (this.energy <= 0) {
                this.gameOver();
            }
        }
    }
    
    gameOver() {
        // 能量耗尽时在当前关卡重新初始化，而不是回到第一关
        this.energy = this.maxEnergy; // 恢复能量
        this.quantumShards = 0; // 重置收集的碎片
        this.outOfBoundsTimer = 0;
        this.isOutOfBoundsWarning = false;
        this.currentDimension = 0; // 重置为正常维度
        this.resetPlayer(); // 重置玩家位置
        this.loadLevel(this.currentLevel); // 重新加载当前关卡
        this.updateUI();
        
        // 保持游戏状态为playing，不显示菜单
        // 如果需要显示一个简短的"复活"提示，可以在这里添加
        this.createRespawnEffect();
    }
    
    createRespawnEffect() {
        // 创建复活效果
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: this.player.x + this.player.width/2,
                y: this.player.y + this.player.height/2,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 50,
                maxLife: 50,
                color: '#00ff00',
                size: Math.random() * 4 + 2
            });
        }
    }
    
    checkWinCondition() {
        // 防止重复触发胜利条件
        if (this.isLevelComplete) return;
        
        // 检查屏幕可视区域内是否还有未收集的碎片
        const visibleCollectibles = this.collectibles.filter(c => {
            // 检查碎片是否在屏幕可视区域内（考虑到玩家移动范围）
            const isVisible = c.x >= 0 && c.x <= this.canvas.width && 
                            c.y >= 0 && c.y <= this.canvas.height;
            return isVisible && !c.collected;
        });
        
        // 如果屏幕可视区域内没有未收集的碎片，就算胜利
        // 同时确保关卡中确实生成了收集品
        if (visibleCollectibles.length === 0 && this.collectibles.length > 0) {
            this.isLevelComplete = true;
            const isChallenge = this.gameMode !== 'casual';
            const lastLevel = isChallenge ? 10 : 20;
            this.showLevelComplete();
            if (this.currentLevel >= lastLevel) {
                setTimeout(() => {
                    this.showVictoryOverlay();
                }, 1000);
            } else {
                setTimeout(() => {
                    this.nextLevel();
                }, 2000);
            }
        }
    }
    
    showLevelComplete() {
        // 创建关卡完成效果
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: this.canvas.width / 2 + (Math.random() - 0.5) * 200,
                y: this.canvas.height / 2 + (Math.random() - 0.5) * 200,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 60,
                maxLife: 60,
                color: '#00ff00',
                size: Math.random() * 5 + 2
            });
        }
    }
    
    nextLevel() {
        const isChallenge = this.gameMode !== 'casual';
        const lastLevel = isChallenge ? 10 : 20;
        if (this.currentLevel >= lastLevel) {
            this.showVictoryOverlay();
            return;
        }
        this.currentLevel++;
        this.energy = this.maxEnergy;
        this.isLevelComplete = false;
        this.loadLevel(this.currentLevel);
        this.resetPlayer();
        this.updateUI();
        this.saveProgress();
    }
    
    renderOutOfBoundsWarning() {
        if (this.isOutOfBoundsWarning) {
            const remainingTime = Math.ceil((this.outOfBoundsWarningTime - this.outOfBoundsTimer) / 1000);
            
            // 绘制警告背景 - 更淡的红色
            this.ctx.fillStyle = 'rgba(255, 100, 100, 0.05)'; // 使用淡红色，透明度更低
            this.ctx.fillRect(0, 0, this.canvas.width, 80);
            
            // 绘制警告边框 - 更淡的红色
            this.ctx.strokeStyle = 'rgba(255, 100, 100, 0.2)'; // 使用淡红色，透明度更低
            this.ctx.lineWidth = 1; // 保持细边框
            this.ctx.strokeRect(0, 0, this.canvas.width, 80);
            
            // 绘制警告文字 - 使用白色文字
            this.ctx.font = 'bold 18px Arial'; // 保持字体大小
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // 稍微降低文字透明度
            this.ctx.textAlign = 'center';
            this.ctx.fillText('警告：反重力模式下正在离开边界！', this.canvas.width / 2, 30);
            
            // 绘制倒计时 - 使用更淡的红色
            this.ctx.font = 'bold 24px Arial'; // 保持字体大小
            this.ctx.fillStyle = 'rgba(255, 100, 100, 0.3)'; // 使用淡红色，透明度更低
            // 倒计时闪烁效果
            if (remainingTime > 3 || Math.floor(Date.now() / 500) % 2 === 0) {
                this.ctx.fillText('切换维度返回：' + remainingTime + 's', this.canvas.width / 2, 65);
            }
            
            // 绘制箭头提示 - 使用更淡的文字
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // 降低提示文字透明度
            this.ctx.font = '14px Arial'; // 略微减小字体
            this.ctx.textAlign = 'left';
            this.ctx.fillText('按1/3/4切换维度', 20, 65);
        }
    }
    
    render() {
        // 清空画布 (不再使用纯黑，而是使用带有透明度的黑色来实现拖尾效果)
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 应用屏幕震动
        this.ctx.save();
        if (this.screenShake > 0) {
            const dx = (Math.random() - 0.5) * this.screenShake;
            const dy = (Math.random() - 0.5) * this.screenShake;
            this.ctx.translate(dx, dy);
        }
        
        // 1. 渲染背景层 (星空 + 网格)
        this.renderBackground();

        // 2. 渲染光波 (作为照明层)
        this.renderLightPulses();

        // 3. 渲染游戏物体 (受光照影响)
        this.renderPlatforms();
        this.renderCollectibles();
        this.renderHazards();
        this.renderPortals();
        
        // 4. 渲染玩家及其拖尾
        this.renderPlayer();
        
        // 5. 渲染前景粒子
        this.renderParticles();
        
        // 6. 渲染越界警告
        this.renderOutOfBoundsWarning();
        
        this.ctx.restore(); // 结束震动偏移
        
        // 7. 全屏闪光特效 (不受震动影响)
        if (this.flashIntensity > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashIntensity})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // 8. 渲染 UI (HUD)
        if (this.gameState === 'playing') {
            this.renderHUD();
        } else if (this.gameState === 'gameOver') {
            this.renderGameOver();
        } else if (this.gameState === 'levelComplete') {
            this.renderLevelComplete();
        }
    }
    
    renderBackground() {
        // 绘制星空
        this.ctx.save();
        this.stars.forEach(star => {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
        
        // 绘制复古未来网格地平线 (仅在底部绘制，营造空间感)
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 217, 255, 0.1)';
        this.ctx.lineWidth = 1;
        const gridSize = 40;
        
        // 垂直线
        for(let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 水平线
        for(let y = this.gridOffset; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            // 越往下越亮
            const alpha = (y / this.canvas.height) * 0.15;
            this.ctx.strokeStyle = `rgba(0, 217, 255, ${alpha})`;
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    renderLightPulses() {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen'; // 混合模式，让光叠加更亮
        
        this.lightPulses.forEach(pulse => {
            // 创建径向渐变，模拟真实光照衰减
            const gradient = this.ctx.createRadialGradient(
                pulse.x, pulse.y, 0,
                pulse.x, pulse.y, pulse.radius
            );
            
            // 核心亮，边缘暗
            gradient.addColorStop(0, `rgba(${this.hexToRgb(pulse.color)}, 0)`); // 中心镂空
            gradient.addColorStop(0.8, `rgba(${this.hexToRgb(pulse.color)}, ${pulse.alpha * 0.8})`); // 光环主体
            gradient.addColorStop(1, `rgba(${this.hexToRgb(pulse.color)}, 0)`); // 边缘消失
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 绘制额外的细线圈，增加科技感
            this.ctx.strokeStyle = `rgba(${this.hexToRgb(pulse.color)}, ${pulse.alpha})`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(pulse.x, pulse.y, pulse.radius * 0.9, 0, Math.PI * 2);
            this.ctx.stroke();
        });
        
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.restore();
    }
    
    // 辅助函数：Hex 转 RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '255, 255, 255';
    }

    renderPlayer() {
        this.ctx.save();
        
        // 1. 绘制拖尾
        this.player.trail.forEach(t => {
            this.ctx.fillStyle = t.color;
            this.ctx.globalAlpha = t.alpha * 0.5;
            this.ctx.fillRect(t.x, t.y, this.player.width, this.player.height);
        });
        this.ctx.globalAlpha = 1.0;
        
        // 2. 绘制玩家主体
        const dimColor = this.dimensions[this.currentDimension].color;
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = dimColor;
        this.ctx.fillStyle = '#fff'; // 核心亮白
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // 3. 绘制玩家边缘发光框
        this.ctx.strokeStyle = dimColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.player.x - 2, this.player.y - 2, this.player.width + 4, this.player.height + 4);
        
        this.ctx.restore();
    }
    
    renderHUD() {
        this.ctx.save();
        
        // 仪表盘样式设置
        this.ctx.font = "bold 16px 'Orbitron', sans-serif";
        const padding = 20;
        const barHeight = 10;
        const barWidth = 200;
        
        // 左上角 - 能量与碎片
        // 背景面板
        this.ctx.fillStyle = 'rgba(10, 10, 30, 0.6)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(260, 0);
        this.ctx.lineTo(240, 80);
        this.ctx.lineTo(0, 80);
        this.ctx.fill();
        
        // 边框装饰
        this.ctx.strokeStyle = 'rgba(0, 217, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 80);
        this.ctx.lineTo(240, 80);
        this.ctx.lineTo(260, 0);
        this.ctx.stroke();

        // 能量条标签
        this.ctx.fillStyle = '#00d9ff';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`ENERGY SYSTEM`, padding, 30);
        
        // 能量条背景
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(padding, 40, barWidth, barHeight);
        
        // 能量条主体
        const energyPct = this.energy / this.maxEnergy;
        const energyGradient = this.ctx.createLinearGradient(padding, 0, padding + barWidth, 0);
        energyGradient.addColorStop(0, '#ff2a6d');
        energyGradient.addColorStop(1, '#00d9ff');
        
        this.ctx.fillStyle = energyGradient;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#00d9ff';
        this.ctx.fillRect(padding, 40, barWidth * energyPct, barHeight);
        this.ctx.shadowBlur = 0;
        
        // 碎片计数 (右侧显示)
        this.ctx.fillStyle = '#b957ff';
        this.ctx.fillText(`SHARDS: ${this.quantumShards}/3`, padding, 70);
        
        // 右上角 - 维度指示器
        const dimName = this.dimensions[this.currentDimension].name;
        const dimColor = this.dimensions[this.currentDimension].color;
        
        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = dimColor;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = dimColor;
        this.ctx.font = "bold 24px 'Orbitron', sans-serif";
        this.ctx.fillText(dimName, this.canvas.width - padding, 40);
        this.ctx.font = "14px 'Orbitron', sans-serif";
        this.ctx.fillText(`DIMENSION LINK ESTABLISHED`, this.canvas.width - padding, 65);
        this.ctx.shadowBlur = 0;
        
        // 中央 - 关卡提示
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.font = "12px 'Orbitron', sans-serif";
        this.ctx.fillText(`LEVEL ${this.currentLevel} // ${this.gameMode ? this.gameMode.toUpperCase() : 'INIT'}`, this.canvas.width/2, 20);

        this.ctx.restore();
    }
    
    renderDimensionBackground() {
        const dimension = this.dimensions[this.currentDimension];
        
        // 创建渐变背景
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width/2, this.canvas.height/2, 0,
            this.canvas.width/2, this.canvas.height/2, this.canvas.width/2
        );
        
        const baseColor = dimension.color;
        gradient.addColorStop(0, baseColor + '20');
        gradient.addColorStop(1, baseColor + '05');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 添加维度特定的视觉效果
        if (dimension.forceField) {
            this.renderForceFieldEffect();
        }
        
        if (dimension.timeScale < 1) {
            this.renderTimeWarpEffect();
        }
    }
    
    renderForceFieldEffect() {
        const time = Date.now() * 0.001;
        for (let i = 0; i < 5; i++) {
            this.ctx.strokeStyle = `rgba(249, 115, 22, ${0.3 - i * 0.05})`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(
                this.canvas.width/2 + Math.sin(time + i) * 100,
                this.canvas.height/2 + Math.cos(time + i * 1.5) * 100,
                50 + i * 30,
                0, Math.PI * 2
            );
            this.ctx.stroke();
        }
    }
    
    renderTimeWarpEffect() {
        const time = Date.now() * 0.0005;
        for (let i = 0; i < 3; i++) {
            this.ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 - i * 0.1})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width/2, this.canvas.height/2, 100 + i * 50, time, time + Math.PI);
            this.ctx.stroke();
        }
    }
    
    renderPlatforms() {
        this.ctx.save();
        this.platforms.forEach(platform => {
            // 计算平台在所有光波和玩家光环下的可见度
            let maxVisibility = 0;
            
            // 1. 检查玩家基础光环
            const distToPlayer = Math.hypot(
                (platform.x + platform.width/2) - (this.player.x + this.player.width/2),
                (platform.y + platform.height/2) - (this.player.y + this.player.height/2)
            );
            if (distToPlayer < this.baseVisibilityRadius) {
                maxVisibility = Math.max(maxVisibility, 1 - distToPlayer / this.baseVisibilityRadius);
            }
            
            // 2. 检查所有光波
            this.lightPulses.forEach(pulse => {
                const distToPulse = Math.hypot(
                    (platform.x + platform.width/2) - pulse.x,
                    (platform.y + platform.height/2) - pulse.y
                );
                // 只有在光波环附近才可见 (radius * 0.8 到 radius)
                if (Math.abs(distToPulse - pulse.radius) < 100) {
                     let visibility = (100 - Math.abs(distToPulse - pulse.radius)) / 100;
                     visibility *= pulse.alpha;
                     maxVisibility = Math.max(maxVisibility, visibility);
                }
            });
            
            // 如果不可见，直接跳过绘制（黑暗效果）
            if (maxVisibility <= 0.05) return;
            
            // 绘制平台
            const alpha = maxVisibility;
            // 判断是否是当前维度平台
            const isCurrentDim = platform.dimension === this.currentDimension || platform.dimension === undefined;
            const dimColor = isCurrentDim ? this.dimensions[this.currentDimension].color : '#555'; // 非当前维度用灰色
            
            // 如果不是当前维度，可见度减半
            const drawAlpha = isCurrentDim ? alpha : alpha * 0.5;
            
            this.ctx.globalAlpha = drawAlpha;
            this.ctx.strokeStyle = dimColor;
            this.ctx.lineWidth = 2;
            this.ctx.fillStyle = `rgba(${this.hexToRgb(dimColor)}, 0.1)`; // 内部微弱填充
            
            this.ctx.beginPath();
            this.ctx.rect(platform.x, platform.y, platform.width, platform.height);
            this.ctx.fill();
            this.ctx.stroke();
            
            // 绘制内部网格纹理 (增加科技感)
            this.ctx.beginPath();
            // 对角线
            this.ctx.moveTo(platform.x, platform.y);
            this.ctx.lineTo(platform.x + platform.width, platform.y + platform.height);
            // 另一条对角线
            // this.ctx.moveTo(platform.x + platform.width, platform.y);
            // this.ctx.lineTo(platform.x, platform.y + platform.height);
            this.ctx.stroke();
            
            // 发光
            this.ctx.shadowBlur = 10 * drawAlpha;
            this.ctx.shadowColor = dimColor;
            
            this.ctx.globalAlpha = 1.0;
            this.ctx.shadowBlur = 0;
        });
        this.ctx.restore();
    }
    
    renderCollectibles() {
        this.collectibles.forEach(collectible => {
            if (!collectible.collected) {
                const time = Date.now() * 0.005;
                
                // 发光效果
                const glowGradient = this.ctx.createRadialGradient(
                    collectible.x + collectible.width/2,
                    collectible.y + collectible.height/2,
                    0,
                    collectible.x + collectible.width/2,
                    collectible.y + collectible.height/2,
                    20
                );
                glowGradient.addColorStop(0, '#00ff0040');
                glowGradient.addColorStop(1, '#00ff0000');
                
                this.ctx.fillStyle = glowGradient;
                this.ctx.fillRect(
                    collectible.x - 10,
                    collectible.y - 10,
                    collectible.width + 20,
                    collectible.height + 20
                );
                
                // 收集品本体
                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillRect(collectible.x, collectible.y, collectible.width, collectible.height);
                
                // 旋转效果
                this.ctx.save();
                this.ctx.translate(collectible.x + collectible.width/2, collectible.y + collectible.height/2);
                this.ctx.rotate(time);
                this.ctx.strokeStyle = '#00ff00';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(-collectible.width/2, -collectible.height/2, collectible.width, collectible.height);
                this.ctx.restore();
            }
        });
    }
    
    renderHazards() {
        this.hazards.forEach(hazard => {
            if (hazard.dimension === this.currentDimension) {
                const time = Date.now() * 0.01;
                
                this.ctx.fillStyle = '#ff0000';
                this.ctx.fillRect(hazard.x, hazard.y, hazard.width, hazard.height);
                
                // 激光效果
                if (hazard.type === 'laser') {
                    this.ctx.strokeStyle = '#ff0000';
                    this.ctx.lineWidth = 3;
                    this.ctx.setLineDash([10, 5]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(hazard.x, hazard.y);
                    this.ctx.lineTo(hazard.x + hazard.width, hazard.y);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                }
            }
        });
    }
    
    renderPortals() {
        this.portals.forEach(portal => {
            const time = Date.now() * 0.002;
            const radius = portal.width / 2;
            const centerX = portal.x + radius;
            const centerY = portal.y + radius;
            
            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(time);
            
            // 漩涡效果
            for(let i=0; i<3; i++) {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, radius - i*5, 0 + i, Math.PI * 1.5 + i);
                this.ctx.strokeStyle = `hsl(${(time * 50 + i * 30) % 360}, 100%, 50%)`;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
            
            this.ctx.restore();
            
            // 核心发光
            const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.5, '#00ffff');
            gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.globalAlpha = 0.5 + Math.sin(time * 5) * 0.2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        });
    }
    
    renderParticles() {
        this.ctx.save();
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = alpha;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }
    
    updateUI() {
        // DOM UI 已移除，转为 Canvas 渲染
        const currentLevelDisplay = document.getElementById('currentLevelDisplay');
        if (currentLevelDisplay) {
            currentLevelDisplay.textContent = this.currentLevel;
        }
    }
    
    gameLoop(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        this.updateUI();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    saveProgress() {
        if (!this.gameMode) return;
        const key = this.gameMode === 'casual' ? 'quantumJumper_progress_casual' : 'quantumJumper_progress_challenge';
        const data = { level: this.currentLevel };
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
    }

    loadProgress(mode) {
        const key = mode === 'casual' ? 'quantumJumper_progress_casual' : 'quantumJumper_progress_challenge';
        // 挑战模式始终从第1关开始，不受localStorage影响
        let defaultLevel = mode === 'casual' ? 11 : 1;
        // 休闲模式才加载保存的进度
        if (mode === 'casual') {
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const data = JSON.parse(raw);
                    if (typeof data.level === 'number') defaultLevel = data.level;
                }
            } catch (e) {}
        }
        this.currentLevel = defaultLevel;
    }

    showVictoryOverlay() {
        this.gameState = 'paused';
        const overlay = document.getElementById('victoryOverlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    returnToModeSelect() {
        this.gameState = 'menu';
        this.isLevelComplete = false;
        this.gameMode = null;
        const victory = document.getElementById('victoryOverlay');
        if (victory) victory.classList.add('hidden');
        const pause = document.getElementById('pauseMenu');
        if (pause) pause.classList.add('hidden');
        const menu = document.getElementById('gameOverlay');
        if (menu) menu.classList.remove('hidden');
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new QuantumJumper();
});