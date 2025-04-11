export const CONFIG = {
    API: {
        VERSION: 'v1alpha',
        MODEL_NAME: 'models/gemini-2.0-flash-live-001'
    },
    // You can change the system instruction to your liking
    SYSTEM_INSTRUCTION: {
        TEXT: 'You are my helpful assistant. You can see and hear me, and respond with voice and text. If you are asked about things you do not know, you can use the google search tool to find the answer.',
    },
    // Default audio settings
    AUDIO: {
        SAMPLE_RATE: 16000,
        OUTPUT_SAMPLE_RATE: 24000,      // If you want to have fun, set this to around 14000 (u certainly will)
        BUFFER_SIZE: 2048,
        CHANNELS: 1
    },
    // If you are working in the RoArm branch 
    // ROARM: {
    //     IP_ADDRESS: '192.168.1.4'
    // }
  };
  
  export default CONFIG; 
