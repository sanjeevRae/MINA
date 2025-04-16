const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeApp, cert } = require('firebase-admin/app');
const { Groq } = require('groq-sdk');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const firebaseConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
};

initializeApp(firebaseConfig);

// Initialize Groq client
const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Import routes
const aiRoutes = require('./routes/ai');
const appointmentRoutes = require('./routes/appointments');

// Use routes
app.use('/api/ai', aiRoutes);
app.use('/api/appointments', appointmentRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'MediConnect API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});