import { MultimodalLiveClient } from './core/websocket-client.js';
import { AudioStreamer } from './audio/audio-streamer.js';
import { AudioRecorder } from './audio/audio-recorder.js';
import { CONFIG } from './config/config.js';
import { Logger } from './utils/logger.js';
import { VideoManager } from './video/video-manager.js';
import { ScreenRecorder } from './video/screen-recorder.js';

/**
 * @fileoverview Main entry point for the application.
 * Initializes and manages the UI, audio, video, and WebSocket interactions.
 */

// DOM Elements
const logsContainer = document.getElementById('logs-container');
const messageInput = document.getElementById('message-input');
// const sendButton = document.getElementById('send-button'); // Renamed to runButton
const runButton = document.getElementById('run-button'); // Was send-button
const micButton = document.getElementById('mic-button');
const micIcon = document.getElementById('mic-icon');
const audioVisualizer = document.getElementById('audio-visualizer');
const connectButton = document.getElementById('connect-button');
const cameraButton = document.getElementById('camera-button');
const cameraIcon = document.getElementById('camera-icon');
const stopVideoButton = document.getElementById('stop-video');
const screenButton = document.getElementById('screen-button');
const screenIcon = document.getElementById('screen-icon');
const screenContainer = document.getElementById('screen-container');
const screenPreview = document.getElementById('screen-preview');
const inputAudioVisualizer = document.getElementById('input-audio-visualizer');
const apiKeyInput = document.getElementById('api-key');
const voiceSelect = document.getElementById('voice-select');
const fpsInput = document.getElementById('fps-input');
const configToggle = document.getElementById('config-toggle-btn'); // Renamed from config-toggle
const configContainer = document.getElementById('config-container');
const systemInstructionInput = document.getElementById('system-instruction'); // This might move to sidebar later
if (systemInstructionInput) systemInstructionInput.value = CONFIG.SYSTEM_INSTRUCTION.TEXT; // Ensure it exists
const applyConfigButton = document.getElementById('apply-config');
const responseTypeSelect = document.getElementById('response-type-select');

// Sidebar DOM Elements
const modelSelect = document.getElementById('model-select');
const temperatureSlider = document.getElementById('temperature-slider');
const temperatureInput = document.getElementById('temperature-input');
const thinkingModeCheckbox = document.getElementById('thinking-mode');
const thinkingBudgetInput = document.getElementById('thinking-budget');
const toolStructuredOutput = document.getElementById('tool-structured-output');
const toolCodeExecution = document.getElementById('tool-code-execution'); // Already here
const toolFunctionCalling = document.getElementById('tool-function-calling');
const toolGroundingSearch = document.getElementById('tool-grounding-search');
const safetySettingsSelect = document.getElementById('safety-settings');
const tokenCountDisplay = document.getElementById('token-count-display'); // Added for token display
const stopSequenceInput = document.getElementById('stop-sequence-input');
const addStopSequenceBtn = document.getElementById('add-stop-sequence-btn');
const stopSequencesList = document.getElementById('stop-sequences-list');

// State for sidebar
let stopSequences = [];


// Load saved values from localStorage
const savedApiKey = localStorage.getItem('gemini_api_key');
const savedVoice = localStorage.getItem('gemini_voice');
const savedFPS = localStorage.getItem('video_fps');
const savedSystemInstruction = localStorage.getItem('system_instruction');


if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
}
if (savedVoice) {
    voiceSelect.value = savedVoice;
}

if (savedFPS) {
    fpsInput.value = savedFPS;
}
if (savedSystemInstruction) {
    systemInstructionInput.value = savedSystemInstruction;
    CONFIG.SYSTEM_INSTRUCTION.TEXT = savedSystemInstruction;
}

// Handle configuration panel toggle (if old panel is still used or repurposed)
if (configToggle && configContainer) {
    configToggle.addEventListener('click', () => {
        configContainer.classList.toggle('active');
        // configToggle.classList.toggle('active'); // The button itself might not need an active class
    });
}

if (applyConfigButton && configContainer && configToggle) {
    applyConfigButton.addEventListener('click', () => {
        configContainer.classList.remove('active'); // Assuming apply closes it
        // configToggle.classList.remove('active');
    });
}


// --- Run Settings Sidebar Logic ---

// Populate Models
async function populateModels() {
    if (!modelSelect) return; // Guard if element not present
    try {
        const response = await fetch('/models');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        modelSelect.innerHTML = ''; // Clear existing options
        if (data && data.data && Array.isArray(data.data)) {
            data.data.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id; // Or a more user-friendly name if available
                modelSelect.appendChild(option);
            });
        } else {
            console.error("Failed to populate models: Invalid data format", data);
            const option = document.createElement('option');
            option.textContent = 'Error loading models';
            modelSelect.appendChild(option);
        }
    } catch (error) {
        console.error("Failed to populate models:", error);
        modelSelect.innerHTML = ''; // Clear existing options
        const option = document.createElement('option');
        option.textContent = 'Error loading models';
        modelSelect.appendChild(option);
    }
}

// Temperature Sync
if (temperatureSlider && temperatureInput) {
    temperatureSlider.addEventListener('input', (e) => temperatureInput.value = e.target.value);
    temperatureInput.addEventListener('change', (e) => { // Use change for direct input
        let value = parseFloat(e.target.value);
        if (isNaN(value)) value = 0.7; // Default or some other logic
        if (value < 0) value = 0;
        if (value > 1) value = 1;
        e.target.value = value; // Correct the input if out of bounds
        temperatureSlider.value = value;
    });
}

// Thinking Budget Toggle
if (thinkingModeCheckbox && thinkingBudgetInput) {
    thinkingModeCheckbox.addEventListener('change', (e) => {
        thinkingBudgetInput.disabled = !e.target.checked;
        if (!e.target.checked) {
            thinkingBudgetInput.value = '';
        }
    });
    // Initial state
    thinkingBudgetInput.disabled = !thinkingModeCheckbox.checked;
}

// Stop Sequences
function renderStopSequences() {
    if (!stopSequencesList) return;
    stopSequencesList.innerHTML = '';
    stopSequences.forEach((seq, index) => {
        const seqElement = document.createElement('div');
        seqElement.className = 'stop-sequence-item'; // For styling
        
        const textSpan = document.createElement('span');
        textSpan.textContent = seq;
        seqElement.appendChild(textSpan);

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>'; // Use icon
        removeBtn.className = 'remove-stop-sequence-btn'; // For styling
        removeBtn.setAttribute('aria-label', `Remove ${seq}`);
        removeBtn.onclick = () => {
            stopSequences.splice(index, 1);
            renderStopSequences();
        };
        seqElement.appendChild(removeBtn);
        stopSequencesList.appendChild(seqElement);
    });
}

if (addStopSequenceBtn && stopSequenceInput) {
    addStopSequenceBtn.addEventListener('click', () => {
        const value = stopSequenceInput.value.trim();
        if (value && !stopSequences.includes(value)) {
            if (stopSequences.length < 5) { // Optional: Limit number of sequences
                stopSequences.push(value);
                stopSequenceInput.value = '';
                renderStopSequences();
            } else {
                logMessage("Maximum 5 stop sequences allowed.", "system");
            }
        }
    });
}

// --- End Run Settings Sidebar Logic ---


// State variables
let isRecording = false;
let audioStreamer = null;
let audioCtx = null;
let isConnected = false;
let audioRecorder = null;
let isVideoActive = false;
let videoManager = null;
let isScreenSharing = false;
let screenRecorder = null;
let isUsingTool = false;

// Multimodal Client
const client = new MultimodalLiveClient();

/**
 * Logs a message to the UI.
 * @param {string} message - The message to log.
 * @param {string} [type='system'] - The type of the message (system, user, ai).
 */
function logMessage(message, type = 'system', isJson = false) {
    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry', type);

    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    timestamp.textContent = new Date().toLocaleTimeString();
    logEntry.appendChild(timestamp);

    const emoji = document.createElement('span');
    emoji.classList.add('emoji');
    switch (type) {
        case 'system':
            emoji.textContent = '⚙️';
            break;
        case 'user':
            emoji.textContent = '🫵';
            break;
        case 'ai':
            emoji.textContent = '🤖';
            break;
    }
    logEntry.appendChild(emoji);

    const messageContent = document.createElement('span');
    messageContent.classList.add('message-content'); // Add class for potential styling

    if (type === 'ai' && typeof message === 'object' && message !== null) { // For functionCall object
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = JSON.stringify(message, null, 2);
        pre.appendChild(code);
        messageContent.appendChild(pre);
        const functionCallLabel = document.createElement('div');
        functionCallLabel.textContent = "Function Call Request:";
        functionCallLabel.style.fontWeight = "bold";
        messageContent.prepend(functionCallLabel);

    } else if (isJson && typeof message === 'string') {
        try {
            const parsedJson = JSON.parse(message);
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.textContent = JSON.stringify(parsedJson, null, 2);
            pre.appendChild(code);
            messageContent.appendChild(pre);
        } catch (e) {
            // If parsing fails, display as plain text
            messageContent.textContent = message;
            Logger.warn("AI response expected JSON, but failed to parse:", message);
        }
    } else {
        messageContent.textContent = message;
    }
    logEntry.appendChild(messageContent);

    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

/**
 * Updates the microphone icon based on the recording state.
 */
function updateMicIcon() {
    micIcon.textContent = isRecording ? 'mic_off' : 'mic';
    micButton.style.backgroundColor = isRecording ? '#ea4335' : '#4285f4';
}

/**
 * Updates the audio visualizer based on the audio volume.
 * @param {number} volume - The audio volume (0.0 to 1.0).
 * @param {boolean} [isInput=false] - Whether the visualizer is for input audio.
 */
function updateAudioVisualizer(volume, isInput = false) {
    const visualizer = isInput ? inputAudioVisualizer : audioVisualizer;
    const audioBar = visualizer.querySelector('.audio-bar') || document.createElement('div');
    
    if (!visualizer.contains(audioBar)) {
        audioBar.classList.add('audio-bar');
        visualizer.appendChild(audioBar);
    }
    
    audioBar.style.width = `${volume * 100}%`;
    if (volume > 0) {
        audioBar.classList.add('active');
    } else {
        audioBar.classList.remove('active');
    }
}

/**
 * Initializes the audio context and streamer if not already initialized.
 * @returns {Promise<AudioStreamer>} The audio streamer instance.
 */
async function ensureAudioInitialized() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (!audioStreamer) {
        audioStreamer = new AudioStreamer(audioCtx);
        await audioStreamer.addWorklet('vumeter-out', 'js/audio/worklets/vol-meter.js', (ev) => {
            updateAudioVisualizer(ev.data.volume);
        });
    }
    return audioStreamer;
}

/**
 * Handles the microphone toggle. Starts or stops audio recording.
 * @returns {Promise<void>}
 */
async function handleMicToggle() {
    if (!isRecording) {
        try {
            await ensureAudioInitialized();
            audioRecorder = new AudioRecorder();
            
            const inputAnalyser = audioCtx.createAnalyser();
            inputAnalyser.fftSize = 256;
            const inputDataArray = new Uint8Array(inputAnalyser.frequencyBinCount);
            
            await audioRecorder.start((base64Data) => {
                if (isUsingTool) {
                    client.sendRealtimeInput([{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data,
                        interrupt: true     // Model isn't interruptable when using tools, so we do it manually
                    }]);
                } else {
                    client.sendRealtimeInput([{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data
                    }]);
                }
                
                inputAnalyser.getByteFrequencyData(inputDataArray);
                const inputVolume = Math.max(...inputDataArray) / 255;
                updateAudioVisualizer(inputVolume, true);
            });

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(inputAnalyser);
            
            await audioStreamer.resume();
            isRecording = true;
            Logger.info('Microphone started');
            logMessage('Microphone started', 'system');
            updateMicIcon();
        } catch (error) {
            Logger.error('Microphone error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            isRecording = false;
            updateMicIcon();
        }
    } else {
        if (audioRecorder && isRecording) {
            audioRecorder.stop();
        }
        isRecording = false;
        logMessage('Microphone stopped', 'system');
        updateMicIcon();
        updateAudioVisualizer(0, true);
    }
}

/**
 * Resumes the audio context if it's suspended.
 * @returns {Promise<void>}
 */
async function resumeAudioContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

/**
 * Connects to the WebSocket server.
 * @returns {Promise<void>}
 */
async function connectToWebsocket() {
    if (!apiKeyInput.value) {
        logMessage('Please input API Key', 'system');
        return;
    }

    // Save values to localStorage
    localStorage.setItem('gemini_api_key', apiKeyInput.value);
    localStorage.setItem('gemini_voice', voiceSelect.value);
    localStorage.setItem('system_instruction', systemInstructionInput.value);

    const config = {
        model: CONFIG.API.MODEL_NAME,
        generationConfig: {
            responseModalities: responseTypeSelect.value,
            speechConfig: {
                voiceConfig: { 
                    prebuiltVoiceConfig: { 
                        voiceName: voiceSelect.value    // You can change voice in the config.js file
                    }
                }
            },

        },
        systemInstruction: {
            parts: [{
                text: systemInstructionInput.value     // You can change system instruction in the config.js file
            }],
        }
    };  

    try {
        await client.connect(config,apiKeyInput.value);
        isConnected = true;
        await resumeAudioContext();
        connectButton.textContent = 'Disconnect';
        connectButton.classList.add('connected');
        messageInput.disabled = false;
        runButton.disabled = false; // Changed from sendButton
        micButton.disabled = false;
        cameraButton.disabled = false;
        screenButton.disabled = false;
        logMessage('Connected to Gemini 2.0 Flash Multimodal Live API', 'system');
    } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        Logger.error('Connection error:', error);
        logMessage(`Connection error: ${errorMessage}`, 'system');
        isConnected = false;
        connectButton.textContent = 'Connect';
        connectButton.classList.remove('connected');
        messageInput.disabled = true;
        runButton.disabled = true; // Changed from sendButton
        micButton.disabled = true;
        cameraButton.disabled = true;
        screenButton.disabled = true;
    }
}

/**
 * Disconnects from the WebSocket server.
 */
function disconnectFromWebsocket() {
    client.disconnect();
    isConnected = false;
    if (audioStreamer) {
        audioStreamer.stop();
        if (audioRecorder) {
            audioRecorder.stop();
            audioRecorder = null;
        }
        isRecording = false;
        updateMicIcon();
    }
    connectButton.textContent = 'Connect';
    connectButton.classList.remove('connected');
    messageInput.disabled = true;
    runButton.disabled = true; // Changed from sendButton
    micButton.disabled = true;
    cameraButton.disabled = true;
    screenButton.disabled = true;
    logMessage('Disconnected from server', 'system');
    
    if (videoManager) {
        stopVideo();
    }
    
    if (screenRecorder) {
        stopScreenSharing();
    }
}

/**
 * Handles sending a text message.
 */
function handleSendMessage() {
    const messageText = messageInput.value.trim();

    // 1. Gather settings from the sidebar
    const currentSettings = {
        model: modelSelect ? modelSelect.value : CONFIG.API.MODEL_NAME,
        temperature: temperatureInput ? parseFloat(temperatureInput.value) : 0.7,
        // thinkingModeEnabled and thinkingBudget are client-side only, not sent to proxy
        tools: {
            structuredOutput: toolStructuredOutput ? toolStructuredOutput.checked : false,
            codeExecution: toolCodeExecution ? toolCodeExecution.checked : false,
            functionCalling: toolFunctionCalling ? toolFunctionCalling.checked : false,
            groundingSearch: toolGroundingSearch ? toolGroundingSearch.checked : false,
        },
        safety: safetySettingsSelect ? safetySettingsSelect.value : "block_none",
        stop: [...stopSequences]
    };

    // 2. Construct messages array
    const messages = [];
    // Add system instruction if provided and not empty
    if (systemInstructionInput && systemInstructionInput.value.trim() !== '') {
        messages.push({ role: 'system', content: systemInstructionInput.value.trim() });
    }

    // Add user message if provided
    if (messageText) {
        messages.push({ role: 'user', content: messageText });
    } 
    
    // If no text message and no active media streams (conceptual, client.getRealtimeInputs is a placeholder)
    // and not just a settings change, then don't send.
    if (messages.length === 0 && client.getRealtimeInputs().length === 0) {
         // Allow "sending" if only settings have changed significantly, but we need a message for the proxy.
         // This case is tricky. If user just changes model and hits run without text, what happens?
         // For now, require some content (text, or assume media is being streamed).
        if (stopSequences.length > 0 || currentSettings.model !== CONFIG.API.MODEL_NAME || currentSettings.safety !== "block_none" || currentSettings.temperature !== 0.7) {
             logMessage("Settings noted. Type a message or provide media to run with these settings.", "system");
             console.log("Current Run Settings (no message to send, but settings changed):", currentSettings);
        } else {
            logMessage("Please enter a message or provide media to send.", "system");
        }
        return;
    }
    // If only system instructions are present (e.g. user cleared their message but left system instructions)
    // we still need a "user" role message for some models, or the interaction might not be valid.
    // However, the current proxy structure might handle system-only if it implies a new turn.
    // For safety, let's ensure there's at least one non-system message or active media if messages array is not empty.
    if (messages.length > 0 && !messages.some(m => m.role === 'user') && client.getRealtimeInputs().length === 0) {
        logMessage("Please provide a user message or ensure media is active to run with system instructions.", "system");
        return;
    }


    // 3. Construct the request body for the API proxy
    const requestBody = {
        model: currentSettings.model,
        messages: messages, // messages array will be empty if only media is present (handled by client's realtime input)
        temperature: currentSettings.temperature,
        stop: currentSettings.stop.length > 0 ? currentSettings.stop : undefined,
        safety: currentSettings.safety,
        tools: currentSettings.tools,
        stream: true, // MultimodalLiveClient implies streaming for chat completions
        // stream_options: { include_usage: true } // This is handled by the proxy now
    };

    // Log the user's message to the UI
    if (messageText) {
        logMessage(messageText, 'user');
    }
    console.log("Request Body prepared for Client:", requestBody);
    
    // The MultimodalLiveClient's .send() method is for text messages in the current turn.
    // Settings are typically sent at the start of a connection or a new turn.
    // The conceptual client.setNextTurnConfig will store this requestBody.
    // The client library would then use this config when it internally makes the actual API call.
    client.setNextTurnConfig(requestBody);

    if (messageText) {
        client.send({ text: messageText }); // Send only the text part for this specific message
        messageInput.value = ''; // Clear input after sending
    } else if (client.getRealtimeInputs().length > 0 || messages.some(m=>m.role === 'system')) {
        // If there's no new text, but media is active OR there were system instructions to send,
        // we might need a way to trigger the client to start/finalize the turn with the new config.
        // This could be client.sendEmptyTurnSignal() or similar.
        // For now, settings are stored, and next text input or media will use them.
        logMessage("Settings and/or media prepared for interaction.", "system");
    }
    // Reset token display for a new turn, actual values will come from server response.
    updateTokenDisplay({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }); 
}


// Helper function to update token display
function updateTokenDisplay(usage) {
    if (tokenCountDisplay) { // Ensure element exists
        if (usage && typeof usage.total_tokens === 'number') {
            const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = usage;
            tokenCountDisplay.textContent = `Total: ${total_tokens} (Prompt: ${prompt_tokens}, Completion: ${completion_tokens})`;
        } else {
            tokenCountDisplay.textContent = 'Token count: N/A'; // Default or reset state
        }
    }
}


// Event Listeners
client.on('open', () => {
    logMessage('WebSocket connection opened', 'system');
    updateTokenDisplay(null); // Reset token count on new connection
});

client.on('log', (log) => {
    logMessage(`${log.type}: ${JSON.stringify(log.message)}`, 'system');
});

client.on('close', (event) => {
    logMessage(`WebSocket connection closed (code ${event.code})`, 'system');
});

client.on('audio', async (data) => {
    try {
        await resumeAudioContext();
        const streamer = await ensureAudioInitialized();
        streamer.addPCM16(new Uint8Array(data));
    } catch (error) {
        logMessage(`Error processing audio: ${error.message}`, 'system');
    }
});

client.on('content', (data) => {
    if (data.modelTurn) {
        // Check if the client object and its _nextTurnConfig property exist
        const currentTurnConfig = client && client._nextTurnConfig ? client._nextTurnConfig : {};
        const expectingStructuredOutput = currentTurnConfig.tools?.structuredOutput || currentTurnConfig.tools?.functionCalling;

        data.modelTurn.parts.forEach(part => {
            if (part.functionCall) {
                isUsingTool = true; // Mark that a tool (function call) is being used or requested
                Logger.info('AI requested a function call:', part.functionCall);
                logMessage(part.functionCall, 'ai'); // logMessage will handle object formatting
            } else if (part.text) {
                if (expectingStructuredOutput) {
                    // Try to detect if it's JSON, even if not perfectly,
                    // as Gemini might return plain text before or after JSON when function calling.
                    const trimmedText = part.text.trim();
                    if ((trimmedText.startsWith('{') && trimmedText.endsWith('}')) || (trimmedText.startsWith('[') && trimmedText.endsWith(']'))) {
                        logMessage(part.text, 'ai', true); // Attempt to log as JSON
                    } else {
                        logMessage(part.text, 'ai', false); // Log as plain text
                    }
                } else {
                    logMessage(part.text, 'ai', false); // Log as plain text
                }
            }
        });
        // Note: isUsingTool might need to be reset more reliably, e.g., on 'turncomplete' or 'functionResponse'
        // For now, if a functionCall is made, we assume the model expects a functionResponse next.
    }
});

client.on('interrupted', () => {
    audioStreamer?.stop();
    isUsingTool = false;
    Logger.info('Model interrupted');
    logMessage('Model interrupted', 'system');
});

client.on('setupcomplete', () => {
    logMessage('Setup complete', 'system');
});

client.on('turncomplete', () => {
    isUsingTool = false;
    logMessage('Turn complete', 'system');
});

client.on('error', (error) => {
    if (error instanceof ApplicationError) {
        Logger.error(`Application error: ${error.message}`, error);
    } else {
        Logger.error('Unexpected error', error);
    }
    logMessage(`Error: ${error.message}`, 'system');
});

client.on('message', (parsedMessage) => { // Assuming this now receives already parsed JSON from SSE events
    // This handler is for messages directly from the WebSocket that might not be part of 'content' flow.
    // Specifically, the proxy sends a final SSE event with usage data.
    if (parsedMessage && typeof parsedMessage === 'object') {
        if (parsedMessage.usage) {
            updateTokenDisplay(parsedMessage.usage);
            // This is a special message containing only usage, do not process further for content.
            return; 
        }
        if (parsedMessage.error) { // Handle top-level errors from stream if proxy sends them this way
            Logger.error('Server error received in message event:', parsedMessage.error);
            logMessage(`Server error: ${parsedMessage.error.message || JSON.stringify(parsedMessage.error)}`, 'system');
            return;
        }
        // Other types of messages not handled by specific client events ('content', 'audio', etc.)
        // could be logged or processed here if necessary.
        // For now, we are primarily interested in the 'usage' message.
    }
});

// Note: The existing client.on('content', (data) => { ... }) handles modelTurn.parts for AI text.
// The client.on('turncomplete', () => { ... }) is also a good place to potentially receive final usage,
// if the client library aggregates it there. The current proxy sends it as a separate SSE event,
// which client.on('message') is intended to catch.


if (runButton) { // Changed from sendButton
    runButton.addEventListener('click', handleSendMessage);
}
if (messageInput) {
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { // Send on Enter, new line on Shift+Enter
            event.preventDefault(); // Prevent new line in textarea on simple Enter
            handleSendMessage();
        }
    });
}

if (micButton) {
    micButton.addEventListener('click', handleMicToggle);
}

if (connectButton) {
    connectButton.addEventListener('click', () => {
        if (isConnected) {
            disconnectFromWebsocket();
        } else {
            connectToWebsocket();
        }
    });
}

// Initial UI state
if (messageInput) messageInput.disabled = true;
if (runButton) runButton.disabled = true; // Changed from sendButton
if (micButton) micButton.disabled = true;
if (connectButton) connectButton.textContent = 'Connect';

// Initial calls for sidebar features
document.addEventListener('DOMContentLoaded', () => {
    populateModels();
    renderStopSequences(); // Initial render for empty list
    updateTokenDisplay(null); // Initialize token display
    // Ensure initial state of thinking budget input is correct
    if (thinkingModeCheckbox && thinkingBudgetInput) {
        thinkingBudgetInput.disabled = !thinkingModeCheckbox.checked;
    }

    // Add setNextTurnConfig to client prototype if it doesn't exist (for conceptual demonstration)
    if (client && typeof client.setNextTurnConfig !== 'function') {
        client.setNextTurnConfig = function(config) {
            this._nextTurnConfig = config; // Store the config
            console.log("Next turn config set on client (conceptual):", this._nextTurnConfig);
            // In a real implementation, the client library would use this._nextTurnConfig
            // when it constructs the actual payload for its next API call (e.g., inside its own send/connect logic).
        };
    }
    if(client && typeof client.getRealtimeInputs !== 'function') {
        // Placeholder for a method that might exist on the client to check for active media streams
        client.getRealtimeInputs = function() { 
            // A real implementation would check if audio/video/screen is actively being captured or queued by the client.
            // For this demo, it always returns an empty array, meaning no media is being "pre-queued" via this check.
            // Actual media is sent using client.sendRealtimeInput().
            return []; 
        }; 
    }
});

/**
 * Handles the video toggle. Starts or stops video streaming.
 * @returns {Promise<void>}
 */
async function handleVideoToggle() {
    Logger.info('Video toggle clicked, current state:', { isVideoActive, isConnected });
    
    localStorage.setItem('video_fps', fpsInput.value);

    if (!isVideoActive) {
        try {
            Logger.info('Attempting to start video');
            if (!videoManager) {
                videoManager = new VideoManager();
            }
            
            await videoManager.start(fpsInput.value,(frameData) => {
                if (isConnected) {
                    client.sendRealtimeInput([frameData]);
                }
            });

            isVideoActive = true;
            cameraIcon.textContent = 'videocam_off';
            cameraButton.classList.add('active');
            Logger.info('Camera started successfully');
            logMessage('Camera started', 'system');

        } catch (error) {
            Logger.error('Camera error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            isVideoActive = false;
            videoManager = null;
            cameraIcon.textContent = 'videocam';
            cameraButton.classList.remove('active');
        }
    } else {
        Logger.info('Stopping video');
        stopVideo();
    }
}

/**
 * Stops the video streaming.
 */
function stopVideo() {
    if (videoManager) {
        videoManager.stop();
        videoManager = null;
    }
    isVideoActive = false;
    cameraIcon.textContent = 'videocam';
    cameraButton.classList.remove('active');
    logMessage('Camera stopped', 'system');
}

cameraButton.addEventListener('click', handleVideoToggle);
stopVideoButton.addEventListener('click', stopVideo);

if (cameraButton) cameraButton.disabled = true;

/**
 * Handles the screen share toggle. Starts or stops screen sharing.
 * @returns {Promise<void>}
 */
async function handleScreenShare() {
    if (!isScreenSharing) {
        try {
            screenContainer.style.display = 'block';
            
            screenRecorder = new ScreenRecorder();
            await screenRecorder.start(screenPreview, (frameData) => {
                if (isConnected) {
                    client.sendRealtimeInput([{
                        mimeType: "image/jpeg",
                        data: frameData
                    }]);
                }
            });

            isScreenSharing = true;
            screenIcon.textContent = 'stop_screen_share';
            screenButton.classList.add('active');
            Logger.info('Screen sharing started');
            logMessage('Screen sharing started', 'system');

        } catch (error) {
            Logger.error('Screen sharing error:', error);
            logMessage(`Error: ${error.message}`, 'system');
            isScreenSharing = false;
            screenIcon.textContent = 'screen_share';
            screenButton.classList.remove('active');
            screenContainer.style.display = 'none';
        }
    } else {
        stopScreenSharing();
    }
}

/**
 * Stops the screen sharing.
 */
function stopScreenSharing() {
    if (screenRecorder) {
        screenRecorder.stop();
        screenRecorder = null;
    }
    isScreenSharing = false;
    screenIcon.textContent = 'screen_share';
    screenButton.classList.remove('active');
    screenContainer.style.display = 'none';
    logMessage('Screen sharing stopped', 'system');
}

screenButton.addEventListener('click', handleScreenShare);
if (screenButton) screenButton.disabled = true;