import { auth, db } from './firebase';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc, Timestamp, orderBy } from 'firebase/firestore';

const getAuthToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  
  return await currentUser.getIdToken();
};

export const aiService = {

  getFirstAidAssistance: async (emergency) => {
    try {
     
      if (emergency.toLowerCase().includes('burn')) {
        return {
          response: `For a ${emergency}, follow these steps:\n\n1. Remove the person from the heat source to stop the burning.\n2. Cool the burn with cool (not cold) running water for 10-15 minutes.\n3. Remove jewelry or tight items from the burned area.\n4. Cover the burn with a sterile, non-adhesive bandage or clean cloth.\n5. Take over-the-counter pain relievers if needed.\n6. Seek medical attention for severe burns or if the burn affects a large area.`,
          disclaimer: "For serious burns, seek immediate medical attention."
        };
      } else if (emergency.toLowerCase().includes('cut') || emergency.toLowerCase().includes('bleeding')) {
        return {
          response: `For ${emergency}, follow these steps:\n\n1. Apply direct pressure to the wound using a clean cloth or bandage.\n2. If possible, elevate the wounded area above the heart.\n3. Clean the wound gently with mild soap and water once bleeding slows.\n4. Apply antibiotic ointment and cover with a sterile bandage.\n5. Seek medical attention for deep cuts, puncture wounds, or if bleeding doesn't stop after 15 minutes of pressure.`,
          disclaimer: "For severe bleeding, call emergency services immediately."
        };
      } else if (emergency.toLowerCase().includes('chok') || emergency.toLowerCase().includes('heimlich')) {
        return {
          response: `For choking, follow these steps:\n\n1. Encourage the person to cough forcefully if they can.\n2. If they cannot cough, speak, or breathe, stand behind them and wrap your arms around their waist.\n3. Make a fist with one hand and place it thumb-side against their abdomen, just above the navel.\n4. Grasp your fist with your other hand and pull inward and upward in quick, separate thrusts.\n5. Repeat until the object is dislodged or emergency services arrive.`,
          disclaimer: "Call emergency services immediately if the person becomes unconscious."
        };
      } else if (emergency.toLowerCase().includes('frost') || emergency.toLowerCase().includes('freezing')) {
        return {
          response: `For frostbite or freezing injuries, follow these steps:\n\n1. Move to a warm location and remove wet or tight clothing.\n2. Immerse the affected area in warm (not hot) water, around 104-108°F (40-42°C).\n3. DO NOT rub or massage the area as this can cause more damage.\n4. DO NOT use direct heat like heating pads or fire.\n5. Wrap the area in dry, sterile bandages, separating affected fingers or toes.\n6. Seek medical attention as soon as possible.`,
          disclaimer: "Always seek medical attention for frostbite, as proper treatment is essential to prevent permanent damage."
        };
      } else {
        return {
          response: `For ${emergency}, follow these general first aid steps:\n\n1. Stay calm and ensure the scene is safe.\n2. Assess the situation and the person's condition.\n3. Call emergency services if the situation is serious.\n4. If the person is conscious, get consent before providing care.\n5. Use appropriate first aid measures for the specific situation.\n6. Monitor the person until help arrives.`,
          disclaimer: "This is general advice. For serious emergencies, always call emergency services immediately."
        };
      }
    } catch (error) {
      console.error('First Aid Service Error:', error);
      throw error;
    }
  },
  
  analyzeSymptomsAssistance: async (symptoms) => {
    try {
      if (symptoms.toLowerCase().includes('fever') && (symptoms.toLowerCase().includes('cough') || symptoms.toLowerCase().includes('sore throat'))) {
        return {
          response: `Your symptoms (${symptoms}) might indicate a respiratory infection such as a cold, flu, or COVID-19. Common differences:\n\n- Cold: Gradual onset, mild symptoms, rarely causes fever\n- Flu: Sudden onset, higher fever, body aches, fatigue\n- COVID-19: May include loss of taste/smell, shortness of breath\n\nRecommendations:\n1. Rest and stay hydrated\n2. Take over-the-counter fever reducers if needed\n3. Monitor symptoms for worsening\n4. Consider testing for COVID-19\n5. Seek medical attention if you develop difficulty breathing, persistent chest pain, confusion, or bluish lips or face.`,
          disclaimer: "This is not a diagnosis. Please consult a healthcare provider for proper evaluation."
        };
      } else if (symptoms.toLowerCase().includes('headache')) {
        return {
          response: `Your headache symptoms (${symptoms}) could be related to several conditions:\n\n- Tension headache: Usually feels like pressure or tightness around the head\n- Migraine: Often one-sided, pulsating, with sensitivity to light/sound\n- Cluster headache: Severe pain around one eye\n- Sinus headache: Pain and pressure around sinuses, often with congestion\n\nPossible triggers include stress, dehydration, eye strain, or lack of sleep.\n\nRecommendations:\n1. Rest in a quiet, dark room\n2. Stay hydrated\n3. Consider over-the-counter pain relievers\n4. Apply cool compress to your forehead\n5. Manage stress through relaxation techniques\n\nSeek immediate medical attention if your headache is sudden and severe, follows a head injury, or is accompanied by fever, stiff neck, confusion, seizures, double vision, weakness, numbness, or difficulty speaking.`,
          disclaimer: "This information is not a diagnosis. Please consult a healthcare provider if headaches are severe or persistent."
        };
      } else if (symptoms.toLowerCase().includes('rash') || symptoms.toLowerCase().includes('skin')) {
        return {
          response: `Your skin symptoms (${symptoms}) could be caused by various conditions:\n\n- Contact dermatitis: Reaction to an irritant or allergen\n- Eczema: Dry, itchy, inflamed skin\n- Hives: Raised, itchy welts\n- Fungal infection: Often red, scaly, and itchy\n- Viral rash: Associated with a viral infection\n\nRecommendations:\n1. Avoid scratching the affected area\n2. Use mild, fragrance-free soap and moisturizers\n3. Apply cool compresses for itching\n4. Consider over-the-counter hydrocortisone cream\n5. Take an antihistamine if itching is severe\n\nSeek medical attention if the rash is widespread, painful, blistering, or accompanied by fever, swelling of the face/throat, or difficulty breathing.`,
          disclaimer: "This information is not a diagnosis. Please consult a healthcare provider for proper evaluation of skin conditions."
        };
      } else {
        return {
          response: `Based on your symptoms (${symptoms}), it's difficult to provide specific information without more details. Common causes of general discomfort include:\n\n- Viral or bacterial infections\n- Stress and anxiety\n- Lack of sleep\n- Dehydration\n- Nutritional deficiencies\n- Medication side effects\n\nGeneral recommendations:\n1. Rest and ensure adequate sleep\n2. Stay hydrated\n3. Maintain a balanced diet\n4. Manage stress through relaxation techniques\n5. Consider over-the-counter remedies appropriate for your symptoms\n\nIf symptoms persist for more than a few days, worsen, or are accompanied by high fever, severe pain, difficulty breathing, chest pain, or confusion, please consult a healthcare provider.`,
          disclaimer: "This is not a diagnosis. Always consult a medical professional for proper evaluation of your symptoms."
        };
      }
    } catch (error) {
      console.error('Symptoms Service Error:', error);
      throw error;
    }
  },
  
  interpretHealthReport: async (report) => {
    try {
      if (report.toLowerCase().includes('cholesterol') || report.toLowerCase().includes('lipid')) {
        return {
          response: `Regarding your lipid/cholesterol report:\n\nKey measurements and their typical healthy ranges:\n- Total Cholesterol: Below 200 mg/dL is desirable\n- LDL ("bad") Cholesterol: Below 100 mg/dL is optimal\n- HDL ("good") Cholesterol: Above 60 mg/dL is considered protective\n- Triglycerides: Below 150 mg/dL is normal\n\nIf your levels are outside these ranges, your doctor might recommend:\n1. Dietary changes (reducing saturated fats, increasing fiber)\n2. Regular physical activity\n3. Weight management\n4. Medication in some cases\n\nRegular monitoring is important for heart health.`,
          disclaimer: "This is general information. Please discuss your specific results with your healthcare provider."
        };
      } else if (report.toLowerCase().includes('blood sugar') || report.toLowerCase().includes('glucose') || report.toLowerCase().includes('a1c')) {
        return {
          response: `Regarding your blood glucose/diabetes-related report:\n\nKey measurements and their typical healthy ranges:\n- Fasting Blood Glucose: 70-99 mg/dL is normal\n- Hemoglobin A1C: Below 5.7% is normal\n- Random Blood Glucose: Below 140 mg/dL is normal\n\nIf your levels are elevated:\n- Prediabetes: Fasting glucose 100-125 mg/dL or A1C 5.7-6.4%\n- Diabetes: Fasting glucose above 126 mg/dL or A1C 6.5% or higher\n\nManagement typically involves:\n1. Dietary changes\n2. Regular physical activity\n3. Weight management\n4. Medication if prescribed\n5. Regular monitoring`,
          disclaimer: "This is general information. Please discuss your specific results with your healthcare provider."
        };
      } else if (report.toLowerCase().includes('liver') || report.toLowerCase().includes('alt') || report.toLowerCase().includes('ast')) {
        return {
          response: `Regarding your liver function tests:\n\nCommon liver enzymes and their normal ranges:\n- ALT (Alanine Transaminase): 7-56 U/L\n- AST (Aspartate Transaminase): 5-40 U/L\n- ALP (Alkaline Phosphatase): 44-147 U/L\n- Bilirubin: 0.1-1.2 mg/dL\n\nElevated liver enzymes can indicate:\n- Medication effects\n- Alcohol consumption\n- Fatty liver disease\n- Viral hepatitis\n- Other liver conditions\n\nIf your levels are elevated, your doctor might recommend:\n1. Additional testing\n2. Dietary changes\n3. Reducing alcohol intake\n4. Medication adjustments\n5. Treatment for any underlying condition`,
          disclaimer: "This is general information. Please discuss your specific results with your healthcare provider."
        };
      } else {
        return {
          response: `Regarding your health report:\n\nMedical reports can contain many measurements and technical terms. Without more specific details about which test results you're curious about, I can provide some general guidance:\n\n1. Look for values marked as "high," "low," or outside the reference range.\n\n2. The reference range is typically shown next to your result, indicating what's considered normal.\n\n3. Minor deviations from the reference range may not be clinically significant.\n\n4. Test results should be interpreted in the context of your overall health, symptoms, and medical history.\n\n5. Your healthcare provider is the best person to explain the significance of your specific results.\n\nIf you'd like more specific information, please mention the particular test or values you're interested in.`,
          disclaimer: "This is general information. Always review your test results with a qualified healthcare provider."
        };
      }
    } catch (error) {
      console.error('Health Report Service Error:', error);
      throw error;
    }
  }
};

export const appointmentService = {
  getPatientAppointments: async (patientId) => {
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef, where("patientId", "==", patientId));
      const querySnapshot = await getDocs(q);
      
      const appointments = [];
      querySnapshot.forEach((doc) => {
        appointments.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return appointments;
    } catch (error) {
      console.error('Get Patient Appointments Error:', error);
      throw error;
    }
  },
  
  getDoctorAppointments: async (doctorId) => {
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(appointmentsRef, where("doctorId", "==", doctorId));
      const querySnapshot = await getDocs(q);
      
      const appointments = [];
      querySnapshot.forEach((doc) => {
        appointments.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return appointments;
    } catch (error) {
      console.error('Get Doctor Appointments Error:', error);
      throw error;
    }
  },
  
  createAppointment: async (appointmentData) => {
    try {
      const appointmentsRef = collection(db, 'appointments');
      const newAppointment = {
        ...appointmentData,
        status: appointmentData.status || 'pending',
        createdAt: Timestamp.now()
      };
      
      const docRef = await addDoc(appointmentsRef, newAppointment);
      return {
        id: docRef.id,
        ...newAppointment
      };
    } catch (error) {
      console.error('Create Appointment Error:', error);
      throw error;
    }
  },
  
  updateAppointmentStatus: async (appointmentId, status) => {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, { 
        status,
        updatedAt: Timestamp.now()
      });
      
      const updatedDoc = await getDoc(appointmentRef);
      return {
        id: updatedDoc.id,
        ...updatedDoc.data()
      };
    } catch (error) {
      console.error('Update Appointment Error:', error);
      throw error;
    }
  }
};

export const messageService = {
  sendMessage: async (message) => {
    try {
      console.log('Sending message to doctor user document:', message);
      
      const doctorRef = doc(db, 'users', message.doctorId);
      const doctorDoc = await getDoc(doctorRef);
      
      if (!doctorDoc.exists()) {
        console.error(`Doctor document with ID ${message.doctorId} not found`);
        throw new Error('Doctor document not found');
      }
      
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newMessage = {
        id: messageId,
        ...message,
        createdAt: Timestamp.now(),
        read: false
      };
      
      const currentData = doctorDoc.data();
      
      const messages = Array.isArray(currentData.messages) ? currentData.messages : [];
      
      await updateDoc(doctorRef, {
        messages: [...messages, newMessage]
      });
      
      console.log('Message successfully added to doctor user document with ID:', messageId);
      return newMessage;
    } catch (error) {
      console.error('Send Message Error:', error);
      throw error;
    }
  },
  
  getDoctorMessages: async (doctorId) => {
    try {
      if (!doctorId) {
        console.error('Doctor ID is required to fetch messages');
        return [];
      }
      
      console.log('Fetching messages for doctor:', doctorId);
      
      const doctorRef = doc(db, 'users', doctorId);
      const doctorDoc = await getDoc(doctorRef);
      
      if (!doctorDoc.exists()) {
        console.error(`Doctor document with ID ${doctorId} not found`);
        return [];
      }
      
      const userData = doctorDoc.data();
      
      const messages = Array.isArray(userData.messages) ? userData.messages : [];
      
      console.log(`Retrieved ${messages.length} messages for doctor:`, doctorId);
      
      if (messages.length > 0) {
        console.log('Sample message:', messages[0]);
      }
      
      return messages.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds : 
                     (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 
                     (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() / 1000 : 0));
        
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds : 
                     (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 
                     (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() / 1000 : 0));
        
        return timeB - timeA;
      });
    } catch (error) {
      console.error('Get Doctor Messages Error:', error);
      return [];
    }
  },
  
  markAsRead: async (doctorId, messageId) => {
    try {
      if (!doctorId || !messageId) {
        console.error('Both doctorId and messageId are required');
        throw new Error('Missing required parameters');
      }
      
      console.log(`Marking message ${messageId} as read for doctor ${doctorId}`);
      
      // Get the doctor's user document
      const doctorRef = doc(db, 'users', doctorId);
      const doctorDoc = await getDoc(doctorRef);
      
      if (!doctorDoc.exists()) {
        console.error(`Doctor document with ID ${doctorId} not found`);
        throw new Error('Doctor document not found');
      }
      
      const userData = doctorDoc.data();
      const messages = Array.isArray(userData.messages) ? userData.messages : [];
      
      const messageExists = messages.some(msg => msg.id === messageId);
      if (!messageExists) {
        console.error(`Message with ID ${messageId} not found`);
        throw new Error('Message not found');
      }
      
      const updatedMessages = messages.map(message => 
        message.id === messageId 
          ? { ...message, read: true, readAt: Timestamp.now() } 
          : message
      );
      
      await updateDoc(doctorRef, { messages: updatedMessages });
      console.log(`Message ${messageId} marked as read successfully`);
      
      const updatedMessage = updatedMessages.find(message => message.id === messageId);
      return updatedMessage || null;
    } catch (error) {
      console.error('Mark As Read Error:', error);
      throw error;
    }
  }
};