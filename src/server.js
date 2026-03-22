const app = require('./app');
const connectDB = require('./config/db');
const { PORT } = require('./config/env');
const { startClassStatusCron } = require('./utils/cron');

const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
        startClassStatusCron();
    });
};

startServer();
