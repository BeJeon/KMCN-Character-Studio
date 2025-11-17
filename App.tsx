// Copyright (c) 2025 BeJeon. All Rights Reserved.
// Created by BeJeon, the original creator of KMCN Character Studio.

import React, { useState, useEffect } from 'react';
import ExpressionGenerator from './components/ExpressionGenerator';
import SceneGenerator from './components/SceneGenerator';
import CameraAngleGenerator from './components/CameraAngleGenerator';
import ImageExtender from './components/ImageExtender';
import PerspectiveMerger from './components/PerspectiveMerger';
import UserManagement from './components/UserManagement';
import ActivityHistory from './components/ActivityHistory';
import SunIcon from './components/icons/SunIcon';
import MoonIcon from './components/icons/MoonIcon';
import SystemIcon from './components/icons/SystemIcon';

// This is a simple, client-side password.
// For a production environment, a more secure authentication method (e.g., a backend service) would be recommended.
const CORRECT_PASSWORD = 'PATPAT0514!';

type Theme = 'light' | 'dark' | 'system';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('isAuthenticated') === 'true');
  const [isCreatorAuthenticated, setIsCreatorAuthenticated] = useState(sessionStorage.getItem('isCreator') === 'true');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [activeTab, setActiveTab] = useState('expressions');
  const [historyUserFilter, setHistoryUserFilter] = useState<string | null>(null);

  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');

  // Effect to handle theme changes and sync with localStorage and system preferences.
  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (t: Theme) => {
      if (t === 'system') {
        // For 'system', we clear the storage and apply based on media query.
        // This makes it consistent with the FOUC script in index.html.
        localStorage.removeItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      } else {
        // For 'light' or 'dark', we store the preference and apply it.
        localStorage.setItem('theme', t);
        if (t === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Only re-apply if the current theme is 'system'.
      // `theme` is captured from the outer scope and is up-to-date
      // because this effect re-runs whenever `theme` changes.
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);


  // Check if the user is the creator by checking the hostname.
  // This provides a simple way to have a "developer mode" or "creator mode".
  const isCreatorHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Effect for copy protection
  useEffect(() => {
    const isUserAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
    const isCreatorUser = sessionStorage.getItem('isCreator') === 'true';

    const preventDefaultAction = (e: Event) => {
      e.preventDefault();
    };

    // Apply protection if the user is authenticated but is NOT the creator
    if (isUserAuthenticated && !isCreatorUser) {
      document.addEventListener('contextmenu', preventDefaultAction);
      document.addEventListener('dragstart', preventDefaultAction);
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none'; // Safari

      // Cleanup function to remove protections
      return () => {
        document.removeEventListener('contextmenu', preventDefaultAction);
        document.removeEventListener('dragstart', preventDefaultAction);
        document.body.style.userSelect = 'auto';
        document.body.style.webkitUserSelect = 'auto';
      };
    }
    
    // If user is creator or not logged in, ensure no restrictions are active.
    // The cleanup function handles this implicitly when the effect re-runs.
    return () => {
        document.removeEventListener('contextmenu', preventDefaultAction);
        document.removeEventListener('dragstart', preventDefaultAction);
        document.body.style.userSelect = 'auto';
        document.body.style.webkitUserSelect = 'auto';
    };
  }, [isAuthenticated]); // Rerun this effect when authentication state changes

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const generatedPasswords = JSON.parse(localStorage.getItem('generatedPasswords') || '[]');
    
    if (passwordInput === CORRECT_PASSWORD) {
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('isCreator', 'true');
      sessionStorage.setItem('loggedInUser', 'Creator');
      setIsAuthenticated(true);
      setIsCreatorAuthenticated(true);
      setLoginError('');
    } else {
      const matchedUser = generatedPasswords.find((p: { name: string; password: string }) => p.password === passwordInput);
      if (matchedUser) {
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('isCreator', 'false');
        sessionStorage.setItem('loggedInUser', matchedUser.name);
        setIsAuthenticated(true);
        setIsCreatorAuthenticated(false);
        setLoginError('');
      } else {
        setLoginError('비밀번호가 올바르지 않습니다. 다시 시도해주세요.');
        setPasswordInput('');
      }
    }
  };
  
  const handleCreatorLogin = () => {
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('isCreator', 'true');
      sessionStorage.setItem('loggedInUser', 'Creator');
      setIsAuthenticated(true);
      setIsCreatorAuthenticated(true);
      setLoginError('');
  };

  const navigateToHistory = (userName: string) => {
    setHistoryUserFilter(userName);
    setActiveTab('history');
  };

  const ThemeSwitcher = () => {
    const nextTheme: Record<Theme, Theme> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    
    const cycleTheme = () => {
      setTheme(nextTheme[theme]);
    };

    return (
      <button
        onClick={cycleTheme}
        className="absolute top-4 right-4 p-2 rounded-full bg-slate-200/50 dark:bg-slate-700/50 hover:bg-slate-300/80 dark:hover:bg-slate-600/80 transition-colors"
        aria-label={`Switch to ${nextTheme[theme]} mode`}
        title={`테마 변경: ${nextTheme[theme]}`}
      >
        {theme === 'light' && <SunIcon className="h-5 w-5 text-slate-800" />}
        {theme === 'dark' && <MoonIcon className="h-5 w-5 text-slate-200" />}
        {theme === 'system' && <SystemIcon className="h-5 w-5 text-slate-600 dark:text-slate-300" />}
      </button>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 min-h-screen flex items-center justify-center p-4">
        <ThemeSwitcher />
        <div className="w-full max-w-md">
          <form 
            onSubmit={handleLogin}
            className="bg-white/50 dark:bg-slate-800/40 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-2xl text-center"
          >
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500 mb-2">
              KMCN 캐릭터 스튜디오
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8">접근하려면 비밀번호를 입력하세요.</p>
            
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="비밀번호"
              className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-center text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors mb-4"
              autoFocus
            />

            {loginError && <p className="text-red-500 dark:text-red-400 text-sm mb-4">{loginError}</p>}
            
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                type="submit"
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 disabled:bg-slate-600 disabled:shadow-none"
              >
                입장하기
              </button>
              {isCreatorHost && (
                <button
                  type="button"
                  onClick={handleCreatorLogin}
                  className="w-full px-6 py-3 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-slate-600"
                >
                  창시자 로그인
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }


  const renderTabContent = () => {
    switch (activeTab) {
      case 'expressions':
        return <ExpressionGenerator isCreator={isCreatorAuthenticated} />;
      case 'scene':
        return <SceneGenerator isCreator={isCreatorAuthenticated} />;
      case 'camera':
        return <CameraAngleGenerator isCreator={isCreatorAuthenticated} />;
      case 'extender':
        return <ImageExtender isCreator={isCreatorAuthenticated} />;
      case 'perspective':
        return <PerspectiveMerger isCreator={isCreatorAuthenticated} />;
      case 'userManagement':
        return <UserManagement onNavigateToHistory={navigateToHistory} />;
       case 'history':
        return <ActivityHistory userFilter={historyUserFilter} />;
      default:
        return <ExpressionGenerator isCreator={isCreatorAuthenticated} />;
    }
  };

  const getTabClass = (tabName: string) => 
    `px-4 sm:px-6 py-3 text-sm sm:text-base font-medium rounded-t-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-purple-400 relative ${
      activeTab === tabName
        ? 'text-slate-900 dark:text-white'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/40'
    }`;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 min-h-screen p-4 sm:p-8">
      
      <div className="container mx-auto max-w-screen-2xl relative">
        <ThemeSwitcher />
        <header className="text-center mb-8 sm:mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">
            KMCN 캐릭터 스튜디오
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-3 text-lg">AI를 활용해 캐릭터의 표정을 만들거나 새로운 장면을 연출해보세요.</p>
        </header>

        <div className="border-b border-slate-300 dark:border-slate-700 mb-8">
          <nav className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto">
            {[{id: 'expressions', label: '표정 생성기'},
              {id: 'scene', label: '장면 생성기'},
              {id: 'camera', label: '카메라 구도 변경'},
              {id: 'extender', label: '이미지 확장'},
              {id: 'perspective', label: '투시도 합성기'},
             ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={getTabClass(tab.id)}>
                {tab.label}
                {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"></span>}
              </button>
             ))}
             {isCreatorAuthenticated && (
                <button onClick={() => setActiveTab('userManagement')} className={getTabClass('userManagement')}>
                  사용자 관리
                  {activeTab === 'userManagement' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"></span>}
                </button>
              )}
              {isCreatorAuthenticated && (
                <button onClick={() => { setHistoryUserFilter(null); setActiveTab('history'); }} className={getTabClass('history')}>
                  활동 기록
                  {activeTab === 'history' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"></span>}
                </button>
              )}
          </nav>
        </div>
        
        <main>
          {renderTabContent()}
        </main>

        <footer className="text-center text-slate-500 dark:text-slate-500 text-xs mt-12 pb-4">
            <p>© 2025 BeJeon (Creator). All Rights Reserved.</p>
            <p className="mt-1">This tool and its generated content are protected by copyright law. Unauthorized reproduction or distribution is prohibited.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
