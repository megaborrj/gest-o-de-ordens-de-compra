import React from 'react';

interface UploadProgressRingProps {
    progress: number;
}

const UploadProgressRing: React.FC<UploadProgressRingProps> = ({ progress }) => {
    const radius = 15.9155;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle
                    className="text-slate-300"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    r={radius}
                    cx="18"
                    cy="18"
                />
                <circle
                    className="text-indigo-600"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    r={radius}
                    cx="18"
                    cy="18"
                    style={{ transition: 'stroke-dashoffset 0.35s' }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-indigo-700">{Math.round(progress)}%</span>
            </div>
        </div>
    );
};

export default UploadProgressRing;
