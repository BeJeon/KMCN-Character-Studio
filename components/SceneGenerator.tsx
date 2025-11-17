// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { generateSceneImage, generateSceneSuggestion } from '../services/geminiService';
import { logActivity } from '../services/activityLog';
import Loader from './Loader';
import XIcon from './icons/XIcon';
import DownloadIcon from './icons/DownloadIcon';
import SparklesIcon from './icons/SparklesIcon';
import AngleSelector from './AngleSelector';

interface GeneratedSceneImage {
    id: string;
    src: string;
    name: string;
    angleName: string;
    prompt: string;
}

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string; url: string }> => {
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

const CAMERA_ANGLES = [
  { name: '기본', prompt: '', description: '지정하지 않고 AI가 장면에 가장 적합한 구도를 결정합니다.' },
  { name: '정면', prompt: 'front view, eye-level shot', description: '피사체를 정면에서 눈높이로 촬영하여 안정적이고 직접적인 느낌을 줍니다.' },
  { name: '로우 앵글', prompt: 'dramatic low-angle shot, looking up at the character', description: '피사체를 아래에서 위로 촬영하여 웅장하고 강력한 느낌을 강조합니다.' },
  { name: '하이 앵글', prompt: 'dramatic high-angle shot, looking down on the character', description: '피사체를 위에서 아래로 촬영하여 약하거나 고립된 느낌을 줍니다.' },
  { name: '클로즈업', prompt: 'close-up shot', description: '얼굴이나 특정 부분을 확대하여 감정이나 디테일을 강조합니다.' },
  { name: '익스트림 클로즈업', prompt: 'extreme close-up shot', description: '눈, 입 등 특정 부위를 극도로 확대하여 강렬한 감정이나 긴장감을 전달합니다.' },
  { name: '풀샷', prompt: 'full shot, wide shot', description: '머리부터 발끝까지 전신을 보여주며 주변 환경과의 관계를 나타냅니다.' },
  { name: '니샷', prompt: 'medium full shot, knee shot', description: '무릎 위 상반신을 촬영하며, 인물의 행동과 표정을 동시에 보여줍니다.' },
  { name: '웨이스트샷', prompt: 'medium shot, waist shot', description: '허리 위 상반신을 촬영하며, 대화 장면에서 가장 일반적으로 사용됩니다.' },
  { name: '바스트샷', prompt: 'medium close-up shot, bust shot', description: '가슴 위 상반신을 촬영하며, 인물의 표정과 감정에 더 집중합니다.' },
  { name: '오버 더 숄더', prompt: 'over-the-shoulder shot', description: '한 인물의 어깨 너머로 다른 인물을 촬영하여 대화의 현장감을 높입니다.' },
  { name: '더치 앵글', prompt: 'Dutch angle, tilted camera', description: '카메라를 기울여 촬영하여 불안정, 혼란, 긴장감 등을 표현합니다.' },
  { name: '항공 뷰', prompt: 'aerial view, bird\'s-eye view', description: '피사체를 바로 위에서 수직으로 내려다보며 전체적인 상황을 조망합니다.' },
  { name: '1인칭 시점 (POV)', prompt: 'Point-of-view (POV) shot', description: '캐릭터의 시점에서 장면을 보여주어 관객의 몰입감을 극대화합니다.' },
  { name: '측면', prompt: 'profile shot, side view', description: '피사체의 옆모습을 촬영하여 관찰자적인 느낌을 주거나 인물의 윤곽을 강조합니다.' },
  { name: '후면', prompt: 'shot from behind', description: '피사체의 뒷모습을 촬영하여 익명성, 미스터리, 또는 인물이 바라보는 풍경을 강조합니다.' }
];

const createOptimizedFilename = (base: string, angleName: string, ext: string): string => {
    const angle = CAMERA_ANGLES.find(a => a.name === angleName);
    const angleAbbr = angle?.prompt
        ? angle.prompt.split(/[\s,]/)[0].replace(/[^a-zA-Z]/g, '').slice(0, 4)
        : 'auto';
    const sanitize = (s: string) => s.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-]/g, '');
    const shortBase = sanitize(base).slice(0, 8);
    const ts = Date.now().toString().slice(-4);
    const filename = `${shortBase}-S-${angleAbbr}-${ts}.${ext}`;
    return filename;
};

interface SceneGeneratorProps {
    isCreator: boolean;
}

const SceneGenerator: React.FC<SceneGeneratorProps> = ({ isCreator }) => {
    const [characterFiles, setCharacterFiles] = useState<File[]>([]);
    const [characterImageUrls, setCharacterImageUrls] = useState<string[]>([]);
    
    const [compositionRefFiles, setCompositionRefFiles] = useState<File[]>([]);
    const [compositionRefUrls, setCompositionRefUrls] = useState<string[]>([]);

    const [poseRefFiles, setPoseRefFiles] = useState<File[]>([]);
    const [poseRefUrls, setPoseRefUrls] = useState<string[]>([]);

    const [prompt, setPrompt] = useState<string>('');
    const [backgroundPrompt, setBackgroundPrompt] = useState<string>('');
    const [clothingPrompt, setClothingPrompt] = useState<string>('');
    const [shouldChangeArtStyle, setShouldChangeArtStyle] = useState<boolean>(false);
    const [selectedAngles, setSelectedAngles] = useState<string[]>([]);
    const [artStyle, setArtStyle] = useState<'gemini' | 'illustrative'>('gemini');

    const [generationHistory, setGenerationHistory] = useState<GeneratedSceneImage[]>([]);
    const [currentBatch, setCurrentBatch] = useState<GeneratedSceneImage[]>([]);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isGeneratingSuggestionFor, setIsGeneratingSuggestionFor] = useState<'background' | 'clothing' | null>(null);
    const [generationProgress, setGenerationProgress] = useState(0);
    
    // Drag state for different dropzones
    const [isDraggingChar, setIsDraggingChar] = useState(false);
    const [isDraggingComp, setIsDraggingComp] = useState(false);
    const [isDraggingPose, setIsDraggingPose] = useState(false);

    // Use a ref to hold the latest state for cleanup on unmount
    const urlStatesRef = useRef({
        characterImageUrls,
        compositionRefUrls,
        poseRefUrls,
        generationHistory,
        currentBatch,
    });
    urlStatesRef.current = {
        characterImageUrls,
        compositionRefUrls,
        poseRefUrls,
        generationHistory,
        currentBatch,
    };

    useEffect(() => {
        // This effect runs only on mount, and its cleanup runs only on unmount.
        return () => {
            // Get the latest URL arrays from the ref to avoid stale state in the cleanup closure.
            const {
                characterImageUrls,
                compositionRefUrls,
                poseRefUrls,
                generationHistory,
                currentBatch,
            } = urlStatesRef.current;
            
            const allUrlsToClean = [
                ...characterImageUrls,
                ...compositionRefUrls,
                ...poseRefUrls,
                ...generationHistory.map(img => img.src),
                ...currentBatch.map(img => img.src),
            ];

            allUrlsToClean.forEach(url => {
                if (url && url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, []);


    const handleImageUpload = (files: FileList | null, type: 'character' | 'composition' | 'pose') => {
        if (!files || files.length === 0) return;
        
        const newFiles = Array.from(files);
        const newUrls = newFiles.map(file => URL.createObjectURL(file));

        if (type === 'character') {
            setCharacterFiles(prev => [...prev, ...newFiles]);
            setCharacterImageUrls(prev => [...prev, ...newUrls]);
        } else if (type === 'composition') {
            setCompositionRefFiles(prev => [...prev, ...newFiles]);
            setCompositionRefUrls(prev => [...prev, ...newUrls]);
        } else {
            setPoseRefFiles(prev => [...prev, ...newFiles]);
            setPoseRefUrls(prev => [...prev, ...newUrls]);
        }
    };
    
    const handleRemoveImage = (index: number, type: 'character' | 'composition' | 'pose') => {
        if (type === 'character') {
            URL.revokeObjectURL(characterImageUrls[index]);
            setCharacterFiles(prev => prev.filter((_, i) => i !== index));
            setCharacterImageUrls(prev => prev.filter((_, i) => i !== index));
        } else if (type === 'composition') {
            URL.revokeObjectURL(compositionRefUrls[index]);
            setCompositionRefFiles(prev => prev.filter((_, i) => i !== index));
            setCompositionRefUrls(prev => prev.filter((_, i) => i !== index));
        } else {
            URL.revokeObjectURL(poseRefUrls[index]);
            setPoseRefFiles(prev => prev.filter((_, i) => i !== index));
            setPoseRefUrls(prev => prev.filter((_, i) => i !== index));
        }
    };
    
    const handleGenerate = async () => {
        if (characterFiles.length === 0 || !prompt) {
            setError("최소 1개의 캐릭터 이미지와 장면 설명이 필요합니다.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setCurrentBatch([]);
        setGenerationProgress(0);
        
        try {
            const characterImagesData = await Promise.all(characterFiles.map(fileToBase64));
            const compositionRefsData = await Promise.all(compositionRefFiles.map(fileToBase64));
            const poseRefsData = await Promise.all(poseRefFiles.map(fileToBase64));

            const characterImages = characterImagesData.map(({data, mimeType}) => ({data, mimeType}));
            const compositionRefs = compositionRefsData.map(({data, mimeType}) => ({data, mimeType}));
            const poseRefs = poseRefsData.map(({data, mimeType}) => ({data, mimeType}));
            
            const allInputUrls = [
                ...characterImagesData.map(d => d.url),
                ...compositionRefsData.map(d => d.url),
                ...poseRefsData.map(d => d.url)
            ];

            const anglesToProcess = selectedAngles.length > 0 ? selectedAngles : [''];
            const currentPrompt = prompt;
            
            const BATCH_SIZE = 3; // Process in small batches to avoid network/resource congestion with large inputs
            let completedCount = 0;

            for (let i = 0; i < anglesToProcess.length; i += BATCH_SIZE) {
                const batch = anglesToProcess.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map(anglePrompt => {
                    const angleName = CAMERA_ANGLES.find(a => a.prompt === anglePrompt)?.name || '기본';
                    return generateSceneImage(
                        characterImages,
                        currentPrompt,
                        backgroundPrompt,
                        clothingPrompt,
                        artStyle,
                        shouldChangeArtStyle,
                        compositionRefs.length > 0 ? compositionRefs : null,
                        poseRefs.length > 0 ? poseRefs : null,
                        null,
                        anglePrompt || null
                    ).then(async result => {
                        const dataUrl = `data:${result.mimeType};base64,${result.base64Data}`;
                        await logActivity({
                            generator: 'Scene',
                            details: {
                                prompt: currentPrompt,
                                backgroundPrompt,
                                clothingPrompt,
                                angle: angleName
                            },
                            inputs: allInputUrls,
                            output: dataUrl
                        });
                        return { ...result, angleName, dataUrl };
                    });
                });

                const batchResults = await Promise.all(batchPromises);
                
                const newImages: GeneratedSceneImage[] = batchResults.map(({ mimeType, angleName, dataUrl }) => {
                    const extension = 'png';
                    const fullPromptParts = [currentPrompt];
                    if (backgroundPrompt) fullPromptParts.push(`배경: ${backgroundPrompt}`);
                    if (clothingPrompt) fullPromptParts.push(`의상: ${clothingPrompt}`);
                    const fullPrompt = fullPromptParts.join(' / ');
                    const baseFileName = characterFiles.length > 0 ? characterFiles[0].name : 'S';
                    const filename = createOptimizedFilename(baseFileName, angleName, extension);
                    const blob = dataURLToBlob(dataUrl);
                    const blobUrl = blob ? URL.createObjectURL(blob) : dataUrl;

                    return {
                        id: `scene-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        src: blobUrl,
                        name: filename,
                        angleName: angleName,
                        prompt: fullPrompt,
                    };
                });

                setCurrentBatch(prev => [...prev, ...newImages]);
                setGenerationHistory(prev => [...newImages, ...prev]);
                completedCount += batch.length;
                setGenerationProgress(completedCount);
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsGenerating(false);
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
        if (generationHistory.length === 0) return;
        setIsDownloading(true);
        const zip = new JSZip();
        const baseFileName = characterFiles.length > 0 
            ? characterFiles[0].name.replace(/\.[^/.]+$/, "") 
            : 'S';

        const downloadPromises = generationHistory.map(async (image) => {
            const response = await fetch(image.src);
            const blob = await response.blob();
            zip.file(image.name, blob);
        });

        await Promise.all(downloadPromises);

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseFileName}_scenes_history.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsDownloading(false);
    };

    const handleRemoveFromHistory = (imageId: string) => {
      const imageToRemove = generationHistory.find(img => img.id === imageId);
      if (imageToRemove?.src.startsWith('blob:')) {
          URL.revokeObjectURL(imageToRemove.src);
      }
      setGenerationHistory(prev => prev.filter(img => img.id !== imageId));
      setCurrentBatch(prev => prev.filter(img => img.id !== imageId));
    };

    const handleAngleToggle = (anglePrompt: string) => {
        if (!anglePrompt) { // '기본' 버튼 클릭 시
            setSelectedAngles([]);
            return;
        }
        setSelectedAngles(prev => 
            prev.includes(anglePrompt) 
                ? prev.filter(p => p !== anglePrompt) 
                : [...prev, anglePrompt]
        );
    };
    
    const handleSelectAllAngles = () => {
        setSelectedAngles(CAMERA_ANGLES.filter(a => a.prompt).map(a => a.prompt));
    };

    const handleClearAngles = () => {
        setSelectedAngles([]);
    };

    const handleGenerateSuggestion = useCallback(async (type: 'background' | 'clothing') => {
        if (!prompt) {
            setError("AI 추천을 받으려면 먼저 장면 설명을 입력해야 합니다.");
            return;
        }
        
        setError(null);
        setIsGeneratingSuggestionFor(type);
        try {
            const suggestion = await generateSceneSuggestion(prompt, type);
            if (type === 'background') {
                setBackgroundPrompt(suggestion);
            } else {
                setClothingPrompt(suggestion);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "추천 생성에 실패했습니다.");
        } finally {
            setIsGeneratingSuggestionFor(null);
        }
    }, [prompt]);

    const Dropzone = ({
        id,
        title,
        onUpload,
        imageUrls,
        onRemove,
        isDragging,
        setIsDragging,
        type,
        multiple = true
    }: {
        id: string;
        title: string;
        onUpload: (files: FileList | null, type: 'character' | 'composition' | 'pose') => void;
        imageUrls: string[];
        onRemove: (index: number, type: 'character' | 'composition' | 'pose') => void;
        isDragging: boolean;
        setIsDragging: (isDragging: boolean) => void;
        type: 'character' | 'composition' | 'pose';
        multiple?: boolean;
    }) => (
        <div>
            <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">{title}</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-2">
                {imageUrls.map((url, index) => (
                    <div key={`${id}-${index}`} className="relative group">
                        <img src={url} alt={`upload-preview-${index}`} className="w-full h-full object-cover rounded-lg aspect-square" />
                        <button 
                            onClick={() => onRemove(index, type)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all focus:outline-none"
                        >
                            <XIcon />
                        </button>
                    </div>
                ))}
            </div>
            <label
                htmlFor={id}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); onUpload(e.dataTransfer.files, type); }}
                className={`cursor-pointer block w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-300 ${isDragging ? 'border-purple-500 bg-slate-100 dark:bg-slate-700/60' : 'border-slate-300 dark:border-slate-600 hover:border-purple-500 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'}`}
            >
                <div className="flex flex-col items-center justify-center">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">이미지를 선택하거나 드래그하세요</span>
                </div>
            </label>
            <input id={id} type="file" accept="image/*" className="sr-only" onChange={(e) => onUpload(e.target.files, type)} multiple={multiple} disabled={isGenerating} />
        </div>
    );

    const totalImagesToGenerate = selectedAngles.length > 0 ? selectedAngles.length : 1;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl h-fit flex flex-col gap-6">
                <h2 className="text-2xl font-bold -mb-2 border-b border-slate-200 dark:border-slate-700 pb-3 text-slate-900 dark:text-white">장면 설정</h2>
                
                <Dropzone id="character-upload" title="1. 소스 캐릭터 (필수)" onUpload={handleImageUpload} imageUrls={characterImageUrls} onRemove={handleRemoveImage} isDragging={isDraggingChar} setIsDragging={setIsDraggingChar} type="character" />

                <div>
                    <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">2. 장면 설명 (필수)</h3>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="예: 두 캐릭터가 해변에서 아이스크림을 먹으며 웃고 있는 장면"
                        className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                        rows={4}
                        disabled={isGenerating}
                    />
                </div>
                
                <div>
                    <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">3. 구도 / 표정 및 행동 참고 (선택 사항)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Dropzone id="composition-upload" title="구도 참고" onUpload={handleImageUpload} imageUrls={compositionRefUrls} onRemove={handleRemoveImage} isDragging={isDraggingComp} setIsDragging={setIsDraggingComp} type="composition" />
                        <Dropzone id="pose-upload" title="표정 및 행동 참고" onUpload={handleImageUpload} imageUrls={poseRefUrls} onRemove={handleRemoveImage} isDragging={isDraggingPose} setIsDragging={setIsDraggingPose} type="pose" />
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">4. 추가 옵션</h3>
                    <div className="space-y-6 bg-slate-100/50 dark:bg-slate-900/30 p-4 rounded-lg">
                        <div>
                            <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300">카메라 구도 (다중 선택 가능)</h4>
                            <AngleSelector
                                angles={CAMERA_ANGLES}
                                selectedAngles={selectedAngles}
                                onAngleToggle={handleAngleToggle}
                                isMultiSelect={true}
                                isGenerating={isGenerating}
                                onSelectAll={handleSelectAllAngles}
                                onClear={handleClearAngles}
                             />
                        </div>
                        <div>
                            <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300">배경 및 의상 변경</h4>
                            <div className="space-y-3 pt-2">
                                <div className="relative">
                                    <textarea
                                        value={backgroundPrompt}
                                        onChange={(e) => setBackgroundPrompt(e.target.value)}
                                        placeholder="새로운 배경 설명 (예: 밤하늘의 은하수 아래). 비워두면 원본 배경을 유지합니다."
                                        className="w-full bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors pr-10"
                                        rows={2}
                                        disabled={isGenerating || !!isGeneratingSuggestionFor}
                                    />
                                     <button
                                        type="button"
                                        onClick={() => handleGenerateSuggestion('background')}
                                        disabled={isGenerating || !!isGeneratingSuggestionFor || !prompt}
                                        className="absolute top-2 right-2 p-1 text-slate-500 dark:text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:cursor-not-allowed disabled:text-slate-500"
                                        title="AI 추천 받기 (장면 설명 필요)"
                                    >
                                        {isGeneratingSuggestionFor === 'background' ? <Loader /> : <SparklesIcon />}
                                    </button>
                                </div>
                                <div className="relative">
                                    <textarea
                                        value={clothingPrompt}
                                        onChange={(e) => setClothingPrompt(e.target.value)}
                                        placeholder="새로운 의상 설명 (예: 검은색 가죽 자켓과 청바지). 비워두면 원본 의상을 유지합니다."
                                        className="w-full bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors pr-10"
                                        rows={2}
                                        disabled={isGenerating || !!isGeneratingSuggestionFor}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleGenerateSuggestion('clothing')}
                                        disabled={isGenerating || !!isGeneratingSuggestionFor || !prompt}
                                        className="absolute top-2 right-2 p-1 text-slate-500 dark:text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:cursor-not-allowed disabled:text-slate-500"
                                        title="AI 추천 받기 (장면 설명 필요)"
                                    >
                                        {isGeneratingSuggestionFor === 'clothing' ? <Loader /> : <SparklesIcon />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300">그림 스타일</h4>
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                  onClick={() => setArtStyle('gemini')}
                                  disabled={isGenerating}
                                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-purple-500 disabled:opacity-50 ${
                                    artStyle === 'gemini' 
                                      ? 'bg-purple-600 text-white shadow-md' 
                                      : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-300 hover:bg-slate-400 dark:hover:bg-slate-600'
                                  }`}
                                >
                                  제미나이 (포토리얼)
                                </button>
                                <button
                                  onClick={() => setArtStyle('illustrative')}
                                  disabled={isGenerating}
                                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-purple-500 disabled:opacity-50 ${
                                    artStyle === 'illustrative' 
                                      ? 'bg-purple-600 text-white shadow-md' 
                                      : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-300 hover:bg-slate-400 dark:hover:bg-slate-600'
                                  }`}
                                >
                                  일러스트 스타일
                                </button>
                            </div>
                             <p className="text-xs text-slate-500 mt-2">
                                {artStyle === 'gemini' ? '실사와 같은 고품질의 포토리얼리즘 스타일로 생성합니다.' : '웹툰이나 컨셉 아트 같은 선명하고 세련된 일러스트 스타일로 생성합니다.'}
                            </p>
                            <div className="mt-3">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={shouldChangeArtStyle} 
                                        onChange={(e) => setShouldChangeArtStyle(e.target.checked)} 
                                        className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500 disabled:opacity-50" 
                                        disabled={isGenerating} 
                                    />
                                    <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors text-sm">소스 캐릭터에도 새 스타일 적용</span>
                                </label>
                                <p className="text-xs text-slate-500 mt-1 pl-6">
                                    체크하면 소스 캐릭터의 그림체를 무시하고 선택한 스타일로 캐릭터를 다시 그립니다.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>


                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || characterFiles.length === 0 || !prompt}
                    className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isGenerating ? <><Loader /> <span className="ml-2">생성 중...</span></> : `장면 생성하기 (${selectedAngles.length > 0 ? selectedAngles.length : 1})`}
                </button>
                {error && <div className="bg-red-500/20 border border-red-500/30 text-red-300 dark:text-red-200 px-4 py-3 rounded-md mt-2">{error}</div>}
            </div>

            <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">생성된 장면</h2>
                    {generationHistory.length > 0 && !isGenerating && (
                    <button 
                        onClick={handleDownloadAll}
                        disabled={isDownloading || !isCreator}
                        title={!isCreator ? "관리자만 다운로드할 수 있습니다." : "기록 전체 다운로드"}
                        className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
                    >
                       {isDownloading ? <><Loader /><span className="ml-2">압축 중...</span></> : '기록 전체 다운로드 (ZIP)'}
                    </button>
                    )}
                </div>
                
                {isGenerating && totalImagesToGenerate > 1 && (
                    <div className="w-full mb-4 px-4">
                        <div className="flex justify-between mb-1">
                            <span className="text-base font-medium text-blue-600 dark:text-blue-300">생성 진행률</span>
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-300">{generationProgress} / {totalImagesToGenerate} 완료</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                            <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2.5 rounded-full" style={{ width: `${(generationProgress / totalImagesToGenerate) * 100}%` }}></div>
                        </div>
                    </div>
                )}

                <div className="flex-grow rounded-lg bg-slate-100 dark:bg-slate-900/50 min-h-[400px] lg:min-h-0 p-4">
                    {isGenerating && currentBatch.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">
                            <Loader/> 
                            <p className="mt-4">AI가 첫 번째 배치를 생성하고 있습니다...</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">선택한 구도 개수에 따라 시간이 걸릴 수 있습니다.<br/>결과가 생성되는 대로 여기에 표시됩니다.</p>
                        </div>
                    )}
                    {currentBatch.length > 0 && (
                         <div className="grid grid-cols-2 gap-4 overflow-y-auto max-h-[60vh] pr-2">
                            {currentBatch.map(image => (
                                <div key={image.id} className="relative group aspect-square bg-slate-200 dark:bg-slate-700 rounded-md overflow-hidden">
                                    <img src={image.src} alt={`Generated scene - ${image.angleName}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex flex-col items-center justify-center p-2 text-center">
                                        <p className="text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">{image.angleName}</p>
                                        <button
                                            onClick={() => handleDownload(image.src, image.name)}
                                            disabled={!isCreator}
                                            title={!isCreator ? "관리자 전용 기능" : "다운로드"}
                                            className="mt-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                                        >
                                            다운로드
                                        </button>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-sm text-center p-1 rounded-b-md pointer-events-none group-hover:opacity-0 transition-opacity duration-300">
                                        {image.angleName}
                                    </div>
                                </div>
                            ))}
                            {isGenerating && (
                                <div className="flex items-center justify-center aspect-square bg-slate-200/50 dark:bg-slate-800/50 rounded-md border-2 border-dashed border-slate-300 dark:border-slate-700">
                                    <div className="text-center">
                                        <Loader />
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">다음 배치 생성 중...</p>
                                    </div>
                                </div>
                            )}
                         </div>
                    )}
                     {!isGenerating && currentBatch.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-slate-500">
                        <p>설정을 완료하고 생성하면</p>
                        <p>결과가 여기에 표시됩니다.</p>
                      </div>
                    )}
                </div>
                 {generationHistory.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-300">생성 기록</h3>
                        <div className="flex overflow-x-auto space-x-3 pb-2 -mx-6 px-6">
                            {generationHistory.map((image) => (
                                <div key={image.id} className="relative flex-shrink-0 group" title={`${image.prompt}`}>
                                    <img 
                                        src={image.src} 
                                        alt="Generated history thumbnail" 
                                        className="w-24 h-24 object-cover rounded-md transition-all duration-200 aspect-square opacity-70 group-hover:brightness-50"
                                    />
                                     <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleDownload(image.src, image.name)}
                                            disabled={!isCreator}
                                            title={!isCreator ? "관리자 전용 기능" : "다운로드"}
                                            className="text-white p-2 rounded-full hover:bg-black/50 transition-colors disabled:cursor-not-allowed disabled:text-slate-400"
                                            aria-label="Download image"
                                        >
                                            <DownloadIcon />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center p-1 rounded-b-md truncate pointer-events-none group-hover:opacity-0 transition-opacity duration-300">
                                        {image.angleName}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveFromHistory(image.id); }}
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

export default SceneGenerator;