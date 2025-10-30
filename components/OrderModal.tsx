import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../services/firebase';
import type { PurchaseOrder, PurchaseOrderItem, Attachment } from '../types';
import { uploadImageForOrder, deleteImageByUrl } from '../services/firebase';
import { Timestamp } from 'firebase/firestore';
import { TrashIcon } from './icons/TrashIcon';
import { UploadIcon } from './icons/UploadIcon';
import { ScannerIcon } from './icons/ScannerIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { PdfIcon } from './icons/PdfIcon';
import Spinner from './Spinner';
import ScannerInstructionsModal from './ScannerInstructionsModal';
import DeleteAttachmentModal from './DeleteAttachmentModal';
import UploadProgressRing from './UploadProgressRing';
import ConfirmationModal from './ConfirmationModal';
import CustomDatePicker from './CustomDatePicker';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder;
  onSave: (order: PurchaseOrder) => Promise<void>;
}

const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose, order, onSave }) => {
  const [editableOrder, setEditableOrder] = useState<PurchaseOrder>(order);
  const [isSaving, setIsSaving] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  const [uploads, setUploads] = useState<{ [key: string]: { progress: number; fileName: string } }>({});
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null);
  const [isDeleteAttachmentModalOpen, setIsDeleteAttachmentModalOpen] = useState(false);
  
  const [statusConfirmProps, setStatusConfirmProps] = useState<{ isOpen: boolean; fileName: string; }>({ isOpen: false, fileName: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditableOrder(JSON.parse(JSON.stringify(order)));
    setUploads({});
  }, [order, isOpen]);

  if (!isOpen) return null;

  const handleDataChange = <K extends keyof PurchaseOrder>(key: K, value: PurchaseOrder[K]) => {
    setEditableOrder(prev => ({ ...prev, [key]: value }));
  };

  const handleItemChange = <K extends keyof PurchaseOrderItem>(index: number, key: K, value: PurchaseOrderItem[K]) => {
    setEditableOrder(prevData => {
      const newItems = [...prevData.items];
      const itemToUpdate = { ...newItems[index], [key]: value };

      if (key === 'quantidade' || key === 'precoUnitario') {
        const qty = key === 'quantidade' ? (value as number) : itemToUpdate.quantidade;
        const price = key === 'precoUnitario' ? (value as number) : itemToUpdate.precoUnitario;
        const total = !isNaN(qty) && !isNaN(price) ? qty * price : 0;
        itemToUpdate.precoTotal = parseFloat(total.toFixed(2));
      }
      newItems[index] = itemToUpdate;

      const newTotalGeral = newItems.reduce((total, currentItem) => total + (currentItem.precoTotal || 0), 0);
      return { ...prevData, items: newItems, totalGeral: parseFloat(newTotalGeral.toFixed(2)) };
    });
  };

  const handleAddItem = () => {
    const newItem: PurchaseOrderItem = { codigo: '', descricao: '', unidade: '', quantidade: 0, precoUnitario: 0, precoTotal: 0 };
    setEditableOrder(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const handleRemoveItem = (indexToRemove: number) => {
    setEditableOrder(prevData => {
      const newItems = prevData.items.filter((_, index) => index !== indexToRemove);
      const newTotalGeral = newItems.reduce((total, currentItem) => total + (currentItem.precoTotal || 0), 0);
      return { ...prevData, items: newItems, totalGeral: parseFloat(newTotalGeral.toFixed(2)) };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editableOrder);
      onClose();
    } catch (error) {
      console.error("Failed to save order:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    uploadFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadFiles = async (filesToUpload: File[]) => {
    const user = auth.currentUser;
    if (!user) return;

    for (const file of filesToUpload) {
      const uploadKey = `${file.name}-${Date.now()}`;
      setUploads(prev => ({ ...prev, [uploadKey]: { progress: 0, fileName: file.name } }));

      try {
        const downloadURL = await uploadImageForOrder(order.id, file, (progress) => {
          setUploads(prev => ({ ...prev, [uploadKey]: { ...prev[uploadKey], progress } }));
        });
        
        const newAttachment: Attachment = {
          url: downloadURL,
          fileName: file.name,
          uploadedBy: user.displayName || user.email || 'Usuário Desconhecido',
          uploadedAt: new Date() as any, // Use client-side date for immediate display
        };

        setEditableOrder(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), newAttachment]
        }));
        
        setStatusConfirmProps({ isOpen: true, fileName: file.name });

      } catch (error) {
        console.error("Upload failed:", error);
        // Optionally show an error message to the user
      } finally {
        setUploads(prev => {
          const newUploads = { ...prev };
          delete newUploads[uploadKey];
          return newUploads;
        });
      }
    }
  };

  const handleDeleteAttachmentClick = (attachment: Attachment) => {
    setAttachmentToDelete(attachment);
    setIsDeleteAttachmentModalOpen(true);
  };

  const handleConfirmDeleteAttachment = async () => {
    if (!attachmentToDelete) return;
    
    // Optimistically update UI
    const updatedAttachments = editableOrder.attachments.filter(att => att.url !== attachmentToDelete.url);
    setEditableOrder(prev => ({ ...prev, attachments: updatedAttachments }));

    try {
      await deleteImageByUrl(attachmentToDelete.url);
    } catch (error) {
      // Revert UI if delete fails
      console.error("Failed to delete attachment:", error);
      setEditableOrder(prev => ({ ...prev, attachments: prev.attachments.concat(attachmentToDelete) }));
      // Show an error message to the user
    } finally {
      setIsDeleteAttachmentModalOpen(false);
      setAttachmentToDelete(null);
    }
  };

  const renderInputField = (label: string, value: string | number, key: keyof PurchaseOrder, type: 'text' | 'number' | 'date' = 'text') => {
    if (type === 'date') {
        return (
            <div>
                <label className="block text-sm font-semibold text-slate-700">{label}</label>
                <CustomDatePicker
                    value={String(value || '')}
                    onChange={(newValue) => handleDataChange(key, newValue as any)}
                />
            </div>
        );
    }

    return (
      <div>
        <label className="block text-sm font-semibold text-slate-700">{label}</label>
        <input
          type={type}
          value={value || ''}
          onChange={(e) => {
            let newValue: string | number = e.target.value;
            if (type === 'number') {
                newValue = parseFloat(e.target.value) || 0;
            }
            handleDataChange(key, newValue as any)
          }}
          className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
    );
  };
  
  const renderCheckbox = (label: string, key: keyof PurchaseOrder) => (
    <div className="flex items-center">
      <input
        id={`modal-${String(key)}`}
        name={String(key)}
        type="checkbox"
        checked={!!editableOrder[key]}
        onChange={(e) => handleDataChange(key, e.target.checked as any)}
        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
      />
      <label htmlFor={`modal-${String(key)}`} className="ml-2 block text-sm text-slate-900">
        {label}
      </label>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4 animate-backdrop-fade-in" onClick={onClose}>
        <div
          className="bg-slate-50 rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col animate-modal-content-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-4 border-b border-slate-200 flex-shrink-0">
            <h2 className="text-xl font-bold text-slate-800">Detalhes da Ordem de Compra</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl">&times;</button>
          </div>

          <div className="flex-grow overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderInputField("Fornecedor", editableOrder.fornecedor, 'fornecedor')}
              {renderInputField("CNPJ", editableOrder.cnpj || '', 'cnpj')}
              {renderInputField("Pedido", editableOrder.pedido, 'pedido')}
              {renderInputField("Sequência", editableOrder.sequencia, 'sequencia')}
              {renderInputField("Nota Fiscal", editableOrder.notaFiscal || '', 'notaFiscal')}
              {renderInputField("Data", editableOrder.data, 'data', 'date')}
              {renderInputField("Emissão", editableOrder.emissao, 'emissao', 'date')}
              {renderInputField("Recebimento", editableOrder.recebimento, 'recebimento', 'date')}
              <div>
                  <label className="block text-sm font-semibold text-slate-700">Status</label>
                   <select
                        value={editableOrder.status}
                        onChange={(e) => handleDataChange('status', e.target.value as any)}
                        className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                        <option value="Iniciado">Iniciado</option>
                        <option value="Recebido">Recebido</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
              </div>
              {renderInputField("Nome Referência", editableOrder.nomeReferencia, 'nomeReferencia')}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-700">Classificação</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 border border-slate-200 rounded-lg bg-slate-100/50">
                {renderCheckbox("Book", 'isBook')}
                {renderCheckbox("Site", 'isSite')}
                {renderCheckbox("Revisão de Impostos", 'isRevisaoImpostos')}
                {renderCheckbox("Casado", 'isCasado')}
                {renderCheckbox("Estoque", 'isEstoque')}
                {renderCheckbox("Remarcar", 'isRemarcar')}
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {renderInputField("link do pedido", editableOrder.observacoes, 'observacoes')}
              {renderInputField("link de entrada", editableOrder.linkEntrada || '', 'linkEntrada')}
            </div>
            
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-700">Itens do Pedido</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100">
                      <tr>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Código</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Descrição</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Un.</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Qtd.</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Preço Un.</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Total</th>
                          <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Ação</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {editableOrder.items.map((item, index) => (
                      <tr key={index}>
                        <td><input value={item.codigo || ''} onChange={(e) => handleItemChange(index, 'codigo', e.target.value)} className="w-full text-sm p-1.5 border border-slate-300 rounded-md bg-white"/></td>
                        <td><input value={item.descricao || ''} onChange={(e) => handleItemChange(index, 'descricao', e.target.value)} className="w-full text-sm p-1.5 border border-slate-300 rounded-md bg-white"/></td>
                        <td><input value={item.unidade || ''} onChange={(e) => handleItemChange(index, 'unidade', e.target.value)} className="w-16 text-sm p-1.5 border border-slate-300 rounded-md bg-white"/></td>
                        <td><input type="number" value={item.quantidade || ''} onChange={(e) => handleItemChange(index, 'quantidade', parseFloat(e.target.value) || 0)} className="w-20 text-sm p-1.5 border border-slate-300 rounded-md bg-white"/></td>
                        <td><input type="number" value={item.precoUnitario || ''} onChange={(e) => handleItemChange(index, 'precoUnitario', parseFloat(e.target.value) || 0)} className="w-24 text-sm p-1.5 border border-slate-300 rounded-md bg-white"/></td>
                        <td><input type="number" readOnly value={item.precoTotal || ''} className="w-24 text-sm p-1.5 border-slate-300 rounded-md bg-white cursor-not-allowed"/></td>
                        <td className="text-center"><button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="w-5 h-5"/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={handleAddItem} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold">+ Adicionar Item</button>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-700">Documentos Anexados</h3>
              <div className="p-4 bg-slate-100/60 border border-slate-200 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    {editableOrder.attachments?.map((att) => (
                      <div key={att.url} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-200 group">
                          {att.fileName.toLowerCase().endsWith('.pdf') ? <PdfIcon className="w-10 h-10 text-red-500 flex-shrink-0" /> : <img src={att.url} alt={att.fileName} className="w-10 h-10 object-cover rounded-md flex-shrink-0" />}
                          <div className="flex-1 truncate">
                              <p className="text-sm font-semibold text-slate-800 truncate" title={att.fileName}>{att.fileName}</p>
                              <p className="text-xs text-slate-500">
                                  Enviado por: {att.uploadedBy} em {att.uploadedAt ? new Date((att.uploadedAt as any).seconds * 1000).toLocaleString('pt-BR') : '...'}
                              </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a href={att.url} download={att.fileName} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-indigo-600 rounded-full hover:bg-indigo-100"><DownloadIcon className="w-5 h-5" /></a>
                              <button onClick={() => handleDeleteAttachmentClick(att)} className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-red-100"><TrashIcon className="w-5 h-5" /></button>
                          </div>
                      </div>
                    ))}
                    {Object.values(uploads).map(({ progress, fileName }, index) => (
                        <div key={index} className="flex items-center gap-4 bg-slate-200 p-2 rounded-md">
                            <UploadProgressRing progress={progress} />
                            <p className="text-sm text-slate-700 font-medium truncate flex-1">{fileName}</p>
                        </div>
                    ))}
                    {(!editableOrder.attachments || editableOrder.attachments.length === 0) && Object.keys(uploads).length === 0 && (
                        <p className="text-sm text-center text-slate-500 py-4">Nenhum documento anexado.</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-4 p-4 border-2 border-dashed border-slate-300 rounded-lg justify-center items-center">
                      <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-100 rounded-md hover:bg-indigo-200">
                        <UploadIcon className="w-5 h-5" /> Anexar Arquivo
                      </button>
                      <input type="file" multiple ref={fileInputRef} onChange={handleFileSelected} className="hidden" accept="image/*,.pdf" />
                      <button onClick={() => setIsScannerModalOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300">
                        <ScannerIcon className="w-5 h-5" /> Escanear
                      </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
                <div className="text-right">
                    <label className="block text-sm font-semibold text-slate-700">Total Geral</label>
                    <input type="number" value={editableOrder.totalGeral || ''} onChange={(e) => handleDataChange('totalGeral', parseFloat(e.target.value))} className="mt-1 w-48 text-lg font-bold text-right border-slate-300 rounded-md bg-white" />
                </div>
            </div>

          </div>

          <div className="flex justify-between items-center p-4 border-t border-slate-200 bg-white/50 flex-shrink-0">
            <div className="text-xs text-slate-500">
              Criado por: {order.creatorEmail} em {order.createdAt ? new Date((order.createdAt as any).seconds * 1000).toLocaleString('pt-BR') : 'N/A'}
              <br />
              {order.updatedBy && `Última modificação por: ${order.updaterEmail} em ${order.updatedAt ? new Date((order.updatedAt as any).seconds * 1000).toLocaleString('pt-BR') : 'N/A'}`}
            </div>
            <div className="flex items-center">
                <button onClick={onClose} className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 mr-3">
                    Cancelar
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-300 flex items-center"
                >
                    {isSaving ? <Spinner small /> : null}
                    <span className={isSaving ? 'ml-2' : ''}>Salvar Alterações</span>
                </button>
            </div>
          </div>
        </div>
      </div>

      <ScannerInstructionsModal isOpen={isScannerModalOpen} onClose={() => setIsScannerModalOpen(false)} />
      {attachmentToDelete && (
        <DeleteAttachmentModal
          isOpen={isDeleteAttachmentModalOpen}
          onClose={() => setIsDeleteAttachmentModalOpen(false)}
          onConfirm={handleConfirmDeleteAttachment}
          attachment={attachmentToDelete}
        />
      )}
       <ConfirmationModal
          isOpen={statusConfirmProps.isOpen}
          onClose={() => setStatusConfirmProps({ isOpen: false, fileName: '' })}
          onConfirm={() => {
            setEditableOrder(prev => ({ ...prev, status: 'Recebido' }));
            setStatusConfirmProps({ isOpen: false, fileName: '' });
          }}
          title="Confirmar Recebimento"
          confirmButtonText="Sim, alterar status"
          confirmButtonClass="bg-green-600 hover:bg-green-700"
        >
          <p>
            O documento <strong>"{statusConfirmProps.fileName}"</strong> foi anexado com sucesso.
          </p>
          <p className="mt-2">
            Deseja alterar o status da ordem para "Recebido"?
          </p>
        </ConfirmationModal>
    </>
  );
};

export default OrderModal;