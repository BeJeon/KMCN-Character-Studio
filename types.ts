// Copyright (c) 2025 BeJeon. All Rights Reserved.

export interface GeneratedImage {
  id: string;
  src: string;
  expressionName: string;
  angleName: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  error?: string;
  // Activity Log Fields
  prompt?: string;
  originalImageUrls?: string[];
}

export interface ActivityLog {
    id: string;
    timestamp: string;
    userName: string;
    generator: 'Expression' | 'Scene' | 'CameraAngle' | 'Extender' | 'Perspective';
    details: {
        prompt?: string;
        backgroundPrompt?: string;
        clothingPrompt?: string;
        angle?: string;
        aspectRatio?: string;
    };
    inputs: string[]; // base64 URLs of input images
    output: string; // base64 URL of the output image
}