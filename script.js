// Gera poeira flutuante decorativa na tela de início/nickname
        (function spawnMenuDust() {
            const parents = [document.getElementById('blocker'), document.getElementById('nicknameScreen'), document.getElementById('controlsScreen')];
            parents.forEach(parent => {
                for (let i = 0; i < 22; i++) {
                    const mote = document.createElement('div');
                    mote.className = 'dustMote';
                    const size = 2 + Math.random() * 4;
                    mote.style.width = size + 'px';
                    mote.style.height = size + 'px';
                    mote.style.left = (Math.random() * 100) + 'vw';
                    mote.style.animationDuration = (10 + Math.random() * 14) + 's';
                    mote.style.animationDelay = (Math.random() * 14) + 's';
                    parent.appendChild(mote);
                }
            });
        })();

        // Botão de tela cheia: funciona em qualquer tela (menu, jogando, pausado) e atualiza sozinho
        // caso o navegador saia da tela cheia por conta própria (ex: o usuário aperta Esc do sistema).
        (function setupFullscreenButton() {
            const btn = document.getElementById('fullscreenBtn');
            if (!btn) return;

            function isFullscreenActive() {
                return !!(document.fullscreenElement || document.webkitFullscreenElement);
            }
            function refreshButton() {
                const active = isFullscreenActive();
                btn.classList.toggle('is-active', active);
                btn.title = active ? 'Sair da tela cheia' : 'Tela cheia';
            }
            function requestFs(el) {
                if (el.requestFullscreen) return el.requestFullscreen();
                if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen(); // Safari mais antigo
            }
            function exitFs() {
                if (document.exitFullscreen) return document.exitFullscreen();
                if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
            }
            btn.addEventListener('click', () => {
                if (isFullscreenActive()) exitFs();
                else requestFs(document.documentElement);
            });
            document.addEventListener('fullscreenchange', refreshButton);
            document.addEventListener('webkitfullscreenchange', refreshButton);
            refreshButton();
        })();

        import * as THREE from 'three';
        import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

        // Detecção de celular feita bem cedo: usada tanto pra configurar o renderer/gerar menos
        // objetos (performance) quanto mais abaixo pelos controles de toque (joystick, botões etc.).
        const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        // 1. CONFIGURAÇÃO BÁSICA
        const scene = new THREE.Scene();
        const daySkyColor = new THREE.Color(0xa3441f);      
        const sunsetSkyColor = new THREE.Color(0x2b4c6f);   
        const nightSkyColor = new THREE.Color(0x04060a);    

        scene.background = daySkyColor.clone();
        scene.fog = new THREE.FogExp2(daySkyColor.getHex(), 0.006); 

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
        camera.position.set(0, 2, 0);

        // ================= PERFIL DE QUALIDADE (Baixo / Médio / Alto) =================
        // Celular começa em "Baixo", PC com placa de vídeo integrada/fraca em "Médio" e o resto em "Alto".
        // O jogador pode trocar no menu de pausa (o jogo reinicia pra aplicar). A resolução ainda se ajusta
        // sozinha durante o jogo (ver updateAdaptiveResolution) se o FPS cair.
        const QUALITY_KEY = 'pixelSaga.quality';
        const QUALITY_PRESETS = {
            low: {
                label: 'Baixo', antialias: false, logDepth: false, maxPixelRatio: 1, minPixelRatio: 0.55,
                shadows: false, softShadows: false, flashlightShadow: false,
                interiorLights: 1, extraLights: false, headlightLights: 1, lambert: true, bump: false,
                pebbles: 30000, rocks: 700, boulders: 70, dust: 800,
                pebbleDist: 60, rockDist: 220, auroras: 1, minimapFps: 10
            },
            medium: {
                label: 'Médio', antialias: false, logDepth: false, maxPixelRatio: 1, minPixelRatio: 0.6,
                shadows: true, softShadows: false, flashlightShadow: false,
                interiorLights: 3, extraLights: true, headlightLights: 2, lambert: false, bump: false,
                pebbles: 60000, rocks: 2500, boulders: 180, dust: 1500,
                pebbleDist: 85, rockDist: 260, auroras: 2, minimapFps: 20
            },
            high: {
                label: 'Alto', antialias: true, logDepth: true, maxPixelRatio: 1.5, minPixelRatio: 0.75,
                shadows: true, softShadows: true, flashlightShadow: true,
                interiorLights: 5, extraLights: true, headlightLights: 2, lambert: false, bump: true,
                pebbles: 90000, rocks: 4000, boulders: 260, dust: 2400,
                pebbleDist: 110, rockDist: 320, auroras: 3, minimapFps: 30
            }
        };
        function pickDefaultQuality() {
            if (isMobile) return 'low';
            // IMPORTANTE: NÃO chamar loseContext() no contexto de teste abaixo. Em algumas combinações de
            // driver (ex: Chrome + Intel no Windows) isso tem um bug conhecido que faz o PRÓXIMO contexto
            // WebGL criado (o do próprio jogo, logo em seguida) nascer "perdido" — tela em branco do jogo
            // inteiro, mascarada durante a cutscene pelas barras pretas (que são HTML/CSS, não WebGL) e só
            // fica visível quando a cutscene termina e elas somem. O navegador libera esse contexto de teste
            // sozinho (garbage collector) assim que a função termina, sem precisar forçar a perda dele.
            try {
                const c = document.createElement('canvas');
                const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
                if (!gl) return 'low';
                const ext = gl.getExtension('WEBGL_debug_renderer_info');
                const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
                if (/swiftshader|llvmpipe|softpipe|microsoft basic|mali|adreno|powervr/i.test(gpu)) return 'low';
                if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|vega \d+ graphics/i.test(gpu)) return 'medium';
            } catch (err) { /* segue com o padrão */ }
            if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) return 'medium';
            return 'high';
        }
        let qualityKey = null;
        try { qualityKey = localStorage.getItem(QUALITY_KEY); } catch (err) { /* modo privado etc. */ }
        if (!QUALITY_PRESETS[qualityKey]) qualityKey = pickDefaultQuality();
        const Q = QUALITY_PRESETS[qualityKey];

        const renderer = new THREE.WebGLRenderer({
            antialias: Q.antialias,          // MSAA custa caro em GPU fraca/celular
            alpha: false, stencil: false,    // a cena já tem fundo opaco e não usa stencil: menos memória e sem blend com a página
            powerPreference: "high-performance",
            logarithmicDepthBuffer: Q.logDepth, // tem custo por pixel (desliga o early-z); só no perfil Alto
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        // Aviso visível + tentativa de recuperação caso o contexto WebGL do jogo se perca em algum momento
        // (troca de GPU, driver travou, aba ficou muito tempo em segundo plano em celular fraco etc.) — sem
        // isso, o sintoma pra quem está jogando é só "a tela ficou preta/parada do nada", sem nenhuma pista.
        renderer.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.error('Contexto WebGL perdido.');
            let notice = document.getElementById('webglLostNotice');
            if (!notice) {
                notice = document.createElement('div');
                notice.id = 'webglLostNotice';
                notice.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(5,6,10,0.92);color:#fdd;font:16px Arial,sans-serif;text-align:center;padding:24px;';
                notice.innerHTML = 'A GPU perdeu o contexto gráfico.<br><button id="webglReloadBtn" style="margin-top:14px;padding:10px 24px;font-size:15px;cursor:pointer;">Recarregar</button>';
                document.body.appendChild(notice);
                document.getElementById('webglReloadBtn').addEventListener('click', () => location.reload());
            }
        });
        renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());
        // Resolução de desenho: começa no máximo do perfil e desce sozinha se o FPS ficar baixo (e volta a subir
        // com calma quando sobra folga). Em tela retina/celular o devicePixelRatio pode ser 2~3 (4~9x mais pixels).
        const pixelRatioMax = Math.min(window.devicePixelRatio || 1, Q.maxPixelRatio);
        const pixelRatioMin = Math.min(Q.minPixelRatio, pixelRatioMax);
        let pixelRatioNow = pixelRatioMax;
        renderer.setPixelRatio(pixelRatioNow);
        renderer.shadowMap.enabled = Q.shadows; // sombras dinâmicas são a parte mais pesada pra GPU fraca
        renderer.shadowMap.type = Q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

        let fpsDebugEl = null;
        let adaptAcc = 0, adaptFrames = 0, adaptUpLock = 6, adaptGoodWindows = 0, adaptBadWindows = 0;
        function updateAdaptiveResolution(dt) {
            if (dt <= 0 || dt > 0.25) return; // engasgo isolado (troca de aba, compilação de shader): não conta
            adaptAcc += dt; adaptFrames++;
            if (adaptAcc < 1.5) return;
            const fps = adaptFrames / adaptAcc;
            adaptAcc = 0; adaptFrames = 0;
            adaptUpLock = Math.max(0, adaptUpLock - 1.5);
            if (fpsDebugEl) fpsDebugEl.textContent = `${Math.round(fps)} FPS · ${Q.label} · res ${pixelRatioNow.toFixed(2)}x`;
            if (fps < 42 && pixelRatioNow > pixelRatioMin + 0.01) {
                adaptGoodWindows = 0;
                if (++adaptBadWindows >= 2) { // só reduz depois de 2 medições ruins seguidas
                    pixelRatioNow = Math.max(pixelRatioMin, pixelRatioNow - (fps < 28 ? 0.2 : 0.1));
                    renderer.setPixelRatio(pixelRatioNow);
                    adaptUpLock = 25; adaptBadWindows = 0;
                }
            } else if (fps > 56 && pixelRatioNow < pixelRatioMax - 0.01 && adaptUpLock <= 0) {
                adaptBadWindows = 0;
                if (++adaptGoodWindows >= 3) {
                    pixelRatioNow = Math.min(pixelRatioMax, pixelRatioNow + 0.1);
                    renderer.setPixelRatio(pixelRatioNow);
                    adaptUpLock = 25; adaptGoodWindows = 0;
                }
            } else { adaptGoodWindows = 0; adaptBadWindows = 0; }
        }
        // Contador de FPS opcional: abra o jogo com "?fps" no final do endereço.
        if (/[?&]fps\b/.test(location.search)) {
            fpsDebugEl = document.createElement('div');
            fpsDebugEl.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;padding:3px 8px;background:rgba(0,0,0,0.6);color:#8f8;font:12px monospace;pointer-events:none;border-radius:4px;';
            document.body.appendChild(fpsDebugEl);
        }
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(renderer.domElement);
        scene.add(camera);

        // --- Dimensões da base (definidas cedo pois o terreno precisa delas) ---
        const habRadius = 10;    // raio da estação (espaço bem maior e mais espaçoso)
        const habHeight = 7;     // altura das paredes
        const doorGapWidth = 5;  // largura funcional do vão da parede (usada na colisão)
        const doorHeight = 6.9;  // altura do portão (maior, quase encostando no teto)
        // Metade do ângulo do vão da porta, calculado a partir da largura real do vão,
        // assim a parede, a colisão e a porta SEMPRE ficam alinhadas entre si.
        const doorHalfAngle = Math.atan((doorGapWidth / 2) / habRadius);
        // Altura (Y) do platô de terreno onde a base fica assentada — usada tanto pelo terreno
        // (getTerrainHeight) quanto pra posicionar a própria estrutura da base (habGroup) em cima dele.
        const basePlatformHeight = 7.5;

        // --- Pontos turísticos de Marte: fonte única de verdade pras coordenadas.        ---
        // --- O terreno usa essas coordenadas pra esculpir cada acidente geográfico,      ---
        // --- e o telão da estação lista as mesmas coordenadas pra quem quiser visitar.   ---
        const OLYMPUS_X = -300, OLYMPUS_Z = -400;
        const VALLES_X = 450, VALLES_Z = 450;
        const GALE_X = -600, GALE_Z = 600;
        const JEZERO_X = 700, JEZERO_Z = -700;
        const MARS_LANDMARKS = [
            { name: 'MONTE OLIMPO', x: OLYMPUS_X, z: OLYMPUS_Z, icon: '🌋' },
            { name: 'VALLES MARINERIS', x: VALLES_X, z: VALLES_Z, icon: '🏜️' },
            { name: 'CRATERA GALE', x: GALE_X, z: GALE_Z, icon: '🏔️' },
            { name: 'CRATERA JEZERO', x: JEZERO_X, z: JEZERO_Z, icon: '🕳️' },
        ];

        // 2. TEXTURAS PROCEDURAIS
        const groundColorHex = '#702d11'; 

        function createMarsTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = groundColorHex; ctx.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 120000; i++) {
                const x = Math.random() * 512, y = Math.random() * 512, size = Math.random() * 1.5 + 0.5;
                const rand = Math.random();
                if (rand > 0.85) ctx.fillStyle = 'rgba(25, 5, 0, 0.6)'; 
                else if (rand > 0.5) ctx.fillStyle = 'rgba(150, 70, 35, 0.25)'; 
                else ctx.fillStyle = 'rgba(90, 35, 10, 0.2)'; 
                ctx.fillRect(x, y, size, size);
            }
            return new THREE.CanvasTexture(canvas);
        }

        function createSunGlowTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.85)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(canvas);
        }

        function createIronFloorTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');

            // Cor base do ferro
            ctx.fillStyle = '#4a4d52';
            ctx.fillRect(0, 0, 512, 512);

            // Ruído/sujeira/ferrugem
            for (let i = 0; i < 25000; i++) {
                const x = Math.random() * 512, y = Math.random() * 512, size = Math.random() * 1.4 + 0.3;
                const rand = Math.random();
                if (rand > 0.7) ctx.fillStyle = 'rgba(15,15,17,0.35)';
                else if (rand > 0.4) ctx.fillStyle = 'rgba(110,65,35,0.12)';
                else ctx.fillStyle = 'rgba(215,220,225,0.15)';
                ctx.fillRect(x, y, size, size);
            }

            // Chapas / painéis do piso
            const tiles = 5;
            const tileSize = 512 / tiles;
            ctx.strokeStyle = 'rgba(12,12,14,0.85)';
            ctx.lineWidth = 4;
            for (let i = 0; i <= tiles; i++) {
                ctx.beginPath(); ctx.moveTo(i * tileSize, 0); ctx.lineTo(i * tileSize, 512); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i * tileSize); ctx.lineTo(512, i * tileSize); ctx.stroke();
            }

            // Rebites nos cantos de cada chapa
            for (let ty = 0; ty <= tiles; ty++) {
                for (let tx = 0; tx <= tiles; tx++) {
                    const cx = tx * tileSize, cy = ty * tileSize;
                    [[9, 9], [-9, 9], [9, -9], [-9, -9]].forEach(([ox, oy]) => {
                        const rx = cx + ox, ry = cy + oy;
                        if (rx >= 0 && rx <= 512 && ry >= 0 && ry <= 512) {
                            ctx.fillStyle = 'rgba(12,12,14,0.9)';
                            ctx.beginPath(); ctx.arc(rx, ry, 3.4, 0, Math.PI * 2); ctx.fill();
                            ctx.fillStyle = 'rgba(155,160,165,0.55)';
                            ctx.beginPath(); ctx.arc(rx - 1, ry - 1, 1.2, 0, Math.PI * 2); ctx.fill();
                        }
                    });
                }
            }
            return new THREE.CanvasTexture(canvas);
        }

        // Painel do supercomputador: canvas persistente que é redesenhado com dados em tempo real
        const scCanvas = document.createElement('canvas');
        scCanvas.width = 512; scCanvas.height = 256;
        const scCtx = scCanvas.getContext('2d');

        function drawStationPanel(clockStr, energyPct, stormPct, stormActive, dayLabel) {
            const ctx = scCtx, w = scCanvas.width, h = scCanvas.height;

            // Fundo do monitor (azul bem escuro, tipo terminal) — vira vermelho escuro em alerta de tempestade
            ctx.fillStyle = stormActive ? '#170606' : '#020d14'; ctx.fillRect(0, 0, w, h);
            const glow = ctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, 300);
            if (stormActive) { glow.addColorStop(0, 'rgba(120,30,20,0.55)'); glow.addColorStop(1, 'rgba(23,6,6,0)'); }
            else { glow.addColorStop(0, 'rgba(30,90,80,0.55)'); glow.addColorStop(1, 'rgba(2,13,20,0)'); }
            ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

            // "Linhas de código" tipo terminal, decorativas, no topo
            ctx.font = '10px monospace';
            const chars = '01#$%></{}[]ABCDEF*';
            for (let row = 0; row < 6; row++) {
                let line = '';
                const len = 30 + Math.floor(Math.random() * 20);
                for (let c = 0; c < len; c++) line += chars[Math.floor(Math.random() * chars.length)];
                ctx.fillStyle = row % 3 === 0 ? 'rgba(255,190,120,0.55)' : 'rgba(110,255,210,0.45)';
                ctx.fillText(line, 14, 16 + row * 12);
            }

            // Barra de status no topo
            const topColor = stormActive ? 'rgba(255,110,90,0.9)' : 'rgba(110,255,210,0.9)';
            ctx.fillStyle = topColor;
            ctx.fillRect(0, 0, w, 4);
            ctx.font = 'bold 13px monospace';
            ctx.fillStyle = '#eafff6';
            ctx.fillText('MARS OPS MAINFRAME // ONLINE', 14, 100);

            // --- Painel de status ---
            const panelY = 108;
            ctx.font = 'bold 22px monospace';
            ctx.fillStyle = '#fffbe0';
            ctx.fillText(clockStr, 14, panelY + 24);
            ctx.font = '12px monospace';
            ctx.fillStyle = '#9fe8d8';
            ctx.fillText(dayLabel, 14, panelY + 42);

            // Barra de energia
            const barX = 260, barW = 230, barY = panelY + 4, barH = 14;
            ctx.font = '12px monospace'; ctx.fillStyle = '#9fe8d8';
            ctx.fillText('ENERGIA SOLAR', barX, barY - 4);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.strokeRect(barX, barY, barW, barH);
            const energyColor = energyPct < 25 ? '#ff6a5a' : (energyPct < 55 ? '#ffd35a' : '#6effc0');
            ctx.fillStyle = energyColor;
            ctx.fillRect(barX + 2, barY + 2, Math.max(0, (barW - 4) * (energyPct / 100)), barH - 4);
            ctx.fillStyle = '#eafff6'; ctx.font = '11px monospace';
            ctx.fillText(Math.round(energyPct) + '%', barX + barW + 8, barY + 12);

            // Barra / alerta de tempestade
            const stormBarY = barY + 26;
            ctx.font = '12px monospace'; ctx.fillStyle = '#9fe8d8';
            ctx.fillText('ATIVIDADE ATMOSFÉRICA', barX, stormBarY - 4);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.strokeRect(barX, stormBarY, barW, barH);
            const stormColor = stormActive ? '#ff5a4a' : (stormPct > 35 ? '#ffb85a' : '#6effc0');
            ctx.fillStyle = stormColor;
            ctx.fillRect(barX + 2, stormBarY + 2, Math.max(0, (barW - 4) * (stormPct / 100)), barH - 4);

            // Linha de status geral / alerta piscante
            ctx.font = 'bold 14px monospace';
            if (stormActive) {
                ctx.fillStyle = (Math.floor(performance.now() / 400) % 2 === 0) ? '#ff5a4a' : '#a02318';
                ctx.fillText('⚠ ALERTA: TEMPESTADE DE POEIRA DETECTADA', 14, panelY + 66);
            } else {
                ctx.fillStyle = '#6effc0';
                ctx.fillText('✓ CONDIÇÕES ESTÁVEIS — SEM ALERTAS', 14, panelY + 66);
            }

            // Pontos turísticos de Marte: lista as coordenadas de cada marco pra quem quiser visitar
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath(); ctx.moveTo(14, panelY + 76); ctx.lineTo(w - 14, panelY + 76); ctx.stroke();
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = '#ffd35a';
            ctx.fillText('📍 PONTOS DE INTERESSE', 14, panelY + 90);
            ctx.font = '11px monospace';
            MARS_LANDMARKS.forEach((poi, i) => {
                const ly = panelY + 106 + i * 12;
                const coordStr = `X ${poi.x >= 0 ? '+' : ''}${poi.x}  Z ${poi.z >= 0 ? '+' : ''}${poi.z}`;
                ctx.fillStyle = '#9fe8d8';
                ctx.fillText(poi.name, 14, ly);
                ctx.fillStyle = '#eafff6';
                ctx.fillText(coordStr, 240, ly);
            });

            // Scanlines
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

            screenTexture.needsUpdate = true;
        }

        const screenTexture = new THREE.CanvasTexture(scCanvas);
        screenTexture.wrapS = THREE.RepeatWrapping;
        screenTexture.repeat.x = -1;
        screenTexture.offset.x = 1;
        drawStationPanel('06:00', 70, 15, false, 'DIA MARCIANO — SOL 1');

        function createKeyboardTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 220;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1b1d20'; ctx.fillRect(0, 0, 512, 220);

            const cols = 20, rows = 6, pad = 4;
            const cellW = 512 / cols, cellH = 190 / rows;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = c * cellW + pad, y = 12 + r * cellH + pad;
                    const w = cellW - pad * 2, h = cellH - pad * 2;
                    ctx.fillStyle = '#3a3d42';
                    ctx.fillRect(x, y, w, h);
                    ctx.fillStyle = 'rgba(255,255,255,0.12)';
                    ctx.fillRect(x, y, w, 2);
                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    ctx.fillRect(x, y + h - 2, w, 2);
                }
            }
            return new THREE.CanvasTexture(canvas);
        }

        const marsTexture = createMarsTexture();
        marsTexture.wrapS = THREE.RepeatWrapping; marsTexture.wrapT = THREE.RepeatWrapping;
        marsTexture.repeat.set(220, 220);

        const ironFloorTexture = createIronFloorTexture();
        ironFloorTexture.wrapS = THREE.RepeatWrapping; ironFloorTexture.wrapT = THREE.RepeatWrapping;
        ironFloorTexture.repeat.set(5, 5);

        const keyboardTexture = createKeyboardTexture();

        // 3. TERRENO
        const worldSize = 2000;
        // Esse raio precisa cobrir não só o piso circular da base, mas também a soleira reta da porta,
        // que estica pra fora da parede (de habRadius - 1 até + doorThresholdDepth, com folga lateral).
        // Antes era habRadius + 3 (=13), mas o canto mais distante da soleira fica a ~14,4 do centro —
        // fora dessa zona 100% plana, entrando na mistura com o relevo natural (dunas/ondulações), que
        // pode facilmente superar o pequeno degrau de 0.2 do piso e "furar" por cima dele perto da porta.
        const flatCoreRadius = habRadius + 5;
        function getTerrainHeight(x, z) {
            let ripples = Math.sin(x * 0.22) * Math.cos(z * 0.22) * 0.5;
            let midWaves = Math.sin(x * 0.08) * Math.cos(z * 0.06) * 1.2;
            let largeDunes = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 4.0;
            // Vales largos e suaves (frequência bem mais baixa, cria depressões e elevações amplas no mapa)
            let valleys = Math.sin(x * 0.0035 + 1.7) * Math.cos(z * 0.004) * 14.0 - 6.0;
            // Campo de dunas assimétrico (cristas mais "duras" de um lado, típico de dunas de vento)
            let duneField = Math.pow(Math.max(0, Math.sin(x * 0.028 + z * 0.01)), 2.5) * 3.5;
            let height = largeDunes + midWaves + ripples + valleys + duneField;
            const distToOlimpo = Math.sqrt((x - OLYMPUS_X) ** 2 + (z - OLYMPUS_Z) ** 2);
            const olyTopRadius = 130, olyOuterRadius = 560, olyHeight = 240;
            if (distToOlimpo < olyTopRadius) {
                height += olyHeight; // platô plano no topo — o Olimpo real tem um complexo de caldeiras lá em cima, não um pico
            } else if (distToOlimpo < olyOuterRadius) {
                const olyT = (distToOlimpo - olyTopRadius) / (olyOuterRadius - olyTopRadius);
                height += Math.pow(1 - olyT, 2) * olyHeight; // encosta suave descendo até a base do vulcão
            }

            // Valles Marineris: gigantesco cânion que corta o mapa na diagonal (lado oposto ao Olimpo).
            // Em vez de um raio a partir de um ponto, projeta (x,z) no eixo do cânion pra achar a
            // posição "ao longo" dele e a distância "perpendicular" até o centro — daí dá pra abrir
            // uma fenda comprida, com uma leve serpenteada e bordas em platô, em vez de um buraco redondo.
            const vmCenterX = VALLES_X, vmCenterZ = VALLES_Z;
            const vmAngle = Math.PI / 7.2; // ~25°
            const vmCos = Math.cos(vmAngle), vmSin = Math.sin(vmAngle);
            const vmHalfLength = 400;
            const vmDx = x - vmCenterX, vmDz = z - vmCenterZ;
            const vmAlong = vmDx * vmCos + vmDz * vmSin;
            let vmPerp = -vmDx * vmSin + vmDz * vmCos;
            vmPerp -= Math.sin(vmAlong * 0.005) * 55; // serpenteia o eixo do cânion, como o de verdade
            const vmWidth = 190 + Math.sin(vmAlong * 0.008) * 45; // bem mais largo, dá pra rodar de jipe à vontade lá dentro
            if (Math.abs(vmAlong) < vmHalfLength) {
                const vmEndFade = 1 - Math.pow(Math.abs(vmAlong) / vmHalfLength, 4); // some suavemente nas pontas
                const vmT = Math.min(1, Math.abs(vmPerp) / vmWidth);
                if (vmT < 1) {
                    const vmFlat = 0.45; // fração central com o piso bem plano — de sobra pro jipe circular
                    const vmWallT = vmT < vmFlat ? 0 : (vmT - vmFlat) / (1 - vmFlat);
                    height -= Math.pow(1 - vmWallT, 1.6) * 130 * vmEndFade;
                    // pequena crista erguida na borda, como o platô que cerca o cânion real
                    if (vmT > 0.8) height += Math.sin((vmT - 0.8) / 0.2 * Math.PI) * 5 * vmEndFade;
                }
            }

            // Cratera Gale: cratera de impacto com o Monte Sharp (Aeolis Mons) erguido bem no meio —
            // onde o rover Curiosity pousou em 2012 e ainda está escalando até hoje.
            const distToGale = Math.sqrt((x - GALE_X) ** 2 + (z - GALE_Z) ** 2);
            const galeRadius = 150, galeRimWidth = 30;
            if (distToGale < galeRadius) {
                height -= (1 - Math.pow(distToGale / galeRadius, 2)) * 40; // bacia da cratera, mais funda no centro
            }
            const galeRimDist = Math.abs(distToGale - galeRadius);
            if (galeRimDist < galeRimWidth) {
                height += Math.pow(Math.cos((galeRimDist / galeRimWidth) * (Math.PI / 2)), 2) * 18; // borda elevada
            }
            if (distToGale < 110) {
                const sharpT = distToGale / 110;
                const sharpSmooth = sharpT * sharpT * (3 - 2 * sharpT); // suaviza topo E base, sem pico pontudo
                height += (1 - sharpSmooth) * 85; // Monte Sharp: morro largo e arredondado, não um espinho
            }

            // Cratera Jezero: cratera mais rasa, com um leque deltaico de sedimentos antigos preservado —
            // onde o rover Perseverance pousou em 2021 caçando sinais de vida microbiana fóssil.
            const distToJezero = Math.sqrt((x - JEZERO_X) ** 2 + (z - JEZERO_Z) ** 2);
            const jezeroRadius = 100, jezeroRimWidth = 22;
            if (distToJezero < jezeroRadius) {
                height -= (1 - Math.pow(distToJezero / jezeroRadius, 2)) * 28;
            }
            const jezeroRimDist = Math.abs(distToJezero - jezeroRadius);
            if (jezeroRimDist < jezeroRimWidth) {
                height += Math.pow(Math.cos((jezeroRimDist / jezeroRimWidth) * (Math.PI / 2)), 2) * 13;
            }
            // Leque deltaico: um "abano" de sedimento que se abre a partir de um ponto da borda pro centro
            const jdx = x - JEZERO_X, jdz = z - JEZERO_Z;
            const jezeroDeltaAngle = Math.PI / 3;
            const jCos = Math.cos(jezeroDeltaAngle), jSin = Math.sin(jezeroDeltaAngle);
            const deltaAlong = jdx * jCos + jdz * jSin;
            const deltaPerp = -jdx * jSin + jdz * jCos;
            if (deltaAlong > 0 && deltaAlong < jezeroRadius * 0.8) {
                const deltaHalfWidth = 8 + deltaAlong * 0.4; // o leque vai se alargando conforme avança
                if (Math.abs(deltaPerp) < deltaHalfWidth) {
                    const deltaT = Math.abs(deltaPerp) / deltaHalfWidth;
                    height += Math.pow(1 - deltaT, 2) * 10;
                }
            }

            // Deixa o chão 100% plano dentro (e um pouco além) da estação, e suaviza a transição depois disso.
            // A altura do platô agora acompanha o nível médio do terreno natural ao redor da base (~7.5),
            // em vez de um valor fixo baixo — antes a estação ficava afundada num "poço" bem abaixo da
            // paisagem em volta.
            const distToBase = Math.sqrt(x**2 + (z - (-30))**2);
            const flatFalloffRadius = 40;
            if (distToBase < flatCoreRadius) {
                height = basePlatformHeight;
            } else if (distToBase < flatFalloffRadius) {
                height = THREE.MathUtils.lerp(basePlatformHeight, height, (distToBase - flatCoreRadius) / (flatFalloffRadius - flatCoreRadius));
            }
            return height;
        }

        // A malha do terreno só tem vértices a cada (worldSize/terrainSegments) unidades e o resto é
        // interpolado de forma reta entre eles. Como getTerrainHeight() tem ondulações de alta frequência
        // (ripples, bordas de cratera, paredes do cânion), calcular a altura de um objeto direto pela função
        // pura quase sempre dá um valor um pouquinho diferente da superfície realmente desenhada — e é isso
        // que fazia pedras (e qualquer outra coisa apoiada no chão) parecerem flutuar ou afundar.
        // getSurfaceHeight() faz a mesma interpolação bilinear que a malha renderizada usa, então qualquer
        // objeto posicionado com ela encosta exatamente na superfície visível, em qualquer parte do mapa.
        const terrainSegments = 250;
        const terrainCell = worldSize / terrainSegments;
        const terrainHalf = worldSize / 2;
        // Mapa de alturas pré-calculado nos vértices da malha. Antes, getSurfaceHeight() chamava
        // getTerrainHeight() 4 vezes (senos, cossenos, pow, raízes das crateras...) POR PARTÍCULA DE POEIRA
        // A CADA FRAME (~10 mil cálculos por quadro) — era o maior gargalo de CPU, principalmente no celular.
        // Agora o terreno é calculado uma vez só e a consulta vira uma leitura de array.
        const terrainStride = terrainSegments + 1;
        const terrainHeightGrid = new Float32Array(terrainStride * terrainStride);
        for (let gzi = 0; gzi < terrainStride; gzi++) {
            for (let gxi = 0; gxi < terrainStride; gxi++) {
                terrainHeightGrid[gzi * terrainStride + gxi] = getTerrainHeight(gxi * terrainCell - terrainHalf, gzi * terrainCell - terrainHalf);
            }
        }
        function getSurfaceHeight(x, z) {
            let gx = (x + terrainHalf) / terrainCell;
            let gz = (z + terrainHalf) / terrainCell;
            gx = THREE.MathUtils.clamp(gx, 0, terrainSegments);
            gz = THREE.MathUtils.clamp(gz, 0, terrainSegments);
            const ix = Math.floor(gx), iz = Math.floor(gz);
            const ix1 = Math.min(ix + 1, terrainSegments), iz1 = Math.min(iz + 1, terrainSegments);
            const fx = gx - ix, fz = gz - iz;
            const row0 = iz * terrainStride, row1 = iz1 * terrainStride;
            const h00 = terrainHeightGrid[row0 + ix], h10 = terrainHeightGrid[row0 + ix1];
            const h01 = terrainHeightGrid[row1 + ix], h11 = terrainHeightGrid[row1 + ix1];
            const h0 = THREE.MathUtils.lerp(h00, h10, fx), h1 = THREE.MathUtils.lerp(h01, h11, fx);
            return THREE.MathUtils.lerp(h0, h1, fz);
        }

        const terrainGeo = new THREE.PlaneGeometry(worldSize, worldSize, terrainSegments, terrainSegments); 
        terrainGeo.rotateX(-Math.PI / 2);
        const positions = terrainGeo.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            // reaproveita o mapa de alturas (mesmos pontos da malha) em vez de recalcular o terreno de novo
            const gxi = Math.round((positions.getX(i) + terrainHalf) / terrainCell);
            const gzi = Math.round((positions.getZ(i) + terrainHalf) / terrainCell);
            positions.setY(i, terrainHeightGrid[gzi * terrainStride + gxi]);
        }
        terrainGeo.computeVertexNormals();
        // O terreno cobre a tela inteira, então é o material mais caro do jogo (cada pixel calcula todas as luzes).
        // Baixo: Lambert (bem mais leve, visual quase igual em solo fosco). Médio: Standard sem bump. Alto: completo.
        const terrainMat = Q.lambert
            ? new THREE.MeshLambertMaterial({ map: marsTexture })
            : new THREE.MeshStandardMaterial(Q.bump
                ? { map: marsTexture, bumpMap: marsTexture, bumpScale: 0.18, roughness: 1.0 }
                : { map: marsTexture, roughness: 1.0 });
        const terrain = new THREE.Mesh(terrainGeo, terrainMat);
        terrain.receiveShadow = true; scene.add(terrain);

        // --- 4. SISTEMA DE COLISÕES E ESTRUTURAS ---
        const collisionData = []; // Guarda posições X e Z para checar bloqueios
        
        const habGroup = new THREE.Group();
        habGroup.position.set(0, basePlatformHeight, -30); // Centro da Base — apoiada em cima do novo platô elevado

        // DoubleSide permite ver a textura metálica por dentro e por fora!
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide });
        const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide }); // cinza bem mais claro que a parede
        const solarMat = new THREE.MeshStandardMaterial({ color: 0x112244, roughness: 0.1, metalness: 0.9 });
        const ironFloorMat = new THREE.MeshStandardMaterial({ map: ironFloorTexture, bumpMap: ironFloorTexture, bumpScale: 0.04, metalness: 0.35, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });

        // Paredes (Cilindro com o vão exatamente na direção +Z, mesma direção da porta)
        const habWalls = new THREE.Mesh(new THREE.CylinderGeometry(habRadius, habRadius, habHeight, 48, 1, true, doorHalfAngle, Math.PI * 2 - doorHalfAngle * 2), metalMat);
        habWalls.position.set(0, habHeight / 2, 0);
        habWalls.castShadow = true; habWalls.receiveShadow = true;
        habGroup.add(habWalls);

        // Teto (Domo esférico, acompanha o novo raio)
        const habDome = new THREE.Mesh(new THREE.SphereGeometry(habRadius, 48, 24, 0, Math.PI*2, 0, Math.PI/2), metalMat);
        habDome.position.set(0, habHeight, 0);
        habGroup.add(habDome);

        // Chão de ferro da base (chapas metálicas com rebites). Tinha dois problemas empilhados aqui:
        // 1) sendo um disco de espessura ZERO, dava pra "ver por baixo" dele de ângulos rentes perto da
        //    parede e pegar o terreno vermelho que existe por baixo de tudo, inclusive da estação inteira;
        // 2) a correção anterior (raio = habRadius - 0.1) reduziu demais o raio: a parede é um polígono de
        //    48 lados e o piso de 64 lados, então nos pontos ENTRE os vértices de cada polígono o raio real
        //    fica um pouco menor que o raio nominal (apótema < raio) — com 9.9 de raio nominal, o piso podia
        //    ficar uns 0.09 mais "pra dentro" que a própria parede em certos pontos, abrindo uma brecha fina
        //    e constante ao redor de toda a estação (bem visível perto de objetos encostados na parede,
        //    como os tanques de gás). Por isso o raio precisa ficar ALÉM do raio nominal da parede, não aquém.
        // Solução: piso com espessura de verdade (enterra a base no terreno, tampando a fresta por dentro
        // de qualquer ângulo) E com raio um pouco MAIOR que o da parede (cobre folgado, sem brecha nunca),
        // igual a folga que já tinha no piso original — só que agora com o problema do disco fino resolvido.
        const floorRadius = habRadius + 0.35;   // folga além da parede — cobre tudo, sem criar aba perceptível
        const floorThickness = 1.5;             // espessura que enterra a base do piso no terreno
        const habFloor = new THREE.Mesh(new THREE.CylinderGeometry(floorRadius, floorRadius, floorThickness, 64), ironFloorMat);
        habFloor.position.set(0, 0.2 - floorThickness / 2, 0);
        habFloor.receiveShadow = true;
        habGroup.add(habFloor);

        // Soleira metálica na porta: estica o mesmo piso de ferro por uma curta faixa pra fora do vão
        // da parede. Sem isso, quem passa pela porta pisa direto do metal pro terreno vermelho, com um
        // corte muito brusco bem debaixo dos pés — essa faixa cobre exatamente essa transição.
        const doorThresholdWidth = doorGapWidth + 2;
        const doorThresholdDepth = 5;
        const doorThreshold = new THREE.Mesh(new THREE.PlaneGeometry(doorThresholdWidth, doorThresholdDepth), ironFloorMat);
        doorThreshold.rotation.x = -Math.PI / 2;
        doorThreshold.position.set(0, 0.2, (habRadius - 1) + doorThresholdDepth / 2);
        doorThreshold.receiveShadow = true;
        habGroup.add(doorThreshold);


        // Iluminação Interna da Base (mais forte para cobrir o espaço maior)
        const interiorLamp = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.2, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        interiorLamp.position.set(0, habHeight + 0.8, 0);
        habGroup.add(interiorLamp);
        // Cada luz de ponto é calculada em TODO pixel de TODO material da cena, então nos perfis Baixo/Médio
        // usamos menos luzes na base e compensamos deixando a central mais forte.
        const interiorLight = new THREE.PointLight(0xffeedd, Q.interiorLights >= 5 ? 5 : (Q.interiorLights >= 3 ? 6.5 : 8.5), 40); // Luz suave e quente
        interiorLight.position.set(0, habHeight - 1, 0);
        habGroup.add(interiorLight);
        // Luzes extras nas laterais para não deixar cantos escuros num espaço maior — mais perto das
        // paredes (0.72 do raio, não 0.5) pra iluminar bem o piso até a borda, senão aquele anel
        // ficava escuro demais e sobrava só a cor acastanhada da luz ambiente, parecendo terra por baixo.
        if (Q.interiorLights >= 3) {
            const interiorLight2 = new THREE.PointLight(0xffeedd, 2.8, 36);
            interiorLight2.position.set(habRadius * 0.72, habHeight - 2, habRadius * 0.72);
            habGroup.add(interiorLight2);
            const interiorLight3 = new THREE.PointLight(0xffeedd, 2.8, 36);
            interiorLight3.position.set(-habRadius * 0.72, habHeight - 2, -habRadius * 0.72);
            habGroup.add(interiorLight3);
        }
        if (Q.interiorLights >= 5) {
            const interiorLight4 = new THREE.PointLight(0xffeedd, 2.8, 36);
            interiorLight4.position.set(habRadius * 0.72, habHeight - 2, -habRadius * 0.72);
            habGroup.add(interiorLight4);
            const interiorLight5 = new THREE.PointLight(0xffeedd, 2.8, 36);
            interiorLight5.position.set(-habRadius * 0.72, habHeight - 2, habRadius * 0.72);
            habGroup.add(interiorLight5);
        }
        // Luz ambiente fixa só da base, pra ela nunca ficar escura mesmo quando é noite lá fora.
        // Cor do "chão" trocada de marrom (0x554433) pra cinza neutro: era essa tonalidade marrom
        // que aparecia no piso de metal perto das paredes, nas áreas com menos luz direta,
        // fazendo o metal parecer terra mesmo estando 100% coberto.
        const interiorAmbient = new THREE.HemisphereLight(0xfff4e0, 0x45464a, 1.1);
        habGroup.add(interiorAmbient);

        // Porta Automática — é um painel CURVO com o MESMO raio da parede (não uma tampa reta),
        // então ela encaixa perfeitamente no vão, sem nenhuma fresta nas bordas.
        // O ângulo é um pouco maior que o vão da parede para sobrepor levemente e vedar de vez.
        const doorOverlapAngle = doorHalfAngle + 0.035;
        const door = new THREE.Mesh(new THREE.CylinderGeometry(habRadius - 0.01, habRadius - 0.01, doorHeight, 24, 1, true, -doorOverlapAngle, doorOverlapAngle * 2), doorMat);
        const doorClosedY = doorHeight / 2;
        const doorOpenY = habHeight + doorHeight / 2;
        door.position.set(0, doorClosedY, 0);
        door.castShadow = true;
        habGroup.add(door);

        // --- SUPERCOMPUTADOR: telão gigante e curvo + plataforma-teclado, no fundo da base (lado oposto à porta) ---
        const superComputerGroup = new THREE.Group(); // apenas organizacional, sem deslocamento próprio
        habGroup.add(superComputerGroup);

        const consoleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5, metalness: 0.6 });
        const screenFrameMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide });
        const screenMat = new THREE.MeshStandardMaterial({ map: screenTexture, emissiveMap: screenTexture, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide });

        // Telão gigante e CURVO — construído como uma fatia de cilindro (mesmo truque da porta),
        // então não tem nenhum suporte/cabo no meio, é uma curva contínua igual às telas de comando.
        // O arco é centralizado em 180° (em vez de 0°) para que a curva se abra PARA A FRENTE,
        // envolvendo o jogador — bem mais largo, cobrindo boa parte da parede do fundo.
        const screenRadius = 7;
        const screenArc = 1.6;           // ângulo total do arco (bem mais largo que antes)
        const screenHeight = 5.0;        // bem maior que antes
        const screenBackZ = -(habRadius - 1.2); // ponto mais encostado na parede (centro do arco)
        const screenOriginZ = screenBackZ + screenRadius; // origem do cilindro, à frente da parede
        const screenThetaStart = Math.PI - screenArc / 2; // arco centralizado em 180° -> abre pra frente
        const screenCenterY = screenHeight / 2 + 0.9;

        // Moldura escura (um pouco mais longe, atrás, formando a "borda" do telão)
        const scFrame = new THREE.Mesh(
            new THREE.CylinderGeometry(screenRadius + 0.05, screenRadius + 0.05, screenHeight + 0.4, 48, 1, true, screenThetaStart - 0.04, screenArc + 0.08),
            screenFrameMat
        );
        scFrame.position.set(0, screenCenterY, screenOriginZ);
        scFrame.castShadow = true;
        superComputerGroup.add(scFrame);

        // Superfície curva do telão (mais perto do jogador que a moldura, por isso fica visível e não é tapada por ela)
        const scScreen = new THREE.Mesh(
            new THREE.CylinderGeometry(screenRadius, screenRadius, screenHeight, 48, 1, true, screenThetaStart, screenArc),
            screenMat
        );
        scScreen.position.set(0, screenCenterY, screenOriginZ);
        superComputerGroup.add(scScreen);

        // Luz própria da tela, dando um brilho azul-esverdeado no ambiente
        const scLight = new THREE.PointLight(0x66ffd6, 2.0, 18);
        scLight.position.set(0, screenCenterY + 0.3, screenBackZ + 3.5);
        superComputerGroup.add(scLight);

        // --- Plataforma-teclado: um palco baixo que o jogador pisa em cima, com o teclado estampado no topo ---
        const platWidth = 6.2, platDepth = 4.0, platHeight = 0.65;
        const platLocalZ = -3.2; // um pouco à frente do telão, no meio da sala
        const platTopMat = new THREE.MeshStandardMaterial({ map: keyboardTexture, roughness: 0.55, metalness: 0.35 });
        const platSideMat = consoleMat;
        const scPlatform = new THREE.Mesh(
            new THREE.BoxGeometry(platWidth, platHeight, platDepth),
            [platSideMat, platSideMat, platTopMat, platSideMat, platSideMat, platSideMat]
        );
        scPlatform.position.set(0, platHeight / 2, platLocalZ);
        scPlatform.castShadow = true; scPlatform.receiveShadow = true;
        habGroup.add(scPlatform);

        // Friso luminoso na base da plataforma
        const platTrimMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x66ffd6, emissiveIntensity: 1.4, roughness: 1 });
        const scPlatformTrim = new THREE.Mesh(new THREE.BoxGeometry(platWidth + 0.08, 0.04, platDepth + 0.08), platTrimMat);
        scPlatformTrim.position.set(0, 0.03, platLocalZ);
        habGroup.add(scPlatformTrim);

        // Dados da plataforma para o jogador conseguir "subir" nela ao caminhar por cima (ver loop principal)
        const platformBounds = {
            minX: -platWidth / 2, maxX: platWidth / 2,
            minZ: platLocalZ - platDepth / 2, maxZ: platLocalZ + platDepth / 2,
            height: platHeight
        };

        // Altura do "chão" (nível dos pés) em qualquer ponto (x,z) — dentro da base é plano/plataforma,
        // fora é o terreno natural. Usada tanto pelo loop de caminhada quanto para posicionar a câmera
        // com segurança sempre que ela é "teleportada" (fim/skip da cutscene, entrar/sair do jipe etc.),
        // pra nunca deixar o jogador nascer enfiado dentro do chão.
        function getGroundY(x, z) {
            const isInsideBase = Math.hypot(x - 0, z - (-30)) < (habRadius - 0.2);
            if (!isInsideBase) return getTerrainHeight(x, z);
            const localX = x - habGroup.position.x, localZ = z - habGroup.position.z;
            const onPlatform = localX > platformBounds.minX && localX < platformBounds.maxX &&
                localZ > platformBounds.minZ && localZ < platformBounds.maxZ;
            return habGroup.position.y + (onPlatform ? platformBounds.height : 0.2);
        }

        // --- ACESSÓRIOS DE CIÊNCIA / ENGENHARIA ---
        const gasTankMat = new THREE.MeshStandardMaterial({ color: 0x1f8a5a, roughness: 0.35, metalness: 0.7 });
        const gasTankMat2 = new THREE.MeshStandardMaterial({ color: 0xb0b8bd, roughness: 0.3, metalness: 0.8 });
        const valveMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 });
        const strapMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.1 });

        // Cluster de tanques de gás/oxigênio, encostados na parede esquerda
        const tankGroup = new THREE.Group();
        tankGroup.position.set(-7.6, 0, 2.5);
        tankGroup.rotation.y = Math.PI * 0.15;
        const tankSpecs = [
            { x: -0.5, mat: gasTankMat, h: 2.0, r: 0.32 },
            { x: 0,    mat: gasTankMat2, h: 2.3, r: 0.32 },
            { x: 0.5,  mat: gasTankMat, h: 2.0, r: 0.32 },
        ];
        tankSpecs.forEach(t => {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, t.h, 16), t.mat);
            body.position.set(t.x, t.h / 2, 0);
            body.castShadow = true; body.receiveShadow = true;
            tankGroup.add(body);
            const cap = new THREE.Mesh(new THREE.SphereGeometry(t.r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), t.mat);
            cap.position.set(t.x, t.h, 0);
            tankGroup.add(cap);
            const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), valveMat);
            valve.position.set(t.x, t.h + 0.18, 0);
            tankGroup.add(valve);
        });
        const tankStrap = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.1), strapMat);
        tankStrap.position.set(0, 1.4, 0.33);
        tankGroup.add(tankStrap);
        habGroup.add(tankGroup);
        // Colisão pro jogador não atravessar os tanques
        {
            const wx = habGroup.position.x + tankGroup.position.x;
            const wz = habGroup.position.z + tankGroup.position.z;
            collisionData.push({ x: wx, z: wz, rSq: Math.pow(1.0, 2) });
        }

        // Impressora 3D com peça sendo "impressa" aos poucos, sobre uma bancada
        const printerGroup = new THREE.Group();
        printerGroup.position.set(7.2, 0, 2.2);
        printerGroup.rotation.y = -Math.PI * 0.4;
        const benchMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.5 });
        const bench = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.7), benchMat);
        bench.position.set(0, 0.425, 0);
        bench.castShadow = true; bench.receiveShadow = true;
        printerGroup.add(bench);

        const printerFrameMat = new THREE.MeshStandardMaterial({ color: 0xdadde0, roughness: 0.4, metalness: 0.5 });
        const printerGlassMat = new THREE.MeshStandardMaterial({ color: 0x88ddff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
        const printerBaseY = 0.85;
        const printerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.6), printerFrameMat);
        printerFrame.position.set(0, printerBaseY + 0.35, 0);
        printerGroup.add(printerFrame);
        const printerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.56), printerGlassMat);
        printerGlass.position.set(0, printerBaseY + 0.35, 0);
        printerGroup.add(printerGlass);

        // Peça em impressão (cresce e reinicia em loop, ver animate())
        const printObjectMat = new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: 0.4, metalness: 0.2, emissive: 0x552200, emissiveIntensity: 0.4 });
        const printObject = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 20), printObjectMat);
        printObject.position.set(0, printerBaseY + 0.03, 0);
        printerGroup.add(printObject);

        // Cabeçote de impressão que sobe conforme a peça cresce
        const printHeadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.7 });
        const printHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), printHeadMat);
        printHead.position.set(0, printerBaseY + 0.1, 0);
        printerGroup.add(printHead);

        if (Q.extraLights) {
            const printerLight = new THREE.PointLight(0x88ddff, 0.8, 4);
            printerLight.position.set(0, printerBaseY + 0.6, 0);
            printerGroup.add(printerLight);
        }
        habGroup.add(printerGroup);
        {
            const wx = habGroup.position.x + printerGroup.position.x;
            const wz = habGroup.position.z + printerGroup.position.z;
            collisionData.push({ x: wx, z: wz, rSq: Math.pow(0.75, 2) });
        }

        // Painel elétrico com LEDs piscando, montado na parede lateral (longe da curva do telão)
        const panelGroup = new THREE.Group();
        panelGroup.position.set(-8.4, 1.6, -4.3);
        panelGroup.rotation.y = 1.097; // encara o centro da sala, encostado na parede curva
        const panelBoxMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.5, metalness: 0.5 });
        const panelBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 0.12), panelBoxMat);
        panelGroup.add(panelBox);
        const ledMats = [];
        const ledRows = 5, ledCols = 4;
        for (let r = 0; r < ledRows; r++) {
            for (let c = 0; c < ledCols; c++) {
                const ledMat = new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x22ff44, emissiveIntensity: 0.2, roughness: 0.6 });
                const led = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.03), ledMat);
                led.position.set(-0.36 + c * 0.24, 0.5 - r * 0.24, 0.08);
                panelGroup.add(led);
                ledMats.push(ledMat);
            }
        }
        habGroup.add(panelGroup);

        // --- BELICHE: onde o astronauta pode dormir até o amanhecer ---
        const bedLocalX = 6.3, bedLocalZ = -4.8;
        const bedGroup = new THREE.Group();
        bedGroup.position.set(bedLocalX, 0, bedLocalZ);
        bedGroup.rotation.y = Math.atan2(bedLocalX, bedLocalZ) + Math.PI / 2; // encosta a cabeceira na parede curva
        const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.6, metalness: 0.5 });
        const mattressMat = new THREE.MeshStandardMaterial({ color: 0x3d6fa8, roughness: 0.8, metalness: 0.05 });
        const pillowMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9, metalness: 0.0 });
        const blanketMat = new THREE.MeshStandardMaterial({ color: 0xd6572f, roughness: 0.85, metalness: 0.05 });

        const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.35, 2.1), bedFrameMat);
        bedFrame.position.set(0, 0.35, 0); bedFrame.castShadow = true; bedFrame.receiveShadow = true;
        bedGroup.add(bedFrame);
        const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 2.0), mattressMat);
        mattress.position.set(0, 0.615, 0); mattress.castShadow = true; mattress.receiveShadow = true;
        bedGroup.add(mattress);
        const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.1, 1.2), blanketMat);
        blanket.position.set(0, 0.75, 0.35); blanket.castShadow = true;
        bedGroup.add(blanket);
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.4), pillowMat);
        pillow.position.set(0, 0.78, -0.78); pillow.castShadow = true;
        bedGroup.add(pillow);
        // Pés da cama
        [[-0.45,-0.9],[0.45,-0.9],[-0.45,0.9],[0.45,0.9]].forEach(([lx,lz]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 8), bedFrameMat);
            leg.position.set(lx, 0.16, lz); bedGroup.add(leg);
        });
        // Luminária de leitura pendurada na parede acima da cabeceira
        const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.7, emissive: 0xffdca0, emissiveIntensity: 0.5 });
        const readingLamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), lampMat);
        readingLamp.position.set(0, 1.5, -0.95);
        bedGroup.add(readingLamp);
        if (Q.extraLights) {
            const readingLight = new THREE.PointLight(0xffdca0, 0.6, 5);
            readingLight.position.set(0, 1.5, -0.9);
            bedGroup.add(readingLight);
        }
        habGroup.add(bedGroup);
        const bedWorldX = habGroup.position.x + bedLocalX;
        const bedWorldZ = habGroup.position.z + bedLocalZ;
        const bedPromptRange = 3;
        {
            collisionData.push({ x: bedWorldX, z: bedWorldZ, rSq: Math.pow(1.1, 2) });
        }

        scene.add(habGroup);

        // Posição da porta no mundo (usada para exibir a mensagem de interação)
        const doorWorldX = habGroup.position.x;
        const doorWorldZ = habGroup.position.z + habRadius;
        const interactPromptEl = document.getElementById('interactPrompt');
        const doorPromptRange = 7; // distância (em unidades) a partir da qual a mensagem aparece

        // Controle Lógico da Porta
        let isDoorOpen = false;
        let doorTargetY = doorClosedY;

        // Painéis Solares — a base do poste agora acompanha a altura real do terreno (getSurfaceHeight)
        // em vez de um Y fixo. Antes, o poste assumia chão em Y=0, então quando a área nivelada ao
        // redor da base mudava de tamanho, o chão "subia" ali e enterrava o poste inteiro.
        for(let i=0; i<3; i++) {
            const panel = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 8), solarMat);
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3), metalMat);
            const px = 15 + (i * 6), pz = -30;
            const poleGroundY = getSurfaceHeight(px, pz);
            pole.position.set(px, poleGroundY + 1.5, pz);
            panel.position.set(0, 1.5, 0);
            panel.rotation.z = Math.PI / 6; 
            pole.add(panel);
            pole.castShadow = true; panel.castShadow = true;
            scene.add(pole);
            // Adiciona poste aos colisores
            collisionData.push({ x: px, z: pz, rSq: Math.pow(0.2 + 0.4, 2) });
        }

        // --- JIPE ESPACIAL: veículo estacionado do lado da estação, dirigível ---
        const jeepParkX = habGroup.position.x - 16, jeepParkZ = habGroup.position.z + 2;
        let jeepHeading = 2.3; // orientação inicial (radianos)
        const jeepGroup = new THREE.Group();
        jeepGroup.position.set(jeepParkX, getTerrainHeight(jeepParkX, jeepParkZ), jeepParkZ);
        jeepGroup.rotation.y = jeepHeading;

        const jeepBodyMat = new THREE.MeshStandardMaterial({ color: 0xc2542c, roughness: 0.45, metalness: 0.55 });
        const jeepTrimMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.4, metalness: 0.4 });
        const jeepGlassMat = new THREE.MeshStandardMaterial({ color: 0xe4f6ff, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.22 });
        const jeepWheelMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.8, metalness: 0.2 });
        const jeepHubMat = new THREE.MeshStandardMaterial({ color: 0xb0b8bd, roughness: 0.35, metalness: 0.8 });
        const cageMat = new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.5, metalness: 0.7 });

        const jeepChassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 4.0), jeepTrimMat);
        jeepChassis.position.set(0, 0.55, 0); jeepChassis.castShadow = true; jeepChassis.receiveShadow = true;
        jeepGroup.add(jeepChassis);
        const jeepBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 1.2), jeepBodyMat);
        jeepBody.position.set(0, 1.05, 1.15); jeepBody.castShadow = true; jeepBody.receiveShadow = true;
        jeepGroup.add(jeepBody);
        // Cockpit aberto: em vez de uma carroceria sólida por cima do banco, só paredes baixas
        // tipo "banheira de buggy" - assim o jogador (câmera) fica visivelmente sentado, à mostra,
        // com visão livre pros lados e pra frente ao dirigir.
        const jeepSeatMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.85, metalness: 0.1 });
        [-0.925, 0.925].forEach(sx => {
            const tubWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, 1.6), jeepBodyMat);
            tubWall.position.set(sx, 0.95, -0.25); tubWall.castShadow = true; tubWall.receiveShadow = true;
            jeepGroup.add(tubWall);
        });
        // Banco do motorista, dentro do vão do cockpit
        const jeepSeatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.55), jeepSeatMat);
        jeepSeatCushion.position.set(0, 0.85, 0.05); jeepSeatCushion.castShadow = true;
        jeepGroup.add(jeepSeatCushion);
        const jeepSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.62, 0.12), jeepSeatMat);
        jeepSeatBack.position.set(0, 1.18, 0.32); jeepSeatBack.rotation.x = -0.12; jeepSeatBack.castShadow = true;
        jeepGroup.add(jeepSeatBack);
        const jeepHeadrest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.12), jeepSeatMat);
        jeepHeadrest.position.set(0, 1.56, 0.24); jeepHeadrest.rotation.x = -0.12;
        jeepGroup.add(jeepHeadrest);
        // Volante simples, na frente do banco
        const jeepWheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 20), cageMat);
        jeepWheelRing.position.set(0, 1.05, -0.75); jeepWheelRing.rotation.x = Math.PI / 2.6;
        jeepGroup.add(jeepWheelRing);
        const jeepWheelColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), jeepHubMat);
        jeepWheelColumn.position.set(0, 0.92, -0.62); jeepWheelColumn.rotation.x = 0.9;
        jeepGroup.add(jeepWheelColumn);
        const jeepHood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 1.1), jeepBodyMat);
        jeepHood.position.set(0, 0.95, -1.75); jeepHood.castShadow = true;
        jeepGroup.add(jeepHood);
        // Cabine/roll-cage (arcos abertos, estilo buggy)
        [-0.85, 0.85].forEach(cx => {
            const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), cageMat);
            bar.position.set(cx, 1.75, 0.6); bar.castShadow = true;
            jeepGroup.add(bar);
        });
        const cageTop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.3), cageMat);
        cageTop.position.set(0, 2.4, 0.6);
        jeepGroup.add(cageTop);
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.85, 0.06), jeepGlassMat);
        windshield.position.set(0, 1.55, -1.1); windshield.rotation.x = -0.25;
        jeepGroup.add(windshield);
        // Antena de comunicação
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.6, 6), jeepHubMat);
        antenna.position.set(0.85, 2.0, 1.4); antenna.rotation.z = 0.15;
        jeepGroup.add(antenna);
        // Barra de luzes traseira
        const jeepLightMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff4433, emissiveIntensity: 0.7, roughness: 0.5 });
        const tailLight = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.08), jeepLightMat);
        tailLight.position.set(0, 0.85, 1.65);
        jeepGroup.add(tailLight);
        // Faróis dianteiros — duas lentes de verdade (esquerda/direita) + suas luzes, ligáveis com a tecla [L]
        const jeepHeadlightLensMat0 = new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff3c0, emissiveIntensity: 0.05, roughness: 0.3 });
        const jeepHeadlightMeshes = [];
        const jeepHeadlightLights = [];
        [-0.65, 0.65].forEach(hx => {
            const lens = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), jeepHeadlightLensMat0.clone());
            lens.position.set(hx, 0.95, -2.02);
            jeepGroup.add(lens);
            jeepHeadlightMeshes.push(lens);

            // Perfil Baixo: só um refletor central (as duas lentes continuam acendendo). Um SpotLight a menos
            // em todos os pixels da cena, mesmo com intensidade 0.
            if (Q.headlightLights >= 2 || hx > 0) {
                const two = Q.headlightLights >= 2;
                const light = new THREE.SpotLight(0xfff3d0, 0, 40, two ? Math.PI / 5 : Math.PI / 4, 0.5, 1.4); // começa apagado (intensity 0)
                light.position.set(two ? hx : 0, 1.0, -2.0);
                const target = new THREE.Object3D(); target.position.set(two ? hx * 0.6 : 0, 0.3, -10);
                jeepGroup.add(target); light.target = target;
                jeepGroup.add(light);
                jeepHeadlightLights.push(light);
            }
        });
        let jeepHeadlightsOn = false;
        function setJeepHeadlights(on) {
            jeepHeadlightsOn = on;
            jeepHeadlightLights.forEach(l => l.intensity = on ? (Q.headlightLights >= 2 ? 5 : 8) : 0);
            jeepHeadlightMeshes.forEach(m => m.material.emissiveIntensity = on ? 2.2 : 0.05);
        }

        // Rodas (guardadas num array pra girar visualmente ao dirigir)
        const jeepWheels = [];
        const wheelRadius = 0.55;
        [[-1.05, 1.15], [1.05, 1.15], [-1.05, -1.35], [1.05, -1.35]].forEach(([wx, wz]) => {
            const wheelGroup = new THREE.Group();
            wheelGroup.position.set(wx, wheelRadius, wz);
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.4, 16), jeepWheelMat);
            tire.rotation.z = Math.PI / 2; tire.castShadow = true;
            wheelGroup.add(tire);
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 8), jeepHubMat);
            hub.rotation.z = Math.PI / 2;
            wheelGroup.add(hub);
            jeepGroup.add(wheelGroup);
            jeepWheels.push(wheelGroup);
        });
        jeepGroup.position.y += wheelRadius; // sobe o corpo pra rodas encostarem no chão
        scene.add(jeepGroup);

        const jeepPromptRange = 4.5;
        let isDriving = false, jeepSpeed = 0;
        const jeepAccel = 14, jeepDrag = 1.1, jeepMaxSpeed = 22, jeepTurnRate = 1.6;
        const jeepParkedRSq = Math.pow(2.3, 2); // "hitbox" circular aproximada do jipe estacionado
        // Entrada de colisão do próprio jipe: raio 0 enquanto está sendo dirigido (senão ele bateria nele mesmo),
        // e volta a bloquear o jogador a pé assim que ele estaciona.
        const jeepCollision = { x: jeepGroup.position.x, z: jeepGroup.position.z, rSq: jeepParkedRSq };
        collisionData.push(jeepCollision);

        // Colisão do jipe em movimento: testa as 4 quinas da carroceria (não só o centro),
        // pra ele não "furar" visualmente uma pedra ou a parede da base numa curva fechada.
        const jeepHalfLen = 2.1, jeepHalfWid = 1.15;
        function checkJeepCollision(cx, cz, headingRad) {
            const fwd = { x: -Math.sin(headingRad), z: -Math.cos(headingRad) };
            const rgt = { x: Math.cos(headingRad), z: -Math.sin(headingRad) };
            for (let sx = -1; sx <= 1; sx += 2) {
                for (let sz = -1; sz <= 1; sz += 2) {
                    const cornerX = cx + fwd.x * jeepHalfLen * sz + rgt.x * jeepHalfWid * sx;
                    const cornerZ = cz + fwd.z * jeepHalfLen * sz + rgt.z * jeepHalfWid * sx;
                    if (checkCollision(cornerX, cornerZ)) return true;
                }
            }
            return false;
        }

        // Inclinação do jipe conforme o relevo (sobe/desce ladeira e também inclina de lado em curvas/encostas).
        // Objetos reutilizados a cada frame pra não recriar Vector3/Matrix4/Quaternion sem necessidade.
        const jeepNormal = new THREE.Vector3(), jeepRight3 = new THREE.Vector3(), jeepFwd3 = new THREE.Vector3(), jeepBack3 = new THREE.Vector3();
        const jeepOrientMatrix = new THREE.Matrix4(), jeepTargetQuat = new THREE.Quaternion();
        function updateJeepTilt(delta, forward) {
            const slopeEps = 0.6, px = jeepGroup.position.x, pz = jeepGroup.position.z;
            const dhdx = (getTerrainHeight(px + slopeEps, pz) - getTerrainHeight(px - slopeEps, pz)) / (2 * slopeEps);
            const dhdz = (getTerrainHeight(px, pz + slopeEps) - getTerrainHeight(px, pz - slopeEps)) / (2 * slopeEps);
            jeepNormal.set(-dhdx, 1, -dhdz).normalize(); // normal real do terreno no ponto onde o jipe está
            jeepFwd3.set(forward.x, 0, forward.z);
            jeepRight3.crossVectors(jeepFwd3, jeepNormal).normalize();
            jeepFwd3.crossVectors(jeepNormal, jeepRight3).normalize(); // reprojeta a frente no plano do terreno
            jeepBack3.copy(jeepFwd3).negate(); // eixo local +Z do grupo aponta pra trás (o capô fica em -Z)
            jeepOrientMatrix.makeBasis(jeepRight3, jeepNormal, jeepBack3);
            jeepTargetQuat.setFromRotationMatrix(jeepOrientMatrix);
            // Suaviza a inclinação (efeito de suspensão), de forma independente da taxa de quadros
            jeepGroup.quaternion.slerp(jeepTargetQuat, 1 - Math.exp(-9 * delta));
        }
        const jeepSeatLocal = new THREE.Vector3(0, 1.5, -0.05), jeepCamWorldPos = new THREE.Vector3();

        // Função Central de Colisão (Retorna TRUE se bateu em algo)
        function checkCollision(px, pz) {
            // 1. Bateu em alguma Pedra ou Poste?
            for (let i = 0; i < collisionData.length; i++) {
                let dx = px - collisionData[i].x;
                let dz = pz - collisionData[i].z;
                if (dx*dx + dz*dz < collisionData[i].rSq) return true;
            }

            // 2. Bateu na parede do Habitat? (Centro em 0, -30, Raio habRadius)
            let hx = px - 0;
            let hz = pz - (-30);
            let distSq = hx*hx + hz*hz;

            // Zona da parede (uma faixa de +/-0.5 em torno do raio da base)
            const wallInnerSq = (habRadius - 0.5) * (habRadius - 0.5);
            const wallOuterSq = (habRadius + 0.5) * (habRadius + 0.5);
            if (distSq > wallInnerSq && distSq < wallOuterSq) {
                let angle = Math.atan2(hx, hz); // 0 aponta direto para a porta (+Z)
                let inDoorway = Math.abs(angle) < doorHalfAngle; // mesmo ângulo usado no vão da parede

                if (!inDoorway) return true; // Bateu na parede metálica circular
                if (door.position.y < doorOpenY - 1.5) return true; // Bateu na porta (se ela não estiver bem aberta)
            }
            return false;
        }

        // 5. PEGADAS E ÁUDIO
        const footprints = [];
        const fpGeo = new THREE.PlaneGeometry(0.4, 0.7); fpGeo.rotateX(-Math.PI / 2);
        const fpCanvas = document.createElement('canvas'); fpCanvas.width=32; fpCanvas.height=64;
        const fpCtx = fpCanvas.getContext('2d'); fpCtx.fillStyle='#220b02'; fpCtx.beginPath(); fpCtx.ellipse(16,32,12,28,0,0,Math.PI*2); fpCtx.fill();
        const fpMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fpCanvas), transparent: true, opacity: 0.6, depthWrite: false });

        let isLeftFoot = true;
        function addFootprint(x, z, rotY) {
            const fp = new THREE.Mesh(fpGeo, fpMat.clone());
            const offset = isLeftFoot ? -0.3 : 0.3;
            fp.position.set(x + Math.cos(rotY) * offset, getTerrainHeight(x, z) + 0.02, z - Math.sin(rotY) * offset);
            fp.rotation.y = rotY; scene.add(fp); footprints.push(fp); isLeftFoot = !isLeftFoot;
            if (footprints.length > 50) { const old = footprints.shift(); scene.remove(old); old.material.dispose(); }
        }

        let audioCtx, windGain, windFilter, breathGain, interiorHumGain, masterGain, sfxGain, musicGain, soundEnabled = true;
        let mouseSensitivity = 1.0, musicVolume = 0.5, sfxVolume = 1.0;
        function initAudio() {
            if(audioCtx) return; audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain(); masterGain.gain.value = soundEnabled ? 1 : 0; masterGain.connect(audioCtx.destination);

            sfxGain = audioCtx.createGain(); sfxGain.gain.value = sfxVolume; sfxGain.connect(masterGain);
            musicGain = audioCtx.createGain(); musicGain.gain.value = musicVolume; musicGain.connect(masterGain);

            const bufSize = audioCtx.sampleRate * 2; const noiseBuf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
            for (let i = 0; i < bufSize; i++) noiseBuf.getChannelData(0)[i] = Math.random() * 2 - 1;
            
            const wind = audioCtx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
            windFilter = audioCtx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 350;
            windGain = audioCtx.createGain(); windGain.gain.value = 0.4;
            wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(sfxGain); wind.start();

            const breath = audioCtx.createOscillator(); breath.type = 'triangle'; breath.frequency.value = 40;
            breathGain = audioCtx.createGain(); breathGain.gain.value = 0;
            breath.connect(breathGain); breathGain.connect(sfxGain); breath.start();

            createInteriorAmbience(noiseBuf);
            createJeepEngineSound(noiseBuf);

            startAmbientMusic();
        }

        // Ambiente interior da estação — só audível quando o jogador está dentro (ver loop principal).
        // Camadas: (1) zumbido elétrico de 60Hz + harmônico, com leve tremulação de LFO pra não soar
        // estático, como um gerador real; (2) rumor grave de suporte de vida/gerador; (3) duas linhas de
        // ventilação com centro de filtro variando lentamente e panorâmicas opostas, dando largura estéreo;
        // (4) bipes aleatórios de painel de controle, espalhados no tempo e no espaço.
        function createInteriorAmbience(noiseBuf) {
            interiorHumGain = audioCtx.createGain(); interiorHumGain.gain.value = 0;

            // Zumbido elétrico (rede/gerador) com tremulação sutil de amplitude
            const humOsc = audioCtx.createOscillator(); humOsc.type = 'sine'; humOsc.frequency.value = 58;
            const humOsc2 = audioCtx.createOscillator(); humOsc2.type = 'sine'; humOsc2.frequency.value = 116;
            const humBus = audioCtx.createGain(); humBus.gain.value = 0.85;
            const humLFO = audioCtx.createOscillator(); humLFO.type = 'sine'; humLFO.frequency.value = 0.13;
            const humLFOGain = audioCtx.createGain(); humLFOGain.gain.value = 0.12;
            humLFO.connect(humLFOGain); humLFOGain.connect(humBus.gain);
            humOsc.connect(humBus); humOsc2.connect(humBus); humBus.connect(interiorHumGain);

            // Rumor grave do gerador/suporte de vida, dá peso físico ao ambiente
            const rumbleOsc = audioCtx.createOscillator(); rumbleOsc.type = 'sine'; rumbleOsc.frequency.value = 28;
            const rumbleGain = audioCtx.createGain(); rumbleGain.gain.value = 0.45;
            rumbleOsc.connect(rumbleGain); rumbleGain.connect(interiorHumGain);

            // Linha de ventilação principal — o centro do filtro "respira" bem devagar
            const ventSource = audioCtx.createBufferSource(); ventSource.buffer = noiseBuf; ventSource.loop = true;
            const ventFilter = audioCtx.createBiquadFilter(); ventFilter.type = 'bandpass'; ventFilter.frequency.value = 850; ventFilter.Q.value = 0.6;
            const ventLFO = audioCtx.createOscillator(); ventLFO.type = 'sine'; ventLFO.frequency.value = 0.045;
            const ventLFOGain = audioCtx.createGain(); ventLFOGain.gain.value = 220;
            ventLFO.connect(ventLFOGain); ventLFOGain.connect(ventFilter.frequency);
            const ventGain = audioCtx.createGain(); ventGain.gain.value = 0.28;
            const ventPanner = audioCtx.createStereoPanner(); ventPanner.pan.value = -0.2;
            ventSource.connect(ventFilter); ventFilter.connect(ventGain); ventGain.connect(ventPanner); ventPanner.connect(interiorHumGain);

            // Segunda linha de ventilação, mais aguda e mais fraca, do outro lado do estéreo —
            // simula um duto de ar diferente e evita que o som pareça mono/artificial
            const ventSource2 = audioCtx.createBufferSource(); ventSource2.buffer = noiseBuf; ventSource2.loop = true; ventSource2.playbackRate.value = 1.07;
            const ventFilter2 = audioCtx.createBiquadFilter(); ventFilter2.type = 'bandpass'; ventFilter2.frequency.value = 1450; ventFilter2.Q.value = 0.5;
            const ventGain2 = audioCtx.createGain(); ventGain2.gain.value = 0.13;
            const ventPanner2 = audioCtx.createStereoPanner(); ventPanner2.pan.value = 0.35;
            ventSource2.connect(ventFilter2); ventFilter2.connect(ventGain2); ventGain2.connect(ventPanner2); ventPanner2.connect(interiorHumGain);

            interiorHumGain.connect(sfxGain);
            [humOsc, humOsc2, humLFO, rumbleOsc, ventSource, ventLFO, ventSource2].forEach(n => n.start());

            scheduleConsoleBeep();
        }

        // Bipes aleatórios de painel de controle: tocam só enquanto o jogador está dentro da base,
        // em intervalos irregulares, às vezes em par (como uma confirmação de comando).
        function playConsoleBeep() {
            if (!audioCtx || !interiorHumGain) return;
            const now = audioCtx.currentTime;
            const freq = 700 + Math.random() * 900;
            const panner = audioCtx.createStereoPanner(); panner.pan.value = (Math.random() * 2 - 1) * 0.5;
            panner.connect(interiorHumGain);

            const osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.03, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
            osc.connect(gain); gain.connect(panner);
            osc.start(now); osc.stop(now + 0.1);

            if (Math.random() < 0.35) {
                const osc2 = audioCtx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 1.5;
                const gain2 = audioCtx.createGain();
                gain2.gain.setValueAtTime(0.0001, now + 0.13);
                gain2.gain.linearRampToValueAtTime(0.04, now + 0.14);
                gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
                osc2.connect(gain2); gain2.connect(panner);
                osc2.start(now + 0.13); osc2.stop(now + 0.21);
            }
        }
        function scheduleConsoleBeep() {
            const delay = 3000 + Math.random() * 9000;
            setTimeout(() => {
                if (typeof playerInsideBase !== 'undefined' && playerInsideBase && soundEnabled) playConsoleBeep();
                scheduleConsoleBeep();
            }, delay);
        }
        // Música ambiente procedural: acorde suspenso e lento, tocando em loop com leve "flutuação" (LFO no detune)
        function startAmbientMusic() {
            const notes = [55, 82.41, 110, 130.81, 164.81]; // A1, E2, A2, C3, E3 — pad espacial aberto
            notes.forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                osc.type = i % 2 === 0 ? 'sine' : 'triangle';
                osc.frequency.value = freq;

                const noteGain = audioCtx.createGain();
                noteGain.gain.value = 0.09 - i * 0.012;

                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = 700 + i * 80;

                osc.connect(filter); filter.connect(noteGain); noteGain.connect(musicGain);
                osc.start();

                const lfo = audioCtx.createOscillator();
                lfo.type = 'sine'; lfo.frequency.value = 0.05 + i * 0.02;
                const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 3.5;
                lfo.connect(lfoGain); lfoGain.connect(osc.detune); lfo.start();
            });
        }
        function setSoundEnabled(enabled) {
            soundEnabled = enabled;
            if (masterGain) masterGain.gain.value = soundEnabled ? 1 : 0;
        }
        function setMusicVolume(v) { musicVolume = v; if (musicGain) musicGain.gain.value = v; }
        function setSfxVolume(v) { sfxVolume = v; if (sfxGain) sfxGain.gain.value = v; }
        function setMouseSensitivity(v) { mouseSensitivity = v; controls.pointerSpeed = v; }
        function playStepSound() {
            if(!audioCtx) return; const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
            osc.type = 'square'; osc.frequency.setValueAtTime(80, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime+0.1);
            filter.type = 'lowpass'; filter.frequency.value = 200;
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime+0.15);
            osc.connect(filter); filter.connect(gain); gain.connect(sfxGain);
            osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        }
        let doorNoiseBuffer = null;
        function getDoorNoiseBuffer() {
            if (doorNoiseBuffer) return doorNoiseBuffer;
            const bufSize = audioCtx.sampleRate * 1;
            doorNoiseBuffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
            const data = doorNoiseBuffer.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            return doorNoiseBuffer;
        }
        // Som mecânico de porta pneumática/deslizante: chiado de ar (ruído filtrado com varredura de
        // frequência) + zumbido grave de motor/servo por baixo, terminando num baque metálico quando a
        // porta trava no batente. isOpening=true varre para agudo (abrindo); false varre para grave (fechando).
        function playDoorSound(isOpening) {
            if (!audioCtx) return;
            const now = audioCtx.currentTime;

            const hiss = audioCtx.createBufferSource();
            hiss.buffer = getDoorNoiseBuffer();
            const hissFilter = audioCtx.createBiquadFilter();
            hissFilter.type = 'bandpass'; hissFilter.Q.value = 0.9;
            hissFilter.frequency.setValueAtTime(isOpening ? 500 : 1400, now);
            hissFilter.frequency.linearRampToValueAtTime(isOpening ? 1400 : 400, now + 0.5);
            const hissGain = audioCtx.createGain();
            hissGain.gain.setValueAtTime(0.0001, now);
            hissGain.gain.linearRampToValueAtTime(0.35, now + 0.06);
            hissGain.gain.linearRampToValueAtTime(0.0001, now + 0.55);
            hiss.connect(hissFilter); hissFilter.connect(hissGain); hissGain.connect(sfxGain);
            hiss.start(now); hiss.stop(now + 0.6);

            const motor = audioCtx.createOscillator();
            motor.type = 'sawtooth';
            motor.frequency.setValueAtTime(isOpening ? 60 : 90, now);
            motor.frequency.linearRampToValueAtTime(isOpening ? 90 : 60, now + 0.5);
            const motorFilter = audioCtx.createBiquadFilter();
            motorFilter.type = 'lowpass'; motorFilter.frequency.value = 220;
            const motorGain = audioCtx.createGain();
            motorGain.gain.setValueAtTime(0.0001, now);
            motorGain.gain.linearRampToValueAtTime(0.18, now + 0.08);
            motorGain.gain.linearRampToValueAtTime(0.0001, now + 0.5);
            motor.connect(motorFilter); motorFilter.connect(motorGain); motorGain.connect(sfxGain);
            motor.start(now); motor.stop(now + 0.55);

            const thunkOsc = audioCtx.createOscillator();
            thunkOsc.type = 'triangle';
            thunkOsc.frequency.setValueAtTime(140, now + 0.5);
            thunkOsc.frequency.exponentialRampToValueAtTime(40, now + 0.62);
            const thunkGain = audioCtx.createGain();
            thunkGain.gain.setValueAtTime(0.0001, now + 0.5);
            thunkGain.gain.linearRampToValueAtTime(0.4, now + 0.52);
            thunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
            thunkOsc.connect(thunkGain); thunkGain.connect(sfxGain);
            thunkOsc.start(now + 0.5); thunkOsc.stop(now + 0.7);
        }

        // --- SOM DO JIPE: motor elétrico contínuo (tom sobe com a velocidade) + ruído de rodagem no
        // terreno, ambos controlados a cada frame por updateJeepEngineSound(). Fica em silêncio (gain 0)
        // enquanto o jipe está parado/o jogador não está dirigindo, e ganha vida com playJeepStartSound()
        // ao entrar e se desliga com playJeepStopSound() ao sair.
        let jeepEngineGain, jeepMotorOsc, jeepMotorOsc2, jeepMotorFilter, jeepRoadGain, jeepRoadFilter;
        function createJeepEngineSound(noiseBuf) {
            jeepEngineGain = audioCtx.createGain(); jeepEngineGain.gain.value = 0;

            // Zumbido do motor elétrico: dois osciladores em oitava, com o grave dando corpo e o
            // agudo dando o "whine" característico de motor elétrico — a frequência de ambos sobe
            // com a velocidade em updateJeepEngineSound().
            jeepMotorOsc = audioCtx.createOscillator(); jeepMotorOsc.type = 'sawtooth'; jeepMotorOsc.frequency.value = 70;
            jeepMotorOsc2 = audioCtx.createOscillator(); jeepMotorOsc2.type = 'triangle'; jeepMotorOsc2.frequency.value = 140;
            const motorOsc2Gain = audioCtx.createGain(); motorOsc2Gain.gain.value = 0.35;
            jeepMotorFilter = audioCtx.createBiquadFilter(); jeepMotorFilter.type = 'lowpass'; jeepMotorFilter.frequency.value = 450;
            jeepMotorOsc.connect(jeepMotorFilter);
            jeepMotorOsc2.connect(motorOsc2Gain); motorOsc2Gain.connect(jeepMotorFilter);
            jeepMotorFilter.connect(jeepEngineGain);

            // Ruído de rodagem (pneus/cascalho no chão marciano) — mais presente quanto mais rápido anda
            const roadSource = audioCtx.createBufferSource(); roadSource.buffer = noiseBuf; roadSource.loop = true;
            jeepRoadFilter = audioCtx.createBiquadFilter(); jeepRoadFilter.type = 'bandpass'; jeepRoadFilter.frequency.value = 400; jeepRoadFilter.Q.value = 0.5;
            jeepRoadGain = audioCtx.createGain(); jeepRoadGain.gain.value = 0;
            roadSource.connect(jeepRoadFilter); jeepRoadFilter.connect(jeepRoadGain); jeepRoadGain.connect(jeepEngineGain);

            jeepEngineGain.connect(sfxGain);
            [jeepMotorOsc, jeepMotorOsc2, roadSource].forEach(n => n.start());
        }
        // Chamado a cada frame enquanto dirige (ver updateJeepDriving): sobe o tom e o volume do motor
        // com a velocidade atual, e o ruído de rodagem junto — sem rampas, porque já roda todo frame.
        function updateJeepEngineSound(speedAbs, speedRatio) {
            if (!audioCtx || !jeepMotorOsc) return;
            jeepMotorOsc.frequency.value = 70 + speedRatio * 260;
            jeepMotorOsc2.frequency.value = jeepMotorOsc.frequency.value * 2;
            jeepMotorFilter.frequency.value = 450 + speedRatio * 1800;
            jeepEngineGain.gain.value = 0.16 + speedRatio * 0.1;
            jeepRoadGain.gain.value = Math.min(1, speedAbs / 4) * 0.22;
        }
        // Som de "ligar" o jipe: um chirp eletrônico curto subindo de tom, tipo veículo elétrico ativando
        function playJeepStartSound() {
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator(); osc.type = 'sine';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.22, now + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
            osc.connect(gain); gain.connect(sfxGain);
            osc.start(now); osc.stop(now + 0.3);
        }
        // Som de "desligar" o jipe: o inverso, um chirp descendo de tom
        function playJeepStopSound() {
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator(); osc.type = 'sine';
            osc.frequency.setValueAtTime(420, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.3);
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
            osc.connect(gain); gain.connect(sfxGain);
            osc.start(now); osc.stop(now + 0.36);
        }

        // --- BANDEIRAS: o jogador pode plantar e nomear marcos pelo mapa ---
        const flags = [];
        const flagColors = [0xff5a3c, 0x3ca8ff, 0xffd23d, 0x6affa0, 0xd68aff, 0xff8ac2];
        function createNameSprite(text) {
            const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.font = 'bold 28px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const textWidth = ctx.measureText(text).width;
            const boxW = Math.min(canvas.width, textWidth + 28), boxH = 42;
            ctx.fillStyle = 'rgba(10,10,10,0.6)';
            ctx.fillRect((canvas.width - boxW) / 2, (canvas.height - boxH) / 2, boxW, boxH);
            ctx.fillStyle = '#fffbb5';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
            const tex = new THREE.CanvasTexture(canvas);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
            sprite.scale.set(2.4, 0.6, 1);
            return sprite;
        }
        function plantFlag(x, z, name) {
            const group = new THREE.Group();
            const color = flagColors[flags.length % flagColors.length];
            const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.6 });
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.2, 8), poleMat);
            pole.position.y = 1.1; pole.castShadow = true;
            group.add(pole);
            const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.5), new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }));
            cloth.position.set(0.4, 1.85, 0); cloth.castShadow = true;
            group.add(cloth);
            const nameSprite = createNameSprite(name);
            nameSprite.position.set(0, 2.55, 0);
            group.add(nameSprite);
            group.position.set(x, getTerrainHeight(x, z), z);
            scene.add(group);
            flags.push({ x, z, name, cloth, phase: Math.random() * 10 });
        }

        // Tela de nomear bandeira
        const flagNameScreen = document.getElementById('flagNameScreen');
        const flagNameInput = document.getElementById('flagNameInput');
        const flagNameOkBtn = document.getElementById('flagNameOk');
        let isNamingFlag = false, namingFlagPending = null;
        function startFlagNaming(x, z) {
            namingFlagPending = { x, z };
            isNamingFlag = true;
            flagNameInput.value = `Bandeira ${flags.length + 1}`;
            flagNameScreen.style.display = 'flex';
            interactPromptEl.classList.remove('visible');
            if (isControlsLocked()) requestUnlock();
            updateMobileControlsVisibility();
            setTimeout(() => { flagNameInput.focus(); flagNameInput.select(); }, 50);
        }
        function finishFlagNaming() {
            namingFlagPending = null;
            isNamingFlag = false;
            flagNameScreen.style.display = 'none';
            if (gameStarted && !isPaused) requestLock();
            updateMobileControlsVisibility();
        }
        function confirmFlagName() {
            const typed = flagNameInput.value.trim();
            const name = typed.length > 0 ? typed : `Bandeira ${flags.length + 1}`;
            if (namingFlagPending) plantFlag(namingFlagPending.x, namingFlagPending.z, name);
            finishFlagNaming();
        }
        flagNameOkBtn.addEventListener('click', confirmFlagName);
        flagNameInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.code === 'Enter') confirmFlagName();
            if (e.code === 'Escape') { namingFlagPending = null; finishFlagNaming(); }
        });

        // --- CAMA: dormir avança o tempo até o amanhecer ---
        const sleepFadeEl = document.getElementById('sleepFade');
        function sleepUntilMorning() {
            const cycles = Math.floor(dayTime / (Math.PI * 2));
            dayTime = (cycles + 1) * Math.PI * 2 + 0.05;
            sleepFadeEl.classList.add('active');
            setTimeout(() => sleepFadeEl.classList.remove('active'), 700);
        }

        // --- JIPE: entrar, sair e dirigir ---
        const jeepEnterEuler = new THREE.Euler(0, 0, 0, 'YXZ');
        function enterJeep() {
            isDriving = true; jeepSpeed = 0;
            // Decompõe a rotação atual da câmera em ordem YXZ (a mesma que o PointerLockControls usa)
            // pra preservar a inclinação vertical (pitch) e zerar qualquer rolagem residual.
            // Escrever direto em camera.rotation.y (ordem XYZ por padrão) misturava os eixos e
            // deixava a visão "caída" pro lado ao entrar no jipe.
            jeepEnterEuler.setFromQuaternion(camera.quaternion, 'YXZ');
            jeepEnterEuler.y = jeepHeading;
            jeepEnterEuler.z = 0;
            camera.quaternion.setFromEuler(jeepEnterEuler);
            interactPromptEl.classList.remove('visible');
            playJeepStartSound();
            document.body.classList.add('driving');
        }
        function exitJeep() {
            isDriving = false; jeepSpeed = 0;
            const right = { x: Math.cos(jeepHeading), z: -Math.sin(jeepHeading) };
            const ex = jeepGroup.position.x + right.x * 3, ez = jeepGroup.position.z + right.z * 3;
            camera.position.set(ex, getTerrainHeight(ex, ez) + 1.75, ez);
            playJeepStopSound();
            if (jeepEngineGain) jeepEngineGain.gain.value = 0;
            if (jeepRoadGain) jeepRoadGain.gain.value = 0;
            document.body.classList.remove('driving');
        }
        function updateJeepDriving(delta) {
            const throttle = (moveForward ? 1 : 0) - (moveBackward ? 1 : 0);
            jeepSpeed += throttle * jeepAccel * delta;
            jeepSpeed -= jeepSpeed * jeepDrag * delta;
            jeepSpeed = THREE.MathUtils.clamp(jeepSpeed, -jeepMaxSpeed * 0.4, jeepMaxSpeed);
            if (Math.abs(jeepSpeed) > 0.15) {
                const steer = (moveLeft ? 1 : 0) - (moveRight ? 1 : 0);
                jeepHeading += steer * jeepTurnRate * delta * Math.sign(jeepSpeed);
            }
            const forward = { x: -Math.sin(jeepHeading), z: -Math.cos(jeepHeading) };
            const nextX = jeepGroup.position.x + forward.x * jeepSpeed * delta;
            const nextZ = jeepGroup.position.z + forward.z * jeepSpeed * delta;
            if (!checkJeepCollision(nextX, nextZ, jeepHeading)) {
                jeepGroup.position.x = nextX; jeepGroup.position.z = nextZ;
            } else {
                jeepSpeed = 0;
            }
            jeepGroup.position.y = getTerrainHeight(jeepGroup.position.x, jeepGroup.position.z) + wheelRadius;
            updateJeepTilt(delta, forward);
            updateJeepEngineSound(Math.abs(jeepSpeed), Math.min(1, Math.abs(jeepSpeed) / jeepMaxSpeed));
            const wheelSpin = -jeepSpeed * delta * 1.4;
            // rotateY (não rotateX): as rodas foram deitadas de lado com rotation.z = 90°,
            // então o eixo de rolamento correto passa a ser o Y local, senão elas giram "de lado".
            jeepWheels.forEach(w => { w.children[0].rotateY(wheelSpin); w.children[1].rotateY(wheelSpin); });

            // Posição do banco em coordenadas locais do jipe, transformada pra world space:
            // assim a câmera acompanha a inclinação do jipe (sobe/desce ladeira, curva) em vez de
            // ficar sempre nivelada num offset vertical fixo.
            jeepGroup.updateMatrixWorld(true);
            jeepCamWorldPos.copy(jeepSeatLocal).applyMatrix4(jeepGroup.matrixWorld);
            camera.position.copy(jeepCamWorldPos);

            interactPromptEl.textContent = 'Pressione [ E ] para sair do jipe';
            interactPromptEl.classList.add('visible');
        }

        // --- MINIMAPA CIRCULAR ---
        // headingRad: 0 = "Norte" (referência arbitrária, o importante é ser consistente),
        // aumenta no sentido horário conforme o jogador vira para a direita.
        const minimapCtx = document.getElementById('minimapCanvas').getContext('2d');
        const cardinalPoints = [ [0,'N'], [90,'L'], [180,'S'], [270,'O'] ];
        const minimapRange = 90; // alcance do radar, em unidades do mundo
        function angleDiffDeg(a, b) { let d = (a - b) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }
        function drawMinimap(headingDeg, baseBearingDeg, baseDist, flagMarkers, jeepBearingDeg, jeepDist, hideJeepMarker, landmarkMarkers) {
            const w = minimapCtx.canvas.width, h = minimapCtx.canvas.height;
            const cx = w / 2, cy = h / 2, R = w / 2 - 10;
            minimapCtx.clearRect(0, 0, w, h);

            // Anéis de alcance
            minimapCtx.strokeStyle = 'rgba(255,251,181,0.15)';
            minimapCtx.lineWidth = 1;
            [0.33, 0.66, 1].forEach(f => { minimapCtx.beginPath(); minimapCtx.arc(cx, cy, R * f, 0, Math.PI * 2); minimapCtx.stroke(); });

            // Pontos cardeais (giram ao redor da borda conforme o jogador vira)
            minimapCtx.font = 'bold 13px Segoe UI, sans-serif';
            minimapCtx.textAlign = 'center';
            minimapCtx.textBaseline = 'middle';
            cardinalPoints.forEach(([deg, label]) => {
                const diffRad = THREE.MathUtils.degToRad(angleDiffDeg(deg, headingDeg));
                const px = cx + Math.sin(diffRad) * (R - 12);
                const py = cy - Math.cos(diffRad) * (R - 12);
                minimapCtx.fillStyle = label === 'N' ? '#ff8a5c' : 'rgba(255,251,181,0.55)';
                minimapCtx.fillText(label, px, py);
            });

            // Marcador da BASE — posição relativa ao jogador, girando com a direção que ele olha.
            // Se estiver fora do alcance do radar, gruda na borda apontando na direção certa.
            const diffRad = THREE.MathUtils.degToRad(angleDiffDeg(baseBearingDeg, headingDeg));
            const clampedDist = Math.min(baseDist, minimapRange);
            const markerR = (clampedDist / minimapRange) * (R - 14);
            const bx = cx + Math.sin(diffRad) * markerR;
            const by = cy - Math.cos(diffRad) * markerR;
            minimapCtx.font = '16px sans-serif';
            minimapCtx.fillStyle = '#66ffd6';
            minimapCtx.textAlign = 'center'; minimapCtx.textBaseline = 'middle';
            minimapCtx.fillText('🏠', bx, by);

            // Marcador do JIPE — só aparece se o jogador não estiver dirigindo ele agora
            if (!hideJeepMarker && jeepBearingDeg !== undefined) {
                const diffRadJ = THREE.MathUtils.degToRad(angleDiffDeg(jeepBearingDeg, headingDeg));
                const clampedDistJ = Math.min(jeepDist, minimapRange);
                const markerRJ = (clampedDistJ / minimapRange) * (R - 14);
                const jx = cx + Math.sin(diffRadJ) * markerRJ;
                const jy = cy - Math.cos(diffRadJ) * markerRJ;
                minimapCtx.fillStyle = '#8fd3ff';
                minimapCtx.beginPath(); minimapCtx.arc(jx, jy, 3, 0, Math.PI * 2); minimapCtx.fill();
                minimapCtx.font = 'bold 9px Segoe UI, sans-serif';
                minimapCtx.textAlign = 'center'; minimapCtx.textBaseline = 'middle';
                minimapCtx.fillText('Jipe', jx, jy + 10);
            }

            // Marcadores dos PONTOS TURÍSTICOS DE MARTE — ficam longe da base, então em vez de sumir
            // do radar (como as bandeiras) eles grudam na borda apontando a direção certa, tipo uma
            // bússola: o jogador sempre sabe pra que lado ir pra encontrar cada um.
            if (landmarkMarkers) {
                landmarkMarkers.forEach(lm => {
                    const diffRadL = THREE.MathUtils.degToRad(angleDiffDeg(lm.bearingDeg, headingDeg));
                    const clampedDistL = Math.min(lm.dist, minimapRange);
                    const rL = (clampedDistL / minimapRange) * (R - 14);
                    const lx = cx + Math.sin(diffRadL) * rL;
                    const ly = cy - Math.cos(diffRadL) * rL;
                    minimapCtx.fillStyle = '#ff9d5c';
                    minimapCtx.beginPath(); minimapCtx.arc(lx, ly, 3, 0, Math.PI * 2); minimapCtx.fill();
                    minimapCtx.font = 'bold 8px Segoe UI, sans-serif';
                    minimapCtx.textAlign = 'center'; minimapCtx.textBaseline = 'middle';
                    minimapCtx.fillStyle = '#ffd9b3';
                    const labelL = lm.name.length > 12 ? lm.name.slice(0, 11) + '…' : lm.name;
                    minimapCtx.fillText(labelL, lx, ly + 10);
                });
            }

            // Marcadores de BANDEIRAS plantadas — mostram nome, só dentro do alcance do radar
            if (flagMarkers) {
                flagMarkers.forEach(f => {
                    if (f.dist > minimapRange) return;
                    const diffRadF = THREE.MathUtils.degToRad(angleDiffDeg(f.bearingDeg, headingDeg));
                    const r = (f.dist / minimapRange) * (R - 14);
                    const fx = cx + Math.sin(diffRadF) * r;
                    const fy = cy - Math.cos(diffRadF) * r;
                    minimapCtx.fillStyle = '#ffd23d';
                    minimapCtx.beginPath(); minimapCtx.arc(fx, fy, 3, 0, Math.PI * 2); minimapCtx.fill();
                    minimapCtx.font = 'bold 9px Segoe UI, sans-serif';
                    minimapCtx.textAlign = 'center'; minimapCtx.textBaseline = 'middle';
                    minimapCtx.fillStyle = '#fffbb5';
                    const label = f.name.length > 10 ? f.name.slice(0, 9) + '…' : f.name;
                    minimapCtx.fillText(label, fx, fy + 10);
                });
            }

            // Jogador — sempre fixo no centro, olhando "pra cima"
            minimapCtx.save();
            minimapCtx.translate(cx, cy);
            minimapCtx.fillStyle = '#ffaa66';
            minimapCtx.beginPath();
            minimapCtx.moveTo(0, -8); minimapCtx.lineTo(6, 7); minimapCtx.lineTo(0, 4); minimapCtx.lineTo(-6, 7);
            minimapCtx.closePath(); minimapCtx.fill();
            minimapCtx.restore();
        }

        // 6. INPUTS E CONTROLES
        const controls = new PointerLockControls(camera, document.body);
        const blocker = document.getElementById('blocker');
        const nicknameScreen = document.getElementById('nicknameScreen');
        const nicknameInput = document.getElementById('nicknameInput');
        const nicknameOkBtn = document.getElementById('nicknameOk');
        const playerHud = document.getElementById('playerHud');
        const coordHud = document.getElementById('coordHud');

        // --- Suporte a celular: em telas de toque não existe Pointer Lock de verdade
        // (arrastar o dedo não dispara mousemove com movementX/Y), então simulamos o "travamento"
        // do controle com uma flag própria e giramos a câmera manualmente a partir do toque
        // (ver applyMobileLook mais abaixo). requestLock/requestUnlock/isControlsLocked substituem
        // TODAS as chamadas diretas a controls.lock()/unlock()/isLocked no resto do arquivo.
        if (isMobile) document.body.classList.add('is-mobile');
        let virtualLocked = false;
        function isControlsLocked() { return isMobile ? virtualLocked : controls.isLocked; }
        function requestLock() {
            if (isMobile) { virtualLocked = true; onControlsLocked(); }
            else controls.lock();
        }
        function requestUnlock() {
            if (isMobile) { virtualLocked = false; onControlsUnlocked(); }
            else if (controls.isLocked) controls.unlock();
        }

        let gameStarted = false;
        let playerNickname = '';

        // 1) Tela de start -> some, e abre a tela de nickname (sem travar o mouse ainda)
        //    Se o jogo já começou (o jogador só apertou Esc / perdeu o foco), volta direto sem pedir nickname de novo.
        document.getElementById('playBtn').addEventListener('click', () => {
            if (gameStarted) { requestLock(); updateMobileControlsVisibility(); return; }
            blocker.style.display = 'none';
            nicknameScreen.style.display = 'flex';
            nicknameInput.value = '';
            setTimeout(() => nicknameInput.focus(), 50);
        });

        // Tela de Controles, acessada pelo botão na tela de start (some o blocker, mostra os controles por cima)
        const controlsScreen = document.getElementById('controlsScreen');
        document.getElementById('controlsBtn').addEventListener('click', () => {
            blocker.style.display = 'none';
            controlsScreen.style.display = 'flex';
        });
        document.getElementById('controlsBack').addEventListener('click', () => {
            controlsScreen.style.display = 'none';
            blocker.style.display = 'flex';
        });

        // 2) Confirma o nickname -> mostra no HUD e só então começa o jogo (trava o mouse)
        function confirmNickname() {
            const typed = nicknameInput.value.trim();
            playerNickname = typed.length > 0 ? typed : 'Astronauta';
            playerHud.textContent = '🧑‍🚀 ' + playerNickname;
            nicknameScreen.style.display = 'none';
            gameStarted = true;
            requestLock();
            initAudio();
            // O HUD (nickname, coordenadas, minimapa) só aparece quando a cutscene terminar —
            // startCutscene() mantém o jogador travado (sem mover/interagir) durante a transmissão.
            startCutscene();
        }
        nicknameOkBtn.addEventListener('click', confirmNickname);
        nicknameInput.addEventListener('keydown', (e) => {
            e.stopPropagation(); // impede que digitar no campo mexa nos controles do jogo
            if (e.code === 'Enter') confirmNickname();
        });

        function onControlsLocked() { blocker.style.display = 'none'; updateMobileControlsVisibility(); }
        function onControlsUnlocked() {
            interactPromptEl.classList.remove('visible');
            updateMobileControlsVisibility();
            // Durante a cutscene de abertura o jogo não deve pausar (ela roda sem o pointer lock preso,
            // e o ESC não tem mais nenhum efeito nela — não dá pra pular)
            if (cutsceneActive) return;
            // Não abre o menu de pausa se o motivo foi abrir a tela de nomear bandeira
            if (isNamingFlag) return;
            // Se o jogo já começou, abrir o menu de pausa (em vez da tela de início)
            if (gameStarted) openPauseMenu();
        }
        controls.addEventListener('lock', onControlsLocked);
        controls.addEventListener('unlock', onControlsUnlocked);

        // --- MENU DE PAUSA ---
        const pauseMenu = document.getElementById('pauseMenu');
        const menuResumeBtn = document.getElementById('menuResume');
        const menuSoundBtn = document.getElementById('menuSound');
        const menuRestartBtn = document.getElementById('menuRestart');
        const menuQuitBtn = document.getElementById('menuQuit');
        const menuCreditsBtn = document.getElementById('menuCredits');
        const creditsScreen = document.getElementById('creditsScreen');
        const creditsBackBtn = document.getElementById('creditsBack');
        const sensSlider = document.getElementById('sensSlider');
        const sensValue = document.getElementById('sensValue');
        const musicVolSlider = document.getElementById('musicVolSlider');
        const musicVolValue = document.getElementById('musicVolValue');
        const sfxVolSlider = document.getElementById('sfxVolSlider');
        const sfxVolValue = document.getElementById('sfxVolValue');
        const minimap = document.getElementById('minimap');
        let isPaused = false;

        function openPauseMenu() {
            if (isPaused || !gameStarted) return;
            isPaused = true;
            pauseMenu.style.display = 'flex';
            interactPromptEl.classList.remove('visible');
            minimap.style.display = 'none';
            if (isControlsLocked()) requestUnlock();
            updateMobileControlsVisibility();
        }
        function closePauseMenu() {
            isPaused = false;
            pauseMenu.style.display = 'none';
            creditsScreen.style.display = 'none';
            minimap.style.display = 'block';
            requestLock();
            updateMobileControlsVisibility();
        }
        menuResumeBtn.addEventListener('click', closePauseMenu);
        menuSoundBtn.addEventListener('click', () => {
            setSoundEnabled(!soundEnabled);
            menuSoundBtn.textContent = soundEnabled ? '🔊 Som: Ligado' : '🔇 Som: Desligado';
        });
        // Botão de gráficos: cicla Baixo → Médio → Alto. Antialias, luzes e quantidade de objetos são definidos
        // na criação da cena, então o jogo reinicia pra aplicar (a escolha fica salva no navegador).
        const menuQualityBtn = document.getElementById('menuQuality');
        if (menuQualityBtn) {
            const qualityOrder = ['low', 'medium', 'high'];
            menuQualityBtn.textContent = '🎨 Gráficos: ' + Q.label;
            menuQualityBtn.addEventListener('click', () => {
                const next = qualityOrder[(qualityOrder.indexOf(qualityKey) + 1) % qualityOrder.length];
                if (!window.confirm(`Mudar os gráficos para "${QUALITY_PRESETS[next].label}"? O jogo será reiniciado.`)) return;
                try { localStorage.setItem(QUALITY_KEY, next); } catch (err) { /* sem storage: só não lembra */ }
                location.reload();
            });
        }
        menuRestartBtn.addEventListener('click', () => location.reload());
        menuQuitBtn.addEventListener('click', () => location.reload());

        // Tela "Sobre o Jogo" — some do menu de pausa e mostra os créditos por cima
        menuCreditsBtn.addEventListener('click', () => {
            pauseMenu.style.display = 'none';
            creditsScreen.style.display = 'flex';
        });
        creditsBackBtn.addEventListener('click', () => {
            creditsScreen.style.display = 'none';
            pauseMenu.style.display = 'flex';
        });

        // Configurações: sensibilidade do mouse, volume da música e dos efeitos
        sensSlider.addEventListener('input', () => {
            const v = parseFloat(sensSlider.value);
            setMouseSensitivity(v);
            sensValue.textContent = v.toFixed(1);
        });
        musicVolSlider.addEventListener('input', () => {
            const v = parseInt(musicVolSlider.value, 10);
            setMusicVolume(v / 100);
            musicVolValue.textContent = v + '%';
        });
        sfxVolSlider.addEventListener('input', () => {
            const v = parseInt(sfxVolSlider.value, 10);
            setSfxVolume(v / 100);
            sfxVolValue.textContent = v + '%';
        });

        // --- CUTSCENE DE ABERTURA: "SOL 1 — A FRONTEIRA VERMELHA" ---
        // Roda logo depois do jogador confirmar o nickname e antes de liberar o controle de verdade:
        // uma câmera cinematográfica sobrevoa alguns marcos do planeta enquanto legendas em estilo
        // "transmissão orbital" contam o contexto da missão. Usa as MESMAS coordenadas (OLYMPUS_X,
        // habGroup.position, jeepGroup.position etc.) já definidas pro resto do jogo, então a cutscene
        // sempre bate certinho com o mundo, mesmo que os números do terreno mudem no futuro.
        const cutsceneEl = document.getElementById('cutscene');
        const cutsceneTextWrap = document.getElementById('cutsceneTextWrap');
        const cutsceneHeaderEl = document.getElementById('cutsceneHeader');
        const cutsceneCaptionEl = document.getElementById('cutsceneCaption');

        let cutsceneActive = false;
        let cutsceneIndex = 0;
        let cutsceneSceneStart = 0;
        const cutsceneOriginalFogDensity = scene.fog.density;
        const cutsceneLookTmp = new THREE.Vector3();
        const olympusPeakY = getTerrainHeight(OLYMPUS_X, OLYMPUS_Z); // altura real do platô do Monte Olimpo
        const vallesFloorY = getTerrainHeight(VALLES_X, VALLES_Z);   // altura no eixo do cânion de Valles Marineris
        const galeFloorY = getTerrainHeight(GALE_X, GALE_Z);         // altura no centro da Cratera Gale (já inclui o Monte Sharp)
        const jezeroFloorY = getTerrainHeight(JEZERO_X, JEZERO_Z);   // altura no centro da Cratera Jezero

        function easeInOutSine(x) { return -(Math.cos(Math.PI * x) - 1) / 2; }

        const CUTSCENE_SCENES = [
            {
                header: 'TRANSMISSÃO ORBITAL // QUARTO PLANETA',
                caption: 'Marte. Um mundo gélido e desértico, coberto por óxido de ferro e envolvido por uma atmosfera rarefeita de dióxido de carbono. Um planeta silencioso que aguarda a chegada da vida.',
                duration: 8000,
                shot(t) {
                    const angle = THREE.MathUtils.degToRad(205) + t * THREE.MathUtils.degToRad(55);
                    const radius = 480, height = THREE.MathUtils.lerp(420, 330, t), cx = 0, cz = -120;
                    return {
                        pos: new THREE.Vector3(cx + Math.cos(angle) * radius, height, cz + Math.sin(angle) * radius),
                        look: new THREE.Vector3(cx, 30, cz)
                    };
                }
            },
            {
                header: 'PONTO DE INTERESSE 🌋 // MONTE OLIMPO',
                caption: 'Erguendo-se por dezenas de quilômetros acima da planície, o Monte Olimpo é o maior vulcão do Sistema Solar — tão imenso que, de suas bordas, a curvatura do próprio planeta se torna visível.',
                duration: 8000,
                shot(t) {
                    const angle = THREE.MathUtils.degToRad(40) - t * THREE.MathUtils.degToRad(75);
                    const radius = THREE.MathUtils.lerp(420, 280, t);
                    const height = olympusPeakY + THREE.MathUtils.lerp(150, 85, t);
                    return {
                        pos: new THREE.Vector3(OLYMPUS_X + Math.cos(angle) * radius, height, OLYMPUS_Z + Math.sin(angle) * radius),
                        look: new THREE.Vector3(OLYMPUS_X, olympusPeakY - 30, OLYMPUS_Z)
                    };
                }
            },
            {
                header: 'PONTO DE INTERESSE 🏜️ // VALLES MARINERIS',
                caption: 'Uma cicatriz colossal corta o hemisfério marciano: Valles Marineris, um sistema de cânions tão extenso que, se estivesse na Terra, se estenderia de costa a costa de um continente inteiro.',
                duration: 8000,
                shot(t) {
                    const angle = THREE.MathUtils.degToRad(160) + t * THREE.MathUtils.degToRad(70);
                    const radius = THREE.MathUtils.lerp(360, 260, t);
                    const height = vallesFloorY + THREE.MathUtils.lerp(230, 150, t);
                    return {
                        pos: new THREE.Vector3(VALLES_X + Math.cos(angle) * radius, height, VALLES_Z + Math.sin(angle) * radius),
                        look: new THREE.Vector3(VALLES_X, vallesFloorY - 20, VALLES_Z)
                    };
                }
            },
            {
                header: 'PONTO DE INTERESSE 🏔️ // CRATERA GALE',
                caption: 'No interior da Cratera Gale, o Monte Sharp se ergue a partir de camadas de sedimento antigo — um registro geológico da história de Marte, e o destino que trouxe o rover Curiosity à superfície em 2012.',
                duration: 7500,
                shot(t) {
                    const angle = THREE.MathUtils.degToRad(-30) + t * THREE.MathUtils.degToRad(85);
                    const radius = THREE.MathUtils.lerp(260, 190, t);
                    const height = galeFloorY + THREE.MathUtils.lerp(130, 80, t);
                    return {
                        pos: new THREE.Vector3(GALE_X + Math.cos(angle) * radius, height, GALE_Z + Math.sin(angle) * radius),
                        look: new THREE.Vector3(GALE_X, galeFloorY + 20, GALE_Z)
                    };
                }
            },
            {
                header: 'PONTO DE INTERESSE 🕳️ // CRATERA JEZERO',
                caption: 'A Cratera Jezero preserva o leque fóssil de um antigo delta fluvial, prova de que rios já correram por este solo. Foi aqui que o rover Perseverance pousou em 2021, em busca de sinais de vida microbiana.',
                duration: 7500,
                shot(t) {
                    const angle = THREE.MathUtils.degToRad(210) - t * THREE.MathUtils.degToRad(80);
                    const radius = THREE.MathUtils.lerp(230, 170, t);
                    const height = jezeroFloorY + THREE.MathUtils.lerp(110, 65, t);
                    return {
                        pos: new THREE.Vector3(JEZERO_X + Math.cos(angle) * radius, height, JEZERO_Z + Math.sin(angle) * radius),
                        look: new THREE.Vector3(JEZERO_X, jezeroFloorY + 10, JEZERO_Z)
                    };
                }
            },
            {
                header: 'ESTAÇÃO HABITACIONAL MARTE-1 // SUPORTE VITAL',
                caption: 'A humanidade estabeleceu seu primeiro bastião permanente. A Base Habitacional Marte-1 fornece suporte vital, energia solar e centro de comando para as operações de superfície.',
                duration: 7500,
                shot(t) {
                    const angle = THREE.MathUtils.degToRad(190) + t * THREE.MathUtils.degToRad(120);
                    const radius = 32, height = habGroup.position.y + 15;
                    return {
                        pos: new THREE.Vector3(habGroup.position.x + Math.cos(angle) * radius, height, habGroup.position.z + Math.sin(angle) * radius),
                        look: new THREE.Vector3(habGroup.position.x, habGroup.position.y + 4, habGroup.position.z)
                    };
                }
            },
            {
                header: 'MÓDULO DE EXPLORAÇÃO // MOBILIDADE DE CAMPO',
                caption: 'Equipamentos de coleta, sistemas de manufatura 3D e veículos de exploração foram implantados para garantir o mapeamento do terreno e a coleta de recursos valiosos.',
                duration: 7000,
                shot(t) {
                    const angle = THREE.MathUtils.degToRad(-50) + t * THREE.MathUtils.degToRad(100);
                    const radius = 11, height = jeepGroup.position.y + 5;
                    return {
                        pos: new THREE.Vector3(jeepGroup.position.x + Math.cos(angle) * radius, height, jeepGroup.position.z + Math.sin(angle) * radius),
                        look: new THREE.Vector3(jeepGroup.position.x, jeepGroup.position.y + 1, jeepGroup.position.z)
                    };
                }
            },
            {
                header: 'INÍCIO DE OPERAÇÃO // SOL 1',
                caption: 'Sua missão é explorar a superfície, monitorar os sistemas da base e expandir a presença humana na Terra Vermelha. As transmissões estão ativas. Boa sorte, Astronauta.',
                duration: 7000,
                shot(t) {
                    // Termina EXATAMENTE no ponto e olhar em que o jogo normalmente começa, olhando
                    // reto pra frente (não pra baixo) — por isso pos e look usam a MESMA altura do chão.
                    const spawnEyeY = getGroundY(0, 0) + 1.75;
                    const startPos = new THREE.Vector3(12, 17, 22);
                    const endPos = new THREE.Vector3(0, spawnEyeY, 0);
                    const startLook = new THREE.Vector3(doorWorldX, habGroup.position.y + 3, doorWorldZ);
                    const endLook = new THREE.Vector3(0, spawnEyeY, -10);
                    return { pos: startPos.lerp(endPos, t), look: startLook.lerp(endLook, t) };
                }
            }
        ];

        function setCutsceneSceneText(i) {
            cutsceneHeaderEl.textContent = CUTSCENE_SCENES[i].header;
            cutsceneCaptionEl.textContent = CUTSCENE_SCENES[i].caption;
        }

        // Chamada assim que o nickname é confirmado: prende o jogo no modo cutscene (some com o HUD,
        // desliga a colisão/movimento do jogador) e começa a tocar a primeira cena.
        function startCutscene() {
            cutsceneActive = true;
            cutsceneIndex = 0;
            cutsceneSceneStart = performance.now();
            scene.fog.density = 0.0016; // afasta a neblina pra dar uma vista mais ampla nos planos aéreos
            setCutsceneSceneText(0);
            cutsceneTextWrap.style.opacity = '0';
            cutsceneEl.classList.add('active');
        }

        // Se o Pointer Lock foi perdido (ex: ESC, inatividade) e o jogo devia estar rodando, tenta
        // travar de novo sozinho, sem mostrar nenhuma tela por cima. Chamado tanto no fim da cutscene
        // quanto (como rede de segurança) na primeira tecla/clique do jogador depois disso — porque o
        // navegador só aceita re-travar o mouse como resposta direta a um gesto do próprio jogador.
        function tryReclaimPointerLock() {
            if (isMobile || !gameStarted || isPaused || isNamingFlag || cutsceneActive || controls.isLocked) return;
            try { controls.lock(); } catch (err) { /* precisa de um gesto do jogador; a rede de segurança abaixo cobre isso */ }
        }
        window.addEventListener('keydown', tryReclaimPointerLock);
        window.addEventListener('pointerdown', tryReclaimPointerLock);

        // Encerra a cutscene (tanto no fim natural quanto ao pular) e libera o jogo normalmente.
        function endCutscene() {
            cutsceneActive = false;
            cutsceneEl.classList.remove('active');
            cutsceneTextWrap.style.opacity = '0';
            scene.fog.density = cutsceneOriginalFogDensity;
            playerHud.style.display = 'block';
            coordHud.style.display = 'block';
            minimap.style.display = 'block';
            updateMobileControlsVisibility();
            // Tenta travar o mouse de novo na hora (funciona na maioria dos navegadores, sem o jogador notar
            // nada). Se essa tentativa falhar silenciosamente, a rede de segurança acima (tryReclaimPointerLock
            // no primeiro clique/tecla) resolve — sem precisar mostrar nenhuma tela de "clique pra continuar".
            tryReclaimPointerLock();
        }

        // Chamada a cada frame (de dentro do loop principal) enquanto cutsceneActive === true.
        function updateCutscene(now) {
            const scn = CUTSCENE_SCENES[cutsceneIndex];
            const elapsed = now - cutsceneSceneStart;
            const rawT = Math.min(1, elapsed / scn.duration);
            const easedT = easeInOutSine(rawT);

            const { pos, look } = scn.shot(easedT);
            camera.position.copy(pos);
            cutsceneLookTmp.copy(look);
            camera.lookAt(cutsceneLookTmp);

            // Legenda entra e sai suavemente (crossfade) nos 14% iniciais/finais de cada cena
            const fadeZone = 0.14;
            let textOpacity = 1;
            if (rawT < fadeZone) textOpacity = rawT / fadeZone;
            else if (rawT > 1 - fadeZone) textOpacity = (1 - rawT) / fadeZone;
            cutsceneTextWrap.style.opacity = String(Math.max(0, Math.min(1, textOpacity)));

            if (rawT >= 1) {
                cutsceneIndex++;
                if (cutsceneIndex >= CUTSCENE_SCENES.length) {
                    endCutscene();
                } else {
                    cutsceneSceneStart = now;
                    setCutsceneSceneText(cutsceneIndex);
                }
            }
        }

        // A cutscene não pode mais ser pulada (de propósito — evita o jogador acabar destravado/preso
        // no meio do chão por causa do navegador soltando o Pointer Lock de verdade ao apertar ESC).
        // Por isso o ESC só abre o menu de pausa depois que a cutscene já tiver terminado sozinha.
        function doPauseOrSkip() {
            if (cutsceneActive) return;
            if (gameStarted && !isPaused) openPauseMenu();
        }
        document.addEventListener('keydown', (e) => {
            if (e.code !== 'Escape') return;
            doPauseOrSkip();
        });

        let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, flashlightOn = false;
        const velocity = new THREE.Vector3(), direction = new THREE.Vector3(), camForward = new THREE.Vector3();
        let currentInteraction = null; // 'door' | 'bed' | 'jeep' | null — atualizado a cada frame em animate()
        let isNightNow = false;

        // --- Ações de jogo, extraídas em funções pra serem chamadas tanto pelo teclado (desktop)
        // quanto pelos botões virtuais na tela (celular). ---
        function canAcceptGameInput() {
            return gameStarted && !isPaused && !isNamingFlag && !cutsceneActive;
        }
        function doToggleFlashlight() {
            if (!canAcceptGameInput()) return;
            flashlightOn = !flashlightOn; flashlight.visible = flashlightOn;
        }
        function doToggleHeadlights() {
            if (!canAcceptGameInput() || !isDriving) return;
            setJeepHeadlights(!jeepHeadlightsOn);
        }
        function doInteract() {
            if (!canAcceptGameInput()) return;
            if (isDriving) {
                exitJeep();
            } else if (currentInteraction === 'door') { // Abrir/Fechar porta da base!
                isDoorOpen = !isDoorOpen;
                doorTargetY = isDoorOpen ? doorOpenY : doorClosedY; // Sobe para liberar a passagem
                playDoorSound(isDoorOpen);
            } else if (currentInteraction === 'bed') {
                if (isNightNow) sleepUntilMorning();
            } else if (currentInteraction === 'jeep') {
                enterJeep();
            }
        }
        function doPlantFlag() {
            if (!canAcceptGameInput() || isDriving || playerInsideBase) return;
            const px = camera.position.x, pz = camera.position.z;
            const tooClose = flags.some(f => Math.hypot(f.x - px, f.z - pz) < 3);
            if (!tooClose) startFlagNaming(px, pz);
        }

        document.addEventListener('keydown', (e) => {
            if (!canAcceptGameInput()) return; // ignora teclas de jogo enquanto está no start/nickname/pausado/nomeando bandeira/cutscene
            if(e.code === 'KeyW') moveForward = true;
            if(e.code === 'KeyA') moveLeft = true;
            if(e.code === 'KeyS') moveBackward = true;
            if(e.code === 'KeyD') moveRight = true;
            if(e.code === 'KeyF') doToggleFlashlight();
            if(e.code === 'KeyL') doToggleHeadlights();
            if(e.code === 'KeyE') doInteract();
            if(e.code === 'KeyG') doPlantFlag();
        });
        document.addEventListener('keyup', (e) => {
            if(e.code === 'KeyW') moveForward = false;
            if(e.code === 'KeyA') moveLeft = false;
            if(e.code === 'KeyS') moveBackward = false;
            if(e.code === 'KeyD') moveRight = false;
        });

        // --- CONTROLES VIRTUAIS (CELULAR): joystick de movimento, arraste pra olhar e botões de ação ---
        const mobileControlsEl = document.getElementById('mobileControls');
        function updateMobileControlsVisibility() {
            if (!isMobile) return;
            document.body.classList.toggle('game-active', canAcceptGameInput());
        }

        if (isMobile) {
            // Joystick virtual (esquerda): controla moveForward/Backward/Left/Right por limiar (digital),
            // igual ao teclado — assim reaproveita 100% da física de movimento já existente.
            const joyZone = document.getElementById('joystickZone');
            const joyStick = document.getElementById('joystickStick');
            const JOY_RADIUS = 40, JOY_DEADZONE = 12;
            let joyPointerId = null, joyCenterX = 0, joyCenterY = 0;

            function joyApply(clientX, clientY) {
                let dx = clientX - joyCenterX, dy = clientY - joyCenterY;
                const dist = Math.hypot(dx, dy);
                if (dist > JOY_RADIUS) { dx = dx / dist * JOY_RADIUS; dy = dy / dist * JOY_RADIUS; }
                joyStick.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
                moveForward = dy < -JOY_DEADZONE;
                moveBackward = dy > JOY_DEADZONE;
                moveLeft = dx < -JOY_DEADZONE;
                moveRight = dx > JOY_DEADZONE;
            }
            function joyReset() {
                joyStick.style.transform = 'translate(-50%, -50%)';
                moveForward = moveBackward = moveLeft = moveRight = false;
            }
            joyZone.addEventListener('pointerdown', (e) => {
                if (!canAcceptGameInput() || joyPointerId !== null) return;
                const rect = joyZone.getBoundingClientRect();
                joyCenterX = rect.left + rect.width / 2;
                joyCenterY = rect.top + rect.height / 2;
                joyPointerId = e.pointerId;
                joyZone.setPointerCapture(e.pointerId);
                joyApply(e.clientX, e.clientY);
            });
            joyZone.addEventListener('pointermove', (e) => {
                if (e.pointerId !== joyPointerId) return;
                joyApply(e.clientX, e.clientY);
            });
            function joyRelease(e) {
                if (e.pointerId !== joyPointerId) return;
                joyPointerId = null;
                joyReset();
            }
            joyZone.addEventListener('pointerup', joyRelease);
            joyZone.addEventListener('pointercancel', joyRelease);

            // Área de "olhar": arrastar o dedo em qualquer lugar da tela gira a câmera. O PointerLockControls
            // de verdade só responde a mousemove enquanto o Pointer Lock real está ativo (não é o caso no
            // toque), então giramos a câmera manualmente aqui, replicando a mesma ordem de eixos (YXZ) e
            // aplicando a mesma sensibilidade (mouseSensitivity) usada no slider de configurações.
            const lookZone = document.getElementById('lookZone');
            const mobileLookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
            let lookPointerId = null, lookLastX = 0, lookLastY = 0;
            function applyMobileLook(dx, dy) {
                mobileLookEuler.setFromQuaternion(camera.quaternion, 'YXZ');
                mobileLookEuler.y -= dx * 0.0024 * mouseSensitivity;
                mobileLookEuler.x -= dy * 0.0024 * mouseSensitivity;
                mobileLookEuler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, mobileLookEuler.x));
                mobileLookEuler.z = 0;
                camera.quaternion.setFromEuler(mobileLookEuler);
            }
            lookZone.addEventListener('pointerdown', (e) => {
                if (!canAcceptGameInput() || lookPointerId !== null) return;
                lookPointerId = e.pointerId;
                lookLastX = e.clientX; lookLastY = e.clientY;
                lookZone.setPointerCapture(e.pointerId);
            });
            lookZone.addEventListener('pointermove', (e) => {
                if (e.pointerId !== lookPointerId) return;
                const dx = e.clientX - lookLastX, dy = e.clientY - lookLastY;
                lookLastX = e.clientX; lookLastY = e.clientY;
                applyMobileLook(dx, dy);
            });
            function lookRelease(e) { if (e.pointerId === lookPointerId) lookPointerId = null; }
            lookZone.addEventListener('pointerup', lookRelease);
            lookZone.addEventListener('pointercancel', lookRelease);

            // Botões de ação: mesmas funções compartilhadas com o teclado.
            function bindMobileButton(id, action) {
                const btn = document.getElementById(id);
                btn.addEventListener('pointerdown', (e) => { e.preventDefault(); action(); });
            }
            bindMobileButton('btnInteract', doInteract);
            bindMobileButton('btnFlashlight', doToggleFlashlight);
            bindMobileButton('btnHeadlights', doToggleHeadlights);
            bindMobileButton('btnFlag', doPlantFlag);
            document.getElementById('btnMobilePause').addEventListener('pointerdown', (e) => { e.preventDefault(); doPauseOrSkip(); });

            // Ao voltar da pausa / trocar de tela, o toque pode "ficar preso" — solta tudo por garantia.
            document.addEventListener('visibilitychange', () => { joyPointerId = null; lookPointerId = null; joyReset(); });

            // Ajusta as dicas de texto que mencionam teclado (ESC, WASD) pra fazerem sentido no celular.
            const flagNameHintEl = document.getElementById('flagNameHint');
            if (flagNameHintEl) flagNameHintEl.textContent = 'Toque fora ou use o botão ⏸ para cancelar';
            const controlsPanelEl = document.querySelector('.controlsPanel');
            if (controlsPanelEl) {
                controlsPanelEl.innerHTML = `
                    <span class="controlHint">🕹️ Joystick — Andar</span>
                    <span class="controlHint">👆 Arraste a tela — Olhar</span>
                    <span class="controlHint">🔦 Botão — Lanterna</span>
                    <span class="controlHint">E — Interagir</span>
                    <span class="controlHint">🚩 Botão — Bandeira</span>
                    <span class="controlHint">💡 Botão — Faróis do jipe</span>
                    <span class="controlHint">⏸ Botão — Menu</span>
                `;
            }
            const creditsControlsP = document.querySelector('#creditsBox p:last-of-type');
            if (creditsControlsP) creditsControlsP.textContent = 'Joystick para andar  |  Arraste a tela para olhar  |  Botões para lanterna, bandeira, faróis e interagir';
        }

        // 7. ILUMINAÇÃO
        const ambientLight = new THREE.AmbientLight(0xbf5b34, 0.35); scene.add(ambientLight);
        const sunLight = new THREE.DirectionalLight(0xfff5db, 1.6); 
        sunLight.castShadow = Q.shadows; sunLight.shadow.mapSize.width = 512; sunLight.shadow.mapSize.height = 512;
        sunLight.shadow.camera.near = 0.5; sunLight.shadow.camera.far = 1200;
        sunLight.shadow.camera.left = -300; sunLight.shadow.camera.right = 300; sunLight.shadow.camera.top = 300; sunLight.shadow.camera.bottom = -300;
        scene.add(sunLight);

        const flashlight = new THREE.SpotLight(0xfffdf0, 12, 60, Math.PI / 6, 0.4, 1.2);
        flashlight.castShadow = Q.flashlightShadow; flashlight.visible = false; camera.add(flashlight);
        const flashlightTarget = new THREE.Object3D(); flashlightTarget.position.set(0, 0, -1); 
        camera.add(flashlightTarget); flashlight.target = flashlightTarget;

        const sunVisual = new THREE.Mesh(new THREE.SphereGeometry(11, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffff })); scene.add(sunVisual);
        const sunGlow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), new THREE.PointsMaterial({ color: 0xfffae0, size: 130, map: createSunGlowTexture(), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(sunGlow);

        const starsGeo = new THREE.BufferGeometry(); const starPos = new Float32Array(4000*3), starCol = new Float32Array(4000*3);
        const p = [new THREE.Color(0xffffff), new THREE.Color(0x8cd3ff), new THREE.Color(0xffe68c), new THREE.Color(0xffa254), new THREE.Color(0xff8c8c), new THREE.Color(0xe0aaff)];
        for(let i=0; i<4000; i++) {
            const i3 = i*3, r = 450 + Math.random()*50, phi = Math.acos(2*Math.random()-1), theta = Math.random()*2*Math.PI;
            starPos[i3] = r*Math.sin(phi)*Math.cos(theta); starPos[i3+1] = Math.abs(r*Math.sin(phi)*Math.sin(theta)); starPos[i3+2] = r*Math.cos(phi);
            const c = p[Math.floor(Math.random()*p.length)]; starCol[i3]=c.r; starCol[i3+1]=c.g; starCol[i3+2]=c.b;
        }
        starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3)); starsGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3)); 
        const starsMat = new THREE.PointsMaterial({ size: 2.2, transparent: true, opacity: 0, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
        const starsPoints = new THREE.Points(starsGeo, starsMat);
        scene.add(starsPoints);

        // Phobos e Deimos: as duas luas de Marte. Pequenas demais pra terem gravidade própria e virarem
        // esferas perfeitas — por isso são "batatas espaciais" irregulares, capturadas de asteroides.
        function makeMoonGeometry(radius, jitter, craterDir) {
            const geo = new THREE.IcosahedronGeometry(radius, 2);
            const pos = geo.attributes.position;
            const dir = craterDir ? craterDir.clone().normalize() : null;
            for (let i = 0; i < pos.count; i++) {
                const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
                v.multiplyScalar(1 + (Math.random() - 0.5) * jitter); // amassa a esfera de forma aleatória
                if (dir) {
                    const dot = v.clone().normalize().dot(dir);
                    if (dot > 0.55) v.multiplyScalar(1 - ((dot - 0.55) / 0.45) * 0.35); // afunda uma cratera gigante, tipo a Stickney do Phobos
                }
                pos.setXYZ(i, v.x, v.y, v.z);
            }
            geo.computeVertexNormals();
            return geo;
        }
        const moonMat = new THREE.MeshStandardMaterial({ color: 0xa89e90, emissive: 0x5c5346, emissiveIntensity: 0.7, roughness: 1.0, flatShading: true });
        const phobosMesh = new THREE.Mesh(makeMoonGeometry(6, 0.3, new THREE.Vector3(0.8, 0.35, 0.5)), moonMat.clone());
        scene.add(phobosMesh);
        const deimosMesh = new THREE.Mesh(makeMoonGeometry(3.2, 0.16), moonMat.clone());
        scene.add(deimosMesh);

        // Auroras marcianas — faixas curvas com shader, só aparecem à noite
        const auroraVertexShader = `
            varying vec2 vUv;
            uniform float time;
            uniform float waveAmp;
            void main() {
                vUv = uv;
                vec3 pos = position;
                pos.z += sin(pos.x * 0.012 + time * 0.5) * waveAmp + sin(pos.x * 0.035 - time * 0.25) * (waveAmp * 0.4);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `;
        const auroraFragmentShader = `
            varying vec2 vUv;
            uniform float time;
            uniform float opacity;
            uniform vec3 colorA;
            uniform vec3 colorB;
            void main() {
                float band = sin(vUv.x * 5.0 + time * 0.6) * 0.5 + 0.5;
                vec3 color = mix(colorA, colorB, band);
                float edgeFade = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
                float shimmer = 0.55 + 0.45 * sin(vUv.x * 14.0 + time * 1.8);
                float alpha = edgeFade * opacity * shimmer;
                gl_FragColor = vec4(color, alpha);
            }
        `;
        const auroraMeshes = [];
        function createAurora(x, y, z, rotY, width, height, colorA, colorB, speed) {
            const geo = new THREE.PlaneGeometry(width, height, 60, 12);
            const mat = new THREE.ShaderMaterial({
                vertexShader: auroraVertexShader,
                fragmentShader: auroraFragmentShader,
                uniforms: {
                    time: { value: Math.random() * 100 },
                    opacity: { value: 0 },
                    waveAmp: { value: width * 0.06 },
                    colorA: { value: new THREE.Color(colorA) },
                    colorB: { value: new THREE.Color(colorB) }
                },
                transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.rotation.y = rotY;
            mesh.userData.speed = speed;
            scene.add(mesh);
            auroraMeshes.push(mesh);
        }
        // Cada aurora é um plano gigante transparente com shader próprio (muito overdraw em GPU fraca).
        createAurora(-150, 240, -520, 0.4, 700, 220, 0x1fe08a, 0x7a3bd6, 1.0);
        if (Q.auroras >= 2) createAurora(250, 280, -600, -0.3, 620, 190, 0x2bd6c8, 0xc23bd6, 0.7);
        if (Q.auroras >= 3) createAurora(50, 200, -700, 0.1, 800, 170, 0x3bffb0, 0x5a5bea, 1.3);

        scene.add(new THREE.Mesh(new THREE.DodecahedronGeometry(11, 1), new THREE.MeshBasicMaterial({color: 0xffffff})).position.set(-300, 230, -450));
        scene.add(new THREE.Mesh(new THREE.DodecahedronGeometry(5, 1), new THREE.MeshBasicMaterial({color: 0xffffff})).position.set(-265, 250, -430));

        // 8. ROCHAS E PEDRAS (Com colisão)
        // No celular a GPU é bem mais fraca pra processar centenas de milhares de instâncias, então
        // gera bem menos pedrinhas/pedras lá — no PC também aparamos um pouco a quantidade de seixos
        // minúsculos (eram 240 mil; quase imperceptíveis a essa distância, mas pesados de desenhar).
        const pebbleCount = Q.pebbles;
        const rockCount = Q.rocks;
        const boulderMax = Q.boulders;

        const rockMat = Q.lambert
            ? new THREE.MeshLambertMaterial({ color: groundColorHex })
            : new THREE.MeshStandardMaterial({ color: groundColorHex, roughness: 1.0 });
        const dummy = new THREE.Object3D();
        const rockSpawnHalf = worldSize / 2 - 20; // cobre o mapa quase até a borda, não só o miolo

        // Pedrinhas e pedras ficam divididas em "chunks" (células de grade), cada um com o seu InstancedMesh.
        // Antes era UM InstancedMesh com o mapa inteiro (até 90 mil pedrinhas ≈ 3 milhões de triângulos) e a
        // GPU desenhava tudo a cada quadro, mesmo o que estava a quilômetros do jogador ou atrás dele. Agora só
        // os chunks perto do jogador ficam visíveis e o Three.js ainda descarta os que estão fora do campo de visão.
        const rockChunks = [];
        function buildRockChunks(geometry, material, total, cellsPerSide, maxDist, castShadow, place) {
            const span = rockSpawnHalf * 2;
            const cell = span / cellsPerSide;
            const perCell = Math.max(1, Math.round(total / (cellsPerSide * cellsPerSide)));
            const reach = maxDist + cell * 0.71; // distância até o centro do chunk (metade da diagonal da célula)
            for (let gz = 0; gz < cellsPerSide; gz++) {
                for (let gx = 0; gx < cellsPerSide; gx++) {
                    const x0 = -rockSpawnHalf + gx * cell, z0 = -rockSpawnHalf + gz * cell;
                    const mesh = new THREE.InstancedMesh(geometry, material, perCell);
                    let n = 0;
                    for (let k = 0; k < perCell; k++) {
                        const px = x0 + Math.random() * cell, pz = z0 + Math.random() * cell;
                        if (place(px, pz)) { mesh.setMatrixAt(n, dummy.matrix); n++; }
                    }
                    if (n === 0) { mesh.dispose(); continue; }
                    mesh.count = n;
                    mesh.castShadow = castShadow; mesh.receiveShadow = castShadow;
                    mesh.computeBoundingSphere(); // usada no descarte por campo de visão (frustum culling)
                    scene.add(mesh);
                    rockChunks.push({ mesh, cx: x0 + cell / 2, cz: z0 + cell / 2, reachSq: reach * reach });
                }
            }
        }
        function updateRockChunkVisibility(px, pz) {
            for (let i = 0; i < rockChunks.length; i++) {
                const c = rockChunks[i], dx = c.cx - px, dz = c.cz - pz;
                c.mesh.visible = dx * dx + dz * dz < c.reachSq;
            }
        }
        let rockVisTimer = 0;

        // Pedrinhas minúsculas (não têm colisão nem sombra)
        buildRockChunks(new THREE.DodecahedronGeometry(0.045, 0), rockMat, pebbleCount, 40, Q.pebbleDist, false, (px, pz) => {
            if (Math.hypot(px - 0, pz - (-30)) < habRadius + 1) return false; // não nasce dentro/perto da base
            dummy.position.set(px, getSurfaceHeight(px, pz) - 0.01, pz);
            dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            const s = Math.random()*0.9+0.3; dummy.scale.set(s, s*0.8, s); dummy.updateMatrix();
            return true;
        });

        // Pedras comuns (com colisão)
        buildRockChunks(new THREE.DodecahedronGeometry(0.5, 0), rockMat, rockCount, 20, Q.rockDist, Q.shadows, (rx, rz) => {
            // Não gera pedra DENTRO ou em cima da base
            if (Math.hypot(rx - 0, rz - (-30)) < habRadius + 9) return false;
            dummy.position.set(rx, getSurfaceHeight(rx, rz) - 0.12, rz);
            dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            const scale = Math.random() * 2.2 + 0.6;
            dummy.scale.set(scale, scale * 0.75, scale);
            dummy.updateMatrix();
            // Adiciona pedra ao array de colisão! (Raio da rocha + Margem para o Player)
            collisionData.push({ x: rx, z: rz, rSq: Math.pow((0.5 * scale) + 0.4, 2) });
            return true;
        });
        updateRockChunkVisibility(0, 0);

        // Rochedos maiores — formações rochosas bem mais altas, espalhadas de forma mais rara pelo mapa
        const instancedBoulders = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 1), rockMat, boulderMax);
        let boulderCount = 0;
        for (let i = 0; i < boulderMax; i++) {
            const rx = (Math.random() - 0.5) * 2 * rockSpawnHalf;
            const rz = (Math.random() - 0.5) * 2 * rockSpawnHalf;
            if (Math.hypot(rx - 0, rz - (-30)) < habRadius + 20) continue; // afasta bem da base

            const scale = Math.random() * 5 + 3.2; // 3.2 a 8.2 — bem maiores que as pedras comuns
            dummy.position.set(rx, getSurfaceHeight(rx, rz) - scale * 0.28, rz);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            dummy.scale.set(scale, scale * (0.7 + Math.random() * 0.5), scale);
            dummy.updateMatrix();
            instancedBoulders.setMatrixAt(boulderCount, dummy.matrix);
            collisionData.push({ x: rx, z: rz, rSq: Math.pow(scale * 0.55 + 0.6, 2) });
            boulderCount++;
        }
        instancedBoulders.count = boulderCount;
        instancedBoulders.castShadow = true; instancedBoulders.receiveShadow = true; scene.add(instancedBoulders);

        // Tempestade de Poeira — nuvem de partículas que sempre envolve o jogador (viaja com ele em X e Z),
        // então dá a sensação de poeira "por todo o mapa" em vez de só perto do ponto de partida.
        const dustCount = Q.dust; const dustBoxR = 55;
        const dustPos = new Float32Array(dustCount * 3), dustSpeeds = new Float32Array(dustCount), dustHeightOffset = new Float32Array(dustCount);
        for(let i=0; i<dustCount*3; i+=3) {
            const rx = (Math.random()-0.5)*2*dustBoxR, rz = (Math.random()-0.5)*2*dustBoxR;
            const hOff = Math.random()*18;
            dustPos[i]=rx; dustPos[i+1]=getSurfaceHeight(rx, rz) + hOff; dustPos[i+2]=rz;
            dustSpeeds[i/3]=Math.random()*12+8; dustHeightOffset[i/3]=hOff;
        }
        const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
        const dustParticles = new THREE.Points(dustGeo, new THREE.PointsMaterial({color: 0xbd5a31, size: 0.18, transparent: true, opacity: 0.22})); scene.add(dustParticles);

        // 9. LOOP PRINCIPAL
        let prevTime = performance.now(), dayTime = 0.5, walkDist = 0;
        let playerInsideBase = false; // usado pra não ter poeira dentro da estação

        // Estado do painel do supercomputador
        let energyLevel = 70;               // 0-100, carrega com sol, descarrega à noite
        let stormLevel = 15;                // 0-100, intensidade da tempestade de poeira
        let stormTarget = 15;
        let stormRetimer = 12;              // segundos até escolher um novo alvo de tempestade
        let solDay = 1;                     // contador de "dias marcianos" (sóis)
        let wasNight = false;
        let panelRedrawTimer = 0;
        let printProgress = 0;
        let ledBlinkTimer = 0;
        let minimapTimer = 0;

        function animate() {
            requestAnimationFrame(animate);
            const time = performance.now(), delta = (time - prevTime) / 1000; prevTime = time;
            updateAdaptiveResolution(delta);
            rockVisTimer -= delta;
            if (rockVisTimer <= 0) { rockVisTimer = 0.2; updateRockChunkVisibility(camera.position.x, camera.position.z); }

            // Cutscene de abertura: assume o controle total da câmera até acabar (ou ser pulada)
            if (cutsceneActive) updateCutscene(time);

            // Animação da Porta! Lerp (Interpolação suave)
            door.position.y += (doorTargetY - door.position.y) * delta * 4;

            if (breathGain && audioCtx) breathGain.gain.value = ((Math.sin(time * 0.002) + 1) / 2) * 0.15;
            footprints.forEach(fp => fp.material.opacity -= 0.0005 * delta * 60);

            // Céu estrelado sempre acompanha o jogador, como um domo infinito no horizonte
            starsPoints.position.copy(camera.position);

            // Phobos orbita bem rápido (cruza o céu várias vezes por sol, como o de verdade);
            // Deimos é bem mais devagar, quase acompanhando a rotação do próprio Marte.
            const phobosAngle = dayTime * 3.4;
            phobosMesh.position.set(
                camera.position.x + Math.cos(phobosAngle) * 300,
                camera.position.y + Math.sin(phobosAngle) * 220 + 40,
                camera.position.z - 200 + Math.sin(phobosAngle * 1.3) * 80
            );
            phobosMesh.rotation.y += delta * 0.5; phobosMesh.rotation.x += delta * 0.2;

            const deimosAngle = dayTime * 0.85;
            deimosMesh.position.set(
                camera.position.x + Math.cos(deimosAngle) * 460,
                camera.position.y + Math.sin(deimosAngle) * 300 + 30,
                camera.position.z - 380
            );
            deimosMesh.rotation.y += delta * 0.25;

            dayTime += 0.012 * delta; 
            const sunY = Math.sin(dayTime) * 400; 
            sunLight.position.set(Math.cos(dayTime)*600, sunY, -300); sunVisual.position.copy(sunLight.position); sunGlow.position.copy(sunLight.position);

            // Conta os "sóis" (dias marcianos) — incrementa a cada nascer do sol
            isNightNow = sunY < -40;
            if (wasNight && !isNightNow) solDay++;
            wasNight = isNightNow;

            // Energia solar: carrega enquanto o sol está no céu, descarrega à noite
            energyLevel += (sunY > 0 ? 9 : -3.5) * delta;
            energyLevel = THREE.MathUtils.clamp(energyLevel, 0, 100);

            // Tempestade de poeira: sobe e desce suavemente rumo a um alvo aleatório que muda de tempos em tempos
            stormRetimer -= delta;
            if (stormRetimer <= 0) {
                stormTarget = Math.random() * 100;
                stormRetimer = 25 + Math.random() * 35;
            }
            stormLevel += (stormTarget - stormLevel) * delta * 0.15;
            const stormActive = stormLevel > 62;

            let nightFactor = 0;
            if (sunY > 80) {
                scene.background.lerp(daySkyColor, 0.05); scene.fog.color.lerp(daySkyColor, 0.05);
                sunLight.intensity = 1.6; ambientLight.color.setHex(0xbf5b34); starsMat.opacity = THREE.MathUtils.lerp(starsMat.opacity, 0, 0.05);
                nightFactor = 0;
            } else if (sunY > -40) {
                scene.background.lerp(sunsetSkyColor, 0.05); scene.fog.color.lerp(sunsetSkyColor, 0.05);
                const factor = Math.max(0, (sunY + 40) / 120); sunLight.intensity = factor; ambientLight.color.setHex(0x45566b);
                starsMat.opacity = THREE.MathUtils.lerp(starsMat.opacity, (1 - factor) * 0.6, 0.05);
                nightFactor = (1 - factor) * 0.6;
            } else {
                scene.background.lerp(nightSkyColor, 0.05); scene.fog.color.lerp(nightSkyColor, 0.05);
                sunLight.intensity = 0; ambientLight.color.setHex(0x0e121a); starsMat.opacity = THREE.MathUtils.lerp(starsMat.opacity, 1, 0.05); 
                nightFactor = 1;
            }

            // Auroras marcianas — só brilham à noite, ondulando lentamente
            auroraMeshes.forEach(m => {
                m.material.uniforms.time.value += delta * m.userData.speed;
                m.material.uniforms.opacity.value = THREE.MathUtils.lerp(m.material.uniforms.opacity.value, nightFactor * 0.8, 0.03);
            });

            dustParticles.visible = !playerInsideBase; // sem poeira dentro da estação
            const stormMix = stormLevel / 100;
            dustParticles.material.opacity = 0.12 + stormMix * 0.5;
            const dustSpeedMul = 1 + stormMix * 2.2;

            // Áudio ambiente reagindo ao mundo: vento mais forte/agudo durante tempestade, abafado e mais
            // grave quando o jogador está dentro da base (como se ouvisse do lado de fora através da parede),
            // e o zumbido interno da base entra/sai suavemente ao cruzar a porta.
            if (audioCtx) {
                const smooth = Math.min(1, delta * 2.5);
                const targetWindGain = playerInsideBase ? (0.05 + stormMix * 0.05) : (0.32 + stormMix * 0.55);
                const targetWindFreq = playerInsideBase ? 140 : (300 + stormMix * 900);
                windGain.gain.value += (targetWindGain - windGain.gain.value) * smooth;
                windFilter.frequency.value += (targetWindFreq - windFilter.frequency.value) * smooth;
                const targetHum = playerInsideBase ? 0.16 : 0;
                interiorHumGain.gain.value += (targetHum - interiorHumGain.gain.value) * smooth;
            }
            const dustArr = dustParticles.geometry.attributes.position.array, px = camera.position.x, pz = camera.position.z;
            if (dustParticles.visible) for(let i=0; i<dustCount; i++) { // dentro da base a poeira está oculta: nem calcula
                const idx = i*3; dustArr[idx] += dustSpeeds[i]*dustSpeedMul*delta;
                // Checa a distância real (X e Z) até o jogador, não só o X — assim a poeira nunca "esquece"
                // de acompanhar quando o jogador anda mais em Z do que em X, e sempre o envolve, esteja onde
                // estiver no mapa (base, cânion, cratera, topo do Olimpo etc.)
                const ddx = dustArr[idx] - px, ddz = dustArr[idx+2] - pz;
                if (ddx*ddx + ddz*ddz > dustBoxR*dustBoxR) {
                    dustArr[idx] = px - dustBoxR + Math.random()*dustBoxR*0.3; // volta a nascer do lado "a favor do vento"
                    dustArr[idx+2] = pz + (Math.random()-0.5)*2*dustBoxR;
                }
                // Altura sempre relativa ao terreno local (usando a mesma interpolação da malha real),
                // então a poeira encosta certinho no chão em qualquer altitude (dunas, montanha, vales)
                dustArr[idx+1] = getSurfaceHeight(dustArr[idx], dustArr[idx+2]) + dustHeightOffset[i];
            }
            dustParticles.geometry.attributes.position.needsUpdate = true;

            // Sincroniza a "hitbox" do jipe: some enquanto ele está sendo dirigido (senão bateria nele mesmo)
            // e volta a bloquear o jogador a pé assim que ele estaciona, seguindo a posição atual do jipe.
            jeepCollision.x = jeepGroup.position.x;
            jeepCollision.z = jeepGroup.position.z;
            jeepCollision.rSq = isDriving ? 0 : jeepParkedRSq;

            // SISTEMA DE MOVIMENTO + COLISÃO QUE PERMITE "DESLIZAR"
            if (isControlsLocked() && !cutsceneActive) {
                if (isDriving) {
                    // --- Dirigindo o jipe ---
                    updateJeepDriving(delta);
                } else {
                    // --- Andando a pé ---
                    velocity.x -= velocity.x * 8.5 * delta; velocity.z -= velocity.z * 8.5 * delta;
                    direction.z = Number(moveForward) - Number(moveBackward); direction.x = Number(moveRight) - Number(moveLeft); direction.normalize();
                    if (moveForward || moveBackward) velocity.z -= direction.z * 70.0 * delta;
                    if (moveLeft || moveRight) velocity.x -= direction.x * 70.0 * delta;

                    // Salva a posição antes de mover
                    const oldX = controls.getObject().position.x;
                    const oldZ = controls.getObject().position.z;
                    const oldY = controls.getObject().position.y;

                    // Move de mentira (Three.js processa a rotação da câmera pra gente)
                    controls.moveRight(-velocity.x * delta);
                    controls.moveForward(-velocity.z * delta);

                    const nextX = controls.getObject().position.x;
                    const nextZ = controls.getObject().position.z;

                    // Checa Colisão no local previsto
                    if (checkCollision(nextX, nextZ)) {
                        // Tenta deslizar apenas pelo eixo X
                        if (!checkCollision(nextX, oldZ)) {
                            controls.getObject().position.set(nextX, oldY, oldZ);
                            velocity.z = 0;
                        } 
                        // Tenta deslizar apenas pelo eixo Z
                        else if (!checkCollision(oldX, nextZ)) {
                            controls.getObject().position.set(oldX, oldY, nextZ);
                            velocity.x = 0;
                        } 
                        // Bateu de frente em um canto, para totalmente
                        else {
                            controls.getObject().position.set(oldX, oldY, oldZ);
                            velocity.x = 0; velocity.z = 0;
                        }
                    }

                    // Ajusta a altura com base no terreno
                    const finalX = controls.getObject().position.x;
                    const finalZ = controls.getObject().position.z;
                    
                    // Se estiver dentro da base (raio ~6), o chão é fixo e plano. Se não, acompanha as dunas.
                    playerInsideBase = Math.hypot(finalX - 0, finalZ - (-30)) < (habRadius - 0.2);

                    controls.getObject().position.y = getGroundY(finalX, finalZ) + 1.75;

                    // Interações de contexto: porta, cama ou jipe — a mais próxima dentro do alcance "ganha" a tecla [E]
                    const distToDoor = Math.hypot(finalX - doorWorldX, finalZ - doorWorldZ);
                    const distToBed = Math.hypot(finalX - bedWorldX, finalZ - bedWorldZ);
                    const distToJeep = Math.hypot(finalX - jeepGroup.position.x, finalZ - jeepGroup.position.z);
                    const candidates = [];
                    if (distToDoor < doorPromptRange) candidates.push({ type: 'door', dist: distToDoor });
                    if (distToBed < bedPromptRange) candidates.push({ type: 'bed', dist: distToBed });
                    if (distToJeep < jeepPromptRange) candidates.push({ type: 'jeep', dist: distToJeep });
                    candidates.sort((a, b) => a.dist - b.dist);
                    currentInteraction = candidates.length > 0 ? candidates[0].type : null;

                    if (currentInteraction === 'door') {
                        interactPromptEl.textContent = isDoorOpen ? 'Pressione [ E ] para fechar a porta' : 'Pressione [ E ] para abrir a porta';
                        interactPromptEl.classList.add('visible');
                    } else if (currentInteraction === 'bed') {
                        interactPromptEl.textContent = isNightNow ? 'Pressione [ E ] para dormir até o amanhecer' : 'Só dá pra dormir à noite';
                        interactPromptEl.classList.add('visible');
                    } else if (currentInteraction === 'jeep') {
                        interactPromptEl.textContent = 'Pressione [ E ] para entrar no jipe';
                        interactPromptEl.classList.add('visible');
                    } else {
                        interactPromptEl.classList.remove('visible');
                    }

                    // Áudio e Pegadas (só faz pegadas se estiver do lado de fora)
                    if (Math.abs(velocity.x) > 1 || Math.abs(velocity.z) > 1) {
                        walkDist += Math.sqrt(velocity.x**2 + velocity.z**2) * delta;
                        if (walkDist > 1.2) { 
                            if (!playerInsideBase) addFootprint(finalX, finalZ, camera.rotation.y);
                            playStepSound(); walkDist = 0; 
                        }
                    }
                }

                // Bandeiras: balançam suavemente ao vento
                flags.forEach(f => { f.cloth.rotation.y = Math.sin(time * 0.002 + f.phase) * 0.18; });

                // Minimapa: funciona tanto a pé quanto dirigindo, sempre relativo à posição atual da câmera
                // O radar é redesenhado só algumas vezes por segundo (não a cada quadro): ele mexe com canvas 2D,
                // emojis e texto do DOM, o que pesa bastante no celular e não precisa de 60 atualizações por segundo.
                minimapTimer -= delta;
                if (minimapTimer <= 0) {
                minimapTimer = 1 / Q.minimapFps;
                const camX = camera.position.x, camZ = camera.position.z;

                // Medidor de coordenadas: mesmo sistema X/Z usado pelos pontos turísticos no telão,
                // então o jogador pode comparar sua posição atual com a coordenada de cada marco.
                coordHud.textContent = `📍 X: ${Math.round(camX)}   Z: ${Math.round(camZ)}`;
                // Usa a direção real da câmera (getWorldDirection) em vez de camera.rotation.y:
                // o PointerLockControls gira a câmera em ordem YXZ, mas rotation.y é lido em XYZ,
                // então olhar pra cima/baixo "contaminava" o valor e o minimapa girava errado.
                camera.getWorldDirection(camForward);
                const headingDeg = THREE.MathUtils.radToDeg(Math.atan2(-camForward.x, -camForward.z));
                const dxBase = doorWorldX - camX, dzBase = doorWorldZ - camZ;
                const baseBearingDeg = THREE.MathUtils.radToDeg(Math.atan2(-dxBase, -dzBase));
                const baseDist = Math.hypot(dxBase, dzBase);
                const flagMarkers = flags.map(f => {
                    const dx = f.x - camX, dz = f.z - camZ;
                    return { bearingDeg: THREE.MathUtils.radToDeg(Math.atan2(-dx, -dz)), dist: Math.hypot(dx, dz), name: f.name };
                });
                const dxJeep = jeepGroup.position.x - camX, dzJeep = jeepGroup.position.z - camZ;
                const jeepBearingDeg = THREE.MathUtils.radToDeg(Math.atan2(-dxJeep, -dzJeep));
                const jeepDist = Math.hypot(dxJeep, dzJeep);
                const landmarkMarkers = MARS_LANDMARKS.map(lm => {
                    const dx = lm.x - camX, dz = lm.z - camZ;
                    return { bearingDeg: THREE.MathUtils.radToDeg(Math.atan2(-dx, -dz)), dist: Math.hypot(dx, dz), name: lm.name, icon: lm.icon };
                });
                drawMinimap(headingDeg, baseBearingDeg, baseDist, flagMarkers, jeepBearingDeg, jeepDist, isDriving, landmarkMarkers);
                }
            }

            // Atualiza o painel do supercomputador (a cada ~0.5s, ou mais rápido durante alerta pra piscar)
            panelRedrawTimer -= delta;
            if (panelRedrawTimer <= 0) {
                panelRedrawTimer = stormActive ? 0.2 : 0.5;
                const totalHours = (((dayTime % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 24;
                const hh = Math.floor(totalHours).toString().padStart(2, '0');
                const mm = Math.floor((totalHours % 1) * 60).toString().padStart(2, '0');
                drawStationPanel(`${hh}:${mm}`, energyLevel, stormLevel, stormActive, `SOL ${solDay} — ${isNightNow ? 'NOITE MARCIANA' : 'DIA MARCIANO'}`);
            }

            // Luz do telão pisca em vermelho durante alerta de tempestade
            if (stormActive) {
                const pulse = (Math.sin(time * 0.01) + 1) / 2;
                scLight.color.setHex(0xff5a4a); scLight.intensity = 1.4 + pulse * 1.6;
            } else {
                scLight.color.setHex(0x66ffd6); scLight.intensity = 2.0;
            }

            // Impressora 3D: a peça vai "crescendo" em ciclos, com o cabeçote acompanhando o topo
            printProgress += delta * 0.13;
            if (printProgress > 1) {
                printProgress = 0;
                printObjectMat.color.setHex([0xff8a3d, 0x3dc6ff, 0x8aff6a, 0xffd23d][Math.floor(Math.random() * 4)]);
            }
            const printHeightNow = 0.02 + printProgress * 0.5;
            printObject.scale.y = printHeightNow / 0.01;
            printObject.position.y = printerBaseY + printHeightNow / 2;
            printHead.position.y = printerBaseY + printHeightNow + 0.06;

            // Painel elétrico: LEDs piscam aleatoriamente, tipo um rack de servidores
            ledBlinkTimer -= delta;
            if (ledBlinkTimer <= 0) {
                ledBlinkTimer = 0.12;
                for (let i = 0; i < 3; i++) {
                    const led = ledMats[Math.floor(Math.random() * ledMats.length)];
                    const on = Math.random() > 0.25;
                    led.emissive.setHex(on ? (Math.random() > 0.85 ? 0xff3322 : 0x22ff44) : 0x113311);
                    led.emissiveIntensity = on ? (0.9 + Math.random() * 0.6) : 0.15;
                }
            }

            renderer.render(scene, camera);
        }

        function handleViewportResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
        window.addEventListener('resize', handleViewportResize);
        // Em celulares, orientationchange dispara antes do navegador atualizar innerWidth/innerHeight
        // corretamente — um pequeno atraso garante que o resize pegue as dimensões já rotacionadas.
        window.addEventListener('orientationchange', () => setTimeout(handleViewportResize, 300));

        // Ligar a lanterna muda o número de luzes da cena, e o Three.js recompilaria TODOS os shaders na hora do
        // clique (travada de centenas de ms, no celular passa de 1 s). Compilamos as duas variações aqui,
        // enquanto o jogador ainda está no menu.
        try {
            const flashWas = flashlight.visible;
            flashlight.visible = true;
            renderer.compile(scene, camera);
            flashlight.visible = flashWas;
        } catch (err) { console.warn('Pré-compilação de shaders ignorada:', err); }

        animate();