const Class = require('../models/class.model');

const startClassStatusCron = () => {
    // Run every minute
    setInterval(async () => {
        try {
            const now = new Date();
            // Automatically determine status...
            // the problem says "when endTime has passed, mark as completed".
            // we don't strictly have an endTime field, but we can compute it if needed, or query actualEndTime, or use date + time + duration.
            
            // To be precise: If a class has 'duration' in minutes, and its 'date' (which is the start datetime) is more than duration minutes in the past.
            // But wait, the prompt says "Each class has startTime and endTime. Automatically determine status using: if (now < startTime) status = 'scheduled'; if (now >= startTime && now <= endTime) status = 'ongoing'; if (now > endTime) status = 'completed';"
            // We should use an updateMany based on current time.
            
            // fetch all classes not completed
            const classes = await Class.find({ status: { $ne: 'completed' } });
            
            for (let c of classes) {
                // Determine startTime and endTime
                let startTime;
                let endTime;
                
                // if we have actual startTime and endTime...
                if (c.actualStartTime) {
                    startTime = new Date(c.actualStartTime);
                } else {
                    // Try to guess from 'date' + 'time' fields
                    // date is a Date object. time is a string like "10:30"
                    startTime = new Date(c.date);
                    if (c.time) {
                        const [hours, minutes] = c.time.split(':');
                        startTime.setHours(parseInt(hours, 10));
                        startTime.setMinutes(parseInt(minutes, 10));
                    }
                }
                
                if (c.actualEndTime) {
                    endTime = new Date(c.actualEndTime);
                } else if (c.duration) {
                    endTime = new Date(startTime.getTime() + c.duration * 60000);
                } else {
                    // Default to 1 hour
                    endTime = new Date(startTime.getTime() + 60 * 60000);
                }
                
                let newStatus = c.status;
                if (now < startTime) {
                    newStatus = 'scheduled';
                } else if (now >= startTime && now <= endTime) {
                    newStatus = 'ongoing';
                } else if (now > endTime) {
                    newStatus = 'completed';
                    if (!c.conducted && !c.missed) {
                        // "If teacher clicked Start Class OR at least one student joined -> conducted: true. Else -> missed: true."
                        // since conducted is set to true when joining or starting, we just mark missed if not conducted.
                        c.missed = true;
                    }
                }
                
                if (newStatus !== c.status || (now > endTime && !c.conducted && !c.missed)) {
                    c.status = newStatus;
                    await c.save();
                }
            }
        } catch (error) {
            console.error('Error running status cron:', error);
        }
    }, 60000);
};

module.exports = { startClassStatusCron };
