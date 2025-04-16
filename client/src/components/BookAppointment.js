import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentService, messageService } from '../services/api';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

const BookAppointment = ({ user, onClose }) => {
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [appointmentData, setAppointmentData] = useState({
    doctorId: '',
    date: '',
    time: '',
    reason: '',
    message: '', 
  });
  const [availableTimes, setAvailableTimes] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [messageCharCount, setMessageCharCount] = useState(0); 
  const navigate = useNavigate();

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      const displayHour = hour > 12 ? hour - 12 : hour;
      const amPm = hour >= 12 ? 'PM' : 'AM';
      slots.push(`${displayHour}:00 ${amPm}`);
      if (hour < 18) {
        slots.push(`${displayHour}:30 ${amPm}`);
      }
    }
    return slots;
  };

  useEffect(() => {
    const fetchDoctors = async () => {
      setLoadingDoctors(true);
      setError('');
      
      try {
        if (!auth.currentUser) {
          console.log('User not authenticated, redirecting to login');
          setError('Please log in to book an appointment');
          navigate('/login');
          setLoadingDoctors(false);
          return;
        }
        
        console.log('Fetching doctors from Firestore...');
        
        if (!db) {
          console.error('Firestore db is not initialized properly');
          setError('Database connection error. Please try again later.');
          setLoadingDoctors(false);
          return;
        }
        
        const doctorsQuery = query(collection(db, 'users'), where('role', '==', 'doctor'));
        
        try {
          const doctorSnapshot = await getDocs(doctorsQuery);
          
          if (doctorSnapshot.empty) {
            console.log('No doctors found in the database');
            setDoctors([]);
            setLoadingDoctors(false);
            return;
          }
          
          const doctorsList = [];
          doctorSnapshot.forEach(doc => {
            const doctorData = doc.data();
            doctorsList.push({
              id: doc.id,
              fullName: doctorData.fullName || 'Unknown Doctor',
              specialty: doctorData.specialty || 'General',
              ...doctorData
            });
          });
          
          console.log(`Found ${doctorsList.length} doctors`);
          setDoctors(doctorsList);
        } catch (firestoreError) {
          console.error('Firestore query error:', firestoreError);
          
          if (firestoreError.code === 'permission-denied') {
            setError('Missing or insufficient permissions. Please make sure you are logged in.');
          } else {
            setError(`Failed to load doctors: ${firestoreError.message}`);
          }
        }
      } catch (error) {
        console.error('Error fetching doctors:', error);
        setError(`Failed to load doctors: ${error.message}`);
      } finally {
        setLoadingDoctors(false);
      }
    };

    fetchDoctors();
  }, [navigate]);

  useEffect(() => {
    const updateAvailableTimes = async () => {
      if (!appointmentData.doctorId || !appointmentData.date) {
        setAvailableTimes([]);
        return;
      }

      try {
        
        const allTimeSlots = generateTimeSlots();
        
        setAvailableTimes(allTimeSlots);
      } catch (error) {
        console.error('Error checking availability:', error);
        setError('Failed to load available times');
      }
    };

    updateAvailableTimes();
  }, [appointmentData.doctorId, appointmentData.date]);

  const handleChange = (e) => {
    setAppointmentData({
      ...appointmentData,
      [e.target.name]: e.target.value,
    });
    
    if (e.target.name === 'reason') {
      setCharCount(e.target.value.length);
    } else if (e.target.name === 'message') {
      setMessageCharCount(e.target.value.length);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitLoading(true);

    try {
      if (!user) {
        navigate('/login');
        return;
      }

      if (!appointmentData.doctorId || !appointmentData.date || !appointmentData.time) {
        setError('Please fill in all required fields');
        setSubmitLoading(false);
        return;
      }

      const appointment = {
        doctorId: appointmentData.doctorId,
        date: appointmentData.date,
        time: appointmentData.time,
        reason: appointmentData.reason || 'General consultation',
        patientId: user.uid,
        patientName: user.displayName || 'Patient',
        status: 'scheduled',
        createdAt: new Date().toISOString() 
      };

      const createdAppointment = await appointmentService.createAppointment(appointment);
      console.log('Appointment created successfully:', createdAppointment.id);
      
      if (appointmentData.message && appointmentData.message.trim()) {
        try {
          const message = {
            doctorId: appointmentData.doctorId,
            patientId: user.uid,
            content: appointmentData.message.trim(),
            appointmentId: createdAppointment.id,
            patientName: user.displayName || 'Patient',
            type: 'appointment_message',
            subject: `Regarding appointment on ${appointmentData.date} at ${appointmentData.time}`
          };
          
          const sentMessage = await messageService.sendMessage(message);
          console.log('Message sent successfully:', sentMessage.id);
        } catch (messageError) {
          console.error('Error sending message:', messageError);
        }
      }
      
      alert('Appointment booked successfully!');
      navigate('/patient-dashboard');
    } catch (error) {
      console.error('Error booking appointment:', error);
      setError('Failed to book appointment. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/patient-dashboard');
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-screen overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Book an Appointment</h3>
            <p className="mt-1 text-sm text-gray-500">
              Fill out the form below to schedule a video consultation with a doctor.
            </p>
          </div>
          <button 
            type="button"
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
          <div>
            <label htmlFor="doctorId" className="block text-sm font-medium text-gray-700 mb-1">
              Select Doctor
            </label>
            <select
              id="doctorId"
              name="doctorId"
              className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
              value={appointmentData.doctorId}
              onChange={handleChange}
              required
            >
              <option value="">-- Select a doctor --</option>
              {loadingDoctors ? (
                <option disabled>Loading doctors...</option>
              ) : (
                doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.fullName}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              name="date"
              id="date"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm py-2.5 px-3 focus:ring-primary focus:border-primary sm:text-sm"
              value={appointmentData.date}
              onChange={handleChange}
              min={today}
              required
            />
          </div>

          <div>
            <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
              Time
            </label>
            <select
              id="time"
              name="time"
              className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
              value={appointmentData.time}
              onChange={handleChange}
              disabled={!appointmentData.doctorId || !appointmentData.date}
              required
            >
              <option value="">-- Select a time slot --</option>
              {!appointmentData.doctorId || !appointmentData.date ? (
                <option disabled>Select a doctor and date first</option>
              ) : availableTimes.length === 0 ? (
                <option disabled>No available time slots</option>
              ) : (
                availableTimes.map(time => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Visit
            </label>
            <div className="relative">
              <textarea
                id="reason"
                name="reason"
                rows={4}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm 
                focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm
                transition-all duration-200 ease-in-out
                bg-white bg-opacity-90 hover:bg-opacity-100 
                placeholder-gray-400 resize-none p-3"
                placeholder="Please briefly describe your symptoms or reason for the appointment..."
                value={appointmentData.reason}
                onChange={handleChange}
                maxLength={500}
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                {charCount}/500 characters
              </div>
            </div>
            <p className="text-xs text-gray-500 italic">
              Providing detailed information will help the doctor prepare for your appointment.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {submitLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Booking...
                </>
              ) : (
                'Book Appointment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookAppointment;