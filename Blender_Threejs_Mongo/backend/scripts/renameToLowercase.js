const fs = require('fs');
const path = require('path');

// ✅ Ruta absoluta donde están los modelos
const directory = 'D:/UCC/React/PortafolioUCC/Project/game-project/public/models/toycar';

fs.readdir(directory, (err, files) => {
    if (err) {
        console.error('❌ Error leyendo el directorio:', err);
        return;
    }

    files.forEach(file => {
        const currentPath = path.join(directory, file);
        const lowerCaseName = file.toLowerCase();
        const newPath = path.join(directory, lowerCaseName);

        // Renombrar si el nombre no es todo minúscula
        if (file !== lowerCaseName) {
            fs.rename(currentPath, newPath, (err) => {
                if (err) {
                    console.error(`⚠️ Error renombrando ${file}:`, err);
                } else {
                    console.log(`✅ ${file} → ${lowerCaseName}`);
                }
            });
        }
    });
});
