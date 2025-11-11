import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import Sound from './Sound.js'

const GROUP_PLAYER = 1 << 0
const GROUP_ENEMY  = 1 << 1

export default class Enemy {
  constructor({ scene, physicsWorld, playerRef, position, experience }) {
    this.experience   = experience
    this.scene        = scene
    this.physicsWorld = physicsWorld
    this.playerRef    = playerRef
    this.resources    = this.experience.resources

    this.baseSpeed = 0.65
    this.runSpeed  = 1.10
    this.speed     = this.baseSpeed

    this.bodyY   = 0.9
    this.visualY = 0.0

    this.maxChaseDistance = 30
    this.activationRadius  = 4
    this.killRadius        = 1.8
    this.delayActivation   = 0
    this._killSent         = false

    this.proximitySound = new Sound('/sounds/alert.ogg', { loop: true, volume: 0 })
    this.proximitySound.play()

    this.setModel(position)
    this.setPhysics(position)
    this.setAnimation()
    this._bindCollision()
  }

  setModel(position) {
    const src = this.resources.items.enemyModel
    if (!src) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      )
      m.position.copy(position)
      this.model = m
      this.scene.add(this.model)
      return
    }
    const cloned = skeletonClone(src.scene)
    cloned.scale.setScalar(0.5)
    cloned.position.copy(position)
    cloned.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false } })
    this.model = cloned
    this.scene.add(this.model)
  }

  setPhysics(position) {
    const shape = new CANNON.Sphere(0.5)
    this.body = new CANNON.Body({
      mass: 4.5,
      shape,
      position: new CANNON.Vec3(position.x, this.bodyY, position.z),
      linearDamping: 0.55,
      angularDamping: 0.98
    })
    this.body.collisionFilterGroup = GROUP_ENEMY
    this.body.collisionFilterMask  = GROUP_PLAYER

    this.body.sleepSpeedLimit = 0
    this.body.wakeUp()
    this.physicsWorld.addBody(this.body)
    this.model.userData.physicsBody = this.body
  }

  _animRoot(clips) {
    if (!clips || !clips.length) return this.model
    const t = clips[0].tracks && clips[0].tracks[0]
    const path = t && t.name ? t.name.split('.')[0] : null
    const found = path ? this.model.getObjectByName(path) : null
    return found || this.model
  }

  setAnimation() {
    const pack  = this.resources.items.enemyModel
    const clips = (pack && pack.animations) || []
    const match = (keys) => clips.find(c => {
      const n = c.name.toLowerCase().replace(/\s+/g,'')
      return keys.some(k => n.includes(k))
    })
    const idleClip   = match(['idle'])
    const correrClip = match(['correr'])

    const root = this._animRoot(clips)
    this.mixer = new THREE.AnimationMixer(root)
    this.actions = {}
    if (idleClip)   this.actions.idle   = this.mixer.clipAction(idleClip)
    if (correrClip) this.actions.correr = this.mixer.clipAction(correrClip)
    const start = this.actions.idle || this.actions.correr
    this.current = start || null
    if (start) start.play()
  }

  play(name) {
    const next = this.actions && this.actions[name]
    if (!next || this.current === next) return
    next.reset().play()
    if (this.current) next.crossFadeFrom(this.current, 0.2, true)
    this.current = next
  }

  _sendKillOnce() {
    if (this._killSent) return
    this._killSent = true
    if (this.playerRef && typeof this.playerRef.dieImmediate === 'function') {
      this.playerRef.dieImmediate()
    }
  }

  _bindCollision() {
    this._onCollide = (e) => {
      if (!this.playerRef || !this.playerRef.body) return
      if (e.body === this.playerRef.body) this._sendKillOnce()
    }
    this.body.addEventListener('collide', this._onCollide)
  }

  update(delta) {
    if (this.delayActivation > 0) { this.delayActivation -= delta; return }
    let dt = delta
    if (dt > 1) dt *= 0.001
    dt = Math.min(0.05, Math.max(0, dt))
    if (this.mixer) this.mixer.update(dt)
    if (!this.body || !this.playerRef || !this.playerRef.body) return

    const px = this.playerRef.body.position.x
    const pz = this.playerRef.body.position.z
    const ex = this.body.position.x
    const ez = this.body.position.z
    const dx = px - ex
    const dz = pz - ez
    const dist = Math.hypot(dx, dz)

    if (dist <= this.killRadius) {
      this._sendKillOnce()
      return
    }

    if (dist <= this.maxChaseDistance) {
      const running = dist < this.activationRadius
      this.speed = running ? this.runSpeed : this.baseSpeed
      this.play(running ? 'correr' : 'idle')

      const inv = dist > 0 ? 1 / dist : 0
      const vx = dx * inv * this.speed
      const vz = dz * inv * this.speed
      this.body.velocity.x = THREE.MathUtils.clamp(vx, -this.runSpeed, this.runSpeed)
      this.body.velocity.z = THREE.MathUtils.clamp(vz, -this.runSpeed, this.runSpeed)
      this.body.velocity.y = 0

      const maxD = 10
      const proximity = 1 - Math.min(dist, maxD) / maxD
      if (this.proximitySound?.setVolume) this.proximitySound.setVolume(proximity * 0.6)

      this.model.lookAt(new THREE.Vector3(px, this.visualY, pz))
    } else {
      this.body.velocity.x *= 0.9
      this.body.velocity.z *= 0.9
    }

    this.body.force.y    = 0
    this.body.position.y = this.bodyY
    this.model.position.set(this.body.position.x, this.visualY, this.body.position.z)
  }

  destroy() {
    if (this.model) this.scene.remove(this.model)
    if (this.proximitySound) this.proximitySound.stop()
    if (this.body) {
      if (this._onCollide) this.body.removeEventListener('collide', this._onCollide)
      if (this.physicsWorld.bodies.includes(this.body)) this.physicsWorld.removeBody(this.body)
      this.body = null
    }
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null }
  }
}
