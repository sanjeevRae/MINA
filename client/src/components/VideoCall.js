import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import Peer from 'simple-peer';

const VideoCall = ({ user }) => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [callStatus, setCallStatus] = useState('initializing'); 
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const containerRef = useRef(null);
  const chatInputRef = useRef(null);
  
  useEffect(() => {
    const fetchAppointment = async () => {
      try {
        const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
        
        if (!appointmentDoc.exists()) {
          setError('Appointment not found');
          setLoading(false);
          return;
        }
        
        const appointmentData = {
          id: appointmentDoc.id,
          ...appointmentDoc.data()
        };
        
        const isDoctor = user.uid === appointmentData.doctorId;
        const isPatient = user.uid === appointmentData.patientId;
        
        if (!isDoctor && !isPatient) {
          setError('You are not authorized to join this call');
          setLoading(false);
          return;
        }
        
        setAppointment(appointmentData);
        
        if (appointmentData.status === 'scheduled') {
          await updateDoc(doc(db, 'appointments', appointmentId), {
            status: 'in-progress',
            updatedAt: new Date().toISOString()
          });
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching appointment:', error);
        setError('Failed to load appointment details');
        setLoading(false);
      }
    };
    
    fetchAppointment();
    
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      try {
        updateDoc(doc(db, 'appointments', appointmentId), {
          offer: null,
          answer: null
        });
      } catch (error) {
        console.error('Error cleaning up signaling data:', error);
      }
    };
  }, [appointmentId, user]);
  
  useEffect(() => {
    const setupMediaDevices = async () => {
      if (loading) return;
      
      try {
        console.log('Requesting media access...');
    
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        console.log('Media access granted:', stream.getTracks().map(t => `${t.kind}:${t.label}`));
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          console.log('Setting local video element source');
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; 
        }
      } catch (err) {
        console.error('Failed to access media devices:', err);
        alert(`Camera/microphone access failed: ${err.message}. Please check your permissions.`);
        setError(`Failed to access camera/microphone: ${err.message}`);
        setCallStatus('error');
      }
    };
    
    setupMediaDevices();
  }, [loading]);

  useEffect(() => {
    if (!localStream || !appointment) return;
    
    try {
      updateDoc(doc(db, 'appointments', appointmentId), {
        offer: null,
        answer: null
      });
    } catch (error) {
      console.error('Error cleaning up signaling data:', error);
    }
    
    const initializePeerConnection = async () => {
      try {
        setCallStatus('connecting');
        
        const isInitiator = user.uid === appointment.patientId;
        console.log(`Initializing as ${isInitiator ? 'initiator' : 'receiver'}`);
        
        const peer = new Peer({
          initiator: isInitiator,
          trickle: false,
          stream: localStream,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun.ekiga.net' },
              { urls: 'stun:stun.ideasip.com' },
              { urls: 'stun:stun.schlund.de' },
              { urls: 'stun:stun.stunprotocol.org:3478' },
              { urls: 'stun:stun.voiparound.com' },
              { urls: 'stun:stun.voipbuster.com' },
              { urls: 'stun:stun.voipstunt.com' },
              { urls: 'stun:stun.voxgratia.org' }
            ]
          },
          sdpTransform: (sdp) => {
            return sdp.replace('SAVPF 96 97 98 99 100 101 102 121 127 120 125 107 108 109 124 119 123 118 114 115 116',
                              'SAVPF 100 96 97 98 99 101 102 121 127 120 125 107 108 109 124 119 123 118 114 115 116');
          }
        });
        
        peer.on('signal', async (data) => {
          console.log(`${isInitiator ? 'Offer' : 'Answer'} signal generated:`, data);
          
          try {
            if (isInitiator) {
              // Send offer
              await updateDoc(doc(db, 'appointments', appointmentId), {
                offer: JSON.stringify(data),
                callInitiatedAt: new Date().toISOString()
              });
              console.log('Offer saved to database');
            } else {
              await updateDoc(doc(db, 'appointments', appointmentId), {
                answer: JSON.stringify(data),
                callAnsweredAt: new Date().toISOString()
              });
              console.log('Answer saved to database');
            }
          } catch (err) {
            console.error('Error saving signaling data:', err);
            setError('Connection failed: Could not exchange connection data');
          }
        });
        
        peer.on('stream', (stream) => {
          console.log('Remote stream received:', stream.getTracks().map(t => `${t.kind}:${t.label}`));
          
          setRemoteStream(stream);
          
          if (remoteVideoRef.current) {
            console.log('Setting remote video element source');
            remoteVideoRef.current.srcObject = stream;
            
            remoteVideoRef.current.play()
              .then(() => console.log('Remote video playing successfully'))
              .catch(e => {
                console.error('Error playing remote video:', e);
                alert('Remote video playback failed. Try clicking/tapping on the video area.');
              });
          } else {
            console.error('Remote video element reference is not available');
          }
          
          setCallStatus('connected');
        });
        
        peer.on('connect', () => {
          console.log('Peer connection established!');
          setCallStatus('connected');
        });
        
        peer.on('error', (err) => {
          console.error('Peer connection error:', err);
          setCallStatus('error');
          setError(`Connection error: ${err.message}`);
        });
        
        peer.on('close', () => {
          console.log('Peer connection closed');
          setCallStatus('ended');
        });
        
        peerRef.current = peer;
        
        const unsubscribe = onSnapshot(doc(db, 'appointments', appointmentId), (docSnapshot) => {
          if (!docSnapshot.exists()) return;
          
          const data = docSnapshot.data();
          
          if (isInitiator && data.answer) {
            try {
              const answer = JSON.parse(data.answer);
              console.log('Received answer from database:', answer);
              if (!peer.destroyed && !peer._remoteSdp) {
                peer.signal(answer);
              }
            } catch (err) {
              console.error('Error processing answer:', err);
            }
          }
          
          if (!isInitiator && data.offer) {
            try {
              const offer = JSON.parse(data.offer);
              console.log('Received offer from database:', offer);
              if (!peer.destroyed && !peer._remoteSdp) {
                peer.signal(offer);
              }
            } catch (err) {
              console.error('Error processing offer:', err);
            }
          }
        });
        
        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        console.error('WebRTC initialization error:', err);
        setCallStatus('error');
        setError(`Failed to establish connection: ${err.message}`);
      }
    };
    
    initializePeerConnection();
    
    return () => {
     
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [localStream, appointment, appointmentId, user]);
  
  useEffect(() => {
    const setupVideoElements = async () => {
      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
        try {
          await localVideoRef.current.play();
          console.log('Local video playing');
        } catch (e) {
          console.error('Failed to play local video:', e);
        }
      }
      
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        try {
          await remoteVideoRef.current.play();
          console.log('Remote video playing');
        } catch (e) {
          console.error('Failed to play remote video:', e);
          
          const playOnClick = async () => {
            try {
              await remoteVideoRef.current.play();
              document.removeEventListener('click', playOnClick);
            } catch (err) {
              console.error('Still failed to play on click:', err);
            }
          };
          document.addEventListener('click', playOnClick);
        }
      }
    };
    
    setupVideoElements();
  }, [localStream, remoteStream]);
  
  useEffect(() => {
    if (callStatus === 'connected') {
      const timer = setInterval(() => {
        setCallTime(prevTime => prevTime + 1);
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [callStatus]);
  
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setIsFullScreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };
  
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };
  
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };
  
  const shareScreen = async () => {
    try {
      if (isScreenSharing) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        if (peerRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          const sender = peerRef.current._pc.getSenders().find(s => s.track.kind === 'video');
          sender.replaceTrack(videoTrack);
        }
        
        setLocalStream(stream);
        localVideoRef.current.srcObject = stream;
        setIsScreenSharing(false);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { cursor: 'always' },
          audio: false
        });
        
        if (peerRef.current) {
          const videoTrack = screenStream.getVideoTracks()[0];
          const sender = peerRef.current._pc.getSenders().find(s => s.track.kind === 'video');
          sender.replaceTrack(videoTrack);
          
          videoTrack.onended = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const cameraTrack = stream.getVideoTracks()[0];
            sender.replaceTrack(cameraTrack);
            setLocalStream(stream);
            localVideoRef.current.srcObject = stream;
            setIsScreenSharing(false);
          };
        }
        
        screenStream.addTrack(localStream.getAudioTracks()[0]);
        setLocalStream(screenStream);
        localVideoRef.current.srcObject = screenStream;
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error('Error sharing screen:', err);
      alert('Could not share screen: ' + err.message);
    }
  };
  
  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;
    
    const newMessage = {
      text: chatMessage,
      sender: user.uid,
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    setChatMessage('');
    
    if (chatInputRef.current) {
      chatInputRef.current.focus();
    }
  };
  
  const endCall = async () => {
    console.log('Ending call...');
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    
    try {
      await updateDoc(doc(db, 'appointments', appointmentId), {
        status: 'completed',
        updatedAt: new Date().toISOString(),
        offer: null,
        answer: null
      });
      console.log('Call marked as completed');
    } catch (error) {
      console.error('Error updating appointment status:', error);
    }
    
    setCallStatus('ended');
    
    navigate(user.uid === appointment?.doctorId 
      ? '/doctor-dashboard' 
      : '/patient-dashboard'
    );
  };
  
  useEffect(() => {
    if (callStatus === 'error') {
      const timer = setTimeout(() => {
        if (window.confirm('Connection error. Would you like to try reconnecting?')) {
          window.location.reload();
        } else {
          endCall();
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [callStatus]);
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-primary border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-white">Initializing video call...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-lg w-full">
          <h3 className="text-lg font-medium text-red-600">Error</h3>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50" ref={containerRef}>
      {/* Call header with enhanced UI */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center">
          <span className="text-white font-medium flex items-center">
            {isFullScreen && (
              <button onClick={toggleFullScreen} className="mr-3 text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <span className="font-semibold mr-2">
              {user.uid === appointment?.doctorId 
                ? `Call with Patient: ${appointment?.patientId}` 
                : `Call with Dr. ${appointment?.doctorId}`
              }
            </span>
            
            <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
              callStatus === 'connected' 
                ? 'bg-green-100 text-green-800' 
                : callStatus === 'connecting' 
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {callStatus === 'connected' 
                ? 'Connected' 
                : callStatus === 'connecting' 
                ? 'Connecting...'
                : 'Connection Issue'
              }
            </span>
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-gray-300 text-sm hidden md:block">
            <span className="bg-gray-700 px-2 py-1 rounded">
              Call time: {formatTime(callTime)}
            </span>
          </div>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-full ${showChat ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-700 hover:bg-gray-600'} text-white`}
            title="Chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          
          <button
            onClick={endCall}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            End Call
          </button>
        </div>
      </div>
      
      {/* Settings panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 bg-gray-800 shadow-lg rounded-lg p-4 z-20 w-72">
          <h3 className="text-white font-medium mb-2">Call Settings</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Audio Input</span>
              <select className="bg-gray-700 text-white text-sm rounded p-1">
                <option>Default Microphone</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Video Input</span>
              <select className="bg-gray-700 text-white text-sm rounded p-1">
                <option>Default Camera</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Speaker</span>
              <select className="bg-gray-700 text-white text-sm rounded p-1">
                <option>Default Speaker</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Video Quality</span>
              <select className="bg-gray-700 text-white text-sm rounded p-1">
                <option>720p</option>
                <option>480p</option>
                <option>360p</option>
              </select>
            </div>
            <button 
              className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white py-1 rounded text-sm"
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Main content area with videos and chat */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Video container */}
        <div className={`flex-1 bg-black relative ${showChat ? 'md:w-2/3' : 'w-full'}`} onClick={() => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(e => console.error("Play failed on click:", e));
          }
        }}>
          {/* Remote video */}
          <video 
            ref={remoteVideoRef}
            autoPlay 
            playsInline 
            className="w-full h-full object-contain"
            style={{ background: 'black' }}
          />
          
          {/* Overlay when remote video is not available */}
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-white text-lg">Waiting for other participant...</p>
              </div>
            </div>
          )}
          
          {/* Call time overlay */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
            {formatTime(callTime)}
          </div>
          
          {/* Remote participant is muted/video off indicators */}
          <div className="absolute top-4 right-4 flex space-x-2">
            {false && (
              <div className="bg-red-500 text-white p-1 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
            )}
            {false && (
              <div className="bg-red-500 text-white p-1 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            )}
          </div>
          
          {/* Local video */}
          <div className="absolute bottom-20 right-4 w-1/4 max-w-xs h-1/3 bg-gray-800 border-2 border-gray-700 overflow-hidden rounded-lg z-10 shadow-lg">
            <video 
              ref={localVideoRef}
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover" 
              style={{ background: '#1f2937' }}
            />
            
            {!localStream && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white text-sm">Loading camera...</p>
              </div>
            )}
            
            {/* Muted indicator */}
            {isMuted && (
              <div className="absolute bottom-2 left-2 bg-red-500 text-white p-1 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
            )}
            
            {/* Screen sharing indicator */}
            {isScreenSharing && (
              <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                Sharing screen
              </div>
            )}
          </div>
        </div>
        
        {/* Chat panel */}
        {showChat && (
          <div className="h-60 md:h-auto md:w-1/3 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-white font-medium">Chat</h3>
              <button 
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-gray-500 text-center text-sm">No messages yet</p>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.sender === user.uid ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-3 py-2 rounded-lg ${
                      msg.sender === user.uid ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200'
                    }`}>
                      <p className="text-sm">{msg.text}</p>
                      <p className="text-xs text-opacity-70 mt-1 text-right">
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 border-t border-gray-700">
              <div className="flex">
                <input
                  type="text"
                  ref={chatInputRef}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white rounded-l px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={sendChatMessage}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-r"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Call controls */}
      <div className="bg-gray-800 px-4 py-3 border-t border-gray-700">
        <div className="flex items-center justify-center space-x-4">
          {/* Mic toggle */}
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full ${
              !isMuted 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              {!isMuted ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              )}
            </svg>
          </button>
          
          {/* Video toggle */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full ${
              !isVideoOff 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              {!isVideoOff ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              )}
            </svg>
          </button>
          
          {/* Screen sharing */}
          <button
            onClick={shareScreen}
            className={`p-3 rounded-full ${
              isScreenSharing 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>
          
          {/* Chat toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-3 rounded-full ${
              showChat 
                ? 'bg-indigo-600 hover:bg-indigo-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Chat"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          
          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullScreen}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600"
            title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              {!isFullScreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
          </button>
          
          {/* End call */}
          <button
            onClick={endCall}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700"
            title="End call"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;