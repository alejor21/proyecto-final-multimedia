import * as THREE from 'three'
import Environment from './Environment.js'
import Fox from './Fox.js'
import Robot from './Robot.js'
import ToyCarLoader from '../../loaders/ToyCarLoader.js'
import Floor from './Floor.js'
import ThirdPersonCamera from './ThirdPersonCamera.js'
import Sound from './Sound.js'
import MobileControls from '../../controls/MobileControls.js'
import LevelManager from './LevelManager.js'
import BlockPrefab from './BlockPrefab.js'
import Enemy from './Enemy.js'

export default class World {
  constructor(experience) {
    this.experience = experience
    this.scene = this.experience.scene
    this.blockPrefab = new BlockPrefab(this.experience)
    this.resources = this.experience.resources
    this.levelManager = new LevelManager(this.experience)

    this.currentLevel = 1
    this.gameStarted  = true
    this.enemies = []
    this.portal  = null
    this._lastSpawn = null

    this.levelBounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 }

    this.coinSound   = new Sound('/sounds/coin.ogg')
    this.portalSound = new Sound('/sounds/portal.mp3')

    this.allowPrizePickup = false
    setTimeout(() => { this.allowPrizePickup = true }, 1000)

    this.points = 0
    this.totalDefaultCoins = 0
    this.customCoins = []

    this.resources.on('ready', async () => {
      this.loader = new ToyCarLoader(this.experience)

      this.fox = new Fox(this.experience)
      this.robot = new Robot(this.experience)

      this.experience.vr.bindCharacter(this.robot)
      this.thirdPersonCamera = new ThirdPersonCamera(this.experience, this.robot.group)

      this.mobileControls = new MobileControls({
        onUp:    v => { this.experience.keyboard.keys.up    = v },
        onDown:  v => { this.experience.keyboard.keys.down  = v },
        onLeft:  v => { this.experience.keyboard.keys.left  = v },
        onRight: v => { this.experience.keyboard.keys.right = v }
      })

      if (!this.experience.physics?.world) return
      this.experience.renderer.instance.xr.addEventListener('sessionstart', () => this._checkVRMode())

      await this.loadLevel(1)
    })
  }

  /* ---------- HUD ---------- */
  _updateHUDPoints() {
    try {
      if (this.experience?.updateCoinCount) this.experience.updateCoinCount(this.points)
      if (this.experience?.menu?.setStatus) this.experience.menu.setStatus(`🎖️ Puntos: ${this.points}`)
      // Por si tu HUD escucha eventos:
      window.dispatchEvent(new CustomEvent('game:points', { detail: { points: this.points }}))
    } catch { /* no-op */ }
  }

  /* ---------- Límites / spawn ---------- */
  _computeLevelBounds(blocks = []) {
    const pts = []
    for (const b of blocks) {
      if (b?.position && Array.isArray(b.position)) {
        const [x,,z] = b.position
        pts.push({ x, z })
      }
    }
    if (!pts.length) return
    const pad = 6
    const minX = Math.min(...pts.map(p => p.x)) - pad
    const maxX = Math.max(...pts.map(p => p.x)) + pad
    const minZ = Math.min(...pts.map(p => p.z)) - pad
    const maxZ = Math.max(...pts.map(p => p.z)) + pad
    this.levelBounds = { minX, maxX, minZ, maxZ }
  }

  _clampXZ(x, z) {
    const b = this.levelBounds
    return {
      x: Math.max(b.minX, Math.min(b.maxX, x)),
      z: Math.max(b.minZ, Math.min(b.maxZ, z))
    }
  }

  _getSpawnFromData(data) {
    if (data?.spawnPoint) return data.spawnPoint
    const b = data?.blocks || []
    const s = b.find(x => x.role === 'spawn' || x.role === 'playerSpawn' || x.type === 'spawn')
    if (s?.position) {
      const [x, y, z] = s.position
      return { x, y: y ?? 0.9, z }
    }
    if (this._lastSpawn) return this._lastSpawn
    return { x: 0, y: 0.9, z: 0 }
  }

  /* ---------- Monedas genéricas (2) ---------- */
  _createGenericCoin(position) {
    const group = new THREE.Group()
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.26, 16, 56),
      new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffc300, emissiveIntensity: 1.0, metalness: 0.3, roughness: 0.25 })
    )
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.09, 28),
      new THREE.MeshStandardMaterial({ color: 0xf8e16a, emissive: 0xffd84a, emissiveIntensity: 0.6 })
    )
    disc.rotation.x = Math.PI / 2
    group.add(torus, disc)
    group.position.copy(position)
    group.userData.isCustomCoin = true
    this.scene.add(group)
    return group
  }

  _spawnGenericCoins(count, spawn, minR = 14, maxR = 26) {
    this.customCoins.forEach(c => { this.scene.remove(c.mesh) })
    this.customCoins = []
    const used = []
    const mkPos = () => {
      const a = Math.random() * Math.PI * 2
      const r = minR + Math.random() * (maxR - minR)
      let x = spawn.x + Math.cos(a) * r
      let z = spawn.z + Math.sin(a) * r
      const c = this._clampXZ(x, z)
      return new THREE.Vector3(c.x, 0.50, c.z)
    }

    for (let i = 0; i < count; i++) {
      let pos, tries = 0
      do { pos = mkPos(); tries++ } while (tries < 30 && used.some(p => p.distanceTo(pos) < 8))
      used.push(pos)
      const coinMesh = this._createGenericCoin(pos)
      this.customCoins.push({ mesh: coinMesh, collected: false })
    }
    this.points = 0
    this.totalDefaultCoins = count
    this._updateHUDPoints()
  }

  /* ---------- Enemigos ---------- */
  _clearEnemies() {
    this.enemies.forEach(e => e?.destroy?.())
    this.enemies = []
  }

  _getPlayerForward() {
    if (!this.robot?.group) return new THREE.Vector3(0,0,1)
    const fwd = new THREE.Vector3(0,0,-1)
    fwd.applyQuaternion(this.robot.group.quaternion)
    fwd.normalize()
    return fwd
  }

  spawnEnemiesBehind(spawn, count = 2, distMin = 26, distMax = 34) {
    this._clearEnemies()
    const y = 0.9
    const back = this._getPlayerForward().multiplyScalar(-1)
    for (let i = 0; i < count; i++) {
      const jitter = new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10)
      const dist = distMin + Math.random() * (distMax - distMin)
      let x = spawn.x + back.x * dist + jitter.x
      let z = spawn.z + back.z * dist + jitter.z
      const c = this._clampXZ(x, z)
      x = c.x; z = c.z
      const enemy = new Enemy({
        scene: this.scene,
        physicsWorld: this.experience.physics.world,
        playerRef: this.robot,
        position: new THREE.Vector3(x, y, z),
        experience: this.experience
      })
      enemy.baseSpeed = 0.55
      enemy.runSpeed  = 0.95
      enemy.delayActivation = 0.8 * (i + 1)
      this.enemies.push(enemy)
    }
  }

  /* ---------- Portal ---------- */
  _removePortal() {
    if (!this.portal) return
    this.scene.remove(this.portal)
    this.portal = null
  }

  createPortal(toLevel) {
    if (this.portal) return
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.35, 18, 72),
      new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.2 })
    )
    ring.name = 'ringPortal'
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, 0, 0)
    const light = new THREE.PointLight(0x00e5ff, 3, 16)
    light.position.set(0, 0, 0)

    this.portal = new THREE.Group()
    this.portal.add(ring, light)
    const bp = this.robot.body.position
    const desired = new THREE.Vector3(bp.x + 6, 1.0, bp.z + 6)
    const placed = this._findClearPortalSpot(desired)
    this.portal.position.copy(placed)
    this.portal.userData = { toLevel }
    this.scene.add(this.portal)
    if (window.userInteracted) this.portalSound.play()

    // Load GLB portal model
    try {
      const loader = this.experience?.resources?.loaders?.gltfLoader
      if (loader) {
        loader.load('/models/portal/portal.glb', (gltf) => {
          const mdl = gltf.scene
          mdl.name = 'glbPortal'
          mdl.position.set(0, 0, 0)
          mdl.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true } })
          mdl.scale.set(0.9, 0.9, 0.9)
          this.portal.add(mdl)
        }, undefined, (e) => { console.warn('No se pudo cargar portal.glb', e) })
      }
    } catch { /* no-op */ }
  }

  /* ---------- Update ---------- */
  update(delta) {
    this.fox?.update?.()
    this.robot?.update?.()
    this.blockPrefab?.update?.()

    if (this.enemies.length) {
      const dt = Math.min(0.05, delta)
      this.enemies.forEach(e => e.update(dt))

      if (this.robot?.isDead && !this.defeatTriggered) {
        this.defeatTriggered = true
        // el modal ya se muestra desde Robot.dieImmediate()
        return
      }
    }

    if (this.thirdPersonCamera && this.experience.isThirdPerson && !this.experience.renderer.instance.xr.isPresenting) {
      this.thirdPersonCamera.update()
    }

    if (!this.allowPrizePickup || !this.robot?.body) return

    // monedas genéricas
    for (const c of this.customCoins) {
      if (c.collected) continue
      c.mesh.rotation.y += delta * 2
      const d = c.mesh.position.distanceTo(new THREE.Vector3(
        this.robot.body.position.x, this.robot.body.position.y, this.robot.body.position.z
      ))
      if (d < 1.6) {
        c.collected = true
        this.scene.remove(c.mesh)
        if (window.userInteracted) this.coinSound.play()
        this.points += 1
        this.robot.points = this.points
        this._updateHUDPoints()
        if (this.points >= this.totalDefaultCoins && !this.portal) {
          this.createPortal(this.currentLevel + 1)
        }
      }
    }

    // teleport
    if (this.portal && this.robot?.body) {
      const ring = this.portal.getObjectByName('ringPortal')
      if (ring) ring.rotation.z += delta * 2
      const d = this.portal.position.distanceTo(new THREE.Vector3(
        this.robot.body.position.x, this.robot.body.position.y, this.robot.body.position.z
      ))
      if (d < 1.8) {
        const next = this.portal.userData.toLevel
        this._removePortal()
        this.levelManager?.nextLevel?.()
        this.loadLevel(next)
      }
    }
  }

  // Find a free spot near desired position within level bounds
  _findClearPortalSpot(desired) {
    const candidates = []
    const base = new THREE.Vector3(desired.x, 1.0, desired.z)
    const offsets = [
      [6, 6], [-6, 6], [6, -6], [-6, -6],
      [8, 0], [-8, 0], [0, 8], [0, -8],
      [10, 10], [-10, 10], [10, -10], [-10, -10]
    ]
    for (const [ox, oz] of offsets) {
      let x = base.x + ox
      let z = base.z + oz
      const c = this._clampXZ(x, z)
      candidates.push(new THREE.Vector3(c.x, 1.0, c.z))
    }

    const minDist = 3.5
    const isClear = (p) => {
      for (const obj of this.scene.children) {
        if (!obj?.userData?.levelObject) continue
        const pos = new THREE.Vector3()
        obj.getWorldPosition(pos)
        if (pos.distanceTo(p) < minDist) return false
      }
      return true
    }

    for (const c of candidates) {
      if (isClear(c)) return c
    }
    const cl = this._clampXZ(base.x, base.z)
    return new THREE.Vector3(cl.x, 1.0, cl.z)
  }

  /* ---------- Carga de nivel ---------- */
  async loadLevel(level) {
    console.log(`Cargando nivel ${level}...`);
    try {
      this.clearCurrentScene() // Limpiar la escena antes de cargar el nuevo nivel

      // Destruir y recrear el suelo y el entorno
      if (this.floor) {
          this.floor.destroy();
      }
      this.floor = new Floor(this.experience);

      if (this.environment) {
          this.environment.destroy();
      }
      this.environment = new Environment(this.experience);

      this.currentLevel = level
      this.defeatTriggered = false
      this._removePortal()
      this._clearEnemies()
      this.customCoins.forEach(c => this.scene.remove(c.mesh))
      this.customCoins = []

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
      const apiUrl = `${backendUrl}/api/blocks?level=${level}`
      let apiBlocks = []
      // 1) Intentar API (puede venir incompleta)
      try {
        const res = await fetch(apiUrl)
        if (!res.ok) throw new Error('API')
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('application/json')) throw new Error('No JSON')
        const payload = await res.json()
        apiBlocks = Array.isArray(payload?.blocks) ? payload.blocks : (Array.isArray(payload) ? payload : [])
      } catch { /* no-op: seguimos con local */ }

      // 2) Local siempre: usamos para rellenar faltantes
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      const localUrl = `${base}/data/toy_car_blocks.json`
      const localRes = await fetch(localUrl)
      if (!localRes.ok) throw new Error('Local')
      const ct = localRes.headers.get('content-type') || ''
      if (!ct.includes('application/json')) throw new Error('Local No JSON')
      const all = await localRes.json()
      const localBlocks = all.filter(b => b.level == level || (Array.isArray(b.level) && b.level.includes(level)))

      // 3) Merge: API (si hay) sobre LOCAL, y LOCAL agrega lo que falte
      const byName = new Map()
      for (const b of apiBlocks) if (b?.name) byName.set(b.name, b)
      for (const b of localBlocks) if (b?.name && !byName.has(b.name)) byName.set(b.name, b)
      const merged = Array.from(byName.values())
      if (!merged.length) throw new Error('No blocks for level')
      const data = { blocks: merged }
      console.log(`Level ${level}: API ${apiBlocks.length} + Local ${localBlocks.length} -> Merged ${merged.length}`)

      this._computeLevelBounds(data.blocks)

      if (data.blocks) {
        const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
        const preciseUrl = `${base}/config/precisePhysicsModels.json`
        const preciseRes = await fetch(preciseUrl)
        const preciseModels = await preciseRes.json()
        await this.loader._processBlocks(data.blocks, preciseModels, level)

        // Pre-cargar bloques de siguientes niveles en background (para transición instantánea)
        this._preloadUpcomingLevels(level).catch(() => {})
      } else {
        await this.loader.loadFromURL(apiUrl)
      }

      let spawnPoint = this._getSpawnFromData(data)
      const cl = this._clampXZ(spawnPoint.x, spawnPoint.z)
      spawnPoint = { x: cl.x, y: 0.9, z: cl.z }
      this._lastSpawn = spawnPoint

      // Per-level coins/enemies
      let coinCount = 2, enemyCount = 2
      if (level === 2) { coinCount = 5; enemyCount = 4 }
      else if (level === 3) { coinCount = 10; enemyCount = 8 }

      this._spawnGenericCoins(coinCount, spawnPoint, 14, 26)
      this.resetRobotPosition(spawnPoint)
      this.spawnEnemiesBehind(spawnPoint, enemyCount, 26, 34)
    } catch (e) {
      console.error('❌ Error cargando nivel:', e)
    }
  }

  // Pre-carga de modelos de los siguientes niveles (sin instanciarlos)
  async _preloadUpcomingLevels(current) {
    const nextLevels = [current + 1, current + 2].filter(l => l <= 3) // hasta nivel 3
    if (!nextLevels.length) return

    try {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      const localUrl = `${base}/data/toy_car_blocks.json`
      const res = await fetch(localUrl)
      if (!res.ok) return
      const all = await res.json()

      const byLevelNames = nextLevels.flatMap(l =>
        all.filter(b => b.level == l || (Array.isArray(b.level) && b.level.includes(l))).map(b => b.name)
      )
      await this.loader._preloadModels(byLevelNames, 10)
      console.log(`Pre-cargados modelos de niveles ${nextLevels.join(', ')}`)
    } catch { /* no-op */ }
  }

  /* ---------- Limpieza / util ---------- */
  _clearEnemies() {
    this.enemies.forEach(e => e?.destroy?.())
    this.enemies = []
  }

  clearCurrentScene() {
    this._removePortal()
    this._clearEnemies()
    this.customCoins.forEach(c => this.scene.remove(c.mesh))
    this.customCoins = []
    const toRemove = []
    this.scene.children.forEach(c => { if (c.userData?.levelObject) toRemove.push(c) })
    toRemove.forEach(c => {
      if (c.geometry) c.geometry.dispose()
      if (c.material) Array.isArray(c.material) ? c.material.forEach(m => m.dispose()) : c.material.dispose()
      this.scene.remove(c)
      if (c.userData?.physicsBody) this.experience.physics.world.removeBody(c.userData.physicsBody)
    })
  }

  resetRobotPosition(spawn) {
    if (!this.robot?.body || !this.robot?.group || !spawn) return
    this.robot.body.position.set(spawn.x, this.robot.bodyY, spawn.z)
    this.robot.body.velocity.set(0, 0, 0)
    this.robot.body.angularVelocity.set(0, 0, 0)
    this.robot.body.quaternion.setFromEuler(0, 0, 0)
    this.robot.group.position.set(spawn.x, this.robot.visualY, spawn.z)
    this.robot.group.rotation.set(0, 0, 0)
    this.robot.reset(spawn) 
    this.points = 0
    this.robot.points = 0
    this._updateHUDPoints()
  }

  _checkVRMode() {
    const isVR = this.experience.renderer.instance.xr.isPresenting
    if (isVR) {
      if (this.robot?.group) this.robot.group.visible = false
      this.experience.camera.instance.position.set(5, 1.6, 5)
      this.experience.camera.instance.lookAt(new THREE.Vector3(5, 1.6, 4))
    } else {
      if (this.robot?.group) this.robot.group.visible = true
    }
  }
}
