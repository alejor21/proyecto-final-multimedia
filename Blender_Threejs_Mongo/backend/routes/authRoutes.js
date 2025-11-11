const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

        const exists = await User.findOne({ email });
        if (exists) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

        const hash = await bcrypt.hash(password, 10);
        const user = await User.create({ email, password: hash });

        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || '7d' }
        );

        res.json({
            user: { _id: user._id, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt },
            token
        });
    } catch (e) {
        res.status(500).json({ error: 'Error en registro', detail: e.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || '7d' }
        );

        res.json({
            user: { _id: user._id, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt },
            token
        });
    } catch (e) {
        res.status(500).json({ error: 'Error en login', detail: e.message });
    }
});

module.exports = router;
