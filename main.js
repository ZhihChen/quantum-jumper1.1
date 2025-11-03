// 量子跃迁者 - 游戏主逻辑
class QuantumJumper {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.currentLevel = 1;
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
            { name: '正常维度', color: '#3b82f6', gravity: 0.5, timeScale: 1 },
            { name: '反重力', color: '#8b5cf6', gravity: -0.5, timeScale: 1 },
            { name: '时间扭曲', color: '#06b6d4', gravity: 0.3, timeScale: 0.5 },
            { name: '能量场', color: '#f97316', gravity: 0.5, timeScale: 1, forceField: true }
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
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('resumeBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('quitBtn').addEventListener('click', () => this.quitGame());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('closeSettings').addEventListener('click', () => this.hideSettings());
        document.getElementById('nextLevelBtn').addEventListener('click', () => this.nextLevel());
        
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
        this.currentLevel = 1;
        this.quantumShards = 0;
        this.energy = this.maxEnergy;
        this.currentDimension = 0;
        this.gameState = 'playing';
        document.getElementById('pauseMenu').classList.add('hidden');
        this.resetPlayer();
        this.loadLevel(this.currentLevel);
        this.updateUI();
    }
    
    quitGame() {
        this.gameState = 'menu';
        document.getElementById('pauseMenu').classList.add('hidden');
        document.getElementById('gameOverlay').classList.remove('hidden');
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
        // 创建维度切换的视觉效果
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: this.player.x + Math.random() * 40 - 20,
                y: this.player.y + Math.random() * 40 - 20,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 30,
                maxLife: 30,
                color: this.dimensions[this.currentDimension].color,
                size: Math.random() * 4 + 2
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
        const numCollectibles = 3 + Math.floor(level / 2);
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
        
        // 应用重力
        this.player.vy += dimension.gravity;
        
        // 能量场效果
        if (dimension.forceField) {
            // 模拟能量场推动效果
            this.player.vx += Math.sin(Date.now() * 0.001) * 0.1;
            this.player.vy += Math.cos(Date.now() * 0.0015) * 0.1;
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
                if (this.isColliding(this.player, platform)) {
                    const dimension = this.dimensions[this.currentDimension];
                    
                    // 标准重力模式：玩家从上方落在平台上
                    if (this.player.vy > 0 && this.player.y < platform.y) {
                        this.player.y = platform.y - this.player.height;
                        this.player.vy = 0;
                        this.player.onGround = true;
                    }
                    // 反重力模式：玩家从下方落在平台上
                    else if (dimension.gravity < 0 && this.player.vy < 0 && this.player.y > platform.y) {
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
        const allCollected = this.collectibles.every(c => c.collected);
        if (allCollected && this.collectibles.length > 0) {
            this.showLevelComplete();
            setTimeout(() => {
                this.nextLevel();
            }, 2000);
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
        this.currentLevel++;
        this.energy = this.maxEnergy; // 恢复能量
        this.loadLevel(this.currentLevel);
        this.resetPlayer();
        this.updateUI();
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
        
        // 玩家发光效果
        const glowGradient = this.ctx.createRadialGradient(
            this.player.x + this.player.width/2,
            this.player.y + this.player.height/2,
            0,
            this.player.x + this.player.width/2,
            this.player.y + this.player.height/2,
            30
        );
        glowGradient.addColorStop(0, dimension.color + '60');
        glowGradient.addColorStop(1, dimension.color + '00');
        
        this.ctx.fillStyle = glowGradient;
        this.ctx.fillRect(
            this.player.x - 10,
            this.player.y - 10,
            this.player.width + 20,
            this.player.height + 20
        );
        
        // 玩家本体
        this.ctx.fillStyle = dimension.color;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // 玩家边框
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.player.x, this.player.y, this.player.width, this.player.height);
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
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new QuantumJumper();
});