// Copyright (c) 2025 BeJeon. All Rights Reserved.

import React from 'react';
import SparklesIcon from './SparklesIcon'; // For default

interface AngleIconProps extends React.SVGProps<SVGSVGElement> {
    angleName: string;
}

const AngleIcon: React.FC<AngleIconProps> = ({ angleName, ...props }) => {
    const iconProps: React.SVGProps<SVGSVGElement> = {
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        viewBox: "0 0 24 24",
        strokeWidth: 1.5,
        stroke: "currentColor",
        ...props,
    };

    const stickFigure = (
      <React.Fragment>
        <circle cx="12" cy="7" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 9.5V16" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 19L12 16L15 19" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 13h6" strokeLinecap="round" strokeLinejoin="round" />
      </React.Fragment>
    );

    switch (angleName) {
        case '기본': return <SparklesIcon {...props} />;
        case '정면': return <svg {...iconProps}>{stickFigure}</svg>;
        case '로우 앵글': return <svg {...iconProps}><path d="M12 19l-4-4h8z M10 5h4v8h-4z" stroke="none" fill="currentColor"/><path d="M6 15h12" /></svg>;
        case '하이 앵글': return <svg {...iconProps}><path d="M12 5l4 4H8z M10 11h4v8h-4z" stroke="none" fill="currentColor"/><path d="M6 9h12" /></svg>;
        case '클로즈업': return <svg {...iconProps}><path d="M12 8a2 2 0 100-4 2 2 0 000 4z M12 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /><path d="M4 3h16v18H4z" strokeWidth={2} /></svg>;
        case '익스트림 클로즈업': return <svg {...iconProps}><path d="M12 9a3 3 0 100 6 3 3 0 000-6z"/><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><path d="M4 3h16v18H4z" strokeWidth={2} /></svg>;
        case '풀샷':
        case '와이드 샷':
             return <svg {...iconProps}>{stickFigure}<path d="M3 3h18v18H3z" strokeWidth={2} /></svg>;
        case '니샷': return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="1" strokeWidth={2}/><path clipPath="url(#clipKnee)" d="M12 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M12 7.5c-2 0-6 1-6 3v2h12v-2c0-2-4-3-6-3z"/><defs><clipPath id="clipKnee"><rect x="3" y="3" width="18" height="13" /></clipPath></defs></svg>;
        case '웨이스트샷': return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="1" strokeWidth={2}/><path clipPath="url(#clipWaist)" d="M12 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M12 7.5c-2 0-6 1-6 3v2h12v-2c0-2-4-3-6-3z"/><defs><clipPath id="clipWaist"><rect x="3" y="3" width="18" height="10" /></clipPath></defs></svg>;
        case '바스트샷': return <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="1" strokeWidth={2}/><path clipPath="url(#clipBust)" d="M12 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M12 7.5c-2 0-6 1-6 3v2h12v-2c0-2-4-3-6-3z"/><defs><clipPath id="clipBust"><rect x="3" y="3" width="18" height="8" /></clipPath></defs></svg>;
        case '오버 더 숄더': return <svg {...iconProps}><circle cx="17" cy="6" r="3" /><path d="M20.5 14H13.5c-1.1 0-2-0.9-2-2V9"/><circle cx="6" cy="11" r="3" /><path d="M9 13v6H3v-6" /></svg>;
        case '더치 앵글': return <svg {...iconProps}><rect x="1.5" y="5.5" width="18" height="18" rx="1" transform="rotate(-15 12 12)" strokeWidth={2} />{stickFigure}</svg>;
        case '항공 뷰': return <svg {...iconProps}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" stroke="none" fill="currentColor"/></svg>;
        case '1인칭 시점 (POV)': return <svg {...iconProps}><path d="M4 18.5a4 4 0 014-4h1m-5 4a4 4 0 004-4" /><path d="M20 18.5a4 4 0 00-4-4h-1m5 4a4 4 0 01-4-4" /><rect x="6" y="4" width="12" height="8" rx="1"/></svg>;
        case '측면': return <svg {...iconProps}><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2m6 5a2 2 0 00-2-2h-1a2 2 0 00-2 2v1h3v1h-3v2h3v1h-3v1a2 2 0 002 2h1a2 2 0 002-2" strokeWidth={1}/></svg>;
        case '후면': return <svg {...iconProps}><path d="M16 11a4 4 0 11-8 0 4 4 0 018 0z"/><path d="M18 20a6 6 0 00-12 0h12z"/><path d="M15 11v-1a3 3 0 00-6 0v1" /></svg>;
        default:
            return <svg {...iconProps}><circle cx="12" cy="12" r="3.5"/><path d="M16.5 7.5l-9 9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    }
};

export default AngleIcon;