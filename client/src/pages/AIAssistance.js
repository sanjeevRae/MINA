import React, { useState, useRef, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { aiService, appointmentService } from '../services/api';
import BookAppointment from '../components/BookAppointment';
import VideoCall from '../components/VideoCall';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const pdfjsLib = window.pdfjsLib || {};

const AIAssistance = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointmentError, setAppointmentError] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiMode, setAiMode] = useState('');
  const [processingAi, setProcessingAi] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  
  const navigate = useNavigate();

  const [groqApiKey, setGroqApiKey] = useState(process.env.REACT_APP_GROQ_API_KEY || '');
  
  const [activeTab, setActiveTab] = useState('chat');
  
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [fileError, setFileError] = useState('');
  const [filePreview, setFilePreview] = useState('');
  const [fileType, setFileType] = useState('');
  const fileInputRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        if (user && user.uid) {
          const appointmentsData = await appointmentService.getPatientAppointments(user.uid);
          setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
        }
      } catch (error) {
        console.error('Error fetching appointments:', error);
        setAppointmentError('Failed to load appointments');
      } finally {
        setLoadingAppointments(false);
      }
    };

    if (user) {
      fetchAppointments();
    }
  }, [user]);

  const callGroqApi = async (prompt, systemPrompt) => {
    try {
      if (!groqApiKey) {
        throw new Error('GROQ API key not available');
      }
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: 'llama4-8b',
          messages: [
            { 
              role: 'system', 
              content: systemPrompt 
            },
            { 
              role: 'user', 
              content: prompt 
            }
          ],
          temperature: 0.5,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get response from GROQ');
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('GROQ API Error:', error);
      throw error;
    }
  };

  const getSystemPrompt = (promptType) => {
    switch (promptType) {
      case 'first-aid':
        return "You are a medical first aid assistant that provides clear, accurate emergency guidance. Always emphasize seeking professional medical help for serious situations.";
      case 'symptoms':
        return "You are a medical assistant providing general health information. You're not diagnosing patients, and you should always recommend consulting a doctor for proper diagnosis.";
      case 'report':
        return "You are a medical assistant that explains medical reports in simple terms. Break down medical terminology into everyday language.";
      default:
        return "You are a healthcare assistant providing general information. Always recommend consulting healthcare professionals for medical advice.";
    }
  };

  const handleSendMessage = async (messageText, isQuickPrompt = false) => {
   
    if ((messageText.trim() === '' && !fileUrl && !isQuickPrompt) || loading) return;
    
    if (!isQuickPrompt) {
      setInput('');
    }
    
    // Create user message
    const userMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setLoading(true);
    setError('');
    
    try {
      const promptType = isQuickPrompt || 'general';
      
      const systemPrompt = getSystemPrompt(promptType);
      
      let fullPrompt = messageText;
      
      if (fileUrl) {
        const fileName = fileUrl.split('/').pop().split('?')[0]; 
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension);
        const isPdf = fileExtension === 'pdf';
        const isDoc = ['doc', 'docx'].includes(fileExtension);
        const isTxt = fileExtension === 'txt';
        
        const fileTypeText = isImage ? 'medical image' : 
                             isPdf ? 'PDF medical report' : 
                             isDoc ? 'medical document' : 
                             isTxt ? 'text file' : 'document';
        
        if (messageText.trim()) {
          fullPrompt += `\n\nI've also uploaded a ${fileTypeText} (${fileName}) for analysis.`;
        } else {
          fullPrompt = `Please analyze this uploaded ${fileTypeText} (${fileName}).`;
        }
        
        if (isTxt && fileType === 'text') {
          const reader = new FileReader();
          try {
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput && fileInput.files.length > 0) {
              const file = fileInput.files[0];
              const fileContent = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsText(file);
              });
              
              fullPrompt += `\n\nHere's the content of the file:\n\n"""${fileContent}"""\n\nPlease analyze this and explain what it means in simple terms.`;
            }
          } catch (error) {
            console.error('Error reading file content:', error);
          }
        }
      }
      
      if (promptType === 'first-aid') {
        fullPrompt = `I need first aid guidance for this situation: ${fullPrompt}. Please provide clear, step-by-step instructions.`;
      } else if (promptType === 'symptoms') {
        fullPrompt = `I'm experiencing these symptoms: ${fullPrompt}. What might they indicate? Please provide possible conditions, when I should see a doctor, and any home care recommendations.`;
      } else if (promptType === 'report') {
        if (!fullPrompt.includes("Please analyze this uploaded")) {
          fullPrompt = `Please explain these medical terms or report findings in simple language: ${fullPrompt}. Break down any medical jargon.`;
        }
      }
      
      let responseText;
      try {
        responseText = await callGroqApi(fullPrompt, systemPrompt);
      } catch (error) {
        console.warn('Falling back to mock AI service:', error.message);
        const mockResponse = await getAiMockResponse(promptType, fullPrompt);
        responseText = mockResponse.response;
      }
      
      const aiMessage = {
        id: Date.now() + 1,
        text: responseText,
        sender: 'ai',
        timestamp: new Date().toISOString()
      };
      
      const disclaimerMessage = {
        id: Date.now() + 2,
        text: "This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.",
        sender: 'system',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prevMessages => [...prevMessages, aiMessage, disclaimerMessage]);
      
      if (fileUrl) {
        clearUploadedFile();
      }
    } catch (err) {
      console.error('Error getting AI response:', err);
      setError('Failed to get a response. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getAiMockResponse = async (promptType, message) => {
    console.log('Using mock service for prompt type:', promptType);
    
    if (!promptType || promptType === 'general') {
       if (message.toLowerCase().includes('symptom') || 
          message.toLowerCase().includes('fever') || 
          message.toLowerCase().includes('headache') || 
          message.toLowerCase().includes('pain')) {
        return await aiService.analyzeSymptomsAssistance(message);
      } else if (message.toLowerCase().includes('report') || 
                message.toLowerCase().includes('test') || 
                message.toLowerCase().includes('results')) {
        return await aiService.interpretHealthReport(message);
      } else {
         return await aiService.getFirstAidAssistance(message);
      }
    }
    
    switch(promptType) {
      case 'first-aid':
        return await aiService.getFirstAidAssistance(message);
      case 'symptoms':
        return await aiService.analyzeSymptomsAssistance(message);
      case 'report':
        return await aiService.interpretHealthReport(message);
      default:
        return await aiService.getFirstAidAssistance(message);
    }
  };

   const handleQuickPrompt = (promptType) => {
    setInput('');
    
    let modeMessage;
    switch(promptType) {
      case 'first-aid':
        modeMessage = "🔴 First Aid Assistant activated. Please describe the emergency situation:";
        break;
      case 'symptoms':
        modeMessage = "🟡 Symptom Analyzer activated. Please describe your symptoms:";
        break;
      case 'report':
        modeMessage = "🔵 Medical Report Reader activated. Please enter medical terms, report sections to explain, or upload a medical document:";
        break;
      default:
        return;
    }
    
    const systemMessage = {
      id: Date.now(),
      text: modeMessage,
      sender: 'system',
      promptType: promptType,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prevMessages => [...prevMessages, systemMessage]);
    
    if (promptType === 'report') {
      const fileUploadMessage = {
        id: Date.now() + 1,
        text: "📄 You can upload a medical report or image for analysis.",
        sender: 'system',
        promptType: 'file-upload',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prevMessages => [...prevMessages, fileUploadMessage]);
    }
    
    setTimeout(() => {
      document.getElementById('message-input')?.focus();
    }, 100);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const isInPromptMode = lastMessage && lastMessage.sender === 'system' && lastMessage.promptType;
    
    if (isInPromptMode) {
      handleSendMessage(input, lastMessage.promptType);
    } else {
      handleSendMessage(input);
    }
  };

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
      const systemPrompt = getSystemPrompt(aiMode);
      
      let fullPrompt = aiPrompt;
      if (aiMode === 'first-aid') {
        fullPrompt = `I need first aid guidance for this situation: ${aiPrompt}. Please provide clear, step-by-step instructions.`;
      } else if (aiMode === 'symptoms') {
        fullPrompt = `I'm experiencing these symptoms: ${aiPrompt}. What might they indicate? Please provide possible conditions, when I should see a doctor, and any home care recommendations.`;
      } else if (aiMode === 'report') {
        fullPrompt = `Please explain these medical terms or report findings in simple language: ${aiPrompt}. Break down any medical jargon.`;
      }
      
      let responseText;
      try {
        responseText = await callGroqApi(fullPrompt, systemPrompt);
      } catch (error) {
        console.warn('Falling back to mock AI service:', error.message);
        const mockResponse = await getAiMockResponse(aiMode, aiPrompt);
        responseText = mockResponse.response;
      }
      
      setAiResponse(responseText || 'No response from AI assistant');
    } catch (error) {
      console.error('AI Assistant Error:', error);
      setAiResponse('Error: Unable to get a response from the AI assistant. Please try again later.');
    } finally {
      setProcessingAi(false);
    }
  };

  const extractFileContent = async (file, fileType) => {
    if (!file) return null;
    
    try {
      if (fileType === 'image') {
        return {
          type: 'image',
          content: null,
          description: `[This is a medical image file: ${file.name}]`
        };
      }
      
      if (fileType === 'text') {
        const reader = new FileReader();
        const content = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(new Error("Error reading text file"));
          reader.readAsText(file);
        });
        
        return {
          type: 'text',
          content: content,
          description: `Text file: ${file.name}\n\n${content}`
        };
      }
      
      if (fileType === 'pdf') {
        try {
          if (typeof window.pdfjsLib === 'undefined') {
            console.error('PDF.js library not found. Make sure it is properly loaded.');
            throw new Error('PDF.js library not loaded');
          }
          
          console.log('Starting PDF extraction with PDF.js');
          
          const reader = new FileReader();
          const arrayBuffer = await new Promise((resolve, reject) => {
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error("Error reading PDF file"));
            reader.readAsArrayBuffer(file);
          });
          
          console.log('PDF file read as ArrayBuffer successfully, size:', arrayBuffer.byteLength);
          
          let extractedText = '';
          
          try {
            console.log('Initializing PDF.js document');
            const loadingTask = window.pdfjsLib.getDocument({data: arrayBuffer});
            console.log('PDF loading task created');
            
            const pdf = await loadingTask.promise;
            console.log('PDF loaded successfully, pages:', pdf.numPages);
            
            // Get total number of pages
            const numPages = pdf.numPages;
            
            // Extract text from each page
            for (let i = 1; i <= numPages; i++) {
              console.log(`Processing page ${i} of ${numPages}`);
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const textItems = textContent.items.map(item => item.str).join(' ');
              extractedText += `Page ${i}:\n${textItems}\n\n`;
            }
            
            console.log('PDF text extraction complete');
          } catch (pdfJsError) {
            console.error('Error in PDF.js processing:', pdfJsError);
      
            extractedText = 'Failed to process PDF content with PDF.js. ';
            
            try {
              const textReader = new FileReader();
              const rawText = await new Promise((resolve) => {
                textReader.onload = (e) => resolve(e.target.result);
                textReader.readAsText(file);
              });
              
              if (rawText && rawText.length > 0) {
                extractedText += `Extracted raw text:\n\n${rawText}`;
              } else {
                extractedText += 'This appears to be a scanned document or image-based PDF that does not contain extractable text.';
              }
            } catch (textError) {
              console.error('Fallback text extraction also failed:', textError);
              extractedText += 'Unable to extract any text from this PDF.';
            }
          }
          
          return {
            type: 'pdf',
            content: extractedText,
            description: `Extracted text from PDF: ${file.name}\n\n${extractedText}`
          };
        } catch (pdfError) {
          console.error('Error during PDF extraction process:', pdfError);
          return {
            type: 'pdf',
            content: null,
            description: `[PDF document: ${file.name}] - Unable to extract text content. This may be a scanned document or image-based PDF. Error: ${pdfError.message}`
          };
        }
      }
      
      return {
        type: fileType,
        content: null,
        description: `[This is a ${fileType.toUpperCase()} document: ${file.name}]`
      };
    } catch (error) {
      console.error('Error extracting file content:', error);
      return {
        type: 'error',
        content: null,
        description: `[Error processing file: ${file.name}] - ${error.message}`
      };
    }
  };
  
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    setFileUploading(true);
    setFileError('');
    
    try {
      // Validate file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error(`File too large. Maximum size is 10MB.`);
      }
      
      const fileExtension = file.name.split('.').pop().toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension);
      const isPdf = fileExtension === 'pdf';
      const isDoc = ['doc', 'docx'].includes(fileExtension);
      const isTxt = fileExtension === 'txt';
      
      let fileContentType = isImage ? 'image' : isPdf ? 'pdf' : isDoc ? 'document' : isTxt ? 'text' : 'other';
      setFileType(fileContentType);
      
      // Handle image preview
      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview('');
      }
      
      // Process file content based on type
      let fileContent = null;
      
      // For txt files, we can read directly
      if (isTxt) {
        const reader = new FileReader();
        fileContent = await new Promise((resolve) => {
          reader.onload = (e) => {
            resolve(e.target.result);
          };
          reader.readAsText(file);
        });
      } else {
        // For other files, use the extraction function
        fileContent = await extractFileContent(file, fileContentType);
      }
      
      // Upload to Firebase storage
      const storage = getStorage();
      const fileRef = ref(storage, `health-reports/${user?.uid || 'anonymous'}/${Date.now()}-${file.name}`);
      
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);
      
      setFileUrl(downloadURL);
      
      // Handle immediate use in report mode
      if (aiMode === 'report') {
        const fileTypeText = isImage ? 'medical image' : isPdf ? 'PDF medical report' : isDoc ? 'medical document' : 'text file';
        
        let promptAddition = `I've attached a ${fileTypeText} (${file.name}).`;
        
        if (isTxt && fileContent) {
          promptAddition += `\n\nHere's the content of the file:\n\n"""${fileContent}"""\n\nPlease analyze this and explain what it means in simple terms.`;
        } else if (fileContent && fileContent.content) {
          promptAddition += `\n\n${fileContent.description}\n\nPlease analyze this and explain what it means in simple terms.`;
        }
        
        setAiPrompt(prev => {
          const baseText = prev.trim() ? `${prev}\n\n` : '';
          return `${baseText}${promptAddition}`;
        });
      }
      
      return {
        url: downloadURL,
        content: fileContent
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      setFileError(error.message || 'Failed to upload file. Please try again.');
      return null;
    } finally {
      setFileUploading(false);
    }
  };

  const handleFileInputChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    
    setFileError('');
    setFileUploading(true);
    
    try {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error(`File too large. Maximum size is 10MB.`);
      }
      
      const fileExtension = file.name.split('.').pop().toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension);
      const isPdf = fileExtension === 'pdf';
      const isDoc = ['doc', 'docx'].includes(fileExtension);
      const isTxt = fileExtension === 'txt';
      
      const fileContentType = isImage ? 'image' : isPdf ? 'pdf' : isDoc ? 'document' : isTxt ? 'text' : 'other';
      setFileType(fileContentType);
      
      // Create image preview if applicable
      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview('');
      }
      
      // Upload to Firebase storage
      const storage = getStorage();
      const fileRef = ref(storage, `health-reports/${user?.uid || 'anonymous'}/${Date.now()}-${file.name}`);
      
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);
      
      setFileUrl(downloadURL);
      
      // Add file content to prompt if in report mode
      if (fileType === 'report' || getPromptType() === 'report' || isInReportMode()) {
        const fileTypeText = isImage ? 'medical image' : isPdf ? 'PDF medical report' : isDoc ? 'medical document' : 'text file';
        
        let promptAddition = `I've attached a ${fileTypeText} (${file.name}).`;
        
        // For text files, include content directly
        if (isTxt) {
          const textReader = new FileReader();
          const textContent = await new Promise((resolve, reject) => {
            textReader.onload = (e) => resolve(e.target.result);
            textReader.onerror = (e) => reject(new Error("Error reading file"));
            textReader.readAsText(file);
          });
          
          promptAddition += `\n\nHere's the content of the file:\n\n"""${textContent}"""\n\nPlease analyze this and explain what it means in simple terms.`;
        }
        
        setAiPrompt(prev => {
          const baseText = prev.trim() ? `${prev}\n\n` : '';
          return `${baseText}${promptAddition}`;
        });
      }
      
      console.log("File uploaded successfully:", downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading file:', error);
      setFileError(error.message || 'Failed to upload file. Please try again.');
      return null;
    } finally {
      setFileUploading(false);
    }
  };

  // Helper function to check if we're in report mode
  const isInReportMode = () => {
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    return (lastMessage && lastMessage.promptType === 'report') || aiMode === 'report';
  };

  const getPromptType = () => {
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    if (lastMessage && lastMessage.promptType) {
      return lastMessage.promptType;
    }
    return aiMode || 'general';
  };

  const clearUploadedFile = () => {
    setFileUrl('');
    setFilePreview('');
    setFileType('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* loged in user */}
        {user && (
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Welcome, {user.displayName}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Access your health assistant and appointments
              </p>
            </div>
           
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('chat')}
              className={`${
                activeTab === 'chat'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              AI Chat Assistant
            </button>
            <button
              onClick={() => setActiveTab('panel')}
              className={`${
                activeTab === 'panel'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              AI Health Panel
            </button>
            {user && user.role !== 'doctor' && (
              <button
                onClick={() => setActiveTab('appointments')}
                className={`${
                  activeTab === 'appointments'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Appointments
              </button>
            )}
          </nav>
        </div>

        {/*  active tab */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-lg shadow-xl overflow-hidden min-h-[600px] flex flex-col">
            {/* Header */}
            <div className="bg-primary py-6 px-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">AI Chat Assistant</h2>
                  <p className="text-indigo-100 mt-1">
                    Powered by Groq LLaMA 4 for accurate healthcare information
                  </p>
                </div>
                <svg className="w-10 h-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
            </div>
            
            {/* Quick Action Buttons */}
            <div className="bg-gray-100 p-4 flex justify-center space-x-4">
              <button
                onClick={() => handleQuickPrompt('first-aid')}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-300 shadow-md"
              >
                🔴 Quick First Aid
              </button>
              <button
                onClick={() => handleQuickPrompt('symptoms')}
                className="px-4 py-2 bg-yellow-500 text-white font-medium rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors duration-300 shadow-md"
              >
                🟡 Analyze Symptoms
              </button>
              <button
                onClick={() => handleQuickPrompt('report')}
                className="px-4 py-2 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-300 shadow-md"
              >
                🔵 Read Health Report
              </button>
            </div>
            
            {/* Chat Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto bg-white">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="mx-auto w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Ask me anything about health</h3>
                    <p className="mt-1 text-gray-500">
                      Get instant guidance on first aid, symptoms, medical reports, and general health inquiries.
                    </p>
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4">
                      <span 
                        onClick={() => handleSendMessage("What common symptoms indicate a cold versus the flu?")}
                        className="text-primary hover:text-indigo-700 cursor-pointer underline"
                      >
                        "What common symptoms indicate a cold versus the flu?"
                      </span>
                      <span 
                        onClick={() => handleSendMessage("How should I treat a minor burn at home?")}
                        className="text-primary hover:text-indigo-700 cursor-pointer underline"
                      >
                        "How should I treat a minor burn at home?"
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender === 'user' 
                            ? 'justify-end' 
                            : message.sender === 'system' 
                            ? 'justify-center' 
                            : 'justify-start'
                        }`}
                      >
                        {/*  upload message */}
                        {message.promptType === 'file-upload' ? (
                          <div className="w-full max-w-md mx-auto bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center">
                              <svg className="h-6 w-6 text-blue-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="text-sm text-blue-700">{message.text}</p>
                            </div>
                            
                            <div className="mt-3 flex items-center">
                              <label className="flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 cursor-pointer">
                                <svg className="h-5 w-5 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                {fileUploading ? 'Uploading...' : 'Upload File'}
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept="image/*,.pdf,.doc,.docx,.txt"
                                  onChange={handleFileInputChange}
                                  disabled={loading || fileUploading}
                                />
                              </label>
                              
                              {fileUrl && (
                                <span className="ml-3 text-sm text-green-600 font-medium flex items-center">
                                  <svg className="h-5 w-5 text-green-500 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  File uploaded successfully
                                </span>
                              )}
                            </div>
                            
                            {fileError && (
                              <p className="mt-2 text-sm text-red-600">{fileError}</p>
                            )}
                            
                            {/* File Preview in chat */}
                            {fileUrl && (
                              <div className="mt-3 border rounded-md p-3 bg-white">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-gray-900">Uploaded File</p>
                                  <button
                                    type="button"
                                    onClick={clearUploadedFile}
                                    className="text-sm text-red-600 hover:text-red-800"
                                  >
                                    Remove
                                  </button>
                                </div>
                                
                                {fileType === 'image' && filePreview ? (
                                  <div className="mt-2">
                                    <img 
                                      src={filePreview} 
                                      alt="Uploaded medical document" 
                                      className="max-h-40 rounded-md shadow-sm"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center mt-2 text-sm text-gray-500">
                                    <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    {fileType === 'pdf' ? 'PDF document' : fileType === 'text' ? 'Text file' : 'Document'} uploaded
                                    <a 
                                      href={fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="ml-2 text-primary hover:underline"
                                    >
                                      View
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="mt-3 text-xs text-blue-600">
                              After uploading your file, you can type additional information about it to help the AI analyze it better.
                            </div>
                            
                            <div 
                              className="text-xs mt-1 text-gray-500 text-right"
                            >
                              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`rounded-lg px-4 py-2 max-w-[80%] shadow-sm ${
                              message.sender === 'user'
                                ? 'bg-primary text-white'
                                : message.sender === 'system'
                                ? 'bg-gray-100 text-gray-800 border border-gray-200'
                                : 'bg-gray-200 text-gray-800'
                            }`}
                          >
                            <div className="whitespace-pre-line">{message.text}</div>
                            <div 
                              className={`text-xs mt-1 ${
                                message.sender === 'user' ? 'text-indigo-200' : 'text-gray-500'
                              }`}
                            >
                              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            
            {/* Input Area */}
            <div className="bg-gray-100 p-4 border-t border-gray-200">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex">
                <input
                  id="message-input"
                  type="text"
                  className="flex-1 rounded-l-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                  placeholder="Type your message here..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                      Send
                    </>
                  )}
                </button>
              </form>
              <p className="mt-2 text-xs text-gray-500">
                This AI assistant is for informational purposes only. Always consult with a healthcare professional for medical advice.
                {!messages.length && !user && (
                  <> Need immediate care? <Link to="/register" className="text-primary hover:underline">Sign up</Link> to book a video consultation with a doctor.</>
                )}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'panel' && (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* AI Assistant Panel  */}
            <div className="bg-white overflow-hidden shadow rounded-lg col-span-2">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">AI Health Assistant</h3>
                
                {/* AI Mode Buttons */}
                <div className="mt-5 flex flex-wrap sm:flex-nowrap gap-3 sm:space-x-4">
                  <button
                    onClick={() => handleAiModeSelect('first-aid')}
                    className={`flex-1 px-4 py-2.5 rounded-md text-white font-medium text-center ${
                      aiMode === 'first-aid' 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    🔴 First Aid
                  </button>
                  <button
                    onClick={() => handleAiModeSelect('symptoms')}
                    className={`flex-1 px-4 py-2.5 rounded-md text-white font-medium text-center ${
                      aiMode === 'symptoms' 
                        ? 'bg-yellow-600 hover:bg-yellow-700' 
                        : 'bg-yellow-500 hover:bg-yellow-600'
                    }`}
                  >
                    🟡 Disease Symptoms
                  </button>
                  <button
                    onClick={() => handleAiModeSelect('report')}
                    className={`flex-1 px-4 py-2.5 rounded-md text-white font-medium text-center ${
                      aiMode === 'report' 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    🔵 Health Report Reading
                  </button>
                </div>
                
                {/* AI Input Form */}
                {aiMode && (
                  <form onSubmit={handleAiSubmit} className="mt-4">
                    <div className="mb-4">
                      <label htmlFor="aiPrompt" className="block text-sm font-medium text-gray-700">
                        {aiMode === 'first-aid' && 'Describe the emergency situation:'}
                        {aiMode === 'symptoms' && 'Describe your symptoms:'}
                        {aiMode === 'report' && 'Enter medical report terms to explain:'}
                      </label>
                      <textarea
                        id="aiPrompt"
                        name="aiPrompt"
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        placeholder={
                          aiMode === 'first-aid' 
                            ? 'e.g., "How to treat a burn from hot water"' 
                            : aiMode === 'symptoms' 
                            ? 'e.g., "Persistent headache, fever, and fatigue for 3 days"' 
                            : 'e.g., "What does elevated ALT and AST in liver function test mean?"'
                        }
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        disabled={processingAi}
                      />
                    </div>
                    
                    {/* File Upload UI*/}
                    {aiMode === 'report' && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Upload medical report or image
                        </label>
                        
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                            <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {fileUploading ? 'Uploading...' : 'Choose File'}
                            <input
                              ref={fileInputRef}
                              type="file"
                              className="sr-only"
                              accept="image/*,.pdf,.doc,.docx,.txt"
                              onChange={handleFileInputChange}
                              disabled={processingAi || fileUploading}
                            />
                          </label>
                          
                          {fileUrl && (
                            <button
                              type="button"
                              onClick={clearUploadedFile}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Remove
                            </button>
                          )}
                        </div>
                        
                        {fileError && (
                          <p className="mt-2 text-sm text-red-600">{fileError}</p>
                        )}
                        
                        {/* File Preview */}
                        {fileUrl && (
                          <div className="mt-3 border rounded-md p-3 bg-gray-50">
                            <p className="text-sm font-medium text-gray-900 mb-1">Uploaded File:</p>
                            
                            {fileType === 'image' && filePreview ? (
                              <div className="mt-2">
                                <img 
                                  src={filePreview} 
                                  alt="Uploaded medical document" 
                                  className="max-h-60 rounded-md shadow-sm"
                                />
                              </div>
                            ) : fileType === 'pdf' ? (
                              <div className="flex items-center text-sm text-gray-500">
                                <svg className="h-5 w-5 text-red-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                PDF document uploaded
                                <a 
                                  href={fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="ml-2 text-primary hover:underline"
                                >
                                  View
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-center text-sm text-gray-500">
                                <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Document uploaded
                                <a 
                                  href={fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="ml-2 text-primary hover:underline"
                                >
                                  Download
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <p className="mt-2 text-xs text-gray-500">
                          Upload medical reports, lab results, or images for AI analysis. 
                          Supported formats: PDF, images (JPG, PNG), and text documents.
                        </p>
                      </div>
                    )}
                    
                    <button
                      type="submit"
                      disabled={processingAi || fileUploading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {processingAi ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : fileUploading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Uploading File...
                        </>
                      ) : (
                        'Ask AI Assistant'
                      )}
                    </button>
                  </form>
                )}
                
                {/* AI Response */}
                {aiResponse && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-md">
                    <h4 className="text-md font-medium text-gray-900 mb-2">AI Assistant Response:</h4>
                    <div className="prose prose-sm text-gray-800 whitespace-pre-line">
                      {aiResponse}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Appointments */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Upcoming Appointments</h3>
                {!user ? (
                  <div className="mt-4 text-sm text-gray-500">
                    <p>Please <Link to="/login" className="text-primary hover:underline">sign in</Link> to view your appointments.</p>
                  </div>
                ) : loadingAppointments ? (
                  <div className="mt-6 flex justify-center">
                    <div className="w-10 h-10 border-t-4 border-primary border-solid rounded-full animate-spin"></div>
                  </div>
                ) : appointmentError ? (
                  <p className="mt-4 text-sm text-red-600">{appointmentError}</p>
                ) : appointments.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">You have no upcoming appointments.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-gray-200">
                    {appointments
                      .filter(appointment => appointment.status === 'scheduled')
                      .sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + a.time))
                      .slice(0, 5)
                      .map((appointment) => (
                        <li key={appointment.id} className="py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {appointment.date} at {appointment.time}
                              </p>
                              <p className="text-sm text-gray-500">{appointment.reason}</p>
                            </div>
                            <Link
                              to={`/ai-assistance/video-call/${appointment.id}`}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-secondary hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              Join Call
                            </Link>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && user && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">All Appointments</h3>
              {loadingAppointments ? (
                <div className="mt-6 flex justify-center">
                  <div className="w-10 h-10 border-t-4 border-primary border-solid rounded-full animate-spin"></div>
                </div>
              ) : appointmentError ? (
                <p className="mt-4 text-sm text-red-600">{appointmentError}</p>
              ) : appointments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="mt-4 text-sm text-gray-500">You have no appointments scheduled.</p>
                  <div className="mt-5">
                    <Link
                      to="/ai-assistance/book-appointment"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Book Your First Appointment
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <ul className="mt-4 divide-y divide-gray-200">
                    {appointments
                      .sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(a.date + ' ' + b.time))
                      .map((appointment) => (
                        <li key={appointment.id} className="py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {appointment.date} at {appointment.time}
                              </p>
                              <div className="flex items-center mt-1">
                                <span 
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    appointment.status === 'scheduled' 
                                      ? 'bg-green-100 text-green-800' 
                                      : appointment.status === 'completed' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                </span>
                                <p className="ml-2 text-sm text-gray-500">{appointment.reason}</p>
                              </div>
                            </div>
                            {appointment.status === 'scheduled' && (
                              <Link
                                to={`/ai-assistance/video-call/${appointment.id}`}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-secondary hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                Join Call
                              </Link>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>
                  <div className="mt-6 text-center">
                    <Link
                      to="/ai-assistance/book-appointment"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Book New Appointment
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* video calls */}
        <Routes>
          <Route path="book-appointment" element={<BookAppointment user={user} />} />
          <Route path="video-call/:appointmentId" element={<VideoCall user={user} />} />
        </Routes>
      </div>
    </div>
  );
};

export default AIAssistance;