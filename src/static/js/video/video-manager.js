import { Logger } from '../utils/logger.js';
import { VideoRecorder } from './video-recorder.js';
import { ApplicationError, ErrorCodes } from '../utils/error-boundary.js';

/**
 * @fileoverview Manages video capture and processing with motion detection and frame preview.
 */

/**
 * Manages video capture and processing with motion detection and frame preview
 * @class VideoManager
 */
export class VideoManager {
    /**
     * Creates a new VideoManager instance
     * @constructor
     */
    constructor() {
        // Add at the start of constructor
        if (!document.getElementById('video-container')) {
            throw new ApplicationError(
                'Video container element not found',
                ErrorCodes.INVALID_STATE
            );
        }
        // DOM elements
        this.videoContainer = document.getElementById('video-container');
        this.previewVideo = document.getElementById('preview');
        this.stopVideoButton = document.getElementById('stop-video');
        this.framePreview = document.createElement('canvas');
        
        // State management
        this.lastFrameData = null;
        this.lastSignificantFrame = null;
        this.frameCount = 0;
        this.lastFrameTime = 0;
        this.videoRecorder = null;
        this.isActive = false;

        // Configuration
        this.MOTION_THRESHOLD = 10;  // Minimum pixel difference to detect motion
        this.FRAME_INTERVAL = 200;   // Minimum ms between frames
        this.FORCE_FRAME_INTERVAL = 10; // Send frame every N frames regardless of motion

        this.setupFramePreview();

        // 摄像头状态，用户切换镜头
        this.facingMode = 'user';
        this.onFrame = null;
        this.fps = null;
        
        // 获取翻转按钮元素并添加事件监听
        this.flipCameraButton = document.getElementById('flip-camera');
        if (!this.flipCameraButton) {
            throw new ApplicationError(
                'Flip camera button element not found',
                ErrorCodes.INVALID_STATE
            );
        }
        
        // 在构造函数中直接绑定事件
        this.flipCameraButton.addEventListener('click', async () => {
            try {
                await this.flipCamera();
            } catch (error) {
                Logger.error('Error flipping camera:', error);
            }
        });
    }

    /**
     * Sets up the frame preview canvas
     * @private
     */
    setupFramePreview() {
        this.framePreview.id = 'frame-preview';
        this.framePreview.width = 320;
        this.framePreview.height = 240;
        this.videoContainer.appendChild(this.framePreview);

        // Add click handler to toggle preview size
        this.framePreview.addEventListener('click', () => {
            this.framePreview.classList.toggle('enlarged');
        });
    }

    /**
     * Updates the frame preview with new image data
     * @param {string} base64Data - Base64 encoded image data
     * @private
     */
    updateFramePreview(base64Data,width,height) {
        const img = new Image();
        img.onload = () => {
            const ctx = this.framePreview.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
        };
        img.src = 'data:image/jpeg;base64,' + base64Data;
    }

    /**
     * Detects motion between two frames
     * @param {Uint8ClampedArray} prevFrame - Previous frame data
     * @param {Uint8ClampedArray} currentFrame - Current frame data
     * @returns {number} Motion score
     * @private
     */
    detectMotion(prevFrame, currentFrame) {
        let diff = 0;
        const pixelsToCheck = prevFrame.length / 4;
        const skipPixels = 2;

        for (let i = 0; i < prevFrame.length; i += 4 * skipPixels) {
            const rDiff = Math.abs(prevFrame[i] - currentFrame[i]);
            const gDiff = Math.abs(prevFrame[i + 1] - currentFrame[i + 1]);
            const bDiff = Math.abs(prevFrame[i + 2] - currentFrame[i + 2]);
            diff += (rDiff + gDiff + bDiff) / 3;
        }

        return diff / (pixelsToCheck / skipPixels);
    }

    /**
     * Starts video capture and processing
     * @param {Function} onFrame - Callback for processed frames
     * @returns {Promise<boolean>} Success status
     * @throws {ApplicationError} If video capture fails
     */
    async start(fps, onFrame) {
        try {
            this.onFrame = onFrame;
            this.fps = fps;
            Logger.info('Starting video manager');
            this.videoContainer.style.display = 'block';
            console.log("fps:",fps);
            this.videoRecorder = new VideoRecorder({fps: fps});
                        
            await this.videoRecorder.start(this.previewVideo,this.facingMode, (base64Data) => {
                if (!this.isActive) {
                    //Logger.debug('Skipping frame - inactive');
                    return;
                }

                const currentTime = Date.now();
                if (currentTime - this.lastFrameTime < this.FRAME_INTERVAL) {
                    return;
                }

                this.processFrame(base64Data, onFrame);
            });

            this.isActive = true;
            return true;

        } catch (error) {
            Logger.error('Video manager error:', error);
            this.stop();
            throw new ApplicationError(
                'Failed to start video manager',
                ErrorCodes.VIDEO_START_FAILED,
                { originalError: error }
            );
        }
    }

    /**
     * Processes a single video frame
     * @param {string} base64Data - Base64 encoded frame data
     * @param {Function} onFrame - Frame callback
     * @private
     */
    processFrame(base64Data, onFrame) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            if (this.lastFrameData) {
                const motionScore = this.detectMotion(this.lastFrameData, imageData.data);
                if (motionScore < this.MOTION_THRESHOLD && this.frameCount % this.FORCE_FRAME_INTERVAL !== 0) {
                    //Logger.debug(`Skipping frame - low motion (score: ${motionScore})`);
                    return;
                }
            }

            this.framePreviewWidth = Math.round(canvas.width * 0.5);
            this.framePreviewHeight = Math.round(canvas.height * 0.5);

            this.updateFramePreview(base64Data,this.framePreviewWidth,this.framePreviewHeight);
            
            this.lastFrameData = imageData.data;
            this.lastSignificantFrame = base64Data;
            this.lastFrameTime = Date.now();
            this.frameCount++;

            const size = Math.round(base64Data.length / 1024);
            //Logger.debug(`Processing frame (${size}KB) - frame #${this.frameCount}`);

            onFrame({
                mimeType: "image/jpeg",
                data: base64Data
            });
        };
        img.src = 'data:image/jpeg;base64,' + base64Data;
    }

    /**
     * Stops video capture and processing
     */
    stop() {
        if (this.videoRecorder) {
            this.videoRecorder.stop();
            this.videoRecorder = null;
        }
        this.isActive = false;
        this.videoContainer.style.display = 'none';
        this.lastFrameData = null;
        this.lastSignificantFrame = null;
        this.frameCount = 0;
    }


    async flipCamera() {

        try {
            Logger.info('Flipping camera');
            this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';         
            this.stop();
            await this.start(this.fps,this.onFrame);
            Logger.info('Camera flipped successfully');
        } catch (error) {
            Logger.error('Error flipping camera:', error);
            throw new ApplicationError(
                'Failed to flip camera',
                ErrorCodes.VIDEO_FLIP_FAILED,
                { originalError: error }
            );
        }
    }
}