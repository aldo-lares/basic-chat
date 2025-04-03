/**
 * Chat Interface JavaScript
 * Handles user interaction with the chat interface, including sending messages,
 * recording audio, and displaying responses.
 */

class ChatInterface {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.initElements();
        this.initEventListeners();
        this.audioChunks = [];
        this.isRecording = false;
        this.connectionStatus = 'online';

        // Display session ID
        this.sessionIdDisplay.textContent = "Session ID: " + this.sessionId;
        
        // Check connection
        this.checkConnection();
        
        // Set focus on input
        setTimeout(() => this.messageInput.focus(), 500);
    }

    initElements() {
        this.chatHistory = document.getElementById('chatHistory');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatApiUrl = this.chatHistory.getAttribute('data-chat-api');
        this.audioApiUrl = this.chatHistory.getAttribute('data-audio-api');
        this.micButton = document.getElementById('micButton');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.progressBar = document.getElementById('progressBar');
        this.sessionIdDisplay = document.getElementById('sessionIdDisplay');
        this.connectionStatusElement = document.getElementById('connectionStatus');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.loadingSpinner = document.getElementById('loadingSpinner');
    }

    initEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.micButton.addEventListener('click', () => this.toggleRecording());
        
        // When Enter is pressed in the textarea (without Shift), trigger the send button
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendButton.click();
            }
        });

        // Disable send button when input is empty
        this.messageInput.addEventListener('input', () => {
            this.sendButton.disabled = this.messageInput.value.trim() === '';
        });
        
        // Initial state
        this.sendButton.disabled = true;
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.updateConnectionStatus(true));
        window.addEventListener('offline', () => this.updateConnectionStatus(false));
    }

    generateSessionId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let sessionId = '';
        for (let i = 0; i < 5; i++) {
            sessionId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return sessionId;
    }

    updateProgressBar(percentage) {
        if (percentage >= 0 && percentage <= 100) {
            this.progressBar.style.width = percentage + '%';
        }
    }

    checkConnection() {
        fetch(this.chatApiUrl, { method: 'HEAD', cache: 'no-store' })
            .then(() => this.updateConnectionStatus(true))
            .catch(() => this.updateConnectionStatus(false));
    }

    updateConnectionStatus(online) {
        if (this.connectionStatus === (online ? 'online' : 'offline')) return;
        
        this.connectionStatus = online ? 'online' : 'offline';
        if (this.statusIndicator) {
            this.statusIndicator.className = 'status-indicator' + (online ? '' : ' offline');
        }
        if (this.connectionStatusElement) {
            this.connectionStatusElement.textContent = online ? 'Connected' : 'Disconnected';
        }
        
        if (!online) {
            this.appendMessage('System', 'You appear to be offline. Messages will be sent when connection is restored.', 'aidwin');
        }
    }

    showLoading() {
        if (this.loadingSpinner) {
            this.loadingSpinner.style.display = 'inline-block';
        }
    }

    hideLoading() {
        if (this.loadingSpinner) {
            this.loadingSpinner.style.display = 'none';
        }
    }

    async toggleRecording() {
        if (!this.isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.startRecording(stream);
            } catch (error) {
                console.error('Error accessing microphone:', error);
                this.appendMessage('System', 'Microphone access denied or not available.', 'aidwin');
            }
        } else {
            this.stopRecording();
        }
    }

    startRecording(stream) {
        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(stream);
        
        this.mediaRecorder.addEventListener('dataavailable', event => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        });

        this.mediaRecorder.addEventListener('stop', () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
                const audioBase64 = reader.result;
                this.sendAudioMessage(audioBase64);
            };
            
            // Stop all tracks to release the microphone
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Reset UI
            this.micButton.classList.remove('recording');
            this.recordingStatus.style.display = 'none';
            this.isRecording = false;
        });

        // Start recording
        this.mediaRecorder.start();
        this.isRecording = true;
        this.micButton.classList.add('recording');
        this.recordingStatus.style.display = 'inline';
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }
    }

    sendAudioMessage(audioBase64) {
        // Append the audio message to the chat with timestamp
        const timestamp = this.getCurrentTimestamp();
        this.appendAudioMessage('You', audioBase64, 'you', timestamp);
        
        // Add typing indicator
        const typingBubble = this.addTypingIndicator();
        
        // Extract the audio format from the base64 string
        let audioFormat = 'webm'; // Default format
        if (audioBase64.includes('data:audio/')) {
            const formatMatch = audioBase64.match(/data:audio\/([^;]+);/);
            if (formatMatch && formatMatch[1]) {
                audioFormat = formatMatch[1];
            }
        }
        
        this.showLoading();
        
        // Post the audio message to the API
        fetch(this.audioApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audioData: audioBase64,
                sessionId: this.sessionId,
                audioFormat: audioFormat
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            this.hideLoading();
            
            // Update progress bar if value is provided
            if (data && data.progress !== undefined) {
                this.updateProgressBar(data.progress);
            }
            
            // Replace typing indicator with actual response
            if (data && data.response) {
                const typingBubble = document.getElementById('typingBubble');
                if (typingBubble) {
                    const messageElem = typingBubble.querySelector('.typing-indicator');
                    if (messageElem) {
                        // Replace typing indicator with response
                        messageElem.className = '';
                        messageElem.innerHTML = data.response;
                        
                        // Add timestamp to the response
                        const timestamp = this.getCurrentTimestamp();
                        const timestampElem = document.createElement('div');
                        timestampElem.className = 'chat-timestamp';
                        timestampElem.textContent = timestamp;
                        typingBubble.appendChild(timestampElem);
                        
                        // Remove classes and ID
                        typingBubble.classList.remove('typing-message');
                        typingBubble.removeAttribute('id');
                    }
                } else {
                    // Fallback
                    this.appendMessage('AID Win', data.response, 'aidwin');
                }
                
                // Scroll to bottom
                this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
            }
        })
        .catch(error => {
            this.hideLoading();
            this.handleApiError(error, typingBubble, 'Sorry, there was an error processing your audio message.');
        });
    }

    getCurrentTimestamp() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    createWaveformBars(container, count = 20) {
        const barsContainer = document.createElement('div');
        barsContainer.className = 'waveform-bars';
        
        for (let i = 0; i < count; i++) {
            const bar = document.createElement('div');
            bar.className = 'waveform-bar';
            // Generate random heights for bars
            const height = Math.floor(Math.random() * 30) + 5;
            bar.style.height = `${height}px`;
            barsContainer.appendChild(bar);
        }
        
        container.appendChild(barsContainer);
    }

    addTypingIndicator() {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble aidwin typing-message';
        bubble.id = 'typingBubble';
        
        const titleElem = document.createElement('div');
        titleElem.className = 'chat-title';
        titleElem.textContent = 'AID Win';
        
        const messageElem = document.createElement('div');
        messageElem.className = 'typing-indicator';
        messageElem.innerHTML = '<span></span><span></span><span></span>';
        
        bubble.appendChild(titleElem);
        bubble.appendChild(messageElem);
        this.chatHistory.appendChild(bubble);
        
        // Auto-scroll
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
        
        return bubble;
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) {
            return;
        }

        // Append user message with timestamp
        const timestamp = this.getCurrentTimestamp();
        this.appendMessage('You', message, 'you', timestamp);

        // Clear input and disable button
        this.messageInput.value = '';
        this.sendButton.disabled = true;
        
        // Add typing indicator
        const typingBubble = this.addTypingIndicator();
        
        this.showLoading();
        
        // API request
        fetch(this.chatApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userMessage: message,
                sessionId: this.sessionId
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            this.hideLoading();
            
            // Update progress bar
            if (data && data.progress !== undefined) {
                this.updateProgressBar(data.progress);
            }
            
            // Process response
            if (data && data.response) {
                const typingBubble = document.getElementById('typingBubble');
                if (typingBubble) {
                    const messageElem = typingBubble.querySelector('.typing-indicator');
                    if (messageElem) {
                        // Replace typing indicator with response
                        messageElem.className = '';
                        messageElem.innerHTML = data.response;
                        
                        // Add timestamp
                        const timestamp = this.getCurrentTimestamp();
                        const timestampElem = document.createElement('div');
                        timestampElem.className = 'chat-timestamp';
                        timestampElem.textContent = timestamp;
                        typingBubble.appendChild(timestampElem);
                        
                        // Remove classes and ID
                        typingBubble.classList.remove('typing-message');
                        typingBubble.removeAttribute('id');
                    }
                } else {
                    // Fallback
                    this.appendMessage('AID Win', data.response, 'aidwin');
                }
                
                // Scroll to bottom
                this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
            }
            
            // Refocus input field
            this.messageInput.focus();
        })
        .catch(error => {
            this.hideLoading();
            this.handleApiError(error, typingBubble, 'Sorry, there was an error communicating with the server.');
        });
    }

    handleApiError(error, typingBubble, message) {
        console.error('Error:', error);
        
        const existingTypingBubble = document.getElementById('typingBubble');
        if (existingTypingBubble) {
            // Update the title to System
            const titleElem = existingTypingBubble.querySelector('.chat-title');
            if (titleElem) {
                titleElem.textContent = 'System';
            }
            
            // Replace typing indicator with error message
            const messageElem = existingTypingBubble.querySelector('.typing-indicator');
            if (messageElem) {
                messageElem.className = '';
                messageElem.textContent = message;
                
                // Add timestamp
                const timestamp = this.getCurrentTimestamp();
                const timestampElem = document.createElement('div');
                timestampElem.className = 'chat-timestamp';
                timestampElem.textContent = timestamp;
                existingTypingBubble.appendChild(timestampElem);
                
                existingTypingBubble.classList.remove('typing-message');
            }
        } else {
            // Fallback
            this.appendMessage('System', message, 'aidwin');
        }
        
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    appendAudioMessage(title, audioData, type, timestamp) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + type;
        
        const titleElem = document.createElement('div');
        titleElem.className = 'chat-title';
        titleElem.textContent = title;
        
        const audioContainer = document.createElement('div');
        audioContainer.className = 'audio-message';
        
        // Create play button
        const playButton = document.createElement('button');
        playButton.className = 'play-button';
        playButton.innerHTML = '▶';
        playButton.setAttribute('aria-label', 'Play audio message');
        
        // Create waveform visualization
        const waveformContainer = document.createElement('div');
        waveformContainer.className = 'audio-waveform';
        this.createWaveformBars(waveformContainer);
        
        // Hidden audio element
        const audioElem = document.createElement('audio');
        audioElem.style.display = 'none';
        audioElem.src = audioData;
        audioElem.preload = 'metadata';
        
        // Add click handler for play button
        playButton.addEventListener('click', () => {
            audioElem.play();
            
            // Update button to show playing state
            playButton.innerHTML = '⏸';
            playButton.setAttribute('aria-label', 'Pause audio message');
            
            // Reset button when audio ends
            audioElem.addEventListener('ended', () => {
                playButton.innerHTML = '▶';
                playButton.setAttribute('aria-label', 'Play audio message');
            });
        });
        
        audioContainer.appendChild(playButton);
        audioContainer.appendChild(waveformContainer);
        audioContainer.appendChild(audioElem);
        
        bubble.appendChild(titleElem);
        bubble.appendChild(audioContainer);
        
        // Add timestamp if provided
        if (timestamp) {
            const timestampElem = document.createElement('div');
            timestampElem.className = 'chat-timestamp';
            timestampElem.textContent = timestamp;
            bubble.appendChild(timestampElem);
        }
        
        this.chatHistory.appendChild(bubble);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    appendMessage(title, message, type, timestamp) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + type;
        
        const titleElem = document.createElement('div');
        titleElem.className = 'chat-title';
        titleElem.textContent = title;
        
        const messageElem = document.createElement('div');
        // Render HTML for AID Win messages; use text for user input
        if (type === 'aidwin') {
            messageElem.innerHTML = message;
        } else {
            messageElem.textContent = message;
        }
        
        bubble.appendChild(titleElem);
        bubble.appendChild(messageElem);
        
        // Add timestamp if provided
        if (timestamp) {
            const timestampElem = document.createElement('div');
            timestampElem.className = 'chat-timestamp';
            timestampElem.textContent = timestamp;
            bubble.appendChild(timestampElem);
        }
        
        this.chatHistory.appendChild(bubble);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }
}

// Initialize chat when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatInterface = new ChatInterface();
});
