const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');

// 👇 patch para usar fetch en CommonJS con node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Archivos JSON a procesar
const filesToSend = ['toy_car_blocks3.json', 'coin3.json'];

// Leer URL desde .env
const API_URL = process.env.API_URL;

if (!API_URL) {
    console.error('❌ ERROR: No se encontró API_URL en .env');
    process.exit(1);
}

// Función para enviar datos
async function sendJSON(fileName) {
    const jsonPath = path.join(__dirname, '../data', fileName);
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonData),
        });

        const data = await res.json();
        console.log(`✅ ${fileName} sincronizado correctamente:`, data);
    } catch (err) {
        console.error(`❌ Error al sincronizar ${fileName}:`, err.message);
    }
}

// Enviar cada archivo
filesToSend.forEach(sendJSON);
