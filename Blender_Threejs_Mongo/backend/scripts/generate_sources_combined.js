const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../../game-project/public/models/toycar');
const sourcesFilePath = path.join(__dirname, '../../game-project/src/Experience/sources.js');

// Basic existing sources (environment map, textures, other models)
const baseSources = [
    {
        "name": "environmentMapTexture",
        "type": "cubeTexture",
        "path": [
            "/textures/environmentMap/px.jpg",
            "/textures/environmentMap/nx.jpg",
            "/textures/environmentMap/py.jpg",
            "/textures/environmentMap/ny.jpg",
            "/textures/environmentMap/pz.jpg",
            "/textures/environmentMap/nz.jpg"
        ]
    },
    {
        "name": "grassColorTexture",
        "type": "texture",
        "path": "/textures/dirt/color.jpg"
    },
    {
        "name": "grassNormalTexture",
        "type": "texture",
        "path": "/textures/dirt/normal.jpg"
    },
    {
        "name": "foxModel",
        "type": "gltfModel",
        "path": "/models/Fox/glTF/Fox.gltf"
    },
    {
        "name": "robotModel",
        "type": "gltfModel",
        "path": "/models/Robot/Robot.glb"
    },
    {
        "name": "enemyModel",
        "type": "gltfModel",
        "path": "/models/Enemy/Enemy.glb"
    }
];

fs.readdir(modelsDir, (err, files) => {
    if (err) {
        console.error('Error reading models directory:', err);
        return;
    }

    const glbFiles = files.filter(file => path.extname(file).toLowerCase() === '.glb');

    // We intentionally DO NOT preload all GLB files here.
    // Preloading thousands of models makes the app hang on startup.
    // Models will be lazy-loaded per level by ToyCarLoader.
    const allSources = [...baseSources];

    const sourcesContent = `export default ${JSON.stringify(allSources, null, 4)};`;

    fs.writeFile(sourcesFilePath, sourcesContent, 'utf8', (err) => {
        if (err) {
            console.error('Error writing sources.js file:', err);
            return;
        }
        console.log('sources.js file has been generated with base sources only.');
    });
});
