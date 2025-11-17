// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React, { useState, useEffect, useCallback } from 'react';
import XIcon from './icons/XIcon';
import HistoryIcon from './icons/HistoryIcon';
import FingerprintChecker from './FingerprintChecker';

interface StoredPassword {
    name: string;
    password: string;
    createdAt: string;
}

const ADJECTIVES = ['Agile', 'Bright', 'Calm', 'Daring', 'Eager', 'Fancy', 'Glad', 'Happy', 'Jolly', 'Keen', 'Lively', 'Merry', 'Nice', 'Proud', 'Silly', 'Witty', 'Zany', 'Brave', 'Clever', 'Sunny', 'Gentle'];
const NOUNS = ['Fox', 'River', 'Star', 'Moon', 'Tiger', 'Lion', 'Bear', 'Wolf', 'Eagle', 'Hawk', 'Whale', 'Shark', 'Ant', 'Bee', 'Cat', 'Dog', 'Elk', 'Goat', 'Jay', 'Owl'];

const generatePassword = (): string => {
    const randomItem = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    return `${randomItem(ADJECTIVES)}${randomItem(NOUNS)}${Math.floor(100 + Math.random() * 900)}`;
};

interface UserManagementProps {
    onNavigateToHistory: (userName: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ onNavigateToHistory }) => {
    const [passwords, setPasswords] = useState<StoredPassword[]>([]);
    const [newName, setNewName] = useState('');
    const [notification, setNotification] = useState('');
    const [error, setError] = useState('');
    const [selectedPasswords, setSelectedPasswords] = useState<string[]>([]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('generatedPasswords');
            if (stored) {
                setPasswords(JSON.parse(stored));
            }
        } catch (error) {
            console.error("Failed to load passwords from localStorage:", error);
            setError("비밀번호를 불러오는 데 실패했습니다.");
        }
    }, []);

    const savePasswords = useCallback((newPasswords: StoredPassword[]) => {
        try {
            localStorage.setItem('generatedPasswords', JSON.stringify(newPasswords));
            setPasswords(newPasswords);
            setError(''); // Clear error on success
        } catch (error) {
            console.error("Failed to save passwords to localStorage:", error);
            setError('비밀번호 저장에 실패했습니다. 브라우저 스토리지 공간이 부족할 수 있습니다.');
        }
    }, []);

    const showNotification = (message: string) => {
        setNotification(message);
        setTimeout(() => setNotification(''), 3000);
    };

    const handleAddPassword = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!newName.trim()) return;

        const newPassword: StoredPassword = {
            name: newName.trim(),
            password: generatePassword(),
            createdAt: new Date().toISOString(),
        };

        const updatedPasswords = [...passwords, newPassword];
        savePasswords(updatedPasswords);
        setNewName('');
        showNotification(`'${newPassword.name}'의 비밀번호가 생성되었습니다.`);
    };

    const handleRevokePassword = (passwordToRevoke: string) => {
        setError('');
        const passwordName = passwords.find(p => p.password === passwordToRevoke)?.name || '';
        if (window.confirm(`'${passwordName}' 사용자의 비밀번호를 정말로 삭제하시겠습니까?`)) {
            const updatedPasswords = passwords.filter(p => p.password !== passwordToRevoke);
            savePasswords(updatedPasswords);
            showNotification(`'${passwordName}'의 비밀번호가 삭제되었습니다.`);
        }
    };
    
    const handleClearAllPasswords = () => {
        setError('');
        if (window.confirm('정말로 모든 사용자 비밀번호를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            savePasswords([]);
            showNotification("모든 비밀번호가 삭제되었습니다.");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            showNotification("비밀번호가 클립보드에 복사되었습니다.");
        }).catch(err => {
            console.error('Could not copy text: ', err);
            showNotification("복사에 실패했습니다.");
        });
    };

    const handleSelectPassword = (password: string) => {
        setSelectedPasswords(prev =>
            prev.includes(password)
                ? prev.filter(p => p !== password)
                : [...prev, password]
        );
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedPasswords(passwords.map(p => p.password));
        } else {
            setSelectedPasswords([]);
        }
    };

    const handleRevokeSelected = () => {
        setError('');
        if (selectedPasswords.length === 0) return;

        if (window.confirm(`선택된 ${selectedPasswords.length}명의 사용자를 정말로 삭제하시겠습니까?`)) {
            const updatedPasswords = passwords.filter(p => !selectedPasswords.includes(p.password));
            savePasswords(updatedPasswords);
            showNotification(`${selectedPasswords.length}명의 사용자가 삭제되었습니다.`);
            setSelectedPasswords([]);
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
             {notification && (
                <div className="fixed top-20 right-8 bg-green-500/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg transition-opacity duration-300 z-50">
                    {notification}
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-8">
                    <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl h-fit">
                        <h2 className="text-2xl font-bold mb-4 border-b border-slate-200 dark:border-slate-700 pb-3 text-slate-900 dark:text-white">새 비밀번호 생성</h2>
                        <form onSubmit={handleAddPassword}>
                            <label htmlFor="user-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                사용자 이름 또는 용도
                            </label>
                            <input
                                id="user-name"
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="예: 마케팅팀, 외주 디자이너"
                                className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors mb-4"
                                required
                            />
                            <button
                                type="submit"
                                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 disabled:from-slate-600 disabled:to-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                            >
                                생성하기
                            </button>
                        </form>
                    </div>
                    <FingerprintChecker />
                </div>
                <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">발급된 비밀번호 목록</h2>
                        {passwords.length > 0 && (
                            <button
                                onClick={handleClearAllPasswords}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                title="목록 전체 삭제"
                            >
                                목록 전체 삭제
                            </button>
                        )}
                    </div>
                    {error && (
                        <div className="bg-red-500/20 border border-red-500/30 text-red-300 dark:text-red-200 px-4 py-3 rounded-md mb-4">
                            {error}
                        </div>
                    )}
                    {passwords.length > 0 ? (
                        <>
                             <div className="flex items-center justify-between mb-3 px-1">
                                <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        onChange={handleSelectAll}
                                        checked={selectedPasswords.length > 0 && selectedPasswords.length === passwords.length}
                                        className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span>전체 선택</span>
                                </label>
                                <button
                                    onClick={handleRevokeSelected}
                                    disabled={selectedPasswords.length === 0}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                                >
                                    선택 삭제 ({selectedPasswords.length})
                                </button>
                            </div>
                            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
                                {[...passwords].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(p => (
                                    <div key={p.password} className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center flex-1 min-w-0">
                                             <input
                                                type="checkbox"
                                                checked={selectedPasswords.includes(p.password)}
                                                onChange={() => handleSelectPassword(p.password)}
                                                className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-600 border-slate-400 dark:border-slate-500 text-purple-600 focus:ring-purple-500 mr-4 flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-slate-900 dark:text-white truncate">{p.name}</p>
                                                <p 
                                                    className="text-sm text-purple-600 dark:text-purple-300 font-mono cursor-pointer truncate" 
                                                    title="클릭하여 복사"
                                                    onClick={() => copyToClipboard(p.password)}
                                                >
                                                    {p.password}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    생성일: {new Date(p.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center flex-shrink-0">
                                            <button
                                                onClick={() => onNavigateToHistory(p.name)}
                                                className="text-sm font-semibold text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 px-3 py-1 rounded-md transition-colors"
                                                title="활동 보기"
                                            >
                                               기록 보기
                                            </button>
                                            <button
                                                onClick={() => handleRevokePassword(p.password)}
                                                className="ml-2 text-sm font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10 dark:hover:bg-red-500/20 px-3 py-1 rounded-md transition-colors"
                                                title="비밀번호 삭제"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                            <p>생성된 비밀번호가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;