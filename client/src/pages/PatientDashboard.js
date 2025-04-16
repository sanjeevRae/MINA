import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { aiService, appointmentService } from '../services/api';

import BookAppointment from '../components/BookAppointment';
import VideoCall from '../components/VideoCall';

const PatientDashboard = ({ user }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // AI Assistant state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiMode, setAiMode] = useState(''); 
  const [processingAi, setProcessingAi] = useState(false);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        if (user && user.uid) {
          const response = await appointmentService.getPatientAppointments(user.uid);
          setAppointments(response.appointments || []);
        }
      } catch (error) {
        console.error('Error fetching appointments:', error);
        setError('Failed to load appointments');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [user]);

  const handleAiModeSelect = (mode) => {
    setAiMode(mode);
    setAiResponse('');
    setAiPrompt('');
  };

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    
    if (!aiPrompt.trim() || !aiMode) return;
    
    setProcessingAi(true);
    
    try {
      let response;
      
      switch (aiMode) {
        case 'first-aid':
          response = await aiService.getFirstAidAssistance(aiPrompt);
          break;
        case 'symptoms':
          response = await aiService.analyzeSymptomsAssistance(aiPrompt);
          break;
        case 'report':
          response = await aiService.interpretHealthReport(aiPrompt);
          break;
        default:
          throw new Error('Invalid AI mode');
      }
      
      setAiResponse(response.response || 'No response from AI assistant');
    } catch (error) {
      console.error('AI Assistant Error:', error);
      setAiResponse('Error: Unable to get a response from the AI assistant. Please try again later.');
    } finally {
      setProcessingAi(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Patient Dashboard
          </h2>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            Welcome back, {user?.displayName}
          </p>
          
          <div className="mt-10 pb-12 bg-white sm:pb-16">
            <div className="relative">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                  <p className="text-lg text-gray-500">
                    All your health management features have been moved to our AI Assistance page for a better integrated experience.
                  </p>
                  
                  <div className="mt-8">
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                      <div className="p-8">
                        <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                          </svg>
                          Profile Information
                        </h3>
                        <div className="flex flex-col md:flex-row gap-10">
                          <div className="flex-shrink-0 flex flex-col items-center">
                            {user?.photoURL ? (
                              <div className="relative">
                                <div className="h-32 w-32 rounded-full overflow-hidden ring-4 ring-blue-100 p-1">
                                  <img 
                                    src={user.photoURL} 
                                    alt="Profile" 
                                    className="h-full w-full rounded-full object-cover"
                                  />
                                </div>
                                <div className="absolute bottom-1 right-1 bg-green-500 h-4 w-4 rounded-full border-2 border-white"></div>
                              </div>
                            ) : (
                              <div className="h-32 w-32 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center ring-4 ring-blue-100 p-1">
                                <span className="text-3xl font-bold text-white">
                                  {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                                </span>
                              </div>
                            )}
                            <span className="mt-3 bg-blue-100 text-blue-800 text-sm font-medium px-4 py-1 rounded-full">
                              Patient
                            </span>
                          </div>
                          <div className="flex-1 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-gray-50 p-5 rounded-lg">
                                <h4 className="text-xs uppercase font-medium text-gray-500 mb-1">Full Name</h4>
                                <p className="text-lg font-medium text-gray-900 flex items-center">
                                  <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"></path>
                                  </svg>
                                  {user?.displayName || 'Not provided'}
                                </p>
                              </div>
                              <div className="bg-gray-50 p-5 rounded-lg">
                                <h4 className="text-xs uppercase font-medium text-gray-500 mb-1">Email Address</h4>
                                <p className="text-lg font-medium text-gray-900 flex items-center">
                                  <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
                                  </svg>
                                  {user?.email || 'Not provided'}
                                </p>
                              </div>
                              <div className="bg-gray-50 p-5 rounded-lg">
                                <h4 className="text-xs uppercase font-medium text-gray-500 mb-1">Account Created</h4>
                                <p className="text-lg font-medium text-gray-900 flex items-center">
                                  <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path>
                                  </svg>
                                  {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric'
                                  }) : 'Not available'}
                                </p>
                              </div>
                              <div className="bg-gray-50 p-5 rounded-lg">
                                <h4 className="text-xs uppercase font-medium text-gray-500 mb-1">Last Sign In</h4>
                                <p className="text-lg font-medium text-gray-900 flex items-center">
                                  <svg className="w-5 h-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path>
                                  </svg>
                                  {user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', {
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric'
                                  }) + ' at ' + new Date(user.metadata.lastSignInTime).toLocaleTimeString('en-US', {
                                    hour: '2-digit', 
                                    minute: '2-digit'
                                  }) : 'Not available'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 pt-4 border-t border-gray-100">
                              <div className="flex items-center text-gray-600 text-sm">
                                <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
                                </svg>
                                Your profile information is managed through your account settings.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 mb-10">
                    <Link 
                      to="/ai-assistance" 
                      className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300"
                    >
                      <svg className="-ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                      </svg>
                      Go to AI Assistance
                    </Link>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;