// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React, { useState, useCallback } from 'react';
import { decodeInvisibleWatermark } from '../services/geminiService';
import Loader from './Loader';
import FingerprintIcon from './icons/FingerprintIcon';

const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || file.type;
      resolve({ data, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
};

const FingerprintChecker: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFile = useCallback(async (file: File) => {
        if (!file.type.startsWith("image/")) {
            setError("이미지 파일만 업로드할 수 있습니다.");
            return;
        }
        
        setError(null);
        setResult(null);
        setImageFile(file);
        
        if (imageUrl) {
            URL.revokeObjectURL(imageUrl);
        }
        const newUrl = URL.createObjectURL(file);
        setImageUrl(newUrl);

        setIsChecking(true);
        try {
            const { data, mimeType } = await fileToBase64(file);
            const decodedText = await decodeInvisibleWatermark(data, mimeType);
            setResult(decodedText);
        } catch (e) {
            console.error("Error decoding fingerprint:", e);
            setError(e instanceof Error ? e.message : "핑거프린트 분석 중 오류가 발생했습니다.");
        } finally {
            setIsChecking(false);
        }
    }, [imageUrl]);

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
    };
    
    const renderResult = () => {
        if (isChecking) {
            return (
                <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300">
                    <Loader />
                    <span>분석 중...</span>
                </div>
            );
        }
        if (error) {
            return <p className="text-red-500 dark:text-red-400 font-semibold">{error}</p>;
        }
        if (result) {
            const isCreator = result === "BeJeon";
            const textClass = isCreator ? "text-blue-500 dark:text-blue-300" : "text-purple-500 dark:text-purple-300";
            const label = isCreator ? "창시자 이스터에그:" : "생성한 사용자:";
            return (
                <div className="text-center">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{label}</p>
                    <p className={`text-xl font-bold ${textClass}`}>{result}</p>
                </div>
            );
        }
        if (result === null && imageFile) {
            return <p className="text-yellow-500 dark:text-yellow-400 font-semibold">이미지에서 핑거프린트를 찾을 수 없습니다.</p>;
        }
        return null;
    };


    return (
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl h-fit">
            <h2 className="text-2xl font-bold mb-4 border-b border-slate-200 dark:border-slate-700 pb-3 flex items-center gap-2 text-slate-900 dark:text-white">
                <FingerprintIcon className="h-6 w-6 text-purple-500 dark:text-purple-400"/>
                이미지 출처 확인
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                생성된 이미지를 업로드하여 보이지 않는 핑거프린트(사용자 정보)를 확인합니다.
            </p>
            <label
                htmlFor="fingerprint-upload"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleDrop}
                className={`cursor-pointer block w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-300 ${isDragging ? 'border-purple-500 bg-slate-100/80 dark:bg-slate-700/60' : 'border-slate-300 dark:border-slate-600 hover:border-purple-500 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'}`}
            >
                {imageUrl ? (
                    <img src={imageUrl} alt="Uploaded for checking" className="max-h-40 mx-auto rounded-lg object-contain" />
                ) : (
                    <div className="flex flex-col items-center justify-center py-4">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">분석할 이미지를 선택하거나 드래그하세요</span>
                    </div>
                )}
            </label>
            <input id="fingerprint-upload" type="file" accept="image/png, image/jpeg, image/webp" className="sr-only" onChange={handleFileChange}/>

            <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-900/50 rounded-lg min-h-[60px] flex items-center justify-center">
                {renderResult()}
            </div>
        </div>
    );
};

export default FingerprintChecker;