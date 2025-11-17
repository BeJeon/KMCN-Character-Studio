// Copyright (c) 2025 BeJeon. All Rights Reserved.

import type { ActivityLog } from '../types';

const ACTIVITY_LOG_KEY = 'activityHistory';
const MAX_LOG_ENTRIES = 50; // This should be fine with thumbnails

/**
 * Creates a smaller JPEG thumbnail from a base64 data URL to save storage space.
 * @param base64Url The original image data URL.
 * @param size The maximum width or height of the thumbnail.
 * @returns A promise that resolves with the new thumbnail data URL.
 */
async function createImageThumbnail(base64Url: string, size: number = 128): Promise<string> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const aspect = image.naturalWidth / image.naturalHeight;
            
            if (image.naturalWidth > image.naturalHeight) {
                canvas.width = size;
                canvas.height = size / aspect;
            } else {
                canvas.height = size;
                canvas.width = size * aspect;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas context not available for thumbnail.'));

            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            // Use jpeg for smaller file size, quality 0.8 is a good balance
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        image.onerror = (err) => {
            console.error("Failed to load image for thumbnail creation, returning original", err);
            // Fallback to original if loading fails for some reason
            resolve(base64Url);
        };
        image.src = base64Url;
    });
}


/**
 * Retrieves the entire activity log from localStorage.
 * @returns An array of activity log entries, or an empty array if none exists or an error occurs.
 */
export const getActivityLog = (): ActivityLog[] => {
    try {
        const storedLog = localStorage.getItem(ACTIVITY_LOG_KEY);
        return storedLog ? JSON.parse(storedLog) : [];
    } catch (error) {
        console.error("Failed to retrieve or parse activity log from localStorage:", error);
        return [];
    }
};

/**
 * Adds a new activity entry to the log in localStorage after converting images to thumbnails.
 * @param activity - The activity data to log.
 */
export const logActivity = async (activity: Omit<ActivityLog, 'id' | 'timestamp' | 'userName'>): Promise<void> => {
    const userName = sessionStorage.getItem('loggedInUser');
    if (!userName) {
        console.warn("Could not log activity: User not found in sessionStorage.");
        return;
    }

    let newLogEntry: ActivityLog;
    try {
        const thumbnailInputs = await Promise.all(activity.inputs.map(inputUrl => createImageThumbnail(inputUrl)));
        const thumbnailOutput = await createImageThumbnail(activity.output);

        newLogEntry = {
            ...activity,
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            userName: userName,
            inputs: thumbnailInputs,
            output: thumbnailOutput,
        };
    } catch (thumbError) {
        console.error("Failed to create thumbnails for activity log:", thumbError);
        return; // Do not log if thumbnails fail
    }

    try {
        const currentLog = getActivityLog();
        const updatedLog = [newLogEntry, ...currentLog];
        const cappedLog = updatedLog.slice(0, MAX_LOG_ENTRIES);
        localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(cappedLog));
    } catch (error) {
        console.error("Failed to save activity log to localStorage:", error);
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            // If quota is exceeded, it's likely due to old, large log entries.
            // As a recovery step, we'll clear the log and save only the new entry.
            // This is a drastic measure but ensures the app remains usable.
            console.warn("Quota exceeded. Clearing activity log and saving only the latest entry.");
            try {
                localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify([newLogEntry]));
            } catch (retryError) {
                console.error("Failed to save even a single log entry after clearing:", retryError);
            }
        }
    }
};


/**
 * Clears the entire activity log from localStorage.
 * @returns true if successful, false otherwise.
 */
export const clearActivityLog = (): boolean => {
    try {
        localStorage.removeItem(ACTIVITY_LOG_KEY);
        return true;
    } catch (error) {
        console.error("Failed to clear activity log from localStorage:", error);
        return false;
    }
};