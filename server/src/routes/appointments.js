const express = require('express');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const router = express.Router();

// Initialize Firestore
const db = getFirestore();
const appointmentsCollection = db.collection('appointments');

/**
 * Get all appointments for a doctor
 */
router.get('/doctor/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    
    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Verify the token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    // Check if user is a doctor (This could be improved with proper role-based checks)
    if (decodedToken.uid !== doctorId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const snapshot = await appointmentsCollection.where('doctorId', '==', doctorId).get();
    
    if (snapshot.empty) {
      return res.json({ appointments: [] });
    }
    
    const appointments = [];
    snapshot.forEach(doc => {
      appointments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json({ appointments });
  } catch (error) {
    console.error('Get Doctor Appointments Error:', error);
    res.status(500).json({ error: 'Error retrieving appointments' });
  }
});

/**
 * Get all appointments for a patient
 */
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    
    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Verify the token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    // Check if user is the patient
    if (decodedToken.uid !== patientId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const snapshot = await appointmentsCollection.where('patientId', '==', patientId).get();
    
    if (snapshot.empty) {
      return res.json({ appointments: [] });
    }
    
    const appointments = [];
    snapshot.forEach(doc => {
      appointments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json({ appointments });
  } catch (error) {
    console.error('Get Patient Appointments Error:', error);
    res.status(500).json({ error: 'Error retrieving appointments' });
  }
});

/**
 * Create a new appointment
 */
router.post('/', async (req, res) => {
  try {
    const { doctorId, patientId, date, time, reason } = req.body;
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    
    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!doctorId || !patientId || !date || !time) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Verify the token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    // Check if user is the patient creating the appointment
    if (decodedToken.uid !== patientId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Check if the selected time slot is available
    const existingAppointments = await appointmentsCollection
      .where('doctorId', '==', doctorId)
      .where('date', '==', date)
      .where('time', '==', time)
      .get();
    
    if (!existingAppointments.empty) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }
    
    // Create new appointment
    const appointment = {
      doctorId,
      patientId,
      date,
      time,
      reason: reason || 'General consultation',
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };
    
    const docRef = await appointmentsCollection.add(appointment);
    
    res.status(201).json({
      id: docRef.id,
      ...appointment
    });
  } catch (error) {
    console.error('Create Appointment Error:', error);
    res.status(500).json({ error: 'Error creating appointment' });
  }
});

/**
 * Update appointment status (cancel, complete, etc.)
 */
router.patch('/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    
    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    // Get the appointment
    const appointmentDoc = await appointmentsCollection.doc(appointmentId).get();
    
    if (!appointmentDoc.exists) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    const appointmentData = appointmentDoc.data();
    
    // Verify the token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    // Check if user is the patient or doctor associated with this appointment
    if (decodedToken.uid !== appointmentData.patientId && decodedToken.uid !== appointmentData.doctorId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Update the appointment
    await appointmentsCollection.doc(appointmentId).update({
      status,
      updatedAt: new Date().toISOString()
    });
    
    res.json({
      id: appointmentId,
      ...appointmentData,
      status,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update Appointment Error:', error);
    res.status(500).json({ error: 'Error updating appointment' });
  }
});

module.exports = router;