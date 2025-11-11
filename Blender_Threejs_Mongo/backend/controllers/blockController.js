const Block = require('../models/Block');

/**
 * GET /api/blocks
 * - Si envías ?level=1 filtra por nivel.
 * - Si NO envías level, devuelve todos los bloques.
 * - Si quieres ocultar _id, mantén el .select() comentado.
 */
exports.getBlocks = async (req, res) => {
    try {
        const levelParam = req.query.level;
        const filter = (levelParam !== undefined && levelParam !== '')
            ? { level: Number(levelParam) }
            : {};

        // Si NO quieres _id, descomenta el select:
        // const blocks = await Block.find(filter).select('name x y z level role -_id').lean();
        const blocks = await Block.find(filter).lean();

        res.json(blocks);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener bloques', error: error.message });
    }
};


/**
 * POST /api/blocks
 * Body: { name, x, y, z, level?, role? }
 * - Ojo: en tu versión venía "rol"; aquí lo normalizamos a "role".
 */
exports.addBlock = async (req, res) => {
    try {
        const { name, x, y, z, level = 1, role, rol } = req.body;

        if (name == null || x == null || y == null || z == null) {
            return res.status(400).json({ message: 'name, x, y, z son obligatorios' });
        }

        const doc = await Block.create({
            name,
            x: Number(x),
            y: Number(y),
            z: Number(z),
            level: Number(level) || 1,
            role: (role ?? rol ?? 'default') // admite "rol" por compatibilidad
        });

        res.status(201).json({ message: 'Bloque guardado', block: doc });
    } catch (error) {
        res.status(500).json({ message: 'Error creando bloque', error: error.message });
    }
};


/**
 * POST /api/blocks/batch
 * Body: [ { name, x, y, z, level?, role? }, ... ]
 * - Ideal para importar tu JSON grande.
 * - Valida que sea array y hace cast básico a números.
 */
exports.addMultipleBlocks = async (req, res) => {
    try {
        const blocks = req.body;

        if (!Array.isArray(blocks) || !blocks.length) {
            return res.status(400).json({ message: 'Se espera un array JSON en el body.' });
        }

        // Normaliza entries (x,y,z,level a número / role corrige "rol")
        const normalized = blocks.map(b => ({
            name: b.name,
            x: Number(b.x),
            y: Number(b.y),
            z: Number(b.z),
            level: Number(b.level) || 1,
            role: (b.role ?? b.rol ?? 'default')
        }));

        const result = await Block.insertMany(normalized, { ordered: false });
        res.status(201).json({ message: 'Bloques guardados', count: result.length });
    } catch (error) {
        res.status(500).json({ message: 'Error importando bloques', error: error.message });
    }
};
