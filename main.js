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
        this.levelCompleteTriggered = false; // 防止重复触发关卡完成
        this.lastDimensionSwitchTime = 0; // 记录最后一次维度切换时间，用于掉落保护
        
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
        this.startBackgroundMusic();
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
        // 加载音效文件
        this.sounds.dimensionSwitch = new Audio('resources/dimension_switch.mp3');
        this.sounds.collectShard = new Audio('resources/collect_shard.mp3');
        this.sounds.playerJump = new Audio('resources/player_jump.mp3');
        this.sounds.hazardHit = new Audio('resources/hazard_hit.mp3');
        this.sounds.backgroundAmbient = new Audio('resources/background_ambient.mp3');
        
        // 设置音量
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.sfxVolume;
        });
        
        this.sounds.backgroundAmbient.volume = this.musicVolume;
        this.sounds.backgroundAmbient.loop = true;
    }
    
    startBackgroundMusic() {
        if (this.sounds.backgroundAmbient) {
            this.sounds.backgroundAmbient.play().catch(e => {
                console.log('Background music autoplay blocked:', e);
            });
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
        this.levelCompleteTriggered = false; // 重置关卡完成标志
        // 如果能量耗尽，恢复能量；否则保持当前能量
        if (this.energy <= 0) {
            this.energy = this.maxEnergy;
        }
        this.resetPlayer();
        this.loadLevel(this.currentLevel);
        this.updateUI();
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
        this.levelCompleteTriggered = false; // 重置关卡完成标志
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
            this.lastDimensionSwitchTime = Date.now(); // 记录切换时间，用于掉落保护
            this.updateDimensionButtons();
            this.createDimensionSwitchEffect();
            this.playSound('dimensionSwitch');
            this.updateUI();
        }
    }
    
    cycleDimension(direction) {
        this.currentDimension = (this.currentDimension + direction + this.dimensions.length) % this.dimensions.length;
        this.lastDimensionSwitchTime = Date.now(); // 记录切换时间，用于掉落保护
        this.updateDimensionButtons();
        this.createDimensionSwitchEffect();
        this.playSound('dimensionSwitch');
        this.updateUI();
    }
    
    quickSwitch() {
        // 在当前维度和前一个维度间切换
        const prevDimension = this.currentDimension;
        this.currentDimension = (this.currentDimension + 1) % this.dimensions.length;
        this.lastDimensionSwitchTime = Date.now(); // 记录切换时间，用于掉落保护
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
    }
    
    loadLevel(level) {
        this.platforms = [];
        this.collectibles = [];
        this.hazards = [];
        this.portals = [];
        this.levelCompleteTriggered = false; // 重置关卡完成标志
        
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
                    { x: 350, y: 300, width: 100, height: 20, dimension: 1 }, // 反重力平台（从下方可以站上去）
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
        const dimension = this.dimensions[this.currentDimension];
        const isReverseGravity = dimension.gravity < 0; // 判断是否是反重力维度
        
        // 水平移动
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.player.vx = -this.player.speed;
        } else if (this.keys['d'] || this.keys['arrowright']) {
            this.player.vx = this.player.speed;
        } else {
            this.player.vx *= 0.8; // 摩擦力
        }
        
        // 跳跃（在反重力模式下，跳跃应该是向下）
        if ((this.keys['w'] || this.keys['arrowup'] || this.keys[' ']) && this.player.onGround) {
            if (isReverseGravity) {
                this.player.vy = 12; // 反重力模式下向下跳跃
            } else {
                this.player.vy = -12; // 正常模式下向上跳跃
            }
            this.player.onGround = false;
            this.playSound('playerJump');
        }
        
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
        
        // 水平边界检查（阻止玩家移动到画布外）
        if (this.player.x < 0) {
            this.player.x = 0;
            this.player.vx = 0;
        }
        if (this.player.x > this.canvas.width - this.player.width) {
            this.player.x = this.canvas.width - this.player.width;
            this.player.vx = 0;
        }
        
        // 垂直边界限制（防止无限飞出，但允许反重力模式正常工作）
        // 正常重力模式下，阻止向上超出画布顶部太多
        if (!isReverseGravity && this.player.y < -10) {
            this.player.y = -10;
            this.player.vy = Math.max(0, this.player.vy); // 允许向下移动
        }
        // 反重力模式下，阻止向下超出画布底部太多
        if (isReverseGravity && this.player.y > this.canvas.height - this.player.height + 10) {
            this.player.y = this.canvas.height - this.player.height + 10;
            this.player.vy = Math.min(0, this.player.vy); // 允许向上移动
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
        const dimension = this.dimensions[this.currentDimension];
        const isReverseGravity = dimension.gravity < 0; // 判断是否是反重力维度
        
        // 平台碰撞
        this.platforms.forEach(platform => {
            if (platform.dimension === this.currentDimension || platform.dimension === undefined) {
                if (this.isColliding(this.player, platform)) {
                    if (isReverseGravity) {
                        // 反重力模式：从下往上碰撞，落在平台下表面
                        // 玩家向上移动且玩家的顶部在平台底部下方或刚刚越过
                        if (this.player.vy < 0 && 
                            this.player.y < platform.y + platform.height && 
                            this.player.y + this.player.height > platform.y + platform.height) {
                            this.player.y = platform.y + platform.height;
                            this.player.vy = 0;
                            this.player.onGround = true;
                        }
                    } else {
                        // 正常重力模式：从上往下碰撞，落在平台上面
                        // 玩家向下移动且玩家的底部在平台顶部上方或刚刚越过
                        if (this.player.vy > 0 && 
                            this.player.y + this.player.height > platform.y && 
                            this.player.y < platform.y) {
                            this.player.y = platform.y - this.player.height;
                            this.player.vy = 0;
                            this.player.onGround = true;
                        }
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
        
        // 掉落检测（包括反重力情况）
        // 添加维度切换后的短暂保护期（500ms），避免切换瞬间掉落扣能量
        const timeSinceDimensionSwitch = Date.now() - this.lastDimensionSwitchTime;
        const dimensionSwitchProtection = timeSinceDimensionSwitch < 500;
        
        if (isReverseGravity) {
            // 反重力模式：从上方掉落
            if (this.player.y < -50 && !dimensionSwitchProtection) {
                this.takeDamage(50);
                this.resetPlayer();
            }
        } else {
            // 正常重力模式：从下方掉落
            if (this.player.y > this.canvas.height + 50 && !dimensionSwitchProtection) {
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
        this.energy -= amount;
        this.playSound('hazardHit');
        if (this.energy <= 0) {
            this.gameOver();
        }
    }
    
    gameOver() {
        this.gameState = 'menu';
        document.getElementById('gameOverlay').classList.remove('hidden');
        // 不重置关卡，保持当前关卡，这样玩家再次开始游戏时会从当前关卡继续
        // 能量会在startGame时恢复
        this.updateUI();
    }
    
    checkWinCondition() {
        const allCollected = this.collectibles.every(c => c.collected);
        if (allCollected && this.collectibles.length > 0 && !this.levelCompleteTriggered) {
            this.levelCompleteTriggered = true;
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
        this.levelCompleteTriggered = false; // 重置关卡完成标志
        this.loadLevel(this.currentLevel);
        this.resetPlayer();
        this.updateUI();
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