# MINA: My Intelligent Nursing Assistance

**MINA** is a modern and intelligent telemedicine platform developed as a university project, hackthon project to offer a seamless experience for online medical consultations, appointment bookings, and AI-assisted healthcare support.

Built using cutting-edge technologies like React, Firebase, Node.js, and Groq's LLaMA 4, MINA ensures a responsive interface, secure data handling, and AI-powered medical support for users.

---
## Problem Statements
- **Geographic Barriers**
- **Time**
- **Lack Of Healthcare Professionals**

## Technologies Used

- **Frontend**: React
- **Styling**: Tailwind CSS
- **Backend**: Node.js (Express)
- **Database & Authentication**: Firebase (Firestore, Firebase Authentication)
- **AI Integration**: Groq SDK (LLaMA 4 model)
- **Video Calling**: WebRTC
- **Deployment**: Firebase Hosting & Node.js Server

---

## Key Features

### 🔐 Secure Authentication
- Firebase-based login/signup for Patients and Doctors.

### 📅 Appointment Booking
- **For Patients**: Book appointments by choosing a doctor, date, and time.
- **For Doctors**: View and manage appointments from their dashboard.

### 🤖 AI Chatbot Assistant (Powered by LLaMA 4 via Groq SDK)
- **First Aid Button**: Offers immediate help on emergency topics.
- **Disease Symptoms Button**: Helps identify possible conditions based on user inputs.
- **Health Report Reading Button**: Explains complex medical terms and test reports.

---

## 🎥 Team name & Roles
- **Bhuwan Bhatt**: Backend
- **Bishesh Maharajan**: Frontend
- **Manish Mandar**: Fullstack
- **Sanjeev Rai**: Frontend
- **Sudeep Shrestha**:Backend

---
### Prerequisites
- **Node.js**: Ensure you have Node.js installed.
- **Firebase**: Set up a Firebase project and configure Firestore, Firebase Authentication, and Firebase Hosting.
- **Groq SDK**: Obtain access to Groq's LLaMA 4 model.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/MINA.git
   ```
2. Navigate to the project directory:
   ```bash
   cd MINA
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Configure Firebase and Groq SDK in the `.env` file.

### Running the Application
1. Start the backend server:
   ```bash
   cd backend
   node server.js
   ```
2. Start the frontend:
   ```bash
   cd frontend
   npm start
   ```
3. Access the application in your browser at `http://localhost:3000`.

---

## Contribution Guidelines
- Fork the repository and create a new branch for your feature or bug fix.
- Submit a pull request with a clear description of your changes.

---

## License
This project is licensed under the [MIT License](LICENSE).


## Live Demo
https://mina-healthcare.web.app/
