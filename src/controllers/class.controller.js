const Class = require('../models/class.model');
const Student = require('../models/student.model');
const { sendSuccess, sendError } = require('../utils/response.util');
const { getPagination, buildPaginationMeta } = require('../utils/pagination.util');
const { buildFilter } = require('../utils/filter.util');
const asyncHandler = require('../utils/asyncHandler.util');

const getScopeFilter = async (user, query) => {
    const filter = buildFilter(query, 'date');
    if (user.role === 'teacher') {
        filter.teacherId = user._id;
    } else if (user.role === 'student') {
        const students = await Student.find({ userId: user._id });
        if (students.length > 0) filter.studentId = { $in: students.map(s => s._id) };
        else filter.studentId = null; 
    } else if (query.teacherId) {
        filter.teacherId = query.teacherId;
    }
    return filter;
};

/**
 * @route   POST /api/classes
 * @access  Private [all authenticated]
 */
const createClass = asyncHandler(async (req, res) => {
    const { studentId, subject, topic, date, time, duration, amount, notes, status } = req.body;

    const teacherId = req.user.role === 'teacher' ? req.user._id : req.body.teacherId;
    if (!teacherId) {
        return sendError(res, 'teacherId is required.', 400);
    }

    // If amount is not provided, fetch it from the student's feePerClass
    let finalAmount = amount;
    if (finalAmount === undefined || finalAmount === null) {
        const student = await Student.findById(studentId);
        if (student) {
            finalAmount = student.feePerClass;
        }
    }

    const newClass = await Class.create({
        teacherId, studentId, subject, topic, date, time, duration, amount: finalAmount || 0, notes, status,
    });

    return sendSuccess(res, { class: newClass }, 'Class created successfully', 201);
});

/**
 * @route   GET /api/classes
 * @access  Private
 */
const getAllClasses = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const filter = await getScopeFilter(req.user, req.query);

    const [classes, total] = await Promise.all([
        Class.find(filter)
            .populate('teacherId', 'name email googleMeetLink')
            .populate('studentId', 'name class')
            .skip(skip)
            .limit(limit)
            .sort({ date: -1 }),
        Class.countDocuments(filter),
    ]);

    return sendSuccess(res, {
        classes,
        pagination: buildPaginationMeta(total, page, limit),
    });
});

/**
 * @route   GET /api/classes/:id
 * @access  Private
 */
const getClassById = asyncHandler(async (req, res) => {
    const filter = await getScopeFilter(req.user, { _id: req.params.id });

    const classItem = await Class.findOne(filter)
        .populate('teacherId', 'name email googleMeetLink')
        .populate('studentId', 'name class');

    if (!classItem) {
        return sendError(res, 'Class not found or access denied.', 404);
    }

    return sendSuccess(res, { class: classItem });
});

/**
 * @route   PATCH /api/classes/:id
 * @access  Private
 */
const updateClass = asyncHandler(async (req, res) => {
    const filter = await getScopeFilter(req.user, { _id: req.params.id });

    if (req.user.role === 'teacher') delete req.body.teacherId;

    const classItem = await Class.findOneAndUpdate(
        filter,
        { $set: req.body },
        { new: true, runValidators: true }
    );

    if (!classItem) {
        return sendError(res, 'Class not found or access denied.', 404);
    }

    return sendSuccess(res, { class: classItem }, 'Class updated successfully');
});

/**
 * @route   DELETE /api/classes/:id
 * @access  Private
 */
const deleteClass = asyncHandler(async (req, res) => {
    const filter = await getScopeFilter(req.user, { _id: req.params.id });

    const classItem = await Class.findOneAndDelete(filter);
    if (!classItem) {
        return sendError(res, 'Class not found or access denied.', 404);
    }

    return sendSuccess(res, null, 'Class deleted successfully');
});

/**
 * @route   POST /api/classes/start
 * @access  Private [Teacher]
 */
const startClass = asyncHandler(async (req, res) => {
    const { classId } = req.body;
    const classItem = await Class.findById(classId);

    if (!classItem) {
        return sendError(res, 'Class not found.', 404);
    }

    if (req.user.role === 'teacher' && classItem.teacherId.toString() !== req.user._id.toString()) {
        return sendError(res, 'Access denied.', 403);
    }

    classItem.status = 'ongoing';
    classItem.actualStartTime = new Date();
    classItem.conducted = true;
    await classItem.save();

    return sendSuccess(res, { class: classItem }, 'Class started successfully');
});

/**
 * @route   POST /api/classes/end
 * @access  Private [Teacher]
 */
const endClass = asyncHandler(async (req, res) => {
    const { classId } = req.body;
    const classItem = await Class.findById(classId);

    if (!classItem) {
        return sendError(res, 'Class not found.', 404);
    }

    if (req.user.role === 'teacher' && classItem.teacherId.toString() !== req.user._id.toString()) {
        return sendError(res, 'Access denied.', 403);
    }

    classItem.status = 'completed';
    classItem.actualEndTime = new Date();
    await classItem.save();

    return sendSuccess(res, { class: classItem }, 'Class ended successfully');
});

/**
 * @route   POST /api/classes/join
 * @access  Private [Student]
 */
const joinClass = asyncHandler(async (req, res) => {
    const { classId } = req.body;
    
    // Find the student linked to this user
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
        return sendError(res, 'Student record not found.', 404);
    }

    const classItem = await Class.findById(classId);
    if (!classItem) {
        return sendError(res, 'Class not found.', 404);
    }

    // Verify student is assigned to this class
    if (classItem.studentId.toString() !== student._id.toString()) {
        return sendError(res, 'You are not assigned to this class.', 403);
    }

    // Add to join history if not already there (or every time if we want to track multiple joins)
    classItem.studentJoins.push({
        studentId: student._id,
        joinedAt: new Date()
    });

    // If student joins, mark as conducted
    classItem.conducted = true;
    
    // Status will only be updated by the teacher manually now.

    await classItem.save();

    return sendSuccess(res, { class: classItem }, 'Joined class successfully');
});

module.exports = { 
    createClass, 
    getAllClasses, 
    getClassById, 
    updateClass, 
    deleteClass, 
    startClass, 
    endClass,
    joinClass
};
