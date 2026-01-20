// 量子跃迁者 - 游戏主逻辑
class QuantumJumper {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.currentLevel = 1;
        this.gameMode = null; // 'challenge' | 'casual'
        this.progress = { challenge: { level: 1 }, casual: { level: 11 } };
        this.quantumShards = 0;
        this.energy = 100;
        this.maxEnergy = 100;
        
        // 反重力边界警告相关
        this.outOfBoundsTimer = 0;
        this.isOutOfBoundsWarning = false;
        this.outOfBoundsWarningTime = 5000; // 5秒限制（毫秒）
        
        // 维度系统
        this.currentDimension = 0;
        this.dimensions = [
            { name: '正常维度', color: '#3b82f6', gravity: 0.5, timeScale: 1, backgroundPattern: 'grid', particleColor: '#00d9ff' },
            { name: '反重力', color: '#8b5cf6', gravity: -0.5, timeScale: 1, backgroundPattern: 'spiral', particleColor: '#c084fc' },
            { name: '时间扭曲', color: '#06b6d4', gravity: 0.6, timeScale: 2, backgroundPattern: 'wave', particleColor: '#67e8f9' },
            { name: '能量场', color: '#f97316', gravity: 0.5, timeScale: 1, backgroundPattern: 'pulse', particleColor: '#fdba74', forceField: true }
        ];
        
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
        
        this.init();
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
        // 创建多层次维度切换的视觉效果
        const dimension = this.dimensions[this.currentDimension];
        const centerX = this.player.x + this.player.width / 2;
        const centerY = this.player.y + this.player.height / 2;
        
        // 内层核心粒子 - 快速向外扩散
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 40,
                maxLife: 40,
                color: dimension.particleColor || dimension.color,
                size: Math.random() * 3 + 2,
                layer: 'core'
            });
        }
        
        // 中层能量波 - 稍慢扩散，较大尺寸
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 50,
                maxLife: 50,
                color: dimension.color,
                size: Math.random() * 5 + 3,
                layer: 'wave'
            });
        }
        
        // 外层光晕粒子 - 缓慢扩散，透明度较低
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: centerX + (Math.random() - 0.5) * 60,
                y: centerY + (Math.random() - 0.5) * 60,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 60,
                maxLife: 60,
                color: dimension.particleColor || dimension.color,
                size: Math.random() * 2 + 1,
                layer: 'halo'
            });
        }
        
        // 量子跃迁特效 - 十字形能量爆发
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const speed = 12 + Math.random() * 8;
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 30,
                maxLife: 30,
                color: '#ffffff',
                size: Math.random() * 4 + 2,
                layer: 'quantum'
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
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        const dimension = this.dimensions[this.currentDimension];
        const timeScale = dimension.timeScale;
        
        // 更新玩家
        this.updatePlayer(deltaTime * timeScale);
        
        // 更新粒子
        this.updateParticles();
        
        // 碰撞检测
        this.checkCollisions();
        
        // 检查胜利条件
        this.checkWinCondition();
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
        
        // 更新轨迹
        this.player.trail.push({ x: this.player.x + this.player.width/2, y: this.player.y + this.player.height/2 });
        if (this.player.trail.length > 20) {
            this.player.trail.shift();
        }
        
        this.player.onGround = false;
    }
    
    updateParticles() {
        const dimension = this.dimensions[this.currentDimension];
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // 应用不同层级的物理效果
            switch (particle.layer) {
                case 'core':
                    // 核心粒子：低阻力，保持速度
                    particle.vx *= 0.98;
                    particle.vy *= 0.98;
                    break;
                case 'wave':
                    // 能量波：中等阻力，添加轻微重力
                    particle.vx *= 0.95;
                    particle.vy *= 0.95;
                    particle.vy += dimension.gravity * 0.1;
                    break;
                case 'halo':
                    // 光晕粒子：高阻力，缓慢减速
                    particle.vx *= 0.9;
                    particle.vy *= 0.9;
                    break;
                case 'quantum':
                    // 量子粒子：随机波动，保持高速
                    particle.vx += (Math.random() - 0.5) * 0.5;
                    particle.vy += (Math.random() - 0.5) * 0.5;
                    // 限制最大速度
                    const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
                    if (speed > 20) {
                        const factor = 20 / speed;
                        particle.vx *= factor;
                        particle.vy *= factor;
                    }
                    break;
                default:
                    // 默认粒子：基础物理
                    particle.vx *= 0.95;
                    particle.vy *= 0.95;
                    break;
            }
            
            // 更新位置
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // 更新生命周期
            particle.life--;
            
            // 移除死亡粒子
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
        // 清空画布
        this.ctx.fillStyle = 'rgba(10, 10, 46, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制维度背景效果
        this.renderDimensionBackground();
        
        // 绘制平台
        this.renderPlatforms();
        
        // 绘制收集品
        this.renderCollectibles();
        
        // 绘制危险区域
        this.renderHazards();
        
        // 绘制玩家轨迹
        this.renderPlayerTrail();
        
        // 绘制玩家
        this.renderPlayer();
        
        // 绘制粒子
        this.renderParticles();
        
        // 绘制维度指示器
        this.renderDimensionIndicator();
        
        // 绘制越界警告
        this.renderOutOfBoundsWarning();
    }
    
    renderDimensionBackground() {
        const dimension = this.dimensions[this.currentDimension];
        const time = Date.now() * 0.001;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // 创建多层次渐变背景 - 增强深度感和动态效果
        const gradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, Math.max(centerX, centerY) * 3
        );
        
        const baseColor = dimension.color;
        
        // 动态颜色变化：根据时间和维度创建更丰富的色彩
        const timeFactor = time * 0.2;
        const hueShift1 = Math.sin(timeFactor) * 12;
        const hueShift2 = Math.cos(timeFactor * 1.3) * 18;
        const hueShift3 = Math.sin(timeFactor * 1.7) * 10;
        const hueShift4 = Math.cos(timeFactor * 2.1) * 15;
        const hueShift5 = Math.sin(timeFactor * 0.8) * 20;
        
        const deepDarkColor = this.shiftHue(this.adjustColor(baseColor, -100), hueShift1);
        const darkColor = this.shiftHue(this.adjustColor(baseColor, -70), hueShift2);
        const midDarkColor = this.shiftHue(this.adjustColor(baseColor, -40), hueShift3);
        const baseHueShifted = this.shiftHue(baseColor, hueShift4);
        const midLightColor = this.shiftHue(this.adjustColor(baseColor, 30), hueShift5);
        const lightColor = this.shiftHue(this.adjustColor(baseColor, 60), -hueShift1);
        const highlightColor = this.shiftHue(this.adjustColor(baseColor, 100), hueShift2);
        const edgeColor = this.shiftHue(this.adjustColor(baseColor, -120), hueShift3);
        
        // 添加动态透明度变化 - 更平滑的波动
        const alphaBase = Math.sin(timeFactor * 2) * 0.05 + 0.3;
        const alpha1 = Math.min(0.3, alphaBase + 0.2);
        const alpha2 = Math.min(0.25, alphaBase + 0.15);
        const alpha3 = Math.min(0.2, alphaBase + 0.1);
        const alpha4 = Math.min(0.15, alphaBase + 0.05);
        const alpha5 = Math.min(0.1, alphaBase + 0.03);
        const alpha6 = Math.min(0.05, alphaBase + 0.02);
        const alpha7 = Math.min(0.02, alphaBase + 0.01);
        
        // 更精细的渐变层次，增强空间感和动态效果
        gradient.addColorStop(0, deepDarkColor + Math.floor(alpha1 * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.1, darkColor + Math.floor(alpha2 * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.25, midDarkColor + Math.floor(alpha3 * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.4, baseHueShifted + Math.floor(alpha4 * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.55, midLightColor + Math.floor(alpha4 * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.7, lightColor + Math.floor(alpha5 * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.85, highlightColor + Math.floor(alpha6 * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.95, edgeColor + Math.floor(alpha7 * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, edgeColor + '00');
        
        // 添加第二组渐变，从边缘向中心的反向渐变，增强深度感
        const reverseGradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, Math.max(centerX, centerY) * 2
        );
        
        const reverseTimeFactor = time * 0.15;
        const reverseHueShift = Math.sin(reverseTimeFactor) * 25;
        const reverseColor = this.shiftHue(baseColor, reverseHueShift);
        const reverseAlpha = Math.sin(reverseTimeFactor * 3) * 0.08 + 0.1;
        
        reverseGradient.addColorStop(0, reverseColor + Math.floor(reverseAlpha * 255).toString(16).padStart(2, '0'));
        reverseGradient.addColorStop(0.3, reverseColor + Math.floor(reverseAlpha * 0.5 * 255).toString(16).padStart(2, '0'));
        reverseGradient.addColorStop(1, reverseColor + '00');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 使用叠加模式绘制反向渐变，增强色彩深度
        this.ctx.globalCompositeOperation = 'overlay';
        this.ctx.fillStyle = reverseGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = 'source-over';
        
        // 添加多层视差效果
        this.renderParallaxLayers(dimension, time);
        
        // 添加动态云层效果
        this.renderCloudLayers(dimension, time);
        
        // 注释掉动态背景星光效果（用户不喜欢闪烁的白色斑块）
        // this.renderBackgroundStars(dimension, time);
        
        // 绘制背景图案
        if (dimension.backgroundPattern) {
            switch (dimension.backgroundPattern) {
                case 'grid':
                    this.renderGridPattern(dimension, time);
                    break;
                case 'spiral':
                    this.renderSpiralPattern(dimension, time);
                    break;
                case 'wave':
                    this.renderWavePattern(dimension, time);
                    break;
                case 'pulse':
                    this.renderPulsePattern(dimension, time);
                    break;
            }
        }
        
        // 添加维度特定的视觉效果
        if (dimension.forceField) {
            this.renderForceFieldEffect(time);
        }
        
        if (dimension.timeScale !== 1) {
            this.renderTimeWarpEffect(time);
        }
        
        // 添加全局光晕效果
        this.renderGlobalGlow(dimension, time);
    }
    
    // 辅助函数：调整颜色亮度
    adjustColor(color, amount) {
        // 输入验证：确保color是有效的十六进制颜色字符串
        if (!color || typeof color !== 'string') {
            return '#ffffff'; // 默认白色
        }
        
        // 移除#符号
        color = color.replace('#', '');
        
        // 确保颜色是6位十六进制
        if (color.length !== 6) {
            return '#ffffff'; // 默认白色
        }
        
        // 转换为RGB
        let r = parseInt(color.substring(0, 2), 16);
        let g = parseInt(color.substring(2, 4), 16);
        let b = parseInt(color.substring(4, 6), 16);
        
        // 验证RGB值是否有效
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
            return '#ffffff'; // 默认白色
        }
        
        // 调整亮度
        r = Math.max(0, Math.min(255, r + amount));
        g = Math.max(0, Math.min(255, g + amount));
        b = Math.max(0, Math.min(255, b + amount));
        
        // 转换回十六进制
        return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
    }
    
    // 渲染背景星光效果
    renderBackgroundStars(dimension, time) {
        const starCount = 200;
        const color = dimension.particleColor || dimension.color;
        
        for (let i = 0; i < starCount; i++) {
            // 使用伪随机数生成固定位置的星星
            const seed = i * 1000;
            const x = (seed * 0.123456789) % this.canvas.width;
            const y = (seed * 0.987654321) % this.canvas.height;
            
            // 星星闪烁效果
            const twinkle = Math.sin(time + seed * 0.001) * 0.5 + 0.5;
            const size = twinkle * 1.5;
            const alpha = twinkle * 0.5;
            
            this.ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    // 渲染全局光晕效果
    renderGlobalGlow(dimension, time) {
        const glowGradient = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.width
        );
        
        const pulse = Math.sin(time) * 0.3 + 0.7;
        glowGradient.addColorStop(0, dimension.color + Math.floor(pulse * 10).toString(16).padStart(2, '0'));
        glowGradient.addColorStop(1, dimension.color + '00');
        
        this.ctx.fillStyle = glowGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 渲染多层视差效果
    renderParallaxLayers(dimension, time) {
        // 验证dimension参数
        if (!dimension || !dimension.color) {
            return;
        }
        
        // 验证dimension.color的格式
        const baseColor = dimension.color;
        if (typeof baseColor !== 'string' || baseColor.length !== 7 || baseColor.charAt(0) !== '#') {
            return;
        }
        
        const layerCount = 8; // 增加视差层数，增强层次感
        
        for (let layer = 0; layer < layerCount; layer++) {
            const speed = (layer + 1) * 0.06;
            const phaseOffset = layer * 0.3;
            const layerIndex = layerCount - layer - 1; // 从外层到内层
            
            // 更复杂的运动轨迹：椭圆运动 + 多层波浪干扰
            const xOffset = Math.sin(time * speed + phaseOffset) * 20 * (layer + 1) + 
                          Math.sin(time * speed * 2.3 + phaseOffset * 1.5) * 8 * (layer + 1) +
                          Math.sin(time * speed * 4.1 + phaseOffset * 0.8) * 4 * (layer + 1);
            const yOffset = Math.cos(time * speed * 0.8 + phaseOffset) * 18 * (layer + 1) + 
                          Math.cos(time * speed * 1.7 + phaseOffset * 1.2) * 6 * (layer + 1) +
                          Math.cos(time * speed * 3.5 + phaseOffset * 0.5) * 3 * (layer + 1);
            
            const scale = 1 + layer * 0.06;
            const opacityValue = Math.max(0, Math.min(0.15 - layer * 0.02, 1));
            const opacity = Math.floor(opacityValue * 255).toString(16).padStart(2, '0');
            
            // 根据层的位置调整渐变类型：外层使用更扩散的渐变，内层使用更集中的渐变
            let layerGradient;
            if (layer < layerCount / 2) {
                // 外层使用径向渐变
                layerGradient = this.ctx.createRadialGradient(
                    this.canvas.width / 2 + xOffset, this.canvas.height / 2 + yOffset, 0,
                    this.canvas.width / 2 + xOffset, this.canvas.height / 2 + yOffset, this.canvas.width * scale
                );
            } else {
                // 内层使用椭圆渐变，增加视觉变化
                const gradientRadius = this.canvas.width * scale * 0.8;
                layerGradient = this.ctx.createRadialGradient(
                    this.canvas.width / 2 + xOffset, this.canvas.height / 2 + yOffset, 0,
                    this.canvas.width / 2 + xOffset, this.canvas.height / 2 + yOffset, 
                    layer < layerCount * 0.75 ? gradientRadius * 0.8 : gradientRadius * 1.2
                );
            }
            
            // 更丰富的动态色相偏移和亮度变化
            const hueShift = layer * 15 + Math.sin(time * 0.4 + layer * 0.5) * 30;
            const brightnessAdjust = Math.sin(time * 0.6 + layer * 0.8) * 25;
            const saturationAdjust = Math.cos(time * 0.8 + layer * 0.3) * 15;
            const layerColor = this.shiftHue(this.adjustColor(baseColor, brightnessAdjust), hueShift);
            
            // 根据层的位置和时间调整渐变颜色
            const gradientColor1 = this.shiftHue(layerColor, -15 + Math.sin(time * 0.3 + layer) * 10);
            const gradientColor2 = layerColor;
            const gradientColor3 = this.shiftHue(layerColor, 15 + Math.cos(time * 0.3 + layer) * 10);
            
            // 验证颜色有效性
            const validateColor = (color) => {
                if (!color || typeof color !== 'string' || color.indexOf('NaN') !== -1) {
                    return '#ffffff';
                }
                return color;
            };
            
            // 丰富的渐变层次，增加动态变化
            layerGradient.addColorStop(0, validateColor(layerColor) + '00');
            layerGradient.addColorStop(0.25, validateColor(gradientColor1) + opacity);
            layerGradient.addColorStop(0.45, validateColor(gradientColor2) + opacity);
            layerGradient.addColorStop(0.65, validateColor(gradientColor3) + opacity);
            layerGradient.addColorStop(0.85, validateColor(gradientColor2) + opacity);
            layerGradient.addColorStop(1, validateColor(layerColor) + '00');
            
            // 添加微小的旋转效果，使视差层更生动
            this.ctx.save();
            this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.rotate(Math.sin(time * 0.1 + layer * 0.2) * 0.02 * (layer + 1));
            this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
            
            // 使用叠加模式增强视觉深度
            this.ctx.globalCompositeOperation = layer % 2 === 0 ? 'overlay' : 'screen';
            this.ctx.fillStyle = layerGradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.restore();
        }
        
        // 重置复合模式
        this.ctx.globalCompositeOperation = 'source-over';
    }
    
    // 渲染动态云层效果
    renderCloudLayers(dimension, time) {
        const cloudCount = 20; // 增加云层数量
        const baseColor = dimension.color;
        
        for (let i = 0; i < cloudCount; i++) {
            const seed = i * 1000;
            const speed = 0.3 + Math.random() * 0.4; // 更自然的速度变化
            
            // 更自然的运动轨迹：基础移动 + 垂直波动
            const baseX = ((seed * 0.123456789) + time * speed * 40) % (this.canvas.width + 250) - 125;
            const waveY = Math.sin(time * speed * 0.7 + seed * 0.001) * 25;
            const x = baseX;
            const y = (seed * 0.987654321) % (this.canvas.height * 0.7) + this.canvas.height * 0.15 + waveY;
            
            const size = 25 + Math.random() * 100; // 更大的尺寸变化
            
            // 动态透明度：根据时间和位置变化
            const opacityBase = 0.03 + Math.random() * 0.1;
            const opacityVariation = Math.sin(time * speed * 1.3 + seed * 0.002) * 0.05;
            const opacity = Math.max(0.01, Math.min(0.15, opacityBase + opacityVariation));
            const opacityHex = Math.floor(opacity * 255).toString(16).padStart(2, '0');
            
            // 动态颜色：更丰富的色调变化
            const hueShift = Math.sin(time * speed * 0.5 + seed * 0.003) * 20;
            const brightness = 50 + Math.random() * 40 + Math.sin(time * speed * 0.8 + seed * 0.004) * 15;
            const color = this.shiftHue(this.adjustColor(baseColor, brightness), hueShift);
            
            this.ctx.fillStyle = color + opacityHex;
            this.ctx.beginPath();
            
            // 绘制更复杂的不规则云朵形状
            const cloudSegments = 7;
            const initialRadius = size * (0.4 + Math.random() * 0.3);
            
            for (let j = 0; j < cloudSegments; j++) {
                const angle = (j / cloudSegments) * Math.PI * 2;
                
                // 更自然的云朵轮廓：多层正弦波叠加
                const radiusVariation1 = Math.sin(time * speed + j * 1.3) * 0.3;
                const radiusVariation2 = Math.sin(time * speed * 1.7 + j * 2.1) * 0.15;
                const radius = initialRadius * (1 + radiusVariation1 + radiusVariation2 + Math.random() * 0.2);
                
                const px = x + Math.cos(angle) * radius;
                const py = y + Math.sin(angle) * radius;
                
                if (j === 0) {
                    this.ctx.moveTo(px, py);
                } else {
                    // 使用贝塞尔曲线使云朵边缘更平滑
                    this.ctx.quadraticCurveTo(
                        x + Math.cos(angle - (Math.PI * 2 / cloudSegments) / 2) * initialRadius,
                        y + Math.sin(angle - (Math.PI * 2 / cloudSegments) / 2) * initialRadius,
                        px, py
                    );
                }
            }
            
            this.ctx.closePath();
            this.ctx.fill();
            
            // 为较大的云朵添加内部阴影
            if (size > 60) {
                const shadowOpacity = Math.floor(opacity * 0.5 * 255).toString(16).padStart(2, '0');
                this.ctx.fillStyle = this.adjustColor(baseColor, -10) + shadowOpacity;
                this.ctx.beginPath();
                
                for (let j = 0; j < cloudSegments; j++) {
                    const angle = (j / cloudSegments) * Math.PI * 2;
                    const radius = initialRadius * 0.7;
                    const px = x + Math.cos(angle) * radius;
                    const py = y + Math.sin(angle) * radius;
                    
                    if (j === 0) {
                        this.ctx.moveTo(px, py);
                    } else {
                        this.ctx.quadraticCurveTo(
                            x + Math.cos(angle - (Math.PI * 2 / cloudSegments) / 2) * initialRadius * 0.7,
                            y + Math.sin(angle - (Math.PI * 2 / cloudSegments) / 2) * initialRadius * 0.7,
                            px, py
                        );
                    }
                }
                
                this.ctx.closePath();
                this.ctx.fill();
            }
        }
    }
    
    renderGridPattern(dimension, time) {
        const baseGridSize = 40;
        const depthLayers = 6; // 增加层数以增强深度感
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // 动态网格大小和颜色
        for (let layer = 0; layer < depthLayers; layer++) {
            const gridSize = baseGridSize + layer * 20;
            const scrollX = Math.sin(time * 0.3 + layer) * 25 * (layer + 1);
            const scrollY = Math.cos(time * 0.2 + layer) * 25 * (layer + 1);
            const opacityValue = Math.max(0, Math.min(0.35 - layer * 0.05, 1));
            const opacity = Math.floor(opacityValue * 255).toString(16).padStart(2, '0');
            
            // 根据层数和时间调整网格线颜色
            const hueShift = Math.sin(time * 0.5 + layer) * 30;
            const baseColor = this.shiftHue(dimension.color, hueShift);
            
            // 为网格线创建径向渐变，从中心向外逐渐变化
            const lineGradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(centerX, centerY));
            const layerHueShift = Math.sin(time * 0.7 + layer) * 20;
            lineGradient.addColorStop(0, this.shiftHue(baseColor, layerHueShift) + opacity);
            lineGradient.addColorStop(0.5, this.shiftHue(baseColor, -layerHueShift) + opacity);
            lineGradient.addColorStop(1, baseColor + opacity);
            
            this.ctx.strokeStyle = lineGradient;
            this.ctx.lineWidth = 0.2 + layer * 0.3;
            
            // 绘制垂直网格线（带波浪干扰效果）
            for (let x = scrollX % gridSize; x < this.canvas.width; x += gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                
                // 添加多层波浪干扰，增强动感
                for (let y = 0; y < this.canvas.height; y += 10) {
                    const waveOffset1 = Math.sin(time * 0.8 + layer + y * 0.01 + x * 0.005) * (3 + layer);
                    const waveOffset2 = Math.sin(time * 1.5 + layer * 0.5 + y * 0.02 + x * 0.007) * (2 + layer * 0.5);
                    const waveOffset3 = Math.cos(time * 2.3 + layer * 0.3 + y * 0.008 + x * 0.01) * (1 + layer * 0.3);
                    this.ctx.lineTo(x + waveOffset1 + waveOffset2 + waveOffset3, y);
                }
                
                this.ctx.lineTo(x, this.canvas.height);
                this.ctx.stroke();
            }
            
            // 绘制水平网格线（带波浪干扰效果）
            for (let y = scrollY % gridSize; y < this.canvas.height; y += gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                
                // 添加多层波浪干扰
                for (let x = 0; x < this.canvas.width; x += 10) {
                    const waveOffset1 = Math.cos(time * 0.9 + layer + x * 0.005 + y * 0.01) * (3 + layer);
                    const waveOffset2 = Math.cos(time * 1.3 + layer * 0.7 + x * 0.012 + y * 0.006) * (2 + layer * 0.5);
                    const waveOffset3 = Math.sin(time * 2.1 + layer * 0.4 + x * 0.009 + y * 0.013) * (1 + layer * 0.3);
                    this.ctx.lineTo(x, y + waveOffset1 + waveOffset2 + waveOffset3);
                }
                
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
            }
        }
        
        // 添加网格交叉点的发光效果
        this.renderGridGlowPoints(dimension, time);
        
        // 添加网格脉动效果
        this.renderGridPulseEffect(dimension, time);
    }
    
    // 辅助函数：色相偏移
    shiftHue(color, degrees) {
        // 输入验证：确保color是有效的十六进制颜色字符串
        if (!color || typeof color !== 'string') {
            return '#ffffff'; // 默认白色
        }
        
        // 移除#符号
        color = color.replace('#', '');
        
        // 确保颜色是6位十六进制
        if (color.length !== 6) {
            return '#ffffff'; // 默认白色
        }
        
        // 转换为RGB
        let r = parseInt(color.substring(0, 2), 16) / 255;
        let g = parseInt(color.substring(2, 4), 16) / 255;
        let b = parseInt(color.substring(4, 6), 16) / 255;
        
        // 验证RGB值是否有效
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
            return '#ffffff'; // 默认白色
        }
        
        // 转换为HSL
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0; // 灰色
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        // 应用色相偏移
        h = (h + degrees / 360) % 1;
        if (h < 0) h += 1;
        
        // 转换回RGB
        let r1, g1, b1;
        if (s === 0 || isNaN(h) || isNaN(s) || isNaN(l)) {
            // 处理灰度或无效值情况
            r1 = g1 = b1 = Math.min(1, Math.max(0, isNaN(l) ? 0.5 : l)); // 默认中间亮度
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            
            // 确保h值在有效范围内
            h = (h + 1) % 1;
            if (h < 0) h += 1;
            
            r1 = hue2rgb(p, q, h + 1/3);
            g1 = hue2rgb(p, q, h);
            b1 = hue2rgb(p, q, h - 1/3);
        }
        
        // 确保RGB值有效
        r1 = Math.min(1, Math.max(0, isNaN(r1) ? 0 : r1));
        g1 = Math.min(1, Math.max(0, isNaN(g1) ? 0 : g1));
        b1 = Math.min(1, Math.max(0, isNaN(b1) ? 0 : b1));
        
        // 转换回十六进制
        return '#' + 
            Math.round(r1 * 255).toString(16).padStart(2, '0') +
            Math.round(g1 * 255).toString(16).padStart(2, '0') +
            Math.round(b1 * 255).toString(16).padStart(2, '0');
    }
    
    // 渲染网格交叉点的发光效果
    renderGridGlowPoints(dimension, time) {
        const gridSize = 60;
        const color = dimension.particleColor;
        
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            for (let y = 0; y < this.canvas.height; y += gridSize) {
                // 动态发光效果
                const distance = Math.sqrt(
                    Math.pow(x - this.canvas.width/2, 2) + 
                    Math.pow(y - this.canvas.height/2, 2)
                );
                const pulse = Math.sin(time + distance * 0.01) * 0.5 + 0.5;
                
                if (pulse > 0.7) {
                    const alpha = (pulse - 0.7) * 0.5;
                    this.ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
    }
    
    // 渲染网格脉动效果
    renderGridPulseEffect(dimension, time) {
        const pulseRadius = 100 + Math.sin(time * 0.8) * 50;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // 创建脉动渐变
        const pulseGradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, pulseRadius
        );
        
        const opacity = Math.sin(time * 2) * 0.1 + 0.2;
        pulseGradient.addColorStop(0, dimension.particleColor + Math.floor(opacity * 255).toString(16).padStart(2, '0'));
        pulseGradient.addColorStop(1, dimension.particleColor + '00');
        
        this.ctx.fillStyle = pulseGradient;
        this.ctx.strokeStyle = pulseGradient;
        this.ctx.lineWidth = 3;
        
        // 绘制脉动圆环
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // 绘制脉动波纹
        for (let i = 1; i <= 3; i++) {
            const rippleRadius = pulseRadius * (1 + i * 0.2);
            const rippleAlpha = opacity * (0.5 / i);
            this.ctx.strokeStyle = dimension.particleColor + Math.floor(rippleAlpha * 255).toString(16).padStart(2, '0');
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }
    
    renderSpiralPattern(dimension, time) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const maxRadius = Math.min(centerX, centerY) * 0.9;
        const baseTurns = 8;
        const spiralLayers = 7; // 增加层数以增强深度感
        
        // 绘制多层螺旋
        for (let layer = 0; layer < spiralLayers; layer++) {
            const radius = maxRadius * (1 - layer * 0.12); // 减少每层之间的半径差异
            const turns = baseTurns + layer * 2 + Math.floor(Math.sin(time * 0.2) * 2); // 动态调整匝数
            const layerTime = time * (1 + layer * 0.2) + layer * Math.PI;
            const opacityValue = Math.max(0, Math.min(0.4 - layer * 0.05, 1));
            const opacity = Math.floor(opacityValue * 255).toString(16).padStart(2, '0'); // 增加透明度
            
            // 动态色相偏移
            const hueShift = Math.sin(time * 0.3 + layer) * 30;
            const baseColor = this.shiftHue(dimension.color, hueShift);
            
            // 创建螺旋线的渐变效果
            const spiralGradient = this.ctx.createLinearGradient(centerX, centerY, centerX + radius, centerY);
            const innerColor = this.shiftHue(baseColor, Math.sin(time * 0.5 + layer) * 25) + opacity;
            const middleColor = this.shiftHue(baseColor, -Math.sin(time * 0.7 + layer) * 15) + opacity;
            const outerColor = baseColor + opacity;
            spiralGradient.addColorStop(0, innerColor);
            spiralGradient.addColorStop(0.5, middleColor);
            spiralGradient.addColorStop(1, outerColor);
            
            this.ctx.strokeStyle = spiralGradient;
            this.ctx.lineWidth = 0.5 + layer * 0.3; // 线宽随层数增加
            
            this.ctx.beginPath();
            
            // 螺旋路径（带更丰富的动态变化）
            for (let i = 0; i <= 1; i += 0.0008) {
                const angle = i * Math.PI * 2 * turns + layerTime;
                const spiralRadius = i * radius;
                
                // 增强的复合波浪干扰效果：多层正弦波叠加
                const waveAmplitude1 = Math.sin(i * Math.PI * 4 + time) * 12 * (1 - i);
                const waveAmplitude2 = Math.sin(i * Math.PI * 7.3 + time * 1.5) * 7 * (1 - i);
                const waveAmplitude3 = Math.sin(i * Math.PI * 12.7 + time * 2.3) * 4 * (1 - i);
                const waveAmplitude4 = Math.sin(i * Math.PI * 18.9 + time * 3.1) * 3 * (1 - i);
                
                // 添加径向脉冲效果
                const radialPulse = Math.sin(time * 2 + i * Math.PI * 10) * 3 * (1 - i);
                
                // 添加有机变形效果
                const organicDistortion = Math.sin(i * Math.PI * 8 + time * 0.9) * 2 * (1 - i);
                
                const waveRadius = spiralRadius + waveAmplitude1 + waveAmplitude2 + waveAmplitude3 + waveAmplitude4 + radialPulse + organicDistortion;
                
                // 增强的角度偏移，使螺旋更有机
                const angleOffset = Math.sin(i * Math.PI * 5 + time * 0.7) * 0.15 + Math.cos(i * Math.PI * 3 + time * 1.1) * 0.08;
                
                const x = centerX + Math.cos(angle + angleOffset) * waveRadius;
                const y = centerY + Math.sin(angle + angleOffset) * waveRadius;
                
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            
            this.ctx.stroke();
        }
        
        // 添加螺旋中心的发光效果
        this.renderSpiralCore(dimension, time);
    }
    
    // 渲染螺旋中心的发光核心
    renderSpiralCore(dimension, time) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const pulse = Math.sin(time * 2) * 0.5 + 0.5;
        
        // 核心发光
        const coreGradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, 20
        );
        coreGradient.addColorStop(0, dimension.particleColor + 'ff');
        coreGradient.addColorStop(0.5, dimension.particleColor + '80');
        coreGradient.addColorStop(1, dimension.particleColor + '00');
        
        this.ctx.fillStyle = coreGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 20 + pulse * 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 添加中心粒子效果
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + time;
            const distance = 15 + pulse * 10;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            const alphaValue = Math.max(0, Math.min(0.6 - pulse * 0.2, 1));
            const alpha = Math.floor(alphaValue * 255).toString(16).padStart(2, '0');
            this.ctx.fillStyle = dimension.particleColor + alpha;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    renderWavePattern(dimension, time) {
        const waveLayers = 10; // 增加层数以增强深度感
        const baseAmplitude = 35;
        const baseFrequency = 0.015;
        const centerY = this.canvas.height / 2;
        
        // 绘制水平波形
        for (let i = 0; i < waveLayers; i++) {
            // 计算每层波形的属性
            const layerAmplitude = baseAmplitude * (1 - i * 0.10); // 更缓慢的振幅衰减
            const layerFrequency = baseFrequency * (1 + i * 0.25); // 调整频率增长
            const layerTime = time * (0.4 + i * 0.12); // 时间速度差异
            const layerOpacityValue = Math.max(0, Math.min(0.45 - i * 0.035, 1));
            const layerOpacity = Math.floor(layerOpacityValue * 255).toString(16).padStart(2, '0'); // 增加透明度
            
            // 动态色相偏移
            const hueShift = Math.sin(time * 0.4 + i) * 25;
            const baseColor = this.shiftHue(dimension.color, hueShift);
            
            // 创建更丰富的渐变波形：垂直方向的渐变
            const gradient = this.ctx.createLinearGradient(0, centerY - layerAmplitude * 2, 0, centerY + layerAmplitude * 2);
            const topColor = this.shiftHue(baseColor, Math.sin(time * 0.3 + i) * 20) + layerOpacity;
            const middleColor = baseColor + layerOpacity;
            const bottomColor = this.shiftHue(baseColor, -Math.sin(time * 0.5 + i) * 15) + layerOpacity;
            gradient.addColorStop(0, topColor);
            gradient.addColorStop(0.5, middleColor);
            gradient.addColorStop(1, bottomColor);
            
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 0.6 + i * 0.25;
            
            this.ctx.beginPath();
            
            for (let x = 0; x < this.canvas.width; x++) {
                // 增强的复合波形：多层波浪叠加
                const mainWave = Math.sin(x * layerFrequency + layerTime) * layerAmplitude;
                const secondaryWave = Math.sin(x * layerFrequency * 2.3 + layerTime * 1.5) * layerAmplitude * 0.35;
                const tertiaryWave = Math.sin(x * layerFrequency * 4.7 + layerTime * 2.8) * layerAmplitude * 0.2;
                const quaternaryWave = Math.sin(x * layerFrequency * 7.9 + layerTime * 4.1) * layerAmplitude * 0.12;
                
                // 添加维度特定的干扰波
                const dimensionWave = Math.sin(x * layerFrequency * 8.9 + layerTime * 3.7) * layerAmplitude * 0.1;
                
                // 添加径向干扰效果，从中心向外变化
                const radialDistance = Math.abs(x - this.canvas.width / 2);
                const radialInterference = Math.sin(radialDistance * 0.01 + layerTime) * layerAmplitude * 0.08;
                
                // 添加垂直偏移的动态变化
                const verticalOffset = Math.sin(layerTime * 1.2) * 12 + i * 8;
                
                const y = centerY + verticalOffset + mainWave + secondaryWave + tertiaryWave + quaternaryWave + dimensionWave + radialInterference;
                
                if (x === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            
            this.ctx.stroke();
        }
        
        // 绘制垂直波形（增加交叉干涉效果）
        this.renderVerticalWaves(dimension, time);
        
        // 添加波形粒子效果
        this.renderWaveParticles(dimension, time);
    }
    
    // 渲染垂直波形
    renderVerticalWaves(dimension, time) {
        const verticalWaveCount = 5;
        const baseAmplitude = 20;
        const baseFrequency = 0.01;
        
        for (let i = 0; i < verticalWaveCount; i++) {
            const x = (i + 1) * (this.canvas.width / (verticalWaveCount + 1));
            const layerAmplitude = baseAmplitude * (1 - i * 0.15);
            const layerFrequency = baseFrequency * (1 + i * 0.4);
            const layerTime = time * (0.4 + i * 0.2);
            const opacityValue = Math.max(0, Math.min(0.3 - i * 0.05, 1));
            const opacity = Math.floor(opacityValue * 255).toString(16).padStart(2, '0');
            
            const hueShift = Math.sin(time * 0.5 + i + Math.PI) * 20;
            const color = this.shiftHue(dimension.color, hueShift) + opacity;
            
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 0.4 + i * 0.2;
            
            this.ctx.beginPath();
            
            for (let y = 0; y < this.canvas.height; y++) {
                const mainWave = Math.sin(y * layerFrequency + layerTime) * layerAmplitude;
                const secondaryWave = Math.sin(y * layerFrequency * 1.7 + layerTime * 1.3) * layerAmplitude * 0.4;
                
                const xPos = x + mainWave + secondaryWave;
                
                if (y === 0) {
                    this.ctx.moveTo(xPos, y);
                } else {
                    this.ctx.lineTo(xPos, y);
                }
            }
            
            this.ctx.stroke();
        }
    }
    
    // 渲染波形上的粒子效果
    renderWaveParticles(dimension, time) {
        const particleCount = 30;
        const color = dimension.particleColor;
        const waveSpeed = 0.002;
        
        for (let i = 0; i < particleCount; i++) {
            // 粒子沿主波形移动
            const waveX = (i / particleCount) * this.canvas.width;
            const waveY = this.canvas.height / 2 + 
                Math.sin(waveX * 0.015 + time * 0.5) * 30 +
                Math.sin(waveX * 0.03 + time * 0.8) * 10;
            
            // 粒子脉动效果
            const pulse = Math.sin(time * 3 + i) * 0.5 + 0.5;
            const size = 1 + pulse * 2;
            const alphaValue = Math.max(0, Math.min(0.3 + pulse * 0.4, 1));
            const alpha = Math.floor(alphaValue * 255).toString(16).padStart(2, '0');
            
            this.ctx.fillStyle = color + alpha;
            this.ctx.beginPath();
            this.ctx.arc(waveX, waveY, size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 添加粒子光晕
            if (pulse > 0.7) {
                const glowAlpha = (pulse - 0.7) * 0.3;
                const glowColor = color + Math.floor(glowAlpha * 255).toString(16).padStart(2, '0');
                this.ctx.fillStyle = glowColor;
                this.ctx.beginPath();
                this.ctx.arc(waveX, waveY, size * 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }
    
    renderPulsePattern(dimension, time) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const pulseLayers = 8;
        const baseRadius = 60;
        
        // 绘制多层脉冲圆环
        for (let i = 0; i < pulseLayers; i++) {
            // 计算每层脉冲的属性
            const layerTime = time * (0.7 + i * 0.15);
            const layerRadius = baseRadius + i * 30 + Math.sin(layerTime) * 40;
            const layerAlphaValue = Math.max(0, Math.min(0.4 - i * 0.04, 1));
            const layerAlpha = Math.floor(layerAlphaValue * 255).toString(16).padStart(2, '0');
            
            // 动态色相偏移
            const hueShift = Math.sin(time * 0.3 + i) * 30;
            const color = this.shiftHue(dimension.color, hueShift);
            
            // 脉冲线宽变化
            const lineWidth = 1 + Math.sin(layerTime * 2) * 1.5;
            
            // 椭圆变形效果
            const ellipticalRatioX = 1 + Math.sin(layerTime * 1.2) * 0.2;
            const ellipticalRatioY = 1 + Math.cos(layerTime * 1.2) * 0.2;
            
            // 应用变换
            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.scale(ellipticalRatioX, ellipticalRatioY);
            
            // 创建径向渐变的脉冲线
            const gradientRadius = layerRadius + lineWidth;
            const strokeGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, gradientRadius);
            strokeGradient.addColorStop(0, this.shiftHue(color, -10) + layerAlpha);
            strokeGradient.addColorStop(0.5, color + layerAlpha);
            strokeGradient.addColorStop(1, this.shiftHue(color, 10) + layerAlpha);
            
            // 添加脉冲的不透明度变化
            const alphaVariation = Math.sin(layerTime * 1.7) * 0.1;
            const finalAlpha = Math.min(0.4, parseFloat(`0x${layerAlpha}`) / 255 + alphaVariation);
            const finalAlphaHex = Math.floor(finalAlpha * 255).toString(16).padStart(2, '0');
            
            // 创建更复杂的旋转效果
            this.ctx.rotate(Math.sin(layerTime * 0.8) * 0.2);
            
            // 绘制脉冲圆环
            this.ctx.strokeStyle = strokeGradient;
            this.ctx.lineWidth = lineWidth;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, layerRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // 绘制内部装饰圆环
            if (i % 2 === 1) {
                const innerRadius = layerRadius * 0.7;
                const innerLineWidth = lineWidth * 0.5;
                this.ctx.strokeStyle = this.shiftHue(color, 60) + finalAlphaHex;
                this.ctx.lineWidth = innerLineWidth;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            
            this.ctx.restore();
        }
        
        // 绘制同心圆填充脉冲
        this.renderPulseFills(dimension, time);
        
        // 添加脉冲粒子效果
        this.renderPulseParticles(dimension, time);
        
        // 渲染脉冲中心的核心效果
        this.renderPulseCore(dimension, time);
    }
    
    // 渲染脉冲的填充效果
    renderPulseFills(dimension, time) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const fillLayers = 3;
        
        for (let i = 0; i < fillLayers; i++) {
            const layerTime = time * (1 + i * 0.2);
            const radius = 100 + Math.sin(layerTime) * 80;
            const alphaValue = Math.max(0, Math.min(0.15 - i * 0.04, 1));
            const alpha = Math.floor(alphaValue * 255).toString(16).padStart(2, '0');
            
            const hueShift = Math.sin(time * 0.4 + i + Math.PI) * 20;
            const color = this.shiftHue(dimension.color, hueShift);
            
            const gradient = this.ctx.createRadialGradient(
                centerX, centerY, radius - 20,
                centerX, centerY, radius
            );
            gradient.addColorStop(0, color + '00');
            gradient.addColorStop(1, color + alpha);
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    // 渲染脉冲粒子效果
    renderPulseParticles(dimension, time) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const particleCount = 25;
        
        for (let i = 0; i < particleCount; i++) {
            // 粒子角度和距离
            const angle = (i / particleCount) * Math.PI * 2;
            const baseDistance = 150;
            const pulseDistance = Math.sin(time * 1.5 + i) * 80;
            
            // 粒子位置
            const x = centerX + Math.cos(angle) * (baseDistance + pulseDistance);
            const y = centerY + Math.sin(angle) * (baseDistance + pulseDistance);
            
            // 粒子动态属性
            const pulse = Math.sin(time * 3 + i) * 0.5 + 0.5;
            const size = 1.5 + pulse * 2;
            const alphaValue = Math.max(0, Math.min(0.4 + pulse * 0.3, 1));
            const alpha = Math.floor(alphaValue * 255).toString(16).padStart(2, '0');
            
            this.ctx.fillStyle = dimension.particleColor + alpha;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    // 渲染脉冲中心核心效果
    renderPulseCore(dimension, time) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const pulse = Math.sin(time * 2) * 0.5 + 0.5;
        
        // 核心光晕
        const coreGradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, 40
        );
        const coreColor = this.shiftHue(dimension.particleColor, Math.sin(time) * 10);
        
        coreGradient.addColorStop(0, coreColor + 'ff');
        coreGradient.addColorStop(0.5, coreColor + Math.floor(pulse * 150).toString(16).padStart(2, '0'));
        coreGradient.addColorStop(1, coreColor + '00');
        
        this.ctx.fillStyle = coreGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 40 + pulse * 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 中心发光点
        this.ctx.fillStyle = dimension.particleColor + 'ff';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        this.ctx.fill();
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
        this.platforms.forEach(platform => {
            if (platform.dimension === this.currentDimension || platform.dimension === undefined) {
                this.ctx.fillStyle = '#ffffff40';
                this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
                
                this.ctx.strokeStyle = '#ffffff80';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
            } else {
                // 其他维度的平台显示为半透明
                this.ctx.fillStyle = '#ffffff20';
                this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            }
        });
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
    
    renderPlayerTrail() {
        if (this.player.trail.length > 1) {
            this.ctx.strokeStyle = this.dimensions[this.currentDimension].color + '80';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            
            for (let i = 0; i < this.player.trail.length; i++) {
                const point = this.player.trail[i];
                if (i === 0) {
                    this.ctx.moveTo(point.x, point.y);
                } else {
                    this.ctx.lineTo(point.x, point.y);
                }
            }
            
            this.ctx.stroke();
        }
    }
    
    renderPlayer() {
        const dimension = this.dimensions[this.currentDimension];
        const centerX = this.player.x + this.player.width/2;
        const centerY = this.player.y + this.player.height/2;
        
        // 获取时间因子，用于呼吸效果
        const timeFactor = Date.now() * 0.005;
        const pulse = Math.sin(timeFactor) * 0.5 + 0.5; // 0-1范围
        
        // 外层大发光效果
        const outerGlowGradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, 60 * (0.8 + pulse * 0.2)
        );
        outerGlowGradient.addColorStop(0, dimension.color + '20');
        outerGlowGradient.addColorStop(0.5, dimension.color + '08');
        outerGlowGradient.addColorStop(1, dimension.color + '00');
        
        this.ctx.fillStyle = outerGlowGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 60 * (0.8 + pulse * 0.2), 0, Math.PI * 2);
        this.ctx.fill();
        
        // 中层发光效果
        const midGlowGradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, 30
        );
        midGlowGradient.addColorStop(0, dimension.color + '80');
        midGlowGradient.addColorStop(0.7, dimension.color + '30');
        midGlowGradient.addColorStop(1, dimension.color + '00');
        
        this.ctx.fillStyle = midGlowGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 能量场维度特殊效果
        if (dimension.forceField) {
            const fieldRadius = 45 + Math.sin(timeFactor * 2) * 5;
            const fieldGradient = this.ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, fieldRadius
            );
            fieldGradient.addColorStop(0, dimension.color + '00');
            fieldGradient.addColorStop(0.8, dimension.color + '10');
            fieldGradient.addColorStop(0.9, dimension.color + '40');
            fieldGradient.addColorStop(1, dimension.color + '00');
            
            this.ctx.strokeStyle = fieldGradient;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, fieldRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // 能量场波纹
            for (let i = 0; i < 3; i++) {
                const rippleRadius = 35 + i * 10 + Math.sin(timeFactor + i) * 5;
                const rippleAlpha = 0.3 - i * 0.1;
                this.ctx.strokeStyle = dimension.color + Math.floor(rippleAlpha * 255).toString(16).padStart(2, '0');
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
        
        // 玩家本体
        this.ctx.fillStyle = dimension.color;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // 玩家边框 - 动态发光边框
        const borderGlowGradient = this.ctx.createLinearGradient(
            this.player.x, this.player.y,
            this.player.x + this.player.width, this.player.y + this.player.height
        );
        borderGlowGradient.addColorStop(0, '#ffffff');
        borderGlowGradient.addColorStop(0.5, dimension.color);
        borderGlowGradient.addColorStop(1, '#ffffff');
        
        this.ctx.strokeStyle = borderGlowGradient;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // 内层高亮边框
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(this.player.x + 1, this.player.y + 1, this.player.width - 2, this.player.height - 2);
        
        // 角色核心能量效果
        const coreSize = 4 + pulse * 3;
        const coreGradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, coreSize
        );
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(1, dimension.color);
        
        this.ctx.fillStyle = coreGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, coreSize, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    renderParticles() {
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            this.ctx.fillStyle = particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    renderDimensionIndicator() {
        // 在屏幕边缘显示当前维度
        this.ctx.fillStyle = this.dimensions[this.currentDimension].color;
        this.ctx.fillRect(0, 0, this.canvas.width, 4);
        this.ctx.fillRect(0, this.canvas.height - 4, this.canvas.width, 4);
        this.ctx.fillRect(0, 0, 4, this.canvas.height);
        this.ctx.fillRect(this.canvas.width - 4, 0, 4, this.canvas.height);
    }
    
    updateUI() {
        document.getElementById('currentLevel').textContent = this.currentLevel;
        document.getElementById('currentLevelDisplay').textContent = this.currentLevel; // 更新导航栏中的关卡显示
        document.getElementById('quantumShards').textContent = this.quantumShards;
        document.getElementById('energyValue').textContent = Math.max(0, this.energy);
        
        const energyPercent = Math.max(0, this.energy) / this.maxEnergy * 100;
        document.getElementById('energyBar').style.width = energyPercent + '%';
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
        let defaultLevel = mode === 'casual' ? 11 : 1;
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const data = JSON.parse(raw);
                if (typeof data.level === 'number') defaultLevel = data.level;
            }
        } catch (e) {}
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