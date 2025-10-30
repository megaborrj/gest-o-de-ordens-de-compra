import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: React.ReactNode;
    confirmButtonText?: string;
    confirmButtonClass?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    children,
    confirmButtonText = 'Confirmar',
    confirmButtonClass = 'bg-red-600 hover:bg-red-700',
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 animate-backdrop-fade-in">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-modal-content-fade-in">
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                <div className="mt-2 text-slate-700">{children}</div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-white font-semibold rounded-md transition-colors ${confirmButtonClass}`}
                    >
                        {confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
