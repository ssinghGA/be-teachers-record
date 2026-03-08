const express = require('express');
const {
    createClass, getAllClasses, getClassById, updateClass, deleteClass,
} = require('../controllers/class.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.post('/', createClass);
router.get('/', getAllClasses);
router.get('/:id', getClassById);
router.patch('/:id', updateClass);
router.delete('/:id', deleteClass);

module.exports = router;
