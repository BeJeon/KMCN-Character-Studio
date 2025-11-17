// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { mergeWithPerspective } from '../services/geminiService';
import { logActivity } from '../services/activityLog';
import Loader from './Loader';
import DownloadIcon from './icons/DownloadIcon';

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


const Dropzone = ({
    title,
    onFileUpload,
    imageUrl,
    isGenerating
}: {
    title: string;
    onFileUpload: (file: File) => void;
    imageUrl: string | null;
    isGenerating: boolean;
}) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) {
            onFileUpload(file);
        }
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileUpload(file);
        }
    };
    
    const uniqueId = `upload-${title.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <div>
            <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">{title}</h3>
            <label 
              htmlFor={uniqueId}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`cursor-pointer block w-full border-2 border-dashed rounded-lg p-4 text-center transition-colors duration-300 min-h-[150px] flex items-center justify-center ${isDragging ? 'border-purple-500 bg-slate-100/80 dark:bg-slate-700/60' : 'border-slate-300 dark:border-slate-600 hover:border-purple-500 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'}`}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="Upload preview" className="max-h-40 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">이미지를 선택하거나 드래그하세요</span>
                </div>
              )}
            </label>
            <input id={uniqueId} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} disabled={isGenerating}/>
        </div>
    );
};

interface PerspectiveMergerProps {
    isCreator: boolean;
}

const PerspectiveMerger: React.FC<PerspectiveMergerProps> = ({ isCreator }) => {
    const [inspirationFile, setInspirationFile] = useState<File | null>(null);
    const [inspirationUrl, setInspirationUrl] = useState<string | null>(null);
    const [targetFile, setTargetFile] = useState<File | null>(null);
    const [targetUrl, setTargetUrl] = useState<string | null>(null);
    
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // Drawing State
    const [drawMode, setDrawMode] = useState<'polygon' | 'brush'>('polygon');
    
    // Polygon State
    const [maskPoints, setMaskPoints] = useState<{ x: number, y: number }[]>([]);
    const [isPolygonClosed, setIsPolygonClosed] = useState(false);

    // Brush State
    const [brushSize, setBrushSize] = useState(40);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushPaths, setBrushPaths] = useState<{ points: { x: number, y: number }[], size: number }[]>([]);

    const [currentMousePos, setCurrentMousePos] = useState<{ x: number, y: number } | null>(null);

    useEffect(() => {
        // Cleanup blob URLs to prevent memory leaks
        return () => {
            if (inspirationUrl) URL.revokeObjectURL(inspirationUrl);
            if (targetUrl) URL.revokeObjectURL(targetUrl);
            if (generatedImageUrl) URL.revokeObjectURL(generatedImageUrl);
        };
    }, [inspirationUrl, targetUrl, generatedImageUrl]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image || !image.complete || image.naturalWidth === 0) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scale = image.naturalWidth / canvas.getBoundingClientRect().width;
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        ctx.drawImage(image, 0, 0);

        if (drawMode === 'polygon' && maskPoints.length > 0) {
            ctx.strokeStyle = 'rgb(167, 139, 250)';
            ctx.lineWidth = 3 * scale;
            ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';

            ctx.beginPath();
            ctx.moveTo(maskPoints[0].x, maskPoints[0].y);
            maskPoints.forEach(p => ctx.lineTo(p.x, p.y));

            if (isPolygonClosed) {
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.stroke();
                if (currentMousePos) {
                    ctx.lineTo(currentMousePos.x, currentMousePos.y);
                    ctx.stroke();
                }
            }

            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1 * scale;
            maskPoints.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5 * scale, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            });

        } else if (drawMode === 'brush') {
            brushPaths.forEach(path => {
                if (path.points.length < 1) return;
                ctx.strokeStyle = 'rgba(139, 92, 246, 0.7)';
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.lineWidth = path.size * scale;
                
                ctx.beginPath();
                ctx.moveTo(path.points[0].x, path.points[0].y);
                for (let i = 1; i < path.points.length; i++) {
                    ctx.lineTo(path.points[i].x, path.points[i].y);
                }
                ctx.stroke();
            });

            if (currentMousePos) {
                ctx.beginPath();
                ctx.arc(currentMousePos.x, currentMousePos.y, (brushSize / 2) * scale, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
                ctx.fill();
            }
        }
    }, [maskPoints, isPolygonClosed, currentMousePos, drawMode, brushPaths, brushSize]);

    useEffect(() => {
        const image = imageRef.current;
        if (image) {
            const handleLoad = () => draw();
            image.addEventListener('load', handleLoad);
            if (image.complete) handleLoad();
            return () => image.removeEventListener('load', handleLoad);
        }
    }, [draw, targetUrl]);
    
    useEffect(() => {
        draw();
    }, [maskPoints, isPolygonClosed, currentMousePos, draw]);

    const getScaledCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };
    
    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isGenerating || !targetUrl) return;
        if (drawMode === 'brush') {
            setIsDrawing(true);
            const { x, y } = getScaledCoords(e);
            setBrushPaths(prev => [...prev, { points: [{ x, y }], size: brushSize }]);
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isGenerating || !targetUrl) return;
        const coords = getScaledCoords(e);
        setCurrentMousePos(coords);
        if (drawMode === 'brush' && isDrawing) {
            setBrushPaths(prev => {
                const newPaths = [...prev];
                newPaths[newPaths.length - 1].points.push(coords);
                return newPaths;
            });
        }
    };
    
    const handleCanvasMouseUp = () => {
      if (drawMode === 'brush') setIsDrawing(false);
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isGenerating || !targetUrl || isPolygonClosed || drawMode !== 'polygon') return;
        const coords = getScaledCoords(e);
        setMaskPoints(prev => [...prev, coords]);
    };

    const handleMouseLeave = () => {
        setCurrentMousePos(null);
        if (drawMode === 'brush') setIsDrawing(false);
    };

    const handleCloseShape = () => {
        if (maskPoints.length > 2) {
            setIsPolygonClosed(true);
            setCurrentMousePos(null);
        } else {
            setError("최소 3개 이상의 점을 찍어야 모양을 완성할 수 있습니다.");
        }
    };

    const handleResetMask = () => {
        setMaskPoints([]);
        setIsPolygonClosed(false);
        setBrushPaths([]);
        setError(null);
    };

    const handleInspirationUpload = (file: File) => {
        if (isGenerating) return;
        setInspirationFile(file);
        if(inspirationUrl) URL.revokeObjectURL(inspirationUrl);
        setInspirationUrl(URL.createObjectURL(file));
    };

    const handleTargetUpload = (file: File) => {
        if (isGenerating) return;
        setTargetFile(file);
        if(targetUrl) URL.revokeObjectURL(targetUrl);
        setTargetUrl(URL.createObjectURL(file));
        handleResetMask();
        if(generatedImageUrl) URL.revokeObjectURL(generatedImageUrl);
        setGeneratedImageUrl(null);
    };
    
    const handleGenerate = async () => {
        const isPolygonReady = drawMode === 'polygon' && isPolygonClosed;
        const isBrushReady = drawMode === 'brush' && brushPaths.some(p => p.points.length > 0);
        if (!inspirationFile || !targetFile || (!isPolygonReady && !isBrushReady)) {
            setError('배너 소스, 대상 이미지를 올리고, 합성 영역을 그려야 합니다.');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const maskCanvas = document.createElement('canvas');
            const image = imageRef.current;
            if (!image) throw new Error("Target image element not found.");

            maskCanvas.width = image.naturalWidth;
            maskCanvas.height = image.naturalHeight;
            const ctx = maskCanvas.getContext('2d');
            if (!ctx) throw new Error("Could not get mask canvas context.");
            
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'white';

            if (drawMode === 'polygon') {
              ctx.beginPath();
              ctx.moveTo(maskPoints[0].x, maskPoints[0].y);
              for(let i = 1; i < maskPoints.length; i++) {
                  ctx.lineTo(maskPoints[i].x, maskPoints[i].y);
              }
              ctx.closePath();
              ctx.fill();
            } else { // Brush Mode
              brushPaths.forEach(path => {
                if (path.points.length === 1) { // Single click dot
                    ctx.beginPath();
                    ctx.arc(path.points[0].x, path.points[0].y, path.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (path.points.length > 1) {
                    ctx.lineWidth = path.size;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    ctx.moveTo(path.points[0].x, path.points[0].y);
                    for (let i = 1; i < path.points.length; i++) {
                        ctx.lineTo(path.points[i].x, path.points[i].y);
                    }
                    ctx.stroke();
                }
              });
            }

            const maskDataUrl = maskCanvas.toDataURL('image/png');
            const [maskHeader, maskData] = maskDataUrl.split(',');
            const maskMimeType = maskHeader.match(/:(.*?);/)?.[1] || 'image/png';
            const maskImage = { data: maskData, mimeType: maskMimeType };
            
            const inspirationImageData = await fileToBase64(inspirationFile);
            const targetImageData = await fileToBase64(targetFile);

            const { base64Data, mimeType } = await mergeWithPerspective(
                { data: targetImageData.data, mimeType: targetImageData.mimeType },
                { data: inspirationImageData.data, mimeType: inspirationImageData.mimeType },
                maskImage
            );

            const dataUrl = `data:${mimeType};base64,${base64Data}`;
            await logActivity({
                generator: 'Perspective',
                details: {},
                inputs: [inspirationImageData.url, targetImageData.url],
                output: dataUrl
            });

            const blob = dataURLToBlob(dataUrl);
            const blobUrl = blob ? URL.createObjectURL(blob) : dataUrl;
            setGeneratedImageUrl(blobUrl);

        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleDownload = () => {
        if (!generatedImageUrl || !targetFile) return;

        const originalFileNameBase = targetFile.name.replace(/\.[^/.]+$/, "");
        
        const shortBase = originalFileNameBase.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
        const filename = `${shortBase}-mrg.png`;
    
        const link = document.createElement('a');
        link.href = generatedImageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const isReadyToGenerate = inspirationFile && targetFile && 
      ((drawMode === 'polygon' && isPolygonClosed) || (drawMode === 'brush' && brushPaths.some(p => p.points.length > 0)));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl h-fit flex flex-col gap-6">
                <h2 className="text-2xl font-bold -mb-2 border-b border-slate-200 dark:border-slate-700 pb-3 text-slate-900 dark:text-white">합성 설정</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Dropzone title="1. 배너 소스 이미지" onFileUpload={handleInspirationUpload} imageUrl={inspirationUrl} isGenerating={isGenerating} />
                    <Dropzone title="2. 대상 이미지" onFileUpload={handleTargetUpload} imageUrl={targetUrl} isGenerating={isGenerating} />
                </div>
                
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">3. 합성 영역 지정</h3>
                        <div className="flex items-center gap-2">
                            {drawMode === 'polygon' && !isPolygonClosed && maskPoints.length > 2 && (
                                <button onClick={handleCloseShape} disabled={isGenerating} className="text-sm px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50">모양 완성</button>
                            )}
                            {(maskPoints.length > 0 || brushPaths.length > 0) && <button onClick={handleResetMask} disabled={isGenerating} className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50">영역 초기화</button>}
                        </div>
                    </div>
                     <div className="flex flex-col sm:flex-row gap-4 mb-2">
                        <div className="flex items-center gap-2">
                            <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300">그리기 도구:</h4>
                            <button onClick={() => { handleResetMask(); setDrawMode('polygon');}} disabled={isGenerating} className={`px-3 py-1 text-sm rounded-md ${drawMode === 'polygon' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>다각형</button>
                            <button onClick={() => { handleResetMask(); setDrawMode('brush'); }} disabled={isGenerating} className={`px-3 py-1 text-sm rounded-md ${drawMode === 'brush' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>브러시</button>
                        </div>
                        {drawMode === 'brush' && (
                            <div className="flex items-center gap-2 flex-1">
                                <label htmlFor="brush-size" className="text-sm text-slate-700 dark:text-slate-300">크기:</label>
                                <input id="brush-size" type="range" min="5" max="150" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full h-2 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer" disabled={isGenerating} />
                                <span className="text-sm text-slate-500 dark:text-slate-400 w-8 text-center">{brushSize}</span>
                            </div>
                        )}
                    </div>
                     <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 -mt-1">
                        {drawMode === 'polygon' ? 
                            (isPolygonClosed ? '영역이 확정되었습니다.' : '이미지를 클릭하여 점을 찍어 영역을 그리세요.') :
                            '이미지 위에서 마우스를 드래그하여 영역을 자유롭게 그리세요.'
                        }
                    </p>
                    <div className="relative w-full bg-slate-100 dark:bg-slate-900/50 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
                        <img ref={imageRef} src={targetUrl || ''} alt="Target for masking" className={`w-full h-auto transition-opacity duration-300 ${targetUrl ? 'opacity-100' : 'opacity-0'}`} style={{ visibility: targetUrl ? 'visible' : 'hidden' }} />
                        <canvas 
                            ref={canvasRef} 
                            className="absolute top-0 left-0 w-full h-full"
                            style={{ cursor: targetUrl ? 'crosshair' : 'default' }}
                            onClick={handleCanvasClick}
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={handleMouseLeave}
                        />
                        {!targetUrl && (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-500 p-4 text-center">
                                <p>대상 이미지를 업로드하여 영역을 지정하세요.</p>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !isReadyToGenerate}
                    className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isGenerating ? <><Loader /> <span className="ml-2">합성 중...</span></> : '투시도 합성 실행'}
                </button>
                {error && <div className="bg-red-500/20 border border-red-500/30 text-red-300 dark:text-red-200 px-4 py-3 rounded-md mt-2">{error}</div>}
            </div>

            <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">합성 결과</h2>
                    {generatedImageUrl && !isGenerating && (
                    <button 
                        onClick={handleDownload}
                        disabled={!isCreator}
                        title={!isCreator ? "관리자만 다운로드할 수 있습니다." : "다운로드"}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
                    >
                       <DownloadIcon className="h-5 w-5"/> 다운로드
                    </button>
                    )}
                </div>
                <div className="flex-grow flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900/50 min-h-[400px] lg:min-h-0 w-full">
                    {isGenerating && <div className="text-center text-slate-500 dark:text-slate-400"><Loader/> <p className="mt-4">AI가 이미지를 합성하고 있습니다...</p><p className="text-sm text-slate-400 dark:text-slate-500">잠시만 기다려 주세요.</p></div>}
                    {!isGenerating && generatedImageUrl && (
                         <img src={generatedImageUrl} alt="Generated merged image" className="max-h-full max-w-full object-contain rounded-md" />
                    )}
                     {!isGenerating && !generatedImageUrl && (
                      <div className="text-center text-slate-400 dark:text-slate-500">
                        <p>설정을 완료하고 합성을 실행하면</p>
                        <p>결과가 여기에 표시됩니다.</p>
                      </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default PerspectiveMerger;