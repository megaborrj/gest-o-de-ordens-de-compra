import React, { useState, useEffect } from 'react';
import type { PurchaseOrder } from '../types';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    order: PurchaseOrder;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ isOpen, onClose, onConfirm, order }) => {
    const [inputValue, setInputValue] = useState('');

    // Reset input when modal is opened
    useEffect(() => {
        if (isOpen) {
            setInputValue('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isMatch = inputValue === order.sequencia;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center animate-backdrop-fade-in">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-modal-content-fade-in">
                <h3 className="text-lg font-bold text-slate-800">Confirmar Exclusão</h3>
                <p className="mt-2 text-slate-700">
                    Você tem certeza que deseja excluir a ordem de compra <strong>{order.pedido}</strong> do fornecedor <strong>{order.fornecedor}</strong>?
                </p>
                <p className="text-sm text-red-600 mt-1 font-semibold">Esta ação não pode ser desfeita.</p>

                <div className="mt-4">
                    <label htmlFor="delete-confirm-input" className="block text-sm font-medium text-slate-700">
                        Para confirmar, digite o número da sequência <strong className="text-slate-900">{order.sequencia}</strong> abaixo:
                    </label>
                    <input
                        id="delete-confirm-input"
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        autoComplete="off"
                        aria-describedby="delete-help-text"
                    />
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!isMatch}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                        aria-disabled={!isMatch}
                    >
                        Excluir Permanentemente
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmationModal;