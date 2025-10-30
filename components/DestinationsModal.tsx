import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../services/firebase';
import type { PurchaseOrder, PurchaseOrderItem, Attachment } from '../types';
import { uploadImageForOrder, deleteImageByUrl } from '../services/firebase';
import { Timestamp } from 'firebase/firestore';
import Spinner from './Spinner';
import { TrashIcon } from './icons/TrashIcon';
import { UploadIcon } from './icons/UploadIcon';
import { ScannerIcon } from './icons/ScannerIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { PdfIcon } from './icons/PdfIcon';
import ScannerInstructionsModal from './ScannerInstructionsModal';
import DeleteAttachmentModal from './DeleteAttachmentModal';
import UploadProgressRing from './UploadProgressRing';
import ConfirmationModal from './ConfirmationModal';
import CustomDatePicker from './CustomDatePicker';


interface DestinationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder;
  onSave: (order: PurchaseOrder) => Promise<void>;
}

const DestinationsModal: React.FC<DestinationsModalProps> = ({ isOpen, onClose, order, onSave }) => {
  const [editableOrder, setEditableOrder] = useState<PurchaseOrder>(order);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Attachment related state
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

  const handleMappingItemChange = (index: number, key: keyof PurchaseOrderItem, value: string | number) => {
    setEditableOrder(prevData => {
      const newItems = [...prevData.items];
      const itemToUpdate = { ...newItems[index], [key]: value };
      newItems[index] = itemToUpdate;
      return { ...prevData, items: newItems };
    });
  };
  
  const handleItemChange = <K extends keyof PurchaseOrderItem>(index: number, key: K, value: PurchaseOrderItem[K]) => {
    setEditableOrder(prevData => {
      const newItems = [...prevData.items];
      const itemToUpdate = { ...newItems[index], [key]: value };
      if (key === 'quantidade' || key === 'precoUnitario') {
        const qty = key === 'quantidade' ? (value as number) : itemToUpdate.quantidade;
        const price = key === 'precoUnitario' ? (value as number) : itemToUpdate.precoUnitario;
        itemToUpdate.precoTotal = parseFloat((qty * price).toFixed(2));
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
      console.error("Failed to save order mappings:", error);
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
          uploadedAt: new Date() as any,
        };
        setEditableOrder(prev => ({ ...prev, attachments: [...(prev.attachments || []), newAttachment] }));
        setStatusConfirmProps({ isOpen: true, fileName: file.name });
      } catch (error) {
        console.error("Upload failed:", error);
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
    const updatedAttachments = editableOrder.attachments.filter(att => att.url !== attachmentToDelete.url);
    setEditableOrder(prev => ({ ...prev, attachments: updatedAttachments }));
    try {
      await deleteImageByUrl(attachmentToDelete.url);
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      setEditableOrder(prev => ({ ...prev, attachments: prev.attachments.concat(attachmentToDelete) }));
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
        id={`dest-modal-${String(key)}`}
        name={String(key)}
        type="checkbox"
        checked={!!editableOrder[key]}
        onChange={(e) => handleDataChange(key, e.target.checked as any)}
        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
      />
      <label htmlFor={`dest-modal-${String(key)}`} className="ml-2 block text-sm text-slate-900">{label}</label>
    </div>
  );


  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4 animate-backdrop-fade-in" onClick={onClose}>
      <div
        className="bg-slate-50 rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col animate-modal-content-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800">Mapear Produtos para ERP: Pedido {order.pedido}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl">&times;</button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          
          <details className="bg-white rounded-lg shadow-sm" onToggle={(e) => setIsDetailsOpen((e.target as HTMLDetailsElement).open)}>
             <summary className="p-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 rounded-t-lg">
                {isDetailsOpen ? 'Ocultar Detalhes da Ordem' : 'Ver / Editar Detalhes da Ordem'}
            </summary>
            <div className="p-6 border-t border-slate-200 space-y-6">
              {/* Copied Content from OrderModal */}
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
                       <select value={editableOrder.status} onChange={(e) => handleDataChange('status', e.target.value as any)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
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
                                        <p className="text-xs text-slate-500">Enviado por: {att.uploadedBy} em {att.uploadedAt ? new Date((att.uploadedAt as any).seconds * 1000).toLocaleString('pt-BR') : '...'}</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a href={att.url} download={att.fileName} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-indigo-600 rounded-full hover:bg-indigo-100"><DownloadIcon className="w-5 h-5" /></a>
                                        <button onClick={() => handleDeleteAttachmentClick(att)} className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-red-100"><TrashIcon className="w-5 h-5" /></button>
                                    </div>
                                </div>
                                ))}
                                {Object.values(uploads).map(({ progress, fileName }, index) => (
                                <div key={index} className="flex items-center gap-4 bg-slate-200 p-2 rounded-md"><UploadProgressRing progress={progress} /><p className="text-sm text-slate-700 font-medium truncate flex-1">{fileName}</p></div>
                                ))}
                                {(!editableOrder.attachments || editableOrder.attachments.length === 0) && Object.keys(uploads).length === 0 && (<p className="text-sm text-center text-slate-500 py-4">Nenhum documento anexado.</p>)}
                            </div>
                           <div className="flex flex-col gap-4 p-4 border-2 border-dashed border-slate-300 rounded-lg justify-center items-center">
                               <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-100 rounded-md hover:bg-indigo-200"><UploadIcon className="w-5 h-5" /> Anexar Arquivo</button>
                               <input type="file" multiple ref={fileInputRef} onChange={handleFileSelected} className="hidden" accept="image/*,.pdf" />
                               <button onClick={() => setIsScannerModalOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300"><ScannerIcon className="w-5 h-5" /> Escanear</button>
                           </div>
                       </div>
                  </div>
              </div>
            </div>
          </details>
          
          <div className="overflow-x-auto bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-slate-700 mb-4">Mapeamento de Itens</h3>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-100">
                <tr>
                  <th colSpan={3} className="px-4 py-3 text-center text-sm font-semibold text-slate-800 uppercase tracking-wider border-b-2 border-slate-300">Dados do Fornecedor</th>
                  <th colSpan={3} className="px-4 py-3 text-center text-sm font-semibold text-slate-800 uppercase tracking-wider border-b-2 border-slate-300">Dados de Destino (ERP)</th>
                </tr>
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Código</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Descrição</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Un.</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Código Destino</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Descrição Destino</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Un. Destino</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {editableOrder.items.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700 font-medium">{item.codigo}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 truncate max-w-sm">{item.descricao}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-slate-700">{item.unidade}</td>
                    <td className="px-2 py-1"><input value={item.codigoDestino || ''} onChange={(e) => handleMappingItemChange(index, 'codigoDestino', e.target.value)} className="w-full text-sm bg-white px-2 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"/></td>
                    <td className="px-2 py-1"><input value={item.descricaoDestino || ''} onChange={(e) => handleMappingItemChange(index, 'descricaoDestino', e.target.value)} className="w-full text-sm bg-white px-2 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"/></td>
                    <td className="px-2 py-1"><input value={item.unidadeDestino || ''} onChange={(e) => handleMappingItemChange(index, 'unidadeDestino', e.target.value)} className="w-24 text-sm bg-white px-2 py-1.5 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end items-center p-4 border-t border-slate-200 bg-white/50 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 mr-3">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-300 flex items-center"
          >
            {isSaving ? <Spinner small /> : null}
            <span className={isSaving ? 'ml-2' : ''}>Salvar Mapeamento</span>
          </button>
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

export default DestinationsModal;