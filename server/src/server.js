const path = require('path');
const fs = require('fs');

// Ensure server/.env is loaded reliably regardless of working directory
// MongoDB Atlas Active Connection
const serverEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(serverEnvPath)) {
  require('dotenv').config({ path: serverEnvPath });
} else {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const { connectDB, getDbStatus } = require('./config/db');
const { testEmailConnection } = require('./services/emailService');
const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const documentRoutes = require('./routes/documentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const memoryDb = require('./services/memoryDb');
const User = require('./models/User');
const Group = require('./models/Group');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically so images & previews load smoothly
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'GroupShare Backend Service is operational',
    database: getDbStatus() ? 'MongoDB' : 'In-Memory Demo Store',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);

// Seed sample demo data for immediate testing
const seedDemoData = async () => {
  try {
    const isMongo = getDbStatus();
    const demoAdminEmail = 'admin@groupshare.local';

    const existingAdmin = isMongo
      ? await User.findOne({ email: demoAdminEmail })
      : await memoryDb.users.findByEmail(demoAdminEmail);

    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      let adminUser;
      if (isMongo) {
        adminUser = await User.create({
          name: 'Sarah Connor',
          email: demoAdminEmail,
          password: hashedPassword,
          phone: '+1 555-0199',
          bio: 'Lead System Architect & Admin',
          jobTitle: 'Senior Project Manager',
          department: 'Engineering',
          isVerified: true,
        });

        const demoGroup = await Group.create({
          name: 'Alpha Engineering Team',
          description: 'Official repository for technical specifications, blueprints, and meeting minutes.',
          category: 'Engineering',
          createdBy: adminUser._id,
          members: [
            {
              user: adminUser._id,
              email: adminUser.email,
              role: 'admin',
              joinedAt: new Date(),
            },
          ],
        });
      } else {
        adminUser = await memoryDb.users.create({
          name: 'Sarah Connor',
          email: demoAdminEmail,
          password: hashedPassword,
          phone: '+1 555-0199',
          bio: 'Lead System Architect & Admin',
          jobTitle: 'Senior Project Manager',
          department: 'Engineering',
          isVerified: true,
        });

        await memoryDb.groups.create({
          name: 'Alpha Engineering Team',
          description: 'Official repository for technical specifications, blueprints, and meeting minutes.',
          category: 'Engineering',
          createdBy: adminUser._id,
          members: [
            {
              user: adminUser._id,
              email: adminUser.email,
              role: 'admin',
              joinedAt: new Date(),
            },
          ],
        });
      }
      console.log('✅ Demo account seeded: admin@groupshare.local / password123');
    }
  } catch (err) {
    console.warn('Demo seed notice:', err.message);
  }
};

// Global error handling
app.use((err, req, res, next) => {
  console.error('[Server Error Middleware]:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
  });
});

// Start Server
const startServer = async () => {
  await connectDB();
  await seedDemoData();
  await testEmailConnection();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(` GroupShare Server is running on http://localhost:${PORT}`);
    console.log(` For Android Emulators use: http://10.0.2.2:${PORT}`);
    console.log(`For Physical Android Devices on LAN use: http://<YOUR_PC_LAN_IP>:${PORT}`);
  });
};

startServer();
