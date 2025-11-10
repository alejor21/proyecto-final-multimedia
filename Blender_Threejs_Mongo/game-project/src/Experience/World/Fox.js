import * as THREE from 'three'

export default class Fox {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time
        this.debug = this.experience.debug

        // Debug
        if (this.debug.active) {
            this.debugFolder = this.debug.ui.addFolder('fox')
        }

        // Resource
        this.resource = this.resources.items.foxModel

        this.setModel()
        this.setAnimation()
    }

    setModel() {
        this.model = this.resource.scene
        // Smaller fox
        this.model.scale.set(0.012, 0.012, 0.012)
        this.model.position.set(1.5, 0, -1.2)
        this.scene.add(this.model)
        //Activando la sobra de fox
        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
            }
        })
    }
    //Manejo GUI
    setAnimation() {
        this.animation = {}

        // Mixer
        this.animation.mixer = new THREE.AnimationMixer(this.model)

        // Actions
        this.animation.actions = {}

        this.animation.actions.idle = this.animation.mixer.clipAction(this.resource.animations[0])
        this.animation.actions.walking = this.animation.mixer.clipAction(this.resource.animations[1])
        this.animation.actions.running = this.animation.mixer.clipAction(this.resource.animations[2])

        this.animation.actions.current = this.animation.actions.idle
        this.animation.actions.current.play()

        // Play the action
        this.animation.play = (name) => {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current

            newAction.reset()
            newAction.play()
            newAction.crossFadeFrom(oldAction, 1)

            this.animation.actions.current = newAction
        }

        // Debug
        if (this.debug.active) {
            const debugObject = {
                playIdle: () => { this.animation.play('idle') },
                playWalking: () => { this.animation.play('walking') },
                playRunning: () => { this.animation.play('running') }
            }
            this.debugFolder.add(debugObject, 'playIdle')
            this.debugFolder.add(debugObject, 'playWalking')
            this.debugFolder.add(debugObject, 'playRunning')
        }
    }

    update() {
        const dt = Math.min(0.05, this.time.delta * 0.001)
        this.animation.mixer.update(dt)

        // Follow the player (robot)
        const robot = this.experience?.world?.robot
        if (!robot?.group) return

        // Desired position: a bit behind the robot
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(robot.group.quaternion).normalize()
        const desired = new THREE.Vector3().copy(robot.group.position)
        const followDist = 1.6
        desired.addScaledVector(forward, -followDist)
        desired.y = 0

        // Smoothly move fox towards desired position
        const curr = this.model.position
        const toTarget = new THREE.Vector3().subVectors(desired, curr)
        const dist = toTarget.length()
        const speed = 4.0 // m/s
        const step = Math.min(dist, speed * dt)
        if (dist > 0.001) {
            toTarget.normalize().multiplyScalar(step)
            curr.add(toTarget)
        }

        // Face the movement direction or towards the robot when still
        const lookAt = (dist > 0.1) ? new THREE.Vector3().addVectors(curr, toTarget) : robot.group.position
        this.model.lookAt(lookAt.x, curr.y, lookAt.z)

        // Choose animation based on speed
        if (dist > 0.2) this.animation.play('walking')
        else this.animation.play('idle')
    }
}
