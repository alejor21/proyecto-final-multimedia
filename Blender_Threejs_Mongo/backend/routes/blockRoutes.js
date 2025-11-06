const express = require('express')
const router = express.Router()
const blockController = require('../controllers/blockController')

router.get('/', blockController.getBlocks)
router.post('/', blockController.addBlock)
router.post('/batch', blockController.addMultipleBlocks)
router.get('/ping', (req, res) => {
    res.json({ message: 'pong' });
});



module.exports = router
