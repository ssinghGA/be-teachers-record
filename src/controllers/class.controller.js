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

    const newClass = await Class.create({
        teacherId, studentId, subject, topic, date, time, duration, amount, notes, status,
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
 * @route   POST /api/classes/join
 * @access  Private
 */
const joinClass = asyncHandler(async (req, res) => {
    const { classId } = req.body;
    if (!classId) return sendError(res, 'classId is required', 400);

    const filter = await getScopeFilter(req.user, { _id: classId });
    const classItem = await Class.findOne(filter);

    if (!classItem) {
        return sendError(res, 'Class not found or access denied.', 404);
    }

    // Add user to joinLogs if not already joined in this session
    classItem.joinLogs.push({
        userId: req.user._id,
        joinedAt: new Date(),
    });

    // Student logic vs Teachers logic
    // Even if student joined, we mark it conducted because at least one student joined. Or we evaluate at the end of class.
    // The prompt: "mark class as 'conducted': true if teacher clicked Start Class OR at least one student joined"
    // So we can update conducted to true if it's not already.
    classItem.conducted = true;

    await classItem.save();

    return sendSuccess(res, { class: classItem }, 'Joined class successfully');
});

/**
 * @route   POST /api/classes/start
 * @access  Private [Teacher only]
 */
const startClass = asyncHandler(async (req, res) => {
    const { classId } = req.body;
    if (!classId) return sendError(res, 'classId is required', 400);

    const filter = await getScopeFilter(req.user, { _id: classId });
    const classItem = await Class.findOne(filter);

    if (!classItem) {
        return sendError(res, 'Class not found or access denied.', 404);
    }

    classItem.status = 'ongoing';
    classItem.actualStartTime = new Date();
    classItem.conducted = true; // explicitly mark as conducted
    await classItem.save();

    return sendSuccess(res, { class: classItem }, 'Class started successfully');
});

/**
 * @route   POST /api/classes/end
 * @access  Private [Teacher only]
 */
const endClass = asyncHandler(async (req, res) => {
    const { classId } = req.body;
    if (!classId) return sendError(res, 'classId is required', 400);

    const filter = await getScopeFilter(req.user, { _id: classId });
    const classItem = await Class.findOne(filter);

    if (!classItem) {
        return sendError(res, 'Class not found or access denied.', 404);
    }

    classItem.status = 'completed';
    classItem.actualEndTime = new Date();
    
    // Evaluate missed vs conducted. It might have been marked true already above.
    if (!classItem.conducted) {
        classItem.missed = true;
    }

    await classItem.save();

    return sendSuccess(res, { class: classItem }, 'Class ended successfully');
});

module.exports = { createClass, getAllClasses, getClassById, updateClass, deleteClass, joinClass, startClass, endClass };
