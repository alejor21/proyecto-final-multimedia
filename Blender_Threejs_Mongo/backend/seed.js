require('dotenv').config()
const mongoose = require('mongoose')
const Block = require('./models/Block')

const positions = [
    { x: 3.97, y: 0.5, z: 1.93 },
    { x: -0.25, y: 0.5, z: -2.79 },
]

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI)

        await Block.deleteMany() // (opcional) limpia la colección
        await Block.insertMany(positions)

        console.log('📦 Datos insertados correctamente en MongoDB')
        process.exit()
    } catch (err) {
        console.error('❌ Error al insertar datos:', err)
        process.exit(1)
    }
}

seedDatabase()
