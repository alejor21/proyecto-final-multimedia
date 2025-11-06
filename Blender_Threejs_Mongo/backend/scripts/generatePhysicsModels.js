// Node.js script
const fs = require('fs')
const path = require('path')

// Ruta de entrada y salida
const inputPath = path.join(__dirname, '../data/toy_car_blocks.json')
const outputPath = path.join(__dirname, '../data/precisePhysicsModels2.json');

// Leer archivo JSON original
fs.readFile(inputPath, 'utf8', (err, data) => {
    if (err) {
        console.error('❌ Error leyendo toy_car_blocks.json:', err)
        return
    }

    try {
        const blocks = JSON.parse(data)

        // Filtrar nombres que inicien con 'track'
        const trackNames = blocks
            .filter(block => block.name)//&& block.name.startsWith('track')
            .map(block => block.name)

        // Eliminar duplicados (por si acaso)
        const uniqueTrackNames = [...new Set(trackNames)]

        // Guardar nuevo archivo
        fs.writeFile(
            outputPath,
            JSON.stringify(uniqueTrackNames, null, 4),
            'utf8',
            (err) => {
                if (err) {
                    console.error('❌ Error al escribir precisePhysicsModels.json:', err)
                    return
                }
                console.log(`✅ precisePhysicsModels.json creado con ${uniqueTrackNames.length} entradas.`)
            }
        )

    } catch (parseErr) {
        console.error('❌ Error al parsear toy_car_blocks.json:', parseErr)
    }
})
