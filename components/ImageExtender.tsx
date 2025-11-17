// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React, { useState, useCallback, useEffect } from 'react';
import { extendImage } from '../services/geminiService';
import { logActivity } from '../services/activityLog';
import Loader from './Loader';
import XIcon from './icons/XIcon';
import DownloadIcon from './icons/DownloadIcon';

interface GeneratedImage {
    id: string;
    src: string;
    aspectRatio: '9:16' | '16:9';
    originalFileName: string;
}

interface UploadHistoryItem {
    id: string;
    file: File;
    url: string;
}

// Helper to convert base64 data URL to blob
const dataURLToBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    if (arr.length < 2) {
        return null;
    }
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        return null;
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

interface ImageExtenderProps {
    isCreator: boolean;
}

const ImageExtender: React.FC<ImageExtenderProps> = ({ isCreator }) => {
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatingRatio, setGeneratingRatio] = useState<'9:16' | '16:9' | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cleanup blob URLs on unmount or when images change to prevent memory leaks
    return () => {
        uploadHistory.forEach(item => URL.revokeObjectURL(item.url));
        generatedImages.forEach(image => {
            if (image.src.startsWith('blob:')) {
                URL.revokeObjectURL(image.src);
            }
        });
    };
  }, [uploadHistory, generatedImages]);

  const handleFileUpload = useCallback((file: File) => {
    if (isGenerating) return;
    
    const newId = `upload-${Date.now()}`;
    const newUrl = URL.createObjectURL(file);
    const newHistoryItem = { id: newId, file, url: newUrl };

    setUploadHistory(prev => [newHistoryItem, ...prev.filter(item => item.file.name !== file.name)]);
    setOriginalImage(file);
    setOriginalImageUrl(newUrl);
    setError(null);
  }, [isGenerating]);

  const handleImageUploadEvent = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); setIsDragging(false); };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFileUpload(file);
    } else {
      setError("Please drop an image file.");
    }
  };

  const handleGenerate = async (aspectRatio: '9:16' | '16:9') => {
    if (!originalImage || !originalImageUrl) {
      setError("Please upload an image first.");
      return;
    }
    
    setError(null);
    setIsGenerating(true);
    setGeneratingRatio(aspectRatio);

    try {
      // Create a template image with the original image in the center and transparent background
      const templateData = await new Promise<string>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          const isVertical = aspectRatio === '9:16';
          const targetWidth = isVertical ? 1080 : 1920;
          const targetHeight = isVertical ? 1920 : 1080;
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return reject(new Error("Could not get canvas context."));
          }

          // Ensure canvas is fully transparent before drawing
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (isVertical) {
            // Fit width for 9:16
            const scale = targetWidth / image.naturalWidth;
            const drawHeight = image.naturalHeight * scale;
            const y = (targetHeight - drawHeight) / 2;
            ctx.drawImage(image, 0, y, targetWidth, drawHeight);
          } else {
             // Fit height for 16:9
            const scale = targetHeight / image.naturalHeight;
            const drawWidth = image.naturalWidth * scale;
            const x = (targetWidth - drawWidth) / 2;
            ctx.drawImage(image, x, 0, drawWidth, targetHeight);
          }
          
          // Export as PNG to preserve transparency
          resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = () => reject(new Error("Failed to load original image for template creation."));
        image.src = originalImageUrl;
      });

      // The template is always a PNG to preserve transparency.
      const mimeType = 'image/png';
      // A more robust way to get base64 data from a data URL.
      const base64Data = templateData.substring(templateData.indexOf(',') + 1);

      const { base64Data: extendedImageBase64, mimeType: extendedImageMimeType } = await extendImage(base64Data, mimeType, aspectRatio);
      const dataUrl = `data:${extendedImageMimeType};base64,${extendedImageBase64}`;
      
      await logActivity({
          generator: 'Extender',
          details: { aspectRatio },
          inputs: [originalImageUrl],
          output: dataUrl
      });
      
      const outputBlob = dataURLToBlob(dataUrl);
      const outputBlobUrl = outputBlob ? URL.createObjectURL(outputBlob) : dataUrl;

      const newImage: GeneratedImage = {
        id: `extended-${Date.now()}`,
        src: outputBlobUrl,
        aspectRatio: aspectRatio,
        originalFileName: originalImage.name,
      };
      setGeneratedImages(prev => [newImage, ...prev]);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred during generation.");
    } finally {
      setIsGenerating(false);
      setGeneratingRatio(null);
    }
  };

  const handleDownloadItem = (image: GeneratedImage) => {
    const originalFileNameBase = image.originalFileName.replace(/\.[^/.]+$/, "");
    const shortBase = originalFileNameBase.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    const filename = `${shortBase}-ext-${image.aspectRatio.replace(':', 'x')}.png`;

    const link = document.createElement('a');
    link.href = image.src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleDownloadMain = () => {
    if (generatedImages.length > 0) {
        handleDownloadItem(generatedImages[0]);
    }
  };

  const handleSelectFromGeneratedHistory = (imageId: string) => {
    if (isGenerating) return;
    setGeneratedImages(prev => {
        const selected = prev.find(img => img.id === imageId);
        if (!selected) return prev;
        const rest = prev.filter(img => img.id !== imageId);
        return [selected, ...rest];
    });
  };

  const handleRemoveFromGeneratedHistory = (imageId: string) => {
      const imageToRemove = generatedImages.find(img => img.id === imageId);
      if (imageToRemove?.src.startsWith('blob:')) {
          URL.revokeObjectURL(imageToRemove.src);
      }
      setGeneratedImages(prev => prev.filter(img => img.id !== imageId));
  }

  const handleSelectFromUploadHistory = (id: string) => {
    if (isGenerating) return;
    const selected = uploadHistory.find(item => item.id === id);
    if (selected) {
        setOriginalImage(selected.file);
        setOriginalImageUrl(selected.url);
    }
  };

  const handleRemoveFromUploadHistory = (id: string) => {
      const itemToRemove = uploadHistory.find(item => item.id === id);
      if (!itemToRemove) return;

      if (originalImageUrl === itemToRemove.url) {
          setOriginalImage(null);
          setOriginalImageUrl(null);
      }
      
      URL.revokeObjectURL(itemToRemove.url);

      setUploadHistory(prev => prev.filter(item => item.id !== id));
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl h-fit flex flex-col gap-6">
        <div>
            <h2 className="text-2xl font-bold mb-4 border-b border-slate-200 dark:border-slate-700 pb-3 text-slate-900 dark:text-white">1. 이미지 업로드 및 선택</h2>
            <label 
              htmlFor="extender-image-upload" 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`cursor-pointer block w-full border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${isDragging ? 'border-purple-500 bg-slate-100/80 dark:bg-slate-700/60 ring-4 ring-purple-500/20' : 'border-slate-300 dark:border-slate-600 hover:border-purple-500 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'}`}
            >
              {originalImageUrl ? (
                <img src={originalImageUrl} alt="Uploaded 1:1 preview" className="max-h-80 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="mt-4 block font-medium text-slate-600 dark:text-slate-300">숏폼 또는 영상 배경으로 사용할 1:1 이미지를 업로드하세요</span>
                  <span className="text-sm text-slate-500 mt-1">AI가 이미지의 상하 또는 좌우를 자연스럽게 확장하여 9:16 또는 16:9 비율로 만들어줍니다.</span>
                </div>
              )}
            </label>
            <input id="extender-image-upload" type="file" accept="image/*" className="sr-only" onChange={handleImageUploadEvent} disabled={isGenerating}/>
        </div>
        {uploadHistory.length > 0 && (
            <div>
                <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-300">업로드 기록</h3>
                <div className="flex overflow-x-auto space-x-3 pb-2 -mx-6 px-6">
                    {uploadHistory.map((item) => (
                        <div key={item.id} className="relative flex-shrink-0 group">
                            <img 
                                src={item.url} 
                                alt="Upload history thumbnail" 
                                onClick={() => handleSelectFromUploadHistory(item.id)}
                                className={`h-24 w-24 object-cover rounded-md cursor-pointer transition-all duration-200 aspect-square ${originalImageUrl === item.url ? 'ring-2 ring-purple-500 shadow-lg' : 'opacity-70 group-hover:opacity-100'}`}
                            />
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveFromUploadHistory(item.id); }}
                                disabled={isGenerating}
                                className="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all focus:outline-none focus:ring-2 focus:ring-red-400 disabled:cursor-not-allowed"
                                aria-label="Remove from upload history"
                            >
                                <XIcon />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <button
                onClick={() => handleGenerate('9:16')}
                disabled={isGenerating || !originalImage}
                className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
            >
                {generatingRatio === '9:16' ? <><Loader /> <span className="ml-2">확장 중...</span></> : '9:16 비율로 확장하기'}
            </button>
            <button
                onClick={() => handleGenerate('16:9')}
                disabled={isGenerating || !originalImage}
                className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
            >
                {generatingRatio === '16:9' ? <><Loader /> <span className="ml-2">확장 중...</span></> : '16:9 비율로 확장하기'}
            </button>
        </div>
        {error && <div className="bg-red-500/20 border border-red-500/30 text-red-300 dark:text-red-200 px-4 py-3 rounded-md mt-4">{error}</div>}
      </div>

      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">생성된 이미지</h2>
            {generatedImages.length > 0 && !isGenerating && (
            <button 
                onClick={handleDownloadMain}
                disabled={!isCreator}
                title={!isCreator ? "관리자만 다운로드할 수 있습니다." : "다운로드"}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
            >
                다운로드
            </button>
            )}
        </div>
        <div className={`flex-grow flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900/50 min-h-[400px] lg:min-h-0 w-full max-h-[70vh] ${generatedImages[0]?.aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16] mx-auto'}`}>
            {isGenerating && generatingRatio && <div className="text-center text-slate-500 dark:text-slate-400"><Loader/> <p className="mt-4">AI가 이미지를 {generatingRatio} 비율로 확장하고 있습니다...</p></div>}
            {!isGenerating && generatedImages.length > 0 && (
                 <img src={generatedImages[0].src} alt="Generated scene" className="max-h-full max-w-full object-contain rounded-md" />
            )}
             {!isGenerating && generatedImages.length === 0 && (
              <div className="text-center text-slate-400 dark:text-slate-500">
                <p>1:1 이미지를 업로드하고 생성하면</p>
                <p>결과가 여기에 표시됩니다.</p>
              </div>
            )}
        </div>

        {generatedImages.length > 0 && (
            <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-300">생성 기록</h3>
                <div className="flex overflow-x-auto space-x-3 pb-2 -mx-6 px-6">
                    {generatedImages.map((image) => (
                        <div key={image.id} className="relative flex-shrink-0 group" title={`Original: ${image.originalFileName}\nRatio: ${image.aspectRatio}`}>
                            <img 
                                src={image.src} 
                                alt="Generated history thumbnail" 
                                onClick={() => handleSelectFromGeneratedHistory(image.id)}
                                className={`h-24 object-cover rounded-md cursor-pointer transition-all duration-200 ${image.aspectRatio === '16:9' ? 'aspect-video w-auto' : 'aspect-[9/16]'} ${generatedImages[0].id === image.id ? 'ring-2 ring-purple-500 shadow-lg' : 'opacity-70 group-hover:brightness-50'}`}
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDownloadItem(image); }}
                                    disabled={!isCreator}
                                    title={!isCreator ? "관리자 전용 기능" : "다운로드"}
                                    className="text-white p-2 rounded-full hover:bg-black/50 transition-colors disabled:cursor-not-allowed disabled:text-slate-400"
                                    aria-label="Download image"
                                >
                                    <DownloadIcon />
                                </button>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveFromGeneratedHistory(image.id); }}
                                disabled={isGenerating}
                                className="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all focus:outline-none focus:ring-2 focus:ring-red-400 disabled:cursor-not-allowed"
                                aria-label="Remove from history"
                            >
                                <XIcon />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ImageExtender;