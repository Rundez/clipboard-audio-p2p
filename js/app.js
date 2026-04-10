// Audio QR Clipboard Share - Main application logic
(function() {
    'use strict';

    // DOM elements
    const btnHost = document.getElementById('btn-host');
    const btnGuest = document.getElementById('btn-guest');
    const hostSection = document.getElementById('host-section');
    const guestSection = document.getElementById('guest-section');
    const btnGenerateOffer = document.getElementById('btn-generate-offer');
    const qrContainer = document.getElementById('qr-container');
    const btnListenAudio = document.getElementById('btn-listen-audio');
    const hostStatus = document.getElementById('host-status');
    const qrReader = document.getElementById('qr-reader');
    const btnPlayAnswer = document.getElementById('btn-play-answer');
    const guestStatus = document.getElementById('guest-status');
    const connectionSection = document.getElementById('connection-section');
    const connectionStatus = document.getElementById('connection-status');
    const dataChannelStatus = document.getElementById('data-channel-status');
    const clipboardSection = document.getElementById('clipboard-section');
    const textInput = document.getElementById('text-input');
    const btnSend = document.getElementById('btn-send');
    const btnPaste = document.getElementById('btn-paste');
    const textOutput = document.getElementById('text-output');
    const btnCopy = document.getElementById('btn-copy');
    const logElement = document.getElementById('log');

    // Global state
    let role = null; // 'host' or 'guest'
    let peerConnection = null;
    let dataChannel = null;
    let quiet = null;
    let transmitter = null;
    let receiver = null;
    let qrCodeScanner = null;
    let audioStream = null;
    let audioContext = null;
    let offer = null;
    let answer = null;
    let listening = false;
    // URL-safe base64 encoding/decoding
    function base64UrlEncode(str) {
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function base64UrlDecode(base64) {
        // Add padding if needed
        base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        return atob(base64);
    }

    // Get base URL for this page (handles GitHub Pages and local file)
    function getBaseUrl() {
        // If we're on HTTP/HTTPS, return the full URL without query/hash
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            return window.location.origin + window.location.pathname;
        }
        // For file:// or other protocols, return empty (will use raw JSON)
        return '';
    }
    
    // Check if we should generate a URL (vs raw JSON) for QR
    function shouldGenerateUrl() {
        return window.location.protocol === 'http:' || window.location.protocol === 'https:';
    }

    // Parse URL parameters
    function getUrlParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // Check if we have an offer in URL on page load
    function checkForUrlOffer() {
        const offerParam = getUrlParam('offer');
        if (offerParam) {
            try {
                const decoded = base64UrlDecode(offerParam);
                const parsed = JSON.parse(decoded);
                if (parsed.type === 'offer') {
                    log('Found offer in URL parameter');
                    offer = parsed;
                    // Auto-switch to guest mode
                    role = 'guest';
                    showSection(guestSection);
                    guestStatus.textContent = 'Offer loaded from URL. Generating answer...';
                    btnPlayAnswer.disabled = false;
                    generateAnswer();
                    return true;
                }
            } catch (e) {
                log('Failed to parse offer from URL: ' + e);
            }
        }
        return false;
    }

    // Logging utility
    function log(msg) {
        const timestamp = new Date().toLocaleTimeString();
        const line = `[${timestamp}] ${msg}`;
        logElement.textContent += line + '\n';
        logElement.scrollTop = logElement.scrollHeight;
        console.log(msg);
    }

    // Show/hide sections
    function showSection(section) {
        hostSection.classList.add('hidden');
        guestSection.classList.add('hidden');
        connectionSection.classList.add('hidden');
        clipboardSection.classList.add('hidden');
        if (section) section.classList.remove('hidden');
    }

    // Initialize quiet.js
    async function initQuiet() {
        if (quiet) return quiet;
        log('Loading quiet.js...');
        // Wait for window.quiet to be defined (script loaded)
        return new Promise((resolve) => {
            const maxAttempts = 50; // 5 seconds at 100ms intervals
            let attempts = 0;
            function check() {
                if (window.quiet) {
                    quiet = window.quiet;
                    // Reinitialize with local paths and error handler
                    quiet.init({
                        profilesPrefix: 'lib/',
                        memoryInitializerPrefix: 'lib/',
                        libfecPrefix: 'lib/',
                        onError: function(reason) {
                            log('quiet initialization error: ' + reason);
                        }
                    });
                    quiet.addReadyCallback(() => {
                        log('quiet.js ready');
                        resolve(quiet);
                    });
                } else {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        log('quiet not found after timeout - make sure quiet.js loaded and page served via HTTP (file:// may cause CORS errors)');
                        resolve(null);
                    } else {
                        setTimeout(check, 100);
                    }
                }
            }
            check();
        });
    }

    // Load QRCode library if not already loaded (fallback)
    function loadQRCode() {
        if (typeof QRCode !== 'undefined') {
            return Promise.resolve();
        }
        log('QRCode library not found, loading fallback...');
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'lib/qrcodejs.min.js';
            script.onload = () => {
                log('QRCode library loaded (fallback)');
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load QRCode library'));
            document.head.appendChild(script);
        });
    }

    // Generate QR code from text using qrcodejs
    async function generateQR(text) {
        // Ensure QRCode is available
        if (typeof QRCode === 'undefined') {
            await loadQRCode();
        }
        qrContainer.innerHTML = '';
        try {
            new QRCode(qrContainer, {
                text: text,
                width: 300,
                height: 300,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
            log('QR code generated');
        } catch (error) {
            log('QR generation error: ' + error);
        }
    }

    // Load Html5Qrcode library if not already loaded
    function loadHtml5Qrcode() {
        if (typeof Html5Qrcode !== 'undefined') {
            return Promise.resolve();
        }
        log('Loading Html5Qrcode library...');
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
            script.onload = () => {
                log('Html5Qrcode library loaded');
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load Html5Qrcode library'));
            document.head.appendChild(script);
        });
    }

    // Initialize QR code scanner
    async function initQRScanner() {
        if (qrCodeScanner) return;
        await loadHtml5Qrcode();
        // html5-qrcode library
        qrCodeScanner = new Html5Qrcode('qr-reader');
        log('QR scanner ready');
    }

    // Start scanning
    async function startScanning() {
        if (!qrCodeScanner) await initQRScanner();
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        qrCodeScanner.start({ facingMode: 'environment' }, config, onQRScanSuccess, onQRScanError)
            .then(() => log('Scanning started'))
            .catch(err => log('Failed to start camera: ' + err));
    }

    function onQRScanSuccess(decodedText) {
        log('QR scanned: ' + decodedText.substring(0, 50) + '...');
        let offerJson = decodedText;
        
        // Check if it's a URL with offer parameter
        try {
            const url = new URL(decodedText);
            if (url.searchParams.has('offer')) {
                const encoded = url.searchParams.get('offer');
                offerJson = base64UrlDecode(encoded);
                log('Extracted offer from URL');
            }
        } catch (e) {
            // Not a URL, treat as raw JSON
        }
        
        // Parse the offer JSON
        try {
            const parsed = JSON.parse(offerJson);
            if (parsed.type === 'offer') {
                offer = parsed;
                log('Offer received via QR');
                guestStatus.textContent = 'Offer received. Generating answer...';
                btnPlayAnswer.disabled = false;
                // Stop scanning
                qrCodeScanner.stop().then(() => log('Scanner stopped')).catch(() => {});
                generateAnswer();
            } else {
                log('QR data is not an SDP offer');
            }
        } catch (e) {
            log('Invalid QR data: ' + e);
        }
    }

    function onQRScanError(err) {
        // ignore frequent errors
    }

    // WebRTC functions
    function createPeerConnection() {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        peerConnection = new RTCPeerConnection(config);
        log('PeerConnection created');

        // Data channel
        if (role === 'host') {
            dataChannel = peerConnection.createDataChannel('clipboard');
            setupDataChannel();
        } else {
            peerConnection.ondatachannel = event => {
                dataChannel = event.channel;
                setupDataChannel();
            };
        }

        // ICE candidates
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                log('ICE candidate generated');
                // In a real implementation, we'd send candidates via audio
                // For simplicity, we'll ignore and rely on trickle ICE
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            log('ICE connection state: ' + peerConnection.iceConnectionState);
            updateConnectionStatus();
        };

        peerConnection.onconnectionstatechange = () => {
            log('Connection state: ' + peerConnection.connectionState);
            updateConnectionStatus();
        };
    }

    function setupDataChannel() {
        dataChannel.onopen = () => {
            log('Data channel opened');
            dataChannelStatus.textContent = 'Data channel: open';
            dataChannelStatus.classList.add('open');
            clipboardSection.classList.remove('hidden');
        };
        dataChannel.onclose = () => {
            log('Data channel closed');
            dataChannelStatus.textContent = 'Data channel: closed';
            dataChannelStatus.classList.remove('open');
        };
        dataChannel.onmessage = event => {
            log('Received message: ' + event.data.substring(0, 100));
            textOutput.value = event.data;
        };
        dataChannel.onerror = err => log('Data channel error: ' + err);
    }

    function updateConnectionStatus() {
        const state = peerConnection.connectionState;
        connectionStatus.textContent = state.charAt(0).toUpperCase() + state.slice(1);
        if (state === 'connected') {
            connectionStatus.classList.add('connected');
            connectionSection.classList.remove('hidden');
        } else {
            connectionStatus.classList.remove('connected');
        }
    }

    // Host: generate offer and QR
    async function generateOffer() {
        createPeerConnection();
        try {
            offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            log('Offer created');
            // Convert offer to JSON string
            const offerString = JSON.stringify(offer);
            
            // Create QR content: URL with embedded offer if on HTTP/HTTPS, else raw JSON
            let qrContent;
            if (shouldGenerateUrl()) {
                const baseUrl = getBaseUrl();
                const encodedOffer = base64UrlEncode(offerString);
                qrContent = baseUrl + "?offer=" + encodedOffer;
                log('Generated URL with embedded offer: ' + qrContent.substring(0, 80) + '...');
            } else {
                qrContent = offerString;
                log('Generated raw JSON offer (local file mode)');
            }
            
            await generateQR(qrContent);
            hostStatus.textContent = 'QR code generated. Show it to guest.';
            btnListenAudio.disabled = false;
        } catch (e) {
            log('Error creating offer: ' + e);
        }
    }

    // Guest: generate answer after receiving offer
    async function generateAnswer() {
        if (!offer) return;
        createPeerConnection();
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            log('Answer created');
            guestStatus.textContent = 'Answer ready. Play audio answer.';
        } catch (e) {
            log('Error creating answer: ' + e);
        }
    }

    // Audio encoding/decoding with quiet.js
    async function encodeAudio(text) {
        const q = await initQuiet();
        if (!q) throw new Error('quiet.js not available');
        return new Promise((resolve, reject) => {
            transmitter = q.transmitter({
                profile: 'ultrasonic-experimental',
                onFinish: () => {
                    log('Transmission finished');
                    resolve();
                },
                onError: reject
            });
            transmitter.transmit(q.str2ab(text));
        });
    }

    async function decodeAudio() {
        const q = await initQuiet();
        if (!q) throw new Error('quiet.js not available');
        return new Promise((resolve, reject) => {
            receiver = q.receiver({
                profile: 'ultrasonic-experimental',
                onReceive: (payload) => {
                    const text = q.ab2str(payload);
                    log('Received audio payload: ' + text.substring(0, 100));
                    resolve(text);
                },
                onError: reject
            });
        });
    }

    // Play audio via transmitter
    async function playAudio(text) {
        log('Encoding and playing audio...');
        await encodeAudio(text);
        log('Audio played');
    }

    // Listen for audio via microphone and decode
    async function startListening() {
        if (listening) return;
        listening = true;
        log('Listening for audio answer...');
        hostStatus.textContent = 'Listening... (please play audio answer)';
        try {
            const decodedText = await decodeAudio();
            log('Decoded text: ' + decodedText);
            // Expect JSON answer
            const answerObj = JSON.parse(decodedText);
            if (answerObj.type === 'answer') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answerObj));
                hostStatus.textContent = 'Answer received! Connection established.';
                log('Remote description set');
            } else {
                log('Received data is not an SDP answer');
            }
        } catch (e) {
            log('Decoding failed: ' + e);
            hostStatus.textContent = 'Failed to decode audio.';
        } finally {
            listening = false;
        }
    }

    // Send text via data channel
    function sendText() {
        const text = textInput.value.trim();
        if (!text) return;
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(text);
            log('Text sent: ' + text.substring(0, 50));
        } else {
            log('Data channel not open');
        }
    }

    // Paste from clipboard
    async function pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            textInput.value = text;
            log('Pasted from clipboard');
        } catch (e) {
            log('Clipboard permission denied: ' + e);
        }
    }

    // Copy to clipboard
    async function copyToClipboard() {
        const text = textOutput.value;
        try {
            await navigator.clipboard.writeText(text);
            log('Copied to clipboard');
        } catch (e) {
            log('Copy failed: ' + e);
        }
    }

    // Event listeners
    btnHost.addEventListener('click', () => {
        role = 'host';
        showSection(hostSection);
        log('You are host');
    });

    btnGuest.addEventListener('click', async () => {
        role = 'guest';
        showSection(guestSection);
        try {
            await initQRScanner();
            await startScanning();
            log('You are guest');
        } catch (e) {
            log('Failed to initialize scanner: ' + e);
        }
    });

    btnGenerateOffer.addEventListener('click', generateOffer);

    btnListenAudio.addEventListener('click', startListening);

    btnPlayAnswer.addEventListener('click', async () => {
        if (!answer) return;
        const answerString = JSON.stringify(answer);
        log('Encoding answer to audio...');
        guestStatus.textContent = 'Encoding audio...';
        try {
            await playAudio(answerString);
            guestStatus.textContent = 'Audio answer played.';
            log('Audio answer played');
        } catch (e) {
            log('Audio play error: ' + e);
        }
    });

    btnSend.addEventListener('click', sendText);
    btnPaste.addEventListener('click', pasteFromClipboard);
    btnCopy.addEventListener('click', copyToClipboard);

    // Initialize
    log('Audio QR Clipboard Share initialized');
    log('Protocol: ' + window.location.protocol + ', Base URL: ' + getBaseUrl());
    // Check for offer in URL on page load
    checkForUrlOffer();
})();