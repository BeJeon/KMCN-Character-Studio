// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { generateCameraAngleImage } from '../services/geminiService';
import { logActivity } from '../services/activityLog';
import type { GeneratedImage } from '../types';
import Loader from './Loader';
import AngleSelector from './AngleSelector';

const ANGLES = [
    { name: '정면', prompt: 'front view, centered', description: '캐릭터를 정면에서 촬영합니다.' },
    { name: '좌측', prompt: 'view from the character\'s left side', description: '캐릭터의 왼쪽에서 촬영합니다.' },
    { name: '우측', prompt: 'view from the character\'s right side', description: '캐릭터의 오른쪽에서 촬영합니다.' },
    { name: '클로즈업', prompt: 'close-up shot of the face', description: '얼굴을 가까이에서 촬영합니다.' },
    { name: '와이드 샷', prompt: 'wide shot, full body', description: '캐릭터의 전신을 촬영합니다.' },
    { name: '로우 앵글', prompt: 'dramatic low-angle shot, looking up at the character', description: '아래에서 위로 올려다보며 촬영하여 위압감을 줍니다.' },
    { name: '하이 앵글', prompt: 'dramatic high-angle shot, looking down on the character', description: '위에서 아래로 내려다보며 촬영합니다.' },
    { name: '더치 앵글', prompt: 'Dutch angle, tilted camera creating a sense of unease or dynamism', description: '카메라를 기울여 역동적인 느낌을 줍니다.' },
    { name: '항공 뷰', prompt: 'aerial view, shot from directly above the character', description: '캐릭터 바로 위에서 수직으로 내려다봅니다.' },
];

const dataURLToBlob = (dataurl: string): Blob | null => {
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

const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string, url: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || file.type;
      resolve({ data, mimeType, url: result });
    };
    reader.onerror = (error) => reject(error);
  });
};

const createOptimizedFilename = (base: string, anglePrompt: string, ext: string): string => {
    const sanitize = (s: string) => s.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-]/g, '');
    const baseSanitized = sanitize(base).slice(0, 10);
    const angleAbbr = anglePrompt.split(/[\s,]/)[0].slice(0, 4);
    const filename = `${baseSanitized}-ang-${angleAbbr}.${ext}`;
    return filename;
};

interface CameraAngleGeneratorProps {
    isCreator: boolean;
}

const CameraAngleGenerator: React.FC<CameraAngleGeneratorProps> = ({ isCreator }) => {
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAngles, setSelectedAngles] = useState<string[]>(ANGLES.map(a => a.prompt));

  useEffect(() => {
    return () => {
        generatedImages.forEach(image => {
            if (image.src && image.src.startsWith('blob:')) {
                URL.revokeObjectURL(image.src);
            }
        });
    };
  }, [generatedImages]);

  const handleFileUpload = useCallback((file: File) => {
    if (isGenerating) return;

    if (originalImageUrl) {
      URL.revokeObjectURL(originalImageUrl);
    }
    setOriginalImage(file);
    setOriginalImageUrl(URL.createObjectURL(file));
    setError(null);
    setGeneratedImages([]); // Clear previous results
  }, [isGenerating, originalImageUrl]);
  
  const handleAngleToggle = (anglePrompt: string) => {
    setSelectedAngles(prev => 
        prev.includes(anglePrompt) 
            ? prev.filter(p => p !== anglePrompt) 
            : [...prev, anglePrompt]
    );
  };
  
  const handleGenerate = useCallback(async () => {
    if (!originalImage || isGenerating || selectedAngles.length === 0) return;
    
    setIsGenerating(true);
    setError(null);
    
    const anglesToGenerate = ANGLES.filter(angle => selectedAngles.includes(angle.prompt));

    const placeholders: GeneratedImage[] = anglesToGenerate.map(angle => ({
        id: `${originalImage.name}-${angle.prompt}`,
        expressionName: 'CameraAngle',
        angleName: angle.name,
        src: '',
        status: 'loading' as const,
    }));
    setGeneratedImages(placeholders);
    
    try {
        const { data: base64Data, mimeType, url: originalB64Url } = await fileToBase64(originalImage);
        
        const BATCH_SIZE = 5;
        for (let i = 0; i < anglesToGenerate.length; i += BATCH_SIZE) {
            const batch = anglesToGenerate.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(angle => {
                const imageId = `${originalImage.name}-${angle.prompt}`;
                return generateCameraAngleImage(base64Data, mimeType, angle.prompt)
                    .then(async ({ base64Data: generatedBase64, mimeType: generatedMimeType }) => {
                        const dataUrl = `data:${generatedMimeType};base64,${generatedBase64}`;
                         await logActivity({
                            generator: 'CameraAngle',
                            details: { angle: angle.prompt },
                            inputs: [originalB64Url],
                            output: dataUrl
                        });
                        
                        const blob = dataURLToBlob(dataUrl);
                        const blobUrl = blob ? URL.createObjectURL(blob) : dataUrl;

                        setGeneratedImages(prev => prev.map(img =>
                            img.id === imageId
                                ? { ...img, src: blobUrl, status: 'done' }
                                : img
                        ));
                    })
                    .catch(err => {
                        setGeneratedImages(prev => prev.map(img =>
                            img.id === imageId
                                ? { ...img, status: 'error', error: err instanceof Error ? err.message : "Generation failed" }
                                : img
                        ));
                    });
            });
            await Promise.all(batchPromises);
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred during processing.");
    } finally {
        setIsGenerating(false);
    }
  }, [originalImage, isGenerating, selectedAngles]);

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

  const handleDownload = (src: string, filename: string) => {
    const link = document.createElement('a');
    link.href = src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleDownloadAll = async () => {
    setIsDownloading(true);
    const zip = new JSZip();
    const originalFileNameBase = originalImage ? originalImage.name : 'character';
    
    const imagesToDownload = generatedImages.filter(img => img.status === 'done');
    if (imagesToDownload.length === 0) {
        setIsDownloading(false);
        return;
    }

    const downloadPromises = imagesToDownload.map(async (image) => {
        const response = await fetch(image.src);
        const blob = await response.blob();
        const extension = 'png';
        const angle = ANGLES.find(a => a.name === image.angleName)!;
        const filename = createOptimizedFilename(originalFileNameBase, angle.prompt, extension);
        zip.file(filename, blob);
    });
    
    await Promise.all(downloadPromises);
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${originalFileNameBase.replace(/\.[^/.]+$/, "")}_angles.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsDownloading(false);
  };

  const generationProgress = generatedImages.filter(img => img.status === 'done' || img.status === 'error').length;
  const totalImages = selectedAngles.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl h-fit">
        <h2 className="text-2xl font-bold mb-4 border-b border-slate-200 dark:border-slate-700 pb-3 text-slate-900 dark:text-white">1. 원본 이미지 업로드</h2>
        <label 
          htmlFor="camera-image-upload" 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`cursor-pointer block w-full border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${isDragging ? 'border-purple-500 bg-slate-100/80 dark:bg-slate-700/60 ring-4 ring-purple-500/20' : 'border-slate-300 dark:border-slate-600 hover:border-purple-500 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'}`}
        >
          {originalImageUrl ? (
            <img src={originalImageUrl} alt="Uploaded preview" className="max-h-96 mx-auto rounded-lg object-contain" />
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="mt-4 block font-medium text-slate-600 dark:text-slate-300">이미지를 선택하거나 여기에 드래그하세요</span>
              <span className="text-sm text-slate-500 mt-1">PNG, JPG, WEBP</span>
            </div>
          )}
        </label>
        <input id="camera-image-upload" type="file" accept="image/*" className="sr-only" onChange={handleImageUploadEvent} disabled={isGenerating}/>
        {error && <div className="bg-red-500/20 border border-red-500/30 text-red-300 dark:text-red-200 px-4 py-3 rounded-md mt-4">{error}</div>}
      </div>

      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">2. 구도 선택 및 생성</h2>
        </div>
        
        <AngleSelector
            angles={ANGLES}
            selectedAngles={selectedAngles}
            onAngleToggle={handleAngleToggle}
            isMultiSelect={true}
            isGenerating={isGenerating}
            onSelectAll={() => setSelectedAngles(ANGLES.map(a => a.prompt))}
            onClear={() => setSelectedAngles([])}
        />
        
        <div className="flex items-center gap-4 mt-6">
            <button 
                onClick={handleGenerate}
                disabled={isGenerating || !originalImage || selectedAngles.length === 0}
                className="flex-grow flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
            >
                {isGenerating ? <><Loader /> <span className="ml-2">생성 중</span></> : `선택된 구도 생성 (${selectedAngles.length})`}
            </button>
            {generatedImages.some(img => img.status === 'done') && (
                <button 
                    onClick={handleDownloadAll}
                    disabled={isDownloading || !isCreator}
                    title={!isCreator ? "관리자만 다운로드할 수 있습니다." : "전체 이미지 다운로드"}
                    className="flex-shrink-0 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isDownloading ? <Loader /> : '전체 다운로드'}
                </button>
            )}
        </div>

        {isGenerating && (
            <div className="w-full my-4">
                <div className="flex justify-between mb-1">
                    <span className="text-base font-medium text-blue-600 dark:text-blue-300">생성 진행률</span>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-300">{generationProgress} / {totalImages} 완료</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2.5 rounded-full" style={{ width: totalImages > 0 ? `${(generationProgress / totalImages) * 100}%` : '0%' }}></div>
                </div>
            </div>
        )}
        
        <div className="mt-4 flex-grow">
            {generatedImages.length === 0 && (
              <div className="flex items-center justify-center flex-grow text-slate-400 dark:text-slate-500 min-h-[200px] bg-slate-100 dark:bg-slate-900/40 rounded-lg">
                <p>생성 결과가 여기에 표시됩니다.</p>
              </div>
            )}
            
            {generatedImages.length > 0 && (
                <div className="flex-grow overflow-y-auto max-h-[50vh] pr-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {generatedImages.map((image) => {
                            switch (image.status) {
                              case 'loading':
                                return (
                                  <div key={image.id} className="group relative bg-slate-200 dark:bg-slate-700/50 rounded-lg overflow-hidden shadow-md aspect-square flex flex-col items-center justify-center p-2">
                                      <Loader />
                                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center">{image.angleName}</p>
                                  </div>
                                )
                              case 'error':
                                return (
                                  <div key={image.id} className="group relative bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-500/30 rounded-lg overflow-hidden shadow-md aspect-square flex flex-col items-center justify-center p-2 text-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 dark:text-red-400 mb-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">{image.angleName}</p>
                                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2" title={image.error}>생성 실패</p>
                                  </div>
                                )
                              case 'done':
                                return (
                                  <div key={image.id} className="group relative bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden shadow-md aspect-square">
                                    <img src={image.src} alt={`Generated angle: ${image.angleName}`} className="w-full h-full object-cover"/>
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-all duration-300 flex flex-col items-center justify-center p-4 text-center">
                                      <p className="text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">{image.angleName}</p>
                                      <button
                                          onClick={async () => {
                                              const originalFileNameBase = originalImage ? originalImage.name : 'char';
                                              const extension = 'png';
                                              const angle = ANGLES.find(a => a.name === image.angleName)!;
                                              const filename = createOptimizedFilename(originalFileNameBase, angle.prompt, extension);
                                              handleDownload(image.src, filename);
                                          }}
                                          disabled={!isCreator}
                                          title={!isCreator ? "관리자 전용 기능" : "다운로드"}
                                          className="mt-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                                      >
                                          다운로드
                                      </button>
                                    </div>
                                  </div>
                                )
                              default:
                                return null;
                            }
                        })}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default CameraAngleGenerator;