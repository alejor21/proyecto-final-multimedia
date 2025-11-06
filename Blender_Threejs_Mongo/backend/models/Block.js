const mongoose = require('mongoose')

const blockSchema = new mongoose.Schema({
    name: { type: String },
    x: { type: Number },
    y: { type: Number },
    z: { type: Number },
    level: { type: Number, required: true, default: 1 },
    role: { type: String, enum: ['finalPrize', 'default'], default: 'default' } 
});



module.exports = mongoose.model('Block', blockSchema)
