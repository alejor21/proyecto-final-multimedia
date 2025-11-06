// scripts/generate_sources.js

const fs = require('fs');
const path = require('path');

const modelsPath = path.join('C:/Users/Braya/Desktop/TRABAJO FINAL MULTIMEDIA/Blender_Threejs_Mongo/game-project/public/models/toycar');
const outputPath = path.join('C:/Users/Braya/Desktop/TRABAJO FINAL MULTIMEDIA/Blender_Threejs_Mongo/game-project/src/Experience/sources.js');

if (!fs.existsSync(modelsPath)) {
    console.error('❌ El directorio no existe:', modelsPath);
    process.exit(1);
}

const files = fs.readdirSync(modelsPath);
const sources = [
    {
        name: 'environmentMapTexture',
        type: 'cubeTexture',
        path: [
            '/textures/environmentMap/px.jpg',
            '/textures/environmentMap/nx.jpg',
            '/textures/environmentMap/py.jpg',
            '/textures/environmentMap/ny.jpg',
            '/textures/environmentMap/pz.jpg',
            '/textures/environmentMap/nz.jpg'
        ]
    },
    {
        name: 'grassColorTexture',
        type: 'texture',
        path: '/textures/dirt/color.jpg'
    },
    {
        name: 'grassNormalTexture',
        type: 'texture',
        path: '/textures/dirt/normal.jpg'
    },
    {
        name: 'foxModel',
        type: 'gltfModel',
        path: '/models/Fox/glTF/Fox.gltf'
    },
    {
        name: 'robotModel',
        type: 'gltfModel',
        path: '/models/Robot/Robot.glb'
    }
];

files.forEach(file => {
    if (file.endsWith('.glb')) {
        const name = path.basename(file, '.glb');
        sources.push({
            name,
            type: 'gltfModel',
            path: `/models/toycar/${file}`
        });
    }
});

const output = `export default ${JSON.stringify(sources, null, 4)};\n`;

fs.writeFileSync(outputPath, output, 'utf-8');

console.log('✅ Archivo sources.js generado con éxito en:', outputPath);
