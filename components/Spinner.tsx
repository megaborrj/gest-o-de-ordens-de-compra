
import React from 'react';

interface SpinnerProps {
  small?: boolean;
}

const Spinner: React.FC<SpinnerProps> = ({ small = false }) => {
  const sizeClasses = small ? 'h-5 w-5' : 'h-8 w-8';
  const borderClasses = small ? 'border-2' : 'border-4';
  
  return (
    <div
      className={`${sizeClasses} ${borderClasses} border-t-transparent border-blue-500 rounded-full animate-spin`}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;
