const Student = require('../models/student.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const { getPagination, buildPaginationMeta } = require('../utils/pagination.util');
const { buildFilter } = require('../utils/filter.util');
const asyncHandler = require('../utils/asyncHandler.util');

/**
 * Build a teacher-scoped filter.
 * Teachers only see their own students; admins/super_admins see all.
 */
const getScopeFilter = (user, query) => {
    const filter = buildFilter(query, 'createdAt');
    if (user.role === 'teacher') {
        filter.teacherId = user._id;
    } else if (query.teacherId) {
        filter.teacherId = query.teacherId;
    }
    return filter;
};

/**
 * @route   POST /api/students
 * @desc    Create a new student (automatically assigned to logged-in teacher)
 * @access  Private [teacher, admin, super_admin]
 */
const createStudent = asyncHandler(async (req, res) => {
    const {
        name, class: studentClass, school, parentName, parentPhone,
        email, subject, startDate, status, notes,
    } = req.body;

    // Teacher ID comes from the authenticated user for teachers
    const teacherId =
        req.user.role === 'teacher' ? req.user._id : req.body.teacherId;

    if (!teacherId) {
        return sendError(res, 'teacherId is required for admin-created students.', 400);
    }

    const student = await Student.create({
        name, class: studentClass, school, parentName, parentPhone,
        email, subject, teacherId, startDate, status, notes,
    });

    return sendSuccess(res, { student }, 'Student created successfully', 201);
});

/**
 * @route   GET /api/students
 * @desc    Get all students. Teachers get their own; admins get all.
 * @access  Private
 */
const getAllStudents = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const filter = getScopeFilter(req.user, req.query);

    // Optional search by name
    if (req.query.search) {
        filter.name = new RegExp(req.query.search, 'i');
    }

    const [students, total] = await Promise.all([
        Student.find(filter)
            .populate('teacherId', 'name email')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 }),
        Student.countDocuments(filter),
    ]);

    return sendSuccess(res, {
        students,
        pagination: buildPaginationMeta(total, page, limit),
    });
});

/**
 * @route   GET /api/students/:id
 * @desc    Get student by ID (scoped by ownership for teachers)
 * @access  Private
 */
const getStudentById = asyncHandler(async (req, res) => {
    const filter = { _id: req.params.id };
    if (req.user.role === 'teacher') filter.teacherId = req.user._id;

    const student = await Student.findOne(filter).populate('teacherId', 'name email');
    if (!student) {
        return sendError(res, 'Student not found or access denied.', 404);
    }

    return sendSuccess(res, { student });
});

/**
 * @route   PATCH /api/students/:id
 * @desc    Update student (scoped by ownership for teachers)
 * @access  Private
 */
const updateStudent = asyncHandler(async (req, res) => {
    const filter = { _id: req.params.id };
    if (req.user.role === 'teacher') filter.teacherId = req.user._id;

    // Prevent reassigning teacherId by a teacher
    if (req.user.role === 'teacher') delete req.body.teacherId;

    const student = await Student.findOneAndUpdate(
        filter,
        { $set: req.body },
        { new: true, runValidators: true }
    );

    if (!student) {
        return sendError(res, 'Student not found or access denied.', 404);
    }

    return sendSuccess(res, { student }, 'Student updated successfully');
});

/**
 * @route   DELETE /api/students/:id
 * @desc    Delete student (scoped by ownership for teachers)
 * @access  Private
 */
const deleteStudent = asyncHandler(async (req, res) => {
    const filter = { _id: req.params.id };
    if (req.user.role === 'teacher') filter.teacherId = req.user._id;

    const student = await Student.findOneAndDelete(filter);
    if (!student) {
        return sendError(res, 'Student not found or access denied.', 404);
    }

    return sendSuccess(res, null, 'Student deleted successfully');
});

module.exports = { createStudent, getAllStudents, getStudentById, updateStudent, deleteStudent };
