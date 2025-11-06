import * as THREE from 'three'

export default class Prize {
    constructor({ model, position, scene, role = 'default', sound = null }) {
        this.scene = scene
        this.collected = false
        this.role = role
        this.sound = sound

        this.pivot = new THREE.Group()
        this.pivot.position.copy(position)
        this.pivot.userData.interactivo = true
        this.pivot.userData.collected = false


        //  Clonar el modelo
        this.model = model.clone()
        const visual = this.model.children.find(child => child.isMesh) || this.model
        visual.userData.interactivo = true

        //  Centrar el modelo antes de agregarlo
        const bbox = new THREE.Box3().setFromObject(visual)
        const center = new THREE.Vector3()
        bbox.getCenter(center)
        visual.position.sub(center) // centrado en su propio eje

        // Agregar al grupo principal
        this.pivot.add(visual)

        // Ejes para depuración, fijos al cubo
        const helper = new THREE.AxesHelper(0.5)
        this.pivot.add(helper)

        this.scene.add(this.pivot)
        this.pivot.visible = role !== 'finalPrize'

        console.log(`🎯 Premio en: (${position.x}, ${position.y}, ${position.z}) [role: ${this.role}]`)
    }

    update(delta) {
        if (this.collected) return
        this.pivot.rotation.y += delta * 1.5 // ahora sí gira sobre su eje
    }

    collect() {
        if (this.collected) return

        this.collected = true

        if (this.sound && typeof this.sound.play === 'function') {
            this.sound.play()
        }

        this.pivot.traverse(child => {
            child.userData.collected = true
        })
        this.scene.remove(this.pivot)
    }
}
