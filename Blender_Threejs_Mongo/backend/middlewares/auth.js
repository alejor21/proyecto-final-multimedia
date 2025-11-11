const jwt = require('jsonwebtoken');

exports.authRequired = (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    const payload = jwt.verify(token, process.env.JWT_SECRET); 
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
