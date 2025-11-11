const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        z: { type: Number, required: true },
        level: { type: Number, required: true, default: 1, index: true },
        role: { type: String, enum: ['finalPrize', 'default'], default: 'default' }
    },
    { timestamps: true }
);

// Forzamos el nombre de colección: 'toy_car_blocks'
module.exports = mongoose.model('Block', blockSchema, 'toy_car_blocks');
