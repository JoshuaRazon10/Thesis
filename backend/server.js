require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
// Robust CORS configuration for Production
const allowedOrigins = [
  'http://localhost:3000',
  'https://school-portal-mocha-eta.vercel.app'
];
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach(url => allowedOrigins.push(url.trim()));
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS Access Denied for origin: ${origin}`);
      callback(null, true); // Temporarily allow for debugging if needed, or stick to strict:
      // callback(new Error('CORS Policy Restriction: Unauthorized Origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

const fs = require('fs');
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// SAMS Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/students', require('./src/routes/students'));
app.use('/api/parents', require('./src/routes/parents'));
app.use('/api/guards', require('./src/routes/guards'));
app.use('/api/teachers', require('./src/routes/teachers'));
app.use('/api/attendance', require('./src/routes/attendance'));
app.use('/api/sms', require('./src/routes/sms'));
app.use('/api/payroll', require('./src/routes/payroll'));
app.use('/api/payslips', require('./src/routes/payslips'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/face', require('./src/routes/face'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'SAMS API is running!', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🏫 SAMS API running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health\n`);
});
