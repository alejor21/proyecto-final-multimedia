import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createBoxShapeFromModel, createTrimeshShapeFromModel } from '../Experience/Utils/PhysicsShapeFactory.js';
import Prize from '../Experience/World/Prize.js';

// Collision groups (mantener consistentes con Robot/Enemy)
const GROUP_PLAYER = 1 << 0;
const GROUP_ENEMY  = 1 << 1;

export default class ToyCarLoader {
    constructor(experience) {
        this.experience = experience;
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.physics = this.experience.physics;
        this.prizes = [];
    }

    // Carga perezosa de modelos GLB por nombre y cachea en resources
    _getModelGLB(name) {
        const cached = this.resources.items[name];
        if (cached) return Promise.resolve(cached);
        const loader = this.resources.loaders.gltfLoader;
        const url = `/models/toycar/${name}.glb`;
        return new Promise((resolve, reject) => {
            loader.load(url, (gltf) => {
                this.resources.items[name] = gltf;
                resolve(gltf);
            }, undefined, (err) => {
                console.warn(`No se pudo cargar GLB: ${name} desde ${url}`);
                reject(err);
            });
        });
    }

    // Pre-carga en paralelo con límite de concurrencia
    async _preloadModels(names, concurrency = 8) {
        const unique = Array.from(new Set(names.filter(Boolean)));
        if (!unique.length) return;

        const queue = unique.slice();
        const workers = new Array(Math.min(concurrency, queue.length)).fill(0).map(async () => {
            while (queue.length) {
                const next = queue.shift();
                try { await this._getModelGLB(next) } catch { /* no-op */ }
            }
        });
        await Promise.all(workers);
    }

    // ✅ SOLO PARA NIVEL 1: Determina si el objeto necesita centrado en XZ
    _needsCenterAlignment(name, level) {
        // SOLO aplicar en nivel 1
        if (level !== 1) return false;
        
        const n = String(name || '').toLowerCase();
        return n.startsWith('track-') || 
               n.includes('road') || 
               n.includes('street') ||
               n.startsWith('plasticbarrier');
    }

    // ✅ SOLO PARA NIVEL 1: Determina si el objeto necesita alinearse con el suelo
    _needsGroundAlignment(name, level) {
        // SOLO aplicar en nivel 1
        if (level !== 1) return false;
        
        const n = String(name || '').toLowerCase();
        return n.includes('wheel') || 
               n.includes('tire') ||
               n.startsWith('frontwheel') ||
               n.startsWith('backwheels') ||
               n.includes('car') ||
               n.includes('vehicle');
    }

    _applyTextureToMeshes(root, imagePath, matcher, options = {}) {
        // Pre-chequeo: buscar meshes objetivo antes de cargar la textura
        const matchedMeshes = [];
        root.traverse((child) => {
            if (child.isMesh && (!matcher || matcher(child))) {
                matchedMeshes.push(child);
            }
        });

        if (matchedMeshes.length === 0) {
            return;
        }

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            imagePath,
            (texture) => {
                if ('colorSpace' in texture) {
                    texture.colorSpace = THREE.SRGBColorSpace;
                } else {
                    texture.encoding = THREE.sRGBEncoding;
                }
                texture.flipY = false;
                const wrapS = options.wrapS || THREE.ClampToEdgeWrapping;
                const wrapT = options.wrapT || THREE.ClampToEdgeWrapping;
                texture.wrapS = wrapS;
                texture.wrapT = wrapT;
                const maxAniso = this.experience?.renderer?.instance?.capabilities?.getMaxAnisotropy?.();
                if (typeof maxAniso === 'number' && maxAniso > 0) {
                    texture.anisotropy = maxAniso;
                }
                const center = options.center || { x: 0.5, y: 0.5 };
                texture.center.set(center.x, center.y);
                if (typeof options.rotation === 'number') {
                    texture.rotation = options.rotation;
                }
                if (options.repeat) {
                    texture.repeat.set(options.repeat.x || 1, options.repeat.y || 1);
                }
                // Espejado opcional
                if (options.mirrorX) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.repeat.x = -Math.abs(texture.repeat.x || 1);
                    texture.offset.x = 1;
                }
                if (options.mirrorY) {
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.y = -Math.abs(texture.repeat.y || 1);
                    texture.offset.y = 1;
                }
                if (options.offset) {
                    texture.offset.set(
                        options.offset.x ?? texture.offset.x,
                        options.offset.y ?? texture.offset.y
                    );
                }
                texture.needsUpdate = true;

                let applied = 0;
                matchedMeshes.forEach((child) => {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => {
                            mat.map = texture;
                            mat.needsUpdate = true;
                        });
                    } else if (child.material) {
                        child.material.map = texture;
                        child.material.needsUpdate = true;
                    } else {
                        child.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
                    }
                    applied++;
                });

                if (applied > 0) {
                    console.log(`🖼️ Textura aplicada (${imagePath}) a ${applied} mesh(es)`);
                }
            },
            undefined,
            (err) => {
                console.error('❌ Error cargando textura', imagePath, err);
            }
        );
    }

    async loadFromAPI() {
        try {
            const listRes = await fetch('/config/precisePhysicsModels.json');
            const precisePhysicsModels = await listRes.json();

            let blocks = [];

            try {
                const apiUrl = import.meta.env.VITE_API_URL + '/api/blocks';
                const res = await fetch(apiUrl);

                if (!res.ok) throw new Error('Conexión fallida');

                blocks = await res.json();
                console.log('✅ Datos cargados desde la API:', blocks.length);
            } catch (apiError) {
                console.warn('⚠️ No se pudo conectar con la API. Cargando desde archivo local...');
                const localRes = await fetch('/data/toy_car_blocks.json');
                const allBlocks = await localRes.json();

                // 🔍 Filtrar solo nivel 1
                blocks = allBlocks.filter(b => b.level === 1);
                console.log(`✅ Datos cargados desde archivo local (nivel 1): ${blocks.length}`);
            }

            await this._processBlocks(blocks, precisePhysicsModels);
        } catch (err) {
            console.error('❌ Error al cargar bloques o lista Trimesh:', err);
        }
    }

    async loadFromURL(apiUrl) {
        try {
            const listRes = await fetch('/config/precisePhysicsModels.json');
            const precisePhysicsModels = await listRes.json();

            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error('Conexión fallida al cargar bloques de nivel.');

            const blocks = await res.json();
            console.log(`📦 Bloques cargados (${blocks.length}) desde ${apiUrl}`);

            await this._processBlocks(blocks, precisePhysicsModels);
        } catch (err) {
            console.error('❌ Error al cargar bloques desde URL:', err);
        }
    }

    async _processBlocks(blocks, precisePhysicsModels, levelCtx = null) {
        // Cargar escalas por nivel (una vez)
        if (!this._levelScales) {
            try {
                const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
                const scaleUrl = `${base}/config/levelScales.json`;
                const res = await fetch(scaleUrl);
                this._levelScales = res.ok ? await res.json() : {};
            } catch { 
                this._levelScales = {}; 
            }
        }

        // 1) Pre-cargar todos los modelos del nivel en paralelo
        const names = blocks.map(b => b.name);
        await this._preloadModels(names, 10);

        console.log(`🔄 Procesando ${blocks.length} bloques...`);
        let success = 0;
        let skipped = 0;

        // 2) Instanciar y crear físicas
        for (const block of blocks) {
            if (!block.name) {
                console.warn('⚠️ Bloque sin nombre:', block);
                skipped++;
                continue;
            }

            // Determinar nivel del bloque
            const lvl = (levelCtx != null) 
                ? levelCtx 
                : (Array.isArray(block.level) ? Number(block.level[0]) : Number(block.level));

            const resourceKey = block.name;
            let glb = this.resources.items[resourceKey];
            if (!glb) {
                try {
                    glb = await this._getModelGLB(resourceKey);
                } catch (e) {
                    console.warn(`❌ Modelo no encontrado: ${resourceKey}`);
                    skipped++;
                    continue;
                }
            }

            const model = glb.scene.clone();
            model.userData.levelObject = true;

            // Eliminar cámaras y luces embebidas
            model.traverse((child) => {
                if (child.isCamera || child.isLight) {
                    child.parent.remove(child);
                }
            });

            // Obtener posición del bloque
            const hasArrayPos = Array.isArray(block.position) && block.position.length >= 3;
            const px = hasArrayPos ? Number(block.position[0]) : Number(block.x || 0);
            const py = hasArrayPos ? Number(block.position[1]) : Number(block.y || 0);
            const pz = hasArrayPos ? Number(block.position[2]) : Number(block.z || 0);

            // ✅ LÓGICA SEPARADA POR NIVEL
            if (lvl === 1) {
                // ========== NIVEL 1: LÓGICA ORIGINAL INTACTA ==========
                const bbox = new THREE.Box3().setFromObject(model);
                const center = new THREE.Vector3();
                const size = new THREE.Vector3();
                bbox.getCenter(center);
                bbox.getSize(size);

                const needsCentering = this._needsCenterAlignment(block.name, lvl);
                const needsGroundAlign = this._needsGroundAlignment(block.name, lvl);

                if (needsCentering) {
                    model.position.set(-center.x, model.position.y, -center.z);
                }

                if (needsGroundAlign) {
                    model.position.y -= bbox.min.y;
                }

                model.updateMatrixWorld(true);

                // Aplicar texturas
                this._applyTextureToMeshes(
                    model,
                    '/textures/ima1.jpg',
                    (child) => child.name === 'Cylinder001' || 
                              (child.name && child.name.toLowerCase().includes('cylinder')),
                    { rotation: -Math.PI / 2, center: { x: 0.5, y: 0.5 }, mirrorX: true }
                );

                // Modelos baked
                if (block.name.includes('baked')) {
                    const bakedTexture = new THREE.TextureLoader().load('/textures/baked.jpg');
                    bakedTexture.flipY = false;
                    if ('colorSpace' in bakedTexture) {
                        bakedTexture.colorSpace = THREE.SRGBColorSpace;
                    } else {
                        bakedTexture.encoding = THREE.sRGBEncoding;
                    }

                    model.traverse(child => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshBasicMaterial({ map: bakedTexture });
                            child.material.needsUpdate = true;

                            if (child.name.toLowerCase().includes('portal')) {
                                this.experience.time.on('tick', () => {
                                    child.rotation.y += 0.01;
                                });
                            }
                        }
                    });
                }

                // Premios
                const role = (block.role || '').toLowerCase();
                const looksLikeCoin = block.name.toLowerCase().startsWith('coin');
                const isCollectible = role === 'collectible' || role === 'prize' || role === 'coin';
                
                if (isCollectible) {
                    const prize = new Prize({
                        model,
                        position: new THREE.Vector3(px, py + 0.25, pz),
                        scene: this.scene,
                        role: block.role || "collectible"
                    });

                    prize.model.userData.levelObject = true;
                    prize.pivot.userData.levelObject = true;
                    this.prizes.push(prize);
                    success++;
                    continue;
                } else if (looksLikeCoin) {
                    console.log(`Omitiendo moneda decorativa: ${block.name}`);
                    skipped++;
                    continue;
                }

                // Lógica de contenedor/escala nivel 1
                const lvlKey = String(lvl);
                const scale = (this._levelScales && (this._levelScales[lvlKey] ?? this._levelScales[lvl])) || 1;
                const needsTileAlign = this._needsCenterAlignment(block.name, lvl);

                if (needsTileAlign) {
                    const container = new THREE.Group();
                    container.userData.levelObject = true;
                    container.position.set(px, py, pz);
                    if (typeof scale === 'number' && isFinite(scale) && scale !== 1) {
                        container.scale.setScalar(scale);
                    }

                    const bboxM = new THREE.Box3().setFromObject(model);
                    const centerM = new THREE.Vector3(); 
                    bboxM.getCenter(centerM);
                    const minM = bboxM.min.clone();
                    model.position.sub(new THREE.Vector3(centerM.x, minM.y, centerM.z));
                    container.add(model);
                    this.scene.add(container);
                    container.updateMatrixWorld(true);

                    // Físicas desde contenedor
                    let shapeC; 
                    let physicsPositionC = new THREE.Vector3();
                    if (precisePhysicsModels.includes(block.name)) {
                        shapeC = createTrimeshShapeFromModel(container);
                        if (!shapeC) { 
                            console.warn(`⚠️ No se pudo crear Trimesh para ${block.name}`); 
                            skipped++;
                            continue; 
                        }
                        physicsPositionC.set(0, 0, 0);
                    } else {
                        shapeC = createBoxShapeFromModel(container, 0.9);
                        const bboxC = new THREE.Box3().setFromObject(container);
                        bboxC.getCenter(physicsPositionC);
                    }
                    const bodyC = new CANNON.Body({
                        mass: 0,
                        shape: shapeC,
                        position: new CANNON.Vec3(physicsPositionC.x, physicsPositionC.y, physicsPositionC.z),
                        material: this.physics.obstacleMaterial
                    });
                    bodyC.userData = { levelObject: true };
                    container.userData.physicsBody = bodyC;
                    bodyC.userData.linkedModel = container;
                    bodyC.collisionFilterGroup = bodyC.collisionFilterGroup || 1;
                    bodyC.collisionFilterMask = (typeof bodyC.collisionFilterMask === 'number' ? bodyC.collisionFilterMask : 0xFFFFFFFF) & ~GROUP_ENEMY;
                    this.physics.world.addBody(bodyC);
                    success++;
                    continue;
                } else {
                    if (typeof scale === 'number' && isFinite(scale) && scale !== 1) {
                        model.scale.setScalar(scale);
                    }
                }

                model.position.set(px, py, pz);
                this.scene.add(model);
                model.updateMatrixWorld(true);

                // Físicas nivel 1
                let shape;
                let physicsPosition = new THREE.Vector3();

                if (precisePhysicsModels.includes(block.name)) {
                    shape = createTrimeshShapeFromModel(model);
                    if (!shape) {
                        console.warn(`⚠️ No se pudo crear Trimesh para ${block.name}`);
                        skipped++;
                        continue;
                    }
                    physicsPosition.copy(model.position);
                } else {
                    shape = createBoxShapeFromModel(model, 0.9);
                    const physBbox = new THREE.Box3().setFromObject(model);
                    physBbox.getCenter(physicsPosition);
                }

                const body = new CANNON.Body({
                    mass: 0,
                    shape: shape,
                    position: new CANNON.Vec3(physicsPosition.x, physicsPosition.y, physicsPosition.z),
                    material: this.physics.obstacleMaterial
                });

                body.userData = { levelObject: true };
                model.userData.physicsBody = body;
                body.userData.linkedModel = model;
                body.collisionFilterGroup = body.collisionFilterGroup || 1;
                body.collisionFilterMask = (typeof body.collisionFilterMask === 'number' 
                    ? body.collisionFilterMask 
                    : 0xFFFFFFFF) & ~GROUP_ENEMY;
                
                this.physics.world.addBody(body);
                success++;

            } else if (lvl === 2) {
                // ========== NIVEL 2: CARGA DIRECTA SIN MODIFICACIONES ==========
                
                model.position.set(px, py, pz);
                this.scene.add(model);
                model.updateMatrixWorld(true);

                // Físicas simples
                let shape;
                let physicsPosition = new THREE.Vector3();

                if (precisePhysicsModels.includes(block.name)) {
                    shape = createTrimeshShapeFromModel(model);
                    if (!shape) {
                        console.warn(`⚠️ No se pudo crear Trimesh para ${block.name}`);
                        skipped++;
                        continue;
                    }
                    physicsPosition.set(px, py, pz);
                } else {
                    shape = createBoxShapeFromModel(model, 0.95);
                    const physBbox = new THREE.Box3().setFromObject(model);
                    physBbox.getCenter(physicsPosition);
                }

                const body = new CANNON.Body({
                    mass: 0,
                    shape: shape,
                    position: new CANNON.Vec3(physicsPosition.x, physicsPosition.y, physicsPosition.z),
                    material: this.physics.obstacleMaterial
                });

                body.userData = { levelObject: true };
                model.userData.physicsBody = body;
                body.userData.linkedModel = model;
                body.collisionFilterGroup = 1;
                body.collisionFilterMask = 0xFFFFFFFF & ~GROUP_ENEMY;
                
                this.physics.world.addBody(body);
                success++;

            } else if (lvl === 3) {
                // ========== NIVEL 3: COMPACTACIÓN PARA ACERCAR ELEMENTOS ==========
                
                // ✅ Factor de compactación: ajusta este valor según necesites
                const LEVEL_3_SCALE = 0.5; // 0.5 = 50%, 0.4 = 40%, 0.6 = 60%
                
                // Aplicar escala a las posiciones
                const finalPx = px * LEVEL_3_SCALE;
                const finalPy = py * LEVEL_3_SCALE;
                const finalPz = pz * LEVEL_3_SCALE;
                
                // Escalar el modelo también
                model.scale.setScalar(LEVEL_3_SCALE);
                model.position.set(finalPx, finalPy, finalPz);
                this.scene.add(model);
                model.updateMatrixWorld(true);

                // Físicas escaladas
                let shape;
                let physicsPosition = new THREE.Vector3();

                if (precisePhysicsModels.includes(block.name)) {
                    shape = createTrimeshShapeFromModel(model);
                    if (!shape) {
                        console.warn(`⚠️ No se pudo crear Trimesh para ${block.name}`);
                        skipped++;
                        continue;
                    }
                    physicsPosition.set(finalPx, finalPy, finalPz);
                } else {
                    shape = createBoxShapeFromModel(model, 0.95);
                    const physBbox = new THREE.Box3().setFromObject(model);
                    physBbox.getCenter(physicsPosition);
                }

                const body = new CANNON.Body({
                    mass: 0,
                    shape: shape,
                    position: new CANNON.Vec3(physicsPosition.x, physicsPosition.y, physicsPosition.z),
                    material: this.physics.obstacleMaterial
                });

                body.userData = { levelObject: true };
                model.userData.physicsBody = body;
                body.userData.linkedModel = model;
                body.collisionFilterGroup = 1;
                body.collisionFilterMask = 0xFFFFFFFF & ~GROUP_ENEMY;
                
                this.physics.world.addBody(body);
                success++;
            }
        }

        console.log(`✅ Carga completa: ${success} cargados, ${skipped} omitidos`);
    }
}
