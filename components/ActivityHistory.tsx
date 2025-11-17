// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React, { useState, useEffect, useMemo } from 'react';
import { getActivityLog, clearActivityLog } from '../services/activityLog';
import type { ActivityLog } from '../types';

const GENERATOR_NAMES = {
    'Expression': '표정 생성기',
    'Scene': '장면 생성기',
    'CameraAngle': '카메라 구도 변경',
    'Extender': '이미지 확장',
    'Perspective': '투시도 합성기'
};


const ActivityCard: React.FC<{ log: ActivityLog }> = ({ log }) => {
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const renderDetails = () => {
        const details = Object.entries(log.details).filter(([, value]) => value);
        if (details.length === 0) return null;
        return (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1 bg-slate-100 dark:bg-slate-900/50 p-2 rounded-md">
                {details.map(([key, value]) => {
                    const keyMap: { [key: string]: string } = {
                        prompt: '프롬프트',
                        backgroundPrompt: '배경',
                        clothingPrompt: '의상',
                        angle: '구도',
                        aspectRatio: '비율'
                    };
                    return <p key={key}><span className="font-semibold text-slate-700 dark:text-slate-300">{keyMap[key] || key}:</span> {value}</p>;
                })}
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-purple-600 dark:text-purple-300">{log.userName}</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{GENERATOR_NAMES[log.generator]}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
                <button onClick={() => setIsDetailsOpen(!isDetailsOpen)} className="text-sm text-blue-500 dark:text-blue-400 hover:underline">
                    {isDetailsOpen ? '숨기기' : '상세보기'}
                </button>
            </div>
            
            {isDetailsOpen && renderDetails()}

            <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                    <p className="text-sm font-semibold mb-2 text-center text-slate-600 dark:text-slate-300">입력</p>
                    <div className="flex flex-wrap justify-center gap-2">
                    {log.inputs.map((src, idx) => (
                        <img key={idx} src={src} className="h-24 w-24 object-contain rounded-md bg-slate-200 dark:bg-slate-700" alt={`Input ${idx+1}`}/>
                    ))}
                    </div>
                </div>
                 <div>
                    <p className="text-sm font-semibold mb-2 text-center text-slate-600 dark:text-slate-300">출력</p>
                    <div className="flex justify-center">
                        <img src={log.output} className="h-24 w-24 object-contain rounded-md bg-slate-200 dark:bg-slate-700" alt="Output"/>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ActivityHistory: React.FC<{ userFilter: string | null }> = ({ userFilter }) => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('All');
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        setLogs(getActivityLog());
    }, []);
    
    useEffect(() => {
        if(userFilter) {
            setSelectedUser(userFilter);
        }
    }, [userFilter]);

    const users = useMemo(() => {
        const userSet = new Set(logs.map(log => log.userName));
        return ['All', ...Array.from(userSet)];
    }, [logs]);

    const filteredLogs = useMemo(() => {
        if (selectedUser === 'All') {
            return logs;
        }
        return logs.filter(log => log.userName === selectedUser);
    }, [logs, selectedUser]);
    
    const handleClearHistory = () => {
        if (window.confirm('정말로 모든 활동 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            if (clearActivityLog()) {
                setLogs([]);
                setError(null);
            } else {
                setError("활동 기록 삭제에 실패했습니다. 브라우저 스토리지에 문제가 있을 수 있습니다.");
            }
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                 <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">활동 기록</h2>
                    <p className="text-sm text-slate-500 mt-1">이 기록은 현재 사용 중인 브라우저에만 저장됩니다.</p>
                </div>
                <div className="flex items-center gap-4">
                    <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-slate-800 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                    >
                        {users.map(user => (
                            <option key={user} value={user}>{user === 'All' ? '모든 사용자' : user}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleClearHistory}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                    >
                        기록 전체 삭제
                    </button>
                </div>
            </div>
            
            {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 dark:text-red-200 px-4 py-3 rounded-md mb-4">
                    {error}
                </div>
            )}

            {filteredLogs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLogs.map(log => (
                        <ActivityCard key={log.id} log={log} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-slate-100 dark:bg-slate-800/30 rounded-lg">
                    <p className="text-slate-400 dark:text-slate-500">표시할 활동 기록이 없습니다.</p>
                </div>
            )}
        </div>
    );
};

export default ActivityHistory;