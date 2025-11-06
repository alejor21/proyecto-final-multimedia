# 🧱 Backend API - Aplicativo Interactivo en Primera Persona

Este repositorio contiene el backend del proyecto interactivo en primera persona, desarrollado como una API RESTful utilizando **Node.js**, **Express** y **MongoDB**, y estructurado bajo el patrón arquitectónico **MVC (Modelo - Vista - Controlador)**.

El propósito de este backend es gestionar bloques en un entorno 3D desarrollado con **React** y **Three.js**, permitiendo la consulta y persistencia de coordenadas en MongoDB.

---

## 📐 Arquitectura

El backend aplica el patrón **MVC**, organizado de la siguiente manera:

```
📦 backend
├── 📁 controllers      # Lógica de negocio (blockController.js)
├── 📁 models           # Esquemas de datos (Block.js)
├── 📁 routes           # Definición de endpoints (blockRoutes.js)
├── app.js             # Punto de entrada principal
├── seed.js            # Script de carga de datos iniciales
├── .env               # Variables de entorno (no incluido)
└── package.json       # Dependencias y metadatos del proyecto
```

---

## 🌐 Endpoints disponibles

- `GET /blocks` → Obtiene todos los bloques (coordenadas X, Y, Z)
- `POST /blocks` → Inserta un nuevo bloque en la base de datos

---

## 💾 Base de Datos

- Motor: **MongoDB**
- Conexión: gestionada mediante **Mongoose**
- Las coordenadas se almacenan como objetos `{ x, y, z }` en la colección `blocks`.

---

## 🚀 Tecnologías utilizadas

| Componente     | Tecnología         |
|----------------|--------------------|
| Backend        | Node.js, Express   |
| Arquitectura   | MVC                |
| Base de datos  | MongoDB + Mongoose |
| API            | REST               |
| Frontend       | React + Three.js   |
| Despliegue     | Vercel             |

---

## ⚙️ Instalación

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/tuusuario/tu-repo-backend.git
   cd tu-repo-backend
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Crear archivo `.env` y agregar la variable de conexión:
   ```
   MONGO_URI=mongodb+srv://<usuario>:<contraseña>@<cluster>.mongodb.net/<db>
   ```

4. Ejecutar servidor:
   ```bash
   node app.js
   ```

5. (Opcional) Insertar datos iniciales:
   ```bash
   node seed.js
   ```

---

## 📦 Conexión con el Frontend

El frontend 3D desarrollado en React + Three.js se comunica con esta API para:

- Renderizar bloques en el espacio 3D a partir de los datos consultados
- Permitir al usuario agregar nuevos bloques que se guardan en MongoDB

---

## 🛡️ Buenas prácticas aplicadas

- Patrón MVC
- Modularización y separación de responsabilidades
- Variables de entorno con `.env`
- CORS habilitado para integración con frontend
- Script de `seed` para pruebas rápidas

---

## 🧑‍💻 Autor

Desarrollado por Gustavo Sánchez Rodríguez
email: guswillsan@gmail.com

---

## 🗂️ Licencia

Este proyecto está bajo la licencia ISC. Ver `LICENSE` para más información.

# Datos configuracion mas de un  mundo

## 1. Ajustar el controlador de bloques

Ruta: `backend/controllers/blockController.js`

**Antes:**
```javascript
// Obtener bloques sin _id
exports.getBlocks = async (req, res) => {
    const blocks = await Block.find({}, { name: 1, x: 1, y: 1, z: 1, _id: 0 })
    res.json(blocks)
}

// Agregar un nuevo bloque
exports.addBlock = async (req, res) => {
    const { x, y, z } = req.body
    const newBlock = new Block({ x, y, z })
    await newBlock.save()
    res.status(201).json({ message: 'Bloque guardado', block: newBlock })
}
```

**Debe quedar así:**
```javascript
exports.getBlocks = async (req, res) => {
    try {
        const level = parseInt(req.query.level) || 1;
        const blocks = await Block.find({ level: level }).select('name x y z level -_id');
        res.json(blocks);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener bloques', error });
    }
};

exports.addBlock = async (req, res) => {
    const { name, x, y, z, level } = req.body;
    const newBlock = new Block({ name, x, y, z, level });
    await newBlock.save();
    res.status(201).json({ message: 'Bloque guardado', block: newBlock });
}
```

---

## 2. Ajustar el modelo de bloques

Ruta: `backend/models/Block.js`

**Antes:**
```javascript
const mongoose = require('mongoose')

const blockSchema = new mongoose.Schema({
    name: String,  
    x: Number,
    y: Number,
    z: Number
})

module.exports = mongoose.model('Block', blockSchema)
```

**Debe quedar así:**
```javascript
const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
    name: String,
    x: Number,
    y: Number,
    z: Number,
    level: {
        type: Number,
        required: true,
        default: 1
    }
});

module.exports = mongoose.model('Block', blockSchema);
```

---

## 3. Renovar script de exportación en Blender

Ruta: `backend/scripts/Text_3_cero.txt`

**Nuevo contenido del script Blender:**
```python
import bpy
import os
import json
from mathutils import Vector

# -------- Configuraciones --------
nivel = 2  # 🔵 Puedes cambiar a 2, 3, etc. para otros niveles

# Rutas de exportación
export_path = r"D:/UCC/React/PortafolioUCC/Project_v3_multiplayer_final/game-project/public/models/toycar2"
json_path = os.path.join(export_path, "toy_car_blocks1.json")
os.makedirs(export_path, exist_ok=True)

positions = []

# Configuración de Blender
depsgraph = bpy.context.evaluated_depsgraph_get()
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()

# -------- Recorrer objetos seleccionados --------
for obj in bpy.context.selected_objects:
    if obj.type != 'MESH':
        continue

    obj_eval = obj.evaluated_get(depsgraph)
    matrix_world = obj_eval.matrix_world
    loc = matrix_world.to_translation()

    # 🔵 Normalizar el nombre
    name = obj.name.lower().replace(" ", "_").replace(f"_lev{nivel}", "")

    # 🔵 Asignar nuevo nombre con nivel
    name_with_level = f"{name}_lev{nivel}"
    obj.name = name_with_level

    # 🔵 Conversión de coordenadas para Three.js
    pos = {
        "name": obj.name,
        "x": loc.x,
        "y": loc.z,
        "z": -loc.y,
        "level": nivel
    }

    positions.append(pos)
    print(f"📦 {obj.name}: ({pos['x']}, {pos['y']}, {pos['z']}, nivel {pos['level']})")

    # -------- Exportar modelo individual --------
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    filepath = os.path.join(export_path, f"{obj.name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        use_selection=True,
        export_format='GLB',
        export_apply=False
    )

# -------- Guardar archivo JSON --------
with open(json_path, "w") as f:
    json.dump(positions, f, indent=4)

print("✅ Exportación finalizada con sistema de coordenadas compatible con Three.js.")
```

---

## 4. Exportar archivos desde Blender

- Exportar modelos `.glb` y el `.json`.
- El archivo `toy_car_blocks.json` debe ir a: `backend/data/toy_car_blocks1.json`.
- Ajustar `coin.json` agregando el campo `"level": 1` para todos los registros.

---

## 5. Cargar los bloques a MongoDB

- Ejecutar:

```bash
node scripts/sync_blocks.js
```

**Importante:**  
Asegúrate de que el `sync_blocks.js` esté preparado para leer ambos archivos:

- `data/toy_car_blocks1.json`
- `data/coin1.json`

Y que inserte los bloques correctamente en la base de datos.

---

## 6. Verificar endpoints en Postman

| Acción | Nueva estructura esperada |
|:-------|:--------------------------|
| `GET /api/blocks?level=1` | Trae solo bloques del nivel 1 |
| `GET /api/blocks?level=2` | Trae solo bloques del nivel 2 |
| `POST /api/blocks` | Inserta un bloque con campos `name`, `x`, `y`, `z`, `level` |
| `POST /api/blocks/batch` | Inserta varios bloques con campos `name`, `x`, `y`, `z`, `level` |

---

## 7. Preparar estructura de modelos para frontend

- Directorios de modelos:

```
game-project/public/models/toycar
game-project/public/models/toycar2
```

- Cada nivel en su carpeta.

---

## 8. Ajustar generación automática de fuentes

En `generate_sources.js`:

- Crear archivos separados para evitar sobreescribir los del primer nivel.
- Ejemplo:
  - `toycar_sources.js`
  - `toycar2_sources.js`

---

## 9. Ajustar nombres en los archivos `.glb`

- El nombre debe incluir `_lev1`, `_lev2`, etc.
- El script de Blender ya hace este ajuste automáticamente.

---
# Backend
MONGO_URI=mongodb://127.0.0.1:27017/threejs_blocks
PORT=3001
API_URL=http://192.168.20.9:3001/api/blocks/batch

# Frontend
VITE_API_URL=http://localhost:3001




