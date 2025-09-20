// Get room ID from URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('id');

if (!roomId) {
    window.location.href = 'dashboard.html';
}

// API and auth
const API_BASE = window.location.origin + '/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) {
    window.location.href = 'index.html';
}

// Socket.io connection
const socket = io();

// WebRTC configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Global variables
let localStream = null;
let peers = new Map();
let isVideoEnabled = true;
let isAudioEnabled = true;
let isScreenSharing = false;
let isChatOpen = false;

// DOM elements
const roomName = document.getElementById('roomName');
const participantCount = document.getElementById('participantCount');
const videoContainer = document.getElementById('videoContainer');
const localVideo = document.getElementById('localVideo');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const participantsList = document.getElementById('participants');

// Control buttons
const toggleVideoBtn = document.getElementById('toggleVideo');
const toggleAudioBtn = document.getElementById('toggleAudio');
const shareScreenBtn = document.getElementById('shareScreen');
const toggleChatBtn = document.getElementById('toggleChat');
const leaveRoomBtn = document.getElementById('leaveRoom');
const sendMessageBtn = document.getElementById('sendMessage');
const closeChatBtn = document.getElementById('closeChatBtn');

// Initialize
init();

async function init() {
    try {
        // Load room data
        await loadRoomData();
        
        // Get user media
        await getUserMedia();
        
        // Join room
        socket.emit('join-room', { roomId, userInfo: user });
        
        // Set up socket event listeners
        setupSocketEvents();
        
        // Set up button event listeners
        setupButtonEvents();
        
    } catch (error) {
        console.error('Initialization failed:', error);
        showNotification('Failed to initialize room', 'error');
    }
}

async function loadRoomData() {
    try {
        const response = await fetch(`${API_BASE}/rooms/${roomId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.room) {
            roomName.textContent = data.room.name;
            updateParticipantCount(data.room.participants.length);
        }
    } catch (error) {
        console.error('Failed to load room data:', error);
    }
}

async function getUserMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        localVideo.srcObject = localStream;
        updateLocalVideoStatus();
    } catch (error) {
        console.error('Failed to get user media:', error);
        showNotification('Camera/microphone access denied', 'error');
    }
}

function setupSocketEvents() {
    socket.on('existing-users', (users) => {
        users.forEach(user => {
            createPeerConnection(user.socketId);
        });
    });
    
    socket.on('user-joined', ({ socketId, userInfo }) => {
        createPeerConnection(socketId, userInfo);
    });
    
    socket.on('user-left', (socketId) => {
        if (peers.has(socketId)) {
            peers.get(socketId).close();
            peers.delete(socketId);
            removeVideoElement(socketId);
            updateParticipantCount(peers.size + 1);
        }
    });
    
    socket.on('offer', async ({ offer, callerSocketId }) => {
        const pc = createPeerConnection(callerSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit('answer', { answer, callerSocketId });
    });
    
    socket.on('answer', async ({ answer, answererSocketId }) => {
        const pc = peers.get(answererSocketId);
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });
    
    socket.on('ice-candidate', async ({ candidate, senderSocketId }) => {
        const pc = peers.get(senderSocketId);
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
    
    socket.on('chat-message', ({ message, sender, timestamp }) => {
        displayChatMessage(message, sender, timestamp);
    });
    
    socket.on('user-video-toggled', ({ socketId, enabled }) => {
        updateRemoteVideoStatus(socketId, 'video', enabled);
    });
    
    socket.on('user-audio-toggled', ({ socketId, enabled }) => {
        updateRemoteVideoStatus(socketId, 'audio', enabled);
    });
}

function setupButtonEvents() {
    toggleVideoBtn.addEventListener('click', toggleVideo);
    toggleAudioBtn.addEventListener('click', toggleAudio);
    shareScreenBtn.addEventListener('click', toggleScreenShare);
    toggleChatBtn.addEventListener('click', toggleChat);
    leaveRoomBtn.addEventListener('click', leaveRoom);
    sendMessageBtn.addEventListener('click', sendMessage);
    closeChatBtn.addEventListener('click', toggleChat);
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

function createPeerConnection(socketId, userInfo) {
    if (peers.has(socketId)) {
        return peers.get(socketId);
    }
    
    const pc = new RTCPeerConnection(rtcConfig);
    peers.set(socketId, pc);
    
    // Add local stream to peer connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }
    
    // Handle remote stream
    pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        createVideoElement(socketId, remoteStream, userInfo);
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                targetSocketId: socketId
            });
        }
    };
    
    // Create offer if this is the caller
    if (socketId !== socket.id) {
        createOffer(pc, socketId);
    }
    
    updateParticipantCount(peers.size + 1);
    
    return pc;
}

async function createOffer(pc, targetSocketId) {
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        socket.emit('offer', { offer, targetSocketId });
    } catch (error) {
        console.error('Failed to create offer:', error);
    }
}

function createVideoElement(socketId, stream, userInfo) {
    // Remove existing video element if it exists
    removeVideoElement(socketId);
    
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    videoWrapper.id = `video-${socketId}`;
    
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsinline = true;
    video.srcObject = stream;
    
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = userInfo ? (userInfo.fullName || userInfo.username) : 'Unknown';
    
    const controls = document.createElement('div');
    controls.className = 'video-controls';
    
    const status = document.createElement('span');
    status.className = 'video-status';
    status.id = `status-${socketId}`;
    status.textContent = '📹 🎤';
    
    controls.appendChild(status);
    videoWrapper.appendChild(video);
    videoWrapper.appendChild(label);
    videoWrapper.appendChild(controls);
    
    videoContainer.appendChild(videoWrapper);
}

function removeVideoElement(socketId) {
    const videoElement = document.getElementById(`video-${socketId}`);
    if (videoElement) {
        videoElement.remove();
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            isVideoEnabled = videoTrack.enabled;
            
            toggleVideoBtn.classList.toggle('active', isVideoEnabled);
            updateLocalVideoStatus();
            
            socket.emit('toggle-video', { roomId, enabled: isVideoEnabled });
        }
    }
}

function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            isAudioEnabled = audioTrack.enabled;
            
            toggleAudioBtn.classList.toggle('active', isAudioEnabled);
            updateLocalVideoStatus();
            
            socket.emit('toggle-audio', { roomId, enabled: isAudioEnabled });
        }
    }
}

async function toggleScreenShare() {
    try {
        if (!isScreenSharing) {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            const videoTrack = screenStream.getVideoTracks()[0];
            
            // Replace video track in peer connections
            peers.forEach(async (pc) => {
                const sender = pc.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                }
            });
            
            // Update local video
            localVideo.srcObject = screenStream;
            isScreenSharing = true;
            shareScreenBtn.classList.add('active');
            
            // Handle screen share end
            videoTrack.onended = () => {
                stopScreenShare();
            };
            
            socket.emit('screen-share', { roomId, enabled: true });
            
        } else {
            stopScreenShare();
        }
    } catch (error) {
        console.error('Failed to share screen:', error);
        showNotification('Screen sharing failed', 'error');
    }
}

async function stopScreenShare() {
    try {
        const videoTrack = localStream.getVideoTracks()[0];
        
        // Replace screen track with camera track
        peers.forEach(async (pc) => {
            const sender = pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }
        });
        
        localVideo.srcObject = localStream;
        isScreenSharing = false;
        shareScreenBtn.classList.remove('active');
        
        socket.emit('screen-share', { roomId, enabled: false });
    } catch (error) {
        console.error('Failed to stop screen sharing:', error);
    }
}

function toggleChat() {
    isChatOpen = !isChatOpen;
    chatContainer.classList.toggle('open', isChatOpen);
    toggleChatBtn.classList.toggle('active', isChatOpen);
    
    if (isChatOpen) {
        messageInput.focus();
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('chat-message', {
            roomId,
            message,
            sender: user
        });
        
        // Display message locally
        displayChatMessage(message, user, Date.now(), true);
        messageInput.value = '';
    }
}

function displayChatMessage(message, sender, timestamp, isOwnMessage = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const senderName = sender.fullName || sender.username || 'Unknown';
    const time = new Date(timestamp).toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <div class="message-sender">${isOwnMessage ? 'You' : senderName}</div>
        <div class="message-time">${time}</div>
        <div>${message}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateLocalVideoStatus() {
    const status = document.getElementById('localVideoStatus');
    let statusText = '';
    
    if (isVideoEnabled) statusText += '📹 ';
    else statusText += '📹❌ ';
    
    if (isAudioEnabled) statusText += '🎤';
    else statusText += '🎤❌';
    
    status.textContent = statusText;
}

function updateRemoteVideoStatus(socketId, type, enabled) {
    const status = document.getElementById(`status-${socketId}`);
    if (status) {
        // This is a simplified version - you might want to track each user's status separately
        const currentText = status.textContent;
        if (type === 'video') {
            if (enabled) {
                status.textContent = currentText.replace('📹❌', '📹');
            } else {
                status.textContent = currentText.replace('📹', '📹❌');
            }
        } else if (type === 'audio') {
            if (enabled) {
                status.textContent = currentText.replace('🎤❌', '🎤');
            } else {
                status.textContent = currentText.replace('🎤', '🎤❌');
            }
        }
    }
}

function updateParticipantCount(count) {
    participantCount.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
}

function leaveRoom() {
    if (confirm('Are you sure you want to leave the room?')) {
        socket.emit('leave-room', { roomId });
        
        // Clean up
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        peers.forEach(pc => pc.close());
        peers.clear();
        
        socket.disconnect();
        window.location.href = 'dashboard.html';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    socket.emit('leave-room', { roomId });
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    peers.forEach(pc => pc.close());
    socket.disconnect();
});

// Mobile responsiveness for chat
if (window.innerWidth <= 768) {
    toggleChatBtn.addEventListener('click', () => {
        chatContainer.classList.toggle('open');
    });
}
