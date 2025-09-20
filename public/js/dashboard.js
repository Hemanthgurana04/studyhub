// API base URL and auth
const API_BASE = window.location.origin + '/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

// Check authentication
if (!token) {
    window.location.href = 'index.html';
}

// Socket.io connection
const socket = io();

// DOM elements
const userName = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const addFriendBtn = document.getElementById('addFriendBtn');
const publicRooms = document.getElementById('publicRooms');
const myRooms = document.getElementById('myRooms');
const friendsList = document.getElementById('friendsList');
const friendRequests = document.getElementById('friendRequests');

// Modals
const createRoomModal = document.getElementById('createRoomModal');
const addFriendModal = document.getElementById('addFriendModal');
const createRoomForm = document.getElementById('createRoomForm');
const addFriendForm = document.getElementById('addFriendForm');

// Initialize
userName.textContent = user.fullName || user.username;
socket.emit('join-user', user);

// Load initial data
loadPublicRooms();
loadMyRooms();
loadFriends();
loadFriendRequests();

// Event listeners
logoutBtn.addEventListener('click', logout);
createRoomBtn.addEventListener('click', () => showModal(createRoomModal));
addFriendBtn.addEventListener('click', () => showModal(addFriendModal));

createRoomForm.addEventListener('submit', createRoom);
addFriendForm.addEventListener('submit', sendFriendRequest);

// Modal close handlers
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
        hideModal(e.target.closest('.modal'));
    });
});

// Functions
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    socket.disconnect();
    window.location.href = 'index.html';
}

function showModal(modal) {
    modal.style.display = 'block';
}

function hideModal(modal) {
    modal.style.display = 'none';
}

async function apiRequest(endpoint, options = {}) {
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        ...options
    };
    
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    return response.json();
}

async function loadPublicRooms() {
    try {
        const data = await apiRequest('/rooms/public', { method: 'GET' });
        displayRooms(data.rooms, publicRooms, false);
    } catch (error) {
        console.error('Failed to load public rooms:', error);
    }
}

async function loadMyRooms() {
    try {
        const data = await apiRequest('/rooms/my-rooms', { method: 'GET' });
        displayRooms(data.rooms, myRooms, true);
    } catch (error) {
        console.error('Failed to load my rooms:', error);
    }
}

function displayRooms(rooms, container, isOwner) {
    container.innerHTML = '';
    
    if (rooms.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6c757d;">No rooms available</p>';
        return;
    }
    
    rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        roomCard.innerHTML = `
            <h3>${room.name}</h3>
            <p>${room.description || 'No description'}</p>
            <div class="room-info">
                <span>👥 ${room.participant_count || 0} participants</span>
                <span>👤 ${room.creator_name}</span>
            </div>
            <button class="btn-primary" onclick="joinRoom(${room.id}, ${room.is_private})">
                ${isOwner ? 'Enter Room' : 'Join Room'}
            </button>
        `;
        container.appendChild(roomCard);
    });
}

async function createRoom(e) {
    e.preventDefault();
    
    const formData = new FormData(createRoomForm);
    const roomData = {
        name: document.getElementById('roomName').value,
        description: document.getElementById('roomDescription').value,
        isPrivate: document.getElementById('isPrivate').checked,
        maxParticipants: parseInt(document.getElementById('maxParticipants').value),
        password: document.getElementById('roomPassword').value
    };
    
    try {
        const data = await apiRequest('/rooms/create', {
            method: 'POST',
            body: JSON.stringify(roomData)
        });
        
        if (data.room) {
            showNotification('Room created successfully!', 'success');
            hideModal(createRoomModal);
            createRoomForm.reset();
            loadMyRooms();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Failed to create room', 'error');
    }
}

async function joinRoom(roomId, isPrivate) {
    let password = '';
    
    if (isPrivate) {
        password = prompt('Enter room password:');
        if (!password) return;
    }
    
    try {
        const data = await apiRequest(`/rooms/join/${roomId}`, {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        
        if (data.room) {
            // Redirect to room
            window.location.href = `room.html?id=${roomId}`;
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Failed to join room', 'error');
    }
}

async function loadFriends() {
    try {
        const data = await apiRequest('/friends/list', { method: 'GET' });
        displayFriends(data.friends);
    } catch (error) {
        console.error('Failed to load friends:', error);
    }
}

function displayFriends(friends) {
    friendsList.innerHTML = '';
    
    if (friends.length === 0) {
        friendsList.innerHTML = '<p style="text-align: center; color: #6c757d;">No friends yet</p>';
        return;
    }
    
    friends.forEach(friend => {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';
        friendItem.innerHTML = `
            <span>${friend.full_name || friend.username}</span>
            <button class="btn-small btn-primary" onclick="startPrivateChat(${friend.id})">Chat</button>
        `;
        friendsList.appendChild(friendItem);
    });
}

async function loadFriendRequests() {
    try {
        const data = await apiRequest('/friends/requests', { method: 'GET' });
        displayFriendRequests(data.requests);
    } catch (error) {
        console.error('Failed to load friend requests:', error);
    }
}

function displayFriendRequests(requests) {
    friendRequests.innerHTML = '';
    
    if (requests.length === 0) {
        friendRequests.innerHTML = '<p style="text-align: center; color: #6c757d;">No pending requests</p>';
        return;
    }
    
    requests.forEach(request => {
        const requestItem = document.createElement('div');
        requestItem.className = 'request-item';
        requestItem.innerHTML = `
            <span>${request.full_name || request.username}</span>
            <div class="request-actions">
                <button class="btn-small btn-accept" onclick="acceptFriendRequest(${request.id})">Accept</button>
                <button class="btn-small btn-decline" onclick="declineFriendRequest(${request.id})">Decline</button>
            </div>
        `;
        friendRequests.appendChild(requestItem);
    });
}

async function sendFriendRequest(e) {
    e.preventDefault();
    
    const username = document.getElementById('friendUsername').value;
    
    try {
        const data = await apiRequest('/friends/request', {
            method: 'POST',
            body: JSON.stringify({ username })
        });
        
        if (data.message) {
            showNotification('Friend request sent!', 'success');
            hideModal(addFriendModal);
            addFriendForm.reset();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Failed to send friend request', 'error');
    }
}

async function acceptFriendRequest(requestId) {
    try {
        const data = await apiRequest(`/friends/accept/${requestId}`, {
            method: 'POST'
        });
        
        if (data.message) {
            showNotification('Friend request accepted!', 'success');
            loadFriends();
            loadFriendRequests();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Failed to accept request', 'error');
    }
}

async function declineFriendRequest(requestId) {
    try {
        const data = await apiRequest(`/friends/decline/${requestId}`, {
            method: 'POST'
        });
        
        if (data.message) {
            showNotification('Friend request declined', 'info');
            loadFriendRequests();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Failed to decline request', 'error');
    }
}

function startPrivateChat(friendId) {
    // For now, show a simple alert - you can implement a private chat modal later
    showNotification('Private chat feature coming soon!', 'info');
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

// Socket events
socket.on('user-online', (userData) => {
    // Update friend status if they're online
    console.log('User came online:', userData);
});

socket.on('user-offline', (userData) => {
    // Update friend status if they went offline
    console.log('User went offline:', userData);
});

// Click outside modal to close
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        hideModal(e.target);
    }
});
