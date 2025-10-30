import React from 'react';

interface FiscalAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const FiscalAnalysisModal: React.FC<FiscalAnalysisModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg p-6">
        <h2 className="text-xl font-bold">Fiscal Analysis</h2>
        <p>This is a placeholder for the Fiscal Analysis modal.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
          Close
        </button>
      </div>
    </div>
  );
};

export default FiscalAnalysisModal;
