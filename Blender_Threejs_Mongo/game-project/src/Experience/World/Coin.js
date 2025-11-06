export default class Coin {
    constructor({ scene, position }) {
        // ...existing code...
        
        // Fijar la posición de la moneda
        this.model.position.copy(position)
        
        // Eliminar cualquier física que cause movimiento
        this.body.type = CANNON.Body.STATIC
        
        // Opcional: Añadir una pequeña animación de rotación
        this.rotationSpeed = 0.02
    }

    update() {
        // Rotar suavemente sobre el eje Y
        this.model.rotation.y += this.rotationSpeed
    }
}