// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React from 'react';

const FingerprintIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    className="h-6 w-6"
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 12c0 2.42-.943 4.633-2.495 6.307m-1.135-4.496A3.75 3.75 0 0012 10.5c-1.13 0-2.16.51-2.864 1.307m-1.135 4.496a7.5 7.5 0 01-5.713-6.307c0-1.558.468-3.007 1.258-4.243m8.292 10.486a3.75 3.75 0 01-4.582 0m4.582 0a3.75 3.75 0 00-4.582 0M12 18.75a.375.375 0 01.375.375v.375a.375.375 0 01-.75 0v-.375A.375.375 0 0112 18.75z" />
  </svg>
);

export default FingerprintIcon;