const express = require('express');
const {
    createClass, getAllClasses, getClassById, updateClass, deleteClass,
    joinClass, startClass, endClass
} = require('../controllers/class.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

// Custom actions
router.post('/join', joinClass);
router.post('/start', startClass);
router.post('/end', endClass);

router.post('/', createClass);
router.get('/', getAllClasses);
router.get('/:id', getClassById);
router.patch('/:id', updateClass);
router.delete('/:id', deleteClass);

module.exports = router;
