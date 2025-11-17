// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React from 'react';

const GenerateIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className="h-8 w-8" 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor" 
    strokeWidth={1.5} 
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6.03 12.71a5.96 5.96 0 00-2.82 5.04M11.47 7.29a5.96 5.96 0 00-5.04 2.82M7.5 3a9.75 9.75 0 0110.13 7.86M7.5 3a9.71 9.71 0 00-1.47 5.09M15 21v-4M17 19h-4M17.97 11.29a5.96 5.96 0 002.82-5.04M12.53 16.71a5.96 5.96 0 005.04-2.82M16.5 21a9.75 9.75 0 00-10.13-7.86M16.5 21a9.71 9.71 0 011.47-5.09" />
  </svg>
);

export default GenerateIcon;