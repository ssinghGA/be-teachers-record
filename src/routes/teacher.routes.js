const express = require('express');
const { getAllTeachers, getTeacherById, updateTeacher } = require('../controllers/teacher.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/teachers — Admin / Super Admin only
router.get('/', authenticate, authorize('admin', 'super_admin'), getAllTeachers);

// GET /api/teachers/:id — Admin can see any; teacher sees self
router.get('/:id', authenticate, authorize('admin', 'super_admin', 'teacher'), getTeacherById);

// PATCH /api/teachers/:id — Teacher updates self; Admin updates any
router.patch('/:id', authenticate, authorize('admin', 'super_admin', 'teacher'), updateTeacher);

module.exports = router;
