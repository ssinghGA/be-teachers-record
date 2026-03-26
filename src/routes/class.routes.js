const express = require('express');
const {
    createClass, getAllClasses, getClassById, updateClass, deleteClass, startClass, endClass, joinClass, bulkCreateClasses
} = require('../controllers/class.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.post('/', createClass);
router.post('/bulk', bulkCreateClasses);
router.get('/', getAllClasses);
router.get('/:id', getClassById);
router.patch('/:id', updateClass);
router.delete('/:id', deleteClass);

router.post('/start', startClass);
router.post('/end', endClass);
router.post('/join', joinClass);

module.exports = router;
