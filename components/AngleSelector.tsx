// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React from 'react';
import AngleIcon from './icons/AngleIcon';

interface Angle {
    name: string;
    prompt: string;
    description?: string;
}

interface AngleSelectorProps {
    angles: Angle[];
    selectedAngles: string[]; // array of prompts
    onAngleToggle: (prompt: string) => void;
    isMultiSelect: boolean;
    isGenerating: boolean;
    onSelectAll?: () => void;
    onClear?: () => void;
}

const AngleSelector: React.FC<AngleSelectorProps> = ({
    angles,
    selectedAngles,
    onAngleToggle,
    isMultiSelect,
    isGenerating,
    onSelectAll,
    onClear
}) => {
    return (
        <div className="w-full">
            {isMultiSelect && (onSelectAll || onClear) && (
                <div className="flex justify-end gap-4 mb-3">
                    {onSelectAll && <button onClick={onSelectAll} disabled={isGenerating} className="text-sm text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50">전체 선택</button>}
                    {onClear && <button onClick={onClear} disabled={isGenerating} className="text-sm text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50">선택 해제</button>}
                </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {angles.map(angle => {
                    // For single-select '기본', it's selected if the array is empty. For multi-select, it's special-cased.
                    const isSelected = (angle.prompt === '' && selectedAngles.length === 0) || (angle.prompt && selectedAngles.includes(angle.prompt));
                    
                    return (
                        <button
                            key={angle.name}
                            title={angle.description}
                            disabled={isGenerating}
                            onClick={() => onAngleToggle(angle.prompt)}
                            className={`p-2 flex flex-col items-center justify-center rounded-lg aspect-square transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed group
                                ${isSelected 
                                    ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg transform scale-105' 
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 hover:scale-105'}`
                            }
                        >
                            <AngleIcon angleName={angle.name} className={`h-8 w-8 transition-colors ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
                            <span className="text-xs text-center mt-2 font-medium">{angle.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AngleSelector;