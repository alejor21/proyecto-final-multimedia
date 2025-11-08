import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Sound from './Sound.js'

const GROUP_PLAYER = 1 << 0
const GROUP_ENEMY  = 1 << 1

export default class Robot {
  constructor(experience) {
    this.experience = experience
    this.scene      = this.experience.scene
    this.resources  = this.experience.resources
    this.time       = this.experience.time
    this.physics    = this.experience.physics
    this.keyboard   = this.experience.keyboard

    this.points = 0
    this.isDead = false

    this.params = {
      scale: 0.38,
      bodyRadius: 1.05,
      mass: 3.2,
      moveForce: 82,
      maxSpeed:  6.2,   // un poco > enemigo
      turnSpeed: 2.0
    }

    this.bodyY    = 0.9
    this.visualY  = 0.0
    this._smoothLerp = 0.28

    this.setModel()
    this.setSounds()
    this.setPhysics()
    this.setAnimation()
    this._bindCollision()
  }

  setModel() {
    this.model = this.resources.items.robotModel.scene
    this.model.scale.setScalar(this.params.scale)

    this.group = new THREE.Group()
    this.group.add(this.model)
    this.group.position.set(0, this.visualY, 0)
    this.scene.add(this.group)

    this.model.traverse((c) => { if (c.isMesh) c.castShadow = true })
    this._smoothedPos = this.group.position.clone()
  }

  setPhysics() {
    const shape = new CANNON.Sphere(this.params.bodyRadius)
    this.body = new CANNON.Body({
      mass: this.params.mass,
      shape,
      position: new CANNON.Vec3(0, this.bodyY, 0),
      linearDamping: 0.68,
      angularDamping: 0.99
    })
    this.body.angularFactor.set(0, 1, 0)
    this.body.collisionFilterGroup = GROUP_PLAYER
    this.body.collisionFilterMask  = GROUP_ENEMY

    this.body.allowSleep = true
    this.body.sleepSpeedLimit = 0
    this.body.material = this.physics.robotMaterial
    this.physics.world.addBody(this.body)
    setTimeout(() => this.body.wakeUp(), 50)
  }

  setSounds() {
    this.walkSound = new Sound('/sounds/robot/walking.mp3', { loop: true, volume: 0.45 })
  }

  setAnimation() {
    const clips = this.resources.items.robotModel.animations || []
    const find = (k) => clips.find(a => a.name.toLowerCase().includes(k))
    const idle = find('idle')
    const walk = find('walk')
    const die  = find('die') || find('death')

    this.animation = { mixer: new THREE.AnimationMixer(this.model), actions: {} }
    if (idle) this.animation.actions.idle    = this.animation.mixer.clipAction(idle)
    if (walk) this.animation.actions.walking = this.animation.mixer.clipAction(walk)
    if (die)  {
      this.animation.actions.die = this.animation.mixer.clipAction(die)
      this.animation.actions.die.setLoop(THREE.LoopOnce)
      this.animation.actions.die.clampWhenFinished = true
    }

    const start = this.animation.actions.idle || this.animation.actions.walking
    this.animation.current = start
    if (start) start.play()

    this.play = (name) => {
      const next = this.animation.actions[name]
      const prev = this.animation.current
      if (!next || next === prev) return
      next.reset().play()
      if (prev) next.crossFadeFrom(prev, 0.18, true)
      this.animation.current = next
      if (name === 'walking') this.walkSound.play()
      else if (prev === this.animation.actions.walking) this.walkSound.stop()
    }
  }

  _bindCollision() {
    this._onCollide = () => { this.dieImmediate() }
    this.body.addEventListener('collide', this._onCollide)
  }

  dieImmediate() {
  if (this.isDead) return
  this.isDead = true
  this.walkSound.stop()

  // Bloquear controles y abrir modal (sin respawn automático)
  this.experience?.keyboard?.disableControls?.()
  this.experience?.modal?.show({
    icon: '💀',
    message: '¡El enemigo te atrapó!',
    buttons: [
      {
        text: '🔁 Reintentar',
        onClick: () => {
          // cerrar modal
          this.experience.modal.hide()
          // flujo de reinicio
          this.experience.resetGameToFirstLevel?.()
          this.experience.startGame?.()
          // seguridad: vuelve a habilitar controles por si aún estaban off
          this.experience?.keyboard?.enableControls?.()
        }
      },
      {
        text: '🏁 Terminar',
        onClick: () => {
          this.experience.modal.hide()
          this.experience.resetGame?.()
        }
      }
    ]
  })
}


  reset(position) {
    this.isDead = false
    this.experience.keyboard.enableControls?.()
    this.body.position.set(position.x, this.bodyY, position.z)
    this.body.quaternion.set(0, 0, 0, 1)
    this.body.velocity.set(0, 0, 0)
    this.body.angularVelocity.set(0, 0, 0)
    this.body.angularFactor.set(0, 1, 0)

    this.group.position.set(position.x, this.visualY, position.z)
    this._smoothedPos.copy(this.group.position)

    this.group.quaternion.copy(this.body.quaternion)
    if (this.animation.actions.idle) this.play('idle')
    this.body.wakeUp()
  }

  update() {
    const delta = Math.min(0.05, this.time.delta * 0.001)
    this.animation.mixer.update(delta)

    if (this.isDead) return

    const keys = this.keyboard.getState()
    const { moveForce, maxSpeed, turnSpeed } = this.params

    const clamp = (v) => Math.max(Math.min(v, maxSpeed), -maxSpeed)
    this.body.velocity.x = clamp(this.body.velocity.x)
    this.body.velocity.z = clamp(this.body.velocity.z)

    if (keys.left) {
      this.group.rotation.y += turnSpeed * delta
      this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
    }
    if (keys.right) {
      this.group.rotation.y -= turnSpeed * delta
      this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
    }

    let moving = false
    const forward  = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion)
    const backward = new THREE.Vector3(0, 0,-1).applyQuaternion(this.group.quaternion)

    if (keys.up) {
      this.body.applyForce(new CANNON.Vec3(forward.x * moveForce, 0, forward.z * moveForce), this.body.position)
      moving = true
    }
    if (keys.down) {
      this.body.applyForce(new CANNON.Vec3(backward.x * moveForce, 0, backward.z * moveForce), this.body.position)
      moving = true
    }

    if (!moving) {
      this.body.velocity.x *= 0.8
      this.body.velocity.z *= 0.8
    }

    this.body.velocity.y = 0
    this.body.force.y    = 0
    this.body.position.y = this.bodyY

    if (moving) this.play('walking')
    else this.play('idle')

    const target = new THREE.Vector3(this.body.position.x, this.visualY, this.body.position.z)
    this._smoothedPos.lerp(target, this._smoothLerp)
    this.group.position.copy(this._smoothedPos)
  }
}
