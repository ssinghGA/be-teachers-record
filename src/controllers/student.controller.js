const Student = require('../models/student.model');
const User = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const { getPagination, buildPaginationMeta } = require('../utils/pagination.util');
const { buildFilter } = require('../utils/filter.util');
const asyncHandler = require('../utils/asyncHandler.util');

/**
 * Build a role-scoped filter.
 */
const getScopeFilter = async (user, query) => {
    const filter = buildFilter(query, 'createdAt');
    if (user.role === 'teacher') {
        filter.teacherId = user._id;
    } else if (user.role === 'student') {
        const student = await Student.findOne({ userId: user._id });
        if (student) filter._id = student._id;
        else filter._id = null; // Force empty result if unlinked
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
        email, password, subject, feePerClass, startDate, status, notes,
    } = req.body;

    // Teacher ID comes from the authenticated user for teachers
    const teacherId =
        req.user.role === 'teacher' ? req.user._id : req.body.teacherId;

    if (!teacherId) {
        return sendError(res, 'teacherId is required for admin-created students.', 400);
    }

    // Check if email is provided to create a login account
    let userId = undefined;
    let existingUserMessage = undefined;
    if (email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            // ✅ Student already has a portal account — reuse the same User ID.
            // This allows multiple teachers to enroll the same student.
            userId = existingUser._id;
            existingUserMessage = 'Student linked to existing portal account successfully';
        } else {
            // New student — create a fresh login account
            const newUser = await User.create({
                name,
                email,
                password: password || 'student123',
                role: 'student',
                phone: parentPhone
            });
            userId = newUser._id;
        }
    }

    const student = await Student.create({
        name, class: studentClass, school, parentName, parentPhone,
        email, subject, feePerClass, teacherId, userId, startDate, status, notes,
    });

    return sendSuccess(res, { student }, existingUserMessage || 'Student created successfully', 201);
});

/**
 * @route   POST /api/students/check-email
 * @desc    Check if an email is already registered as a user
 * @access  Private [teacher, admin]
 */
const checkStudentEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);

    const existingUser = await User.findOne({ email });
    return sendSuccess(res, { 
        exists: !!existingUser, 
        user: existingUser ? { name: existingUser.name } : null 
    });
});

/**
 * @route   GET /api/students
 * @desc    Get all students. Teachers get their own; admins get all.
 * @access  Private
 */
const getAllStudents = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const filter = await getScopeFilter(req.user, req.query);

    // Optional search by name
    if (req.query.search) {
        filter.name = new RegExp(req.query.search, 'i');
    }

    const [students, total] = await Promise.all([
        Student.find(filter)
            .populate('teacherId', 'name email googleMeetLink')
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
    const filter = await getScopeFilter(req.user, { _id: req.params.id });

    const student = await Student.findOne(filter).populate('teacherId', 'name email googleMeetLink');
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
    const filter = await getScopeFilter(req.user, { _id: req.params.id });

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
    const filter = await getScopeFilter(req.user, { _id: req.params.id });

    const student = await Student.findOneAndDelete(filter);
    if (!student) {
        return sendError(res, 'Student not found or access denied.', 404);
    }

    return sendSuccess(res, null, 'Student deleted successfully');
});

module.exports = { createStudent, getAllStudents, getStudentById, updateStudent, deleteStudent, checkStudentEmail };
