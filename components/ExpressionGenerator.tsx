// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import JSZip from 'jszip';
import { generateExpressionImage } from '../services/geminiService';
import { logActivity } from '../services/activityLog';
import type { GeneratedImage } from '../types';
import Loader from './Loader';
import GenerateIcon from './icons/GenerateIcon';

// Expanded list of 50 diverse expressions
const EXPRESSIONS = [
  { name: '행복', prompt: 'happy' }, { name: '웃음', prompt: 'laughing' }, { name: '슬픔', prompt: 'sad' },
  { name: '눈물', prompt: 'crying' }, { name: '분노', prompt: 'angry' }, { name: '놀람', prompt: 'surprised' },
  { name: '두려움', prompt: 'scared' }, { name: '역겨움', prompt: 'disgusted' }, { name: '사랑', prompt: 'in love' },
  { name: '윙크', prompt: 'winking' }, { name: '생각 중', prompt: 'thinking' }, { name: '혼란', prompt: 'confused' },
  { name: '피곤함', prompt: 'tired' }, { name: '장난기', prompt: 'mischievous' }, { name: '자신감', prompt: 'confident' },
  { name: '부끄러움', prompt: 'shy' }, { name: '지루함', prompt: 'bored' }, { name: '거만함', prompt: 'arrogant' },
  { name: '의심', prompt: 'skeptical' }, { name: '고통', prompt: 'in pain' }, { name: '환호', prompt: 'cheering' },
  { name: '결심', prompt: 'determined' }, { name: '만족', prompt: 'satisfied' }, { name: '간청', prompt: 'pleading' },
  { name: '사악함', prompt: 'evil grin' }, { name: '멍함', prompt: 'dazed' }, { name: '호기심', prompt: 'curious' },
  { name: '으쓱', prompt: 'shrugging' }, { name: '기도', prompt: 'praying' }, { name: '메롱', prompt: 'sticking tongue out' },
  { name: '졸림', prompt: 'sleepy' }, { name: '아첨', prompt: 'flattering' }, { name: '경멸', prompt: 'scornful' },
  { name: '흥분', prompt: 'excited' }, { name: '안도', prompt: 'relieved' }, { name: '절망', prompt: 'in despair' },
  { name: '용감함', prompt: 'brave' }, { name: '취함', prompt: 'drunk' }, { name: '추움', prompt: 'cold' },
  { name: '더움', prompt: 'hot' }, { name: '배고픔', prompt: 'hungry' }, { name: '소름', prompt: 'creeped out' },
  { name: '순진함', prompt: 'innocent' }, { name: '자랑스러움', prompt: 'proud' }, { name: '질투', prompt: 'jealous' },
  { name: '명상', prompt: 'meditating' }, { name: '인사', prompt: 'greeting' }, { name: '비명', prompt: 'screaming' },
  { name: '쉿!', prompt: 'shushing' }, { name: '짜증', prompt: 'annoyed' }
];

const ANGLES = [
    { name: '정면', prompt: 'front view, centered' },
    { name: '좌측', prompt: 'view from the character\'s left side' },
    { name: '우측', prompt: 'view from the character\'s right side' },
    { name: '클로즈업', prompt: 'close-up shot of the face' },
    { name: '와이드 샷', prompt: 'wide shot, full body' },
    { name: '로우 앵글', prompt: 'dramatic low-angle shot, looking up at the character' },
    { name: '하이 앵글', prompt: 'dramatic high-angle shot, looking down on the character' },
    { name: '더치 앵글', prompt: 'Dutch angle, tilted camera creating a sense of unease or dynamism' },
    { name: '항공 뷰', prompt: 'aerial view, shot from directly above the character' },
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

// Helper to convert file to base64
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

const createOptimizedFilename = (base: string, expPrompt: string, anglePrompt: string, ext: string): string => {
  const sanitize = (s: string) => s.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-]/g, '');
  const baseSanitized = sanitize(base).slice(0, 8);
  const expAbbr = expPrompt.split(' ')[0].slice(0, 4);
  const angleAbbr = anglePrompt.split(/[\s,]/)[0].slice(0, 4);
  const filename = `${baseSanitized}-${expAbbr}-${angleAbbr}.${ext}`;
  return filename;
};

interface ExpressionGeneratorProps {
    isCreator: boolean;
}

const ExpressionGenerator: React.FC<ExpressionGeneratorProps> = ({ isCreator }) => {
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cleanup blob URLs on unmount or when images change to prevent memory leaks
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

    // Initialize placeholders for all expressions and angles
    const placeholders = EXPRESSIONS.flatMap(exp =>
        ANGLES.map(angle => ({
            id: `${file.name}-${exp.prompt}-${angle.prompt}`,
            expressionName: exp.name,
            angleName: angle.name,
            src: '',
            // FIX: Use 'as const' to ensure TypeScript infers a literal type for 'status',
            // preventing a type mismatch with the 'GeneratedImage' interface.
            status: 'pending' as const,
        }))
    );
    setGeneratedImages(placeholders);
  }, [isGenerating, originalImageUrl]);

  const handleGenerateSingle = useCallback(async (imageId: string) => {
    const imageToGenerate = generatedImages.find(img => img.id === imageId);
    if (!imageToGenerate || !originalImage || imageToGenerate.status !== 'pending') {
        return;
    }

    setGeneratedImages(prev => prev.map(img =>
        img.id === imageId ? { ...img, status: 'loading' } : img
    ));

    try {
        const { data: base64Data, mimeType, url: originalB64Url } = await fileToBase64(originalImage);
        const exp = EXPRESSIONS.find(e => e.name === imageToGenerate.expressionName)!;
        const angle = ANGLES.find(a => a.name === imageToGenerate.angleName)!;

        const { base64Data: generatedBase64, mimeType: generatedMimeType } = await generateExpressionImage(base64Data, mimeType, exp.prompt, angle.prompt);
        
        const dataUrl = `data:${generatedMimeType};base64,${generatedBase64}`;
        await logActivity({
            generator: 'Expression',
            details: { prompt: exp.prompt, angle: angle.prompt },
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

    } catch (err) {
        setGeneratedImages(prev => prev.map(img =>
            img.id === imageId
                ? { ...img, status: 'error', error: err instanceof Error ? err.message : "Generation failed" }
                : img
        ));
    }
  }, [generatedImages, originalImage]);
  
  const handleGenerateAll = useCallback(async () => {
    if (!originalImage || isGenerating) return;
    
    setIsGenerating(true);
    setError(null);
    
    const pendingImages = generatedImages.filter(img => img.status === 'pending');
    if (pendingImages.length === 0) {
        setIsGenerating(false);
        return;
    }

    setGeneratedImages(prev =>
      prev.map(img => (img.status === 'pending' ? { ...img, status: 'loading' } : img))
    );
    
    try {
        const { data: base64Data, mimeType, url: originalB64Url } = await fileToBase64(originalImage);
        
        const BATCH_SIZE = 6; // Slightly increased batch size for better parallelism without overloading standard browser limits
        for (let i = 0; i < pendingImages.length; i += BATCH_SIZE) {
            const batch = pendingImages.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(imageToGenerate => {
                const exp = EXPRESSIONS.find(e => e.name === imageToGenerate.expressionName)!;
                const angle = ANGLES.find(a => a.name === imageToGenerate.angleName)!;

                return generateExpressionImage(base64Data, mimeType, exp.prompt, angle.prompt)
                    .then(async ({ base64Data: generatedBase64, mimeType: generatedMimeType }) => {
                        const dataUrl = `data:${generatedMimeType};base64,${generatedBase64}`;
                        await logActivity({
                            generator: 'Expression',
                            details: { prompt: exp.prompt, angle: angle.prompt },
                            inputs: [originalB64Url],
                            output: dataUrl
                        });
                        
                        const blob = dataURLToBlob(dataUrl);
                        const blobUrl = blob ? URL.createObjectURL(blob) : dataUrl;

                        setGeneratedImages(prev => prev.map(img =>
                            img.id === imageToGenerate.id
                                ? { ...img, src: blobUrl, status: 'done' }
                                : img
                        ));
                    })
                    .catch(err => {
                        setGeneratedImages(prev => prev.map(img =>
                            img.id === imageToGenerate.id
                                ? { ...img, status: 'error', error: err instanceof Error ? err.message : "Generation failed" }
                                : img
                        ));
                    });
            });
            await Promise.all(batchPromises); // Wait for the current batch to complete
        }

    } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred during processing.");
    } finally {
        setIsGenerating(false);
    }
  }, [originalImage, isGenerating, generatedImages]);

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
    link.href = src; // Blob URLs can be used directly in href
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleDownloadAll = async () => {
    setIsDownloading(true);
    const zip = new JSZip();
    const originalFileNameBase = originalImage ? originalImage.name : 'char';
    
    const imagesToDownload = generatedImages.filter(img => img.status === 'done');
    if (imagesToDownload.length === 0) {
        setIsDownloading(false);
        return;
    }

    const downloadPromises = imagesToDownload.map(async (image) => {
        const response = await fetch(image.src); // Fetch works with blob URLs
        const blob = await response.blob();
        const extension = 'png';

        const exp = EXPRESSIONS.find(e => e.name === image.expressionName)!;
        const angle = ANGLES.find(a => a.name === image.angleName)!;
        const filename = createOptimizedFilename(originalFileNameBase, exp.prompt, angle.prompt, extension);

        zip.file(filename, blob);
    });
    
    await Promise.all(downloadPromises);
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${originalFileNameBase.replace(/\.[^/.]+$/, "")}_expressions.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsDownloading(false);
  };

  const generationProgress = generatedImages.filter(img => img.status === 'done' || img.status === 'error').length;
  const totalImages = EXPRESSIONS.length * ANGLES.length;
  
  const groupedImages = useMemo(() => {
    return generatedImages.reduce((acc, image) => {
        const key = image.expressionName;
        if (!acc[key]) { acc[key] = []; }
        acc[key].push(image);
        return acc;
    }, {} as Record<string, GeneratedImage[]>);
  }, [generatedImages]);


  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl h-fit">
        <h2 className="text-2xl font-bold mb-4 border-b border-slate-200 dark:border-slate-700 pb-3 text-slate-900 dark:text-white">원본 이미지 업로드</h2>
        <label 
          htmlFor="image-upload" 
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
              <span className="text-sm text-slate-400 dark:text-slate-500 mt-1">PNG, JPG, WEBP</span>
            </div>
          )}
        </label>
        <input id="image-upload" type="file" accept="image/*" className="sr-only" onChange={handleImageUploadEvent} disabled={isGenerating}/>
        {error && <div className="bg-red-500/20 border border-red-500/30 text-red-300 dark:text-red-200 px-4 py-3 rounded-md mt-4">{error}</div>}
      </div>

      <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-3 gap-3">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">생성된 이미지</h2>
          <div className="flex items-center gap-3">
            {generatedImages.some(img => img.status === 'pending') && (
                <button 
                    onClick={handleGenerateAll}
                    disabled={isGenerating}
                    className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isGenerating ? <><Loader /> <span className="ml-2">생성 중</span></> : '전체 생성'}
                </button>
            )}
            {generatedImages.some(img => img.status === 'done') && (
                <button 
                    onClick={handleDownloadAll}
                    disabled={isDownloading || !isCreator}
                    title={!isCreator ? "관리자만 다운로드할 수 있습니다." : "전체 이미지 다운로드"}
                    className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isDownloading ? <><Loader /> <span className="ml-2">압축 중</span></> : '전체 다운로드 (ZIP)'}
                </button>
            )}
          </div>
        </div>

        {isGenerating && (
            <div className="w-full mb-4">
                <div className="flex justify-between mb-1">
                    <span className="text-base font-medium text-blue-600 dark:text-blue-300">생성 진행률</span>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-300">{generationProgress} / {totalImages} 완료</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(generationProgress / totalImages) * 100}%` }}></div>
                </div>
            </div>
        )}

        {generatedImages.length === 0 && (
          <div className="flex items-center justify-center flex-grow text-slate-400 dark:text-slate-500 min-h-[300px]">
            <p>이미지를 업로드하면 결과가 여기에 표시됩니다.</p>
          </div>
        )}

        {generatedImages.length > 0 && (
            <div className="flex-grow overflow-y-auto max-h-[70vh] pr-2 space-y-6">
                {Object.entries(groupedImages).sort(([a], [b]) => EXPRESSIONS.findIndex(e => e.name === a) - EXPRESSIONS.findIndex(e => e.name === b)).map(([expressionName, images]) => (
                    <div key={expressionName}>
                        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm py-2 z-10">{expressionName}</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {(images as GeneratedImage[]).slice().sort((a,b) => ANGLES.findIndex(an => an.name === a.angleName) - ANGLES.findIndex(an => an.name === b.angleName)).map((image) => {
                                switch (image.status) {
                                  case 'pending':
                                    return (
                                      <div key={image.id} className="group relative bg-slate-100 dark:bg-slate-700/30 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden shadow-md aspect-square flex flex-col items-center justify-center p-2 text-center transition-all hover:border-purple-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50">
                                          <button
                                              onClick={() => handleGenerateSingle(image.id)}
                                              disabled={isGenerating}
                                              className="text-slate-500 dark:text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                                              aria-label={`Generate ${expressionName} - ${image.angleName}`}
                                          >
                                              <GenerateIcon />
                                          </button>
                                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium">{image.angleName}</p>
                                      </div>
                                    )
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
                                        <img src={image.src} alt={`Generated expression: ${image.expressionName} - ${image.angleName}`} className="w-full h-full object-cover"/>
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-all duration-300 flex flex-col items-center justify-center p-4 text-center">
                                          <p className="text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">{image.angleName}</p>
                                          <button
                                              onClick={async () => {
                                                  const originalFileNameBase = originalImage ? originalImage.name : 'char';
                                                  const extension = 'png';
                                                  const exp = EXPRESSIONS.find(e => e.name === image.expressionName)!;
                                                  const angle = ANGLES.find(a => a.name === image.angleName)!;
                                                  const filename = createOptimizedFilename(originalFileNameBase, exp.prompt, angle.prompt, extension);
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
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default ExpressionGenerator;