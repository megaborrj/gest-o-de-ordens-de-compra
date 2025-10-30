import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  extractPurchaseOrderData, 
  generateOrderReferenceName,
  extractPurchaseOrderDataFromText,
  generateSummary
} from '../services/geminiService';
import type { ExtractedPurchaseOrder, PurchaseOrderItem } from '../types';
import Spinner from '../components/Spinner';
import { UploadIcon } from '../components/icons/UploadIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { CameraIcon } from '../components/icons/CameraIcon';
import CameraCapture from '../components/CameraCapture';

// Local Icon Components, formerly in SummaryTool
const ClipboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v3.043m-7.416 0v3.043c0 .212.03.418.084.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
);

const CheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

interface ExtractorPageProps {
  onSaveSuccess: (orderData: ExtractedPurchaseOrder) => Promise<void>;
}

// Define the initial empty state for the form
const initialPurchaseOrderState: ExtractedPurchaseOrder = {
  fornecedor: '', cnpj: '', operacao: '', filial: '', pedido: '', sequencia: '', data: '',
  notaFiscal: '',
  observacoes: '', emissao: '', recebimento: '', nomeReferencia: '', items: [], totalGeral: 0,
  status: 'Iniciado', isBook: false, isSite: false, isRevisaoImpostos: false,
  isCasado: false, isEstoque: false, isRemarcar: false,
  linkEntrada: '',
};

const ExtractorPage: React.FC<ExtractorPageProps> = ({ onSaveSuccess }) => {
  // State for image extraction
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [errorImage, setErrorImage] = useState<string | null>(null);

  // State for text extraction & summary
  const [inputText, setInputText] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Shared state
  const [formData, setFormData] = useState<ExtractedPurchaseOrder>(initialPurchaseOrderState);
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    return () => previews.forEach(url => URL.revokeObjectURL(url));
  }, [previews]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles]);
    setPreviews(prevPreviews => [...prevPreviews, ...acceptedFiles.map(file => URL.createObjectURL(file))]);
    setFormData(initialPurchaseOrderState);
    setErrorImage(null);
  }, []);
  
  const handleCapture = useCallback((imageFile: File) => {
      onDrop([imageFile]);
      setIsCameraOpen(false);
  }, [onDrop]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isLoadingImage || isLoadingText) return;
      if (event.clipboardData) {
        const items = event.clipboardData.items;
        let foundText = false;
        // Check for text first
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'string' && items[i].type.startsWith('text/plain')) {
            items[i].getAsString((s) => {
              if (document.activeElement?.tagName !== 'TEXTAREA') {
                setInputText(prev => prev + s);
              }
            });
            foundText = true;
          }
        }
        if (foundText) return; // Prioritize pasting text into the textarea

        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) {
              const now = new Date();
              const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
              const newFile = new File([file], `colado-${timestamp}.${file.type.split('/')[1] || 'png'}`, { type: file.type });
              imageFiles.push(newFile);
            }
          }
        }
        if (imageFiles.length > 0) onDrop(imageFiles);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onDrop, isLoadingImage, isLoadingText]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] }, multiple: true, disabled: isLoadingImage,
  });
  
  const removeFile = (indexToRemove: number) => {
    URL.revokeObjectURL(previews[indexToRemove]);
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    setPreviews(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleGeminiError = (err: unknown): string => {
    let userFriendlyError = "Ocorreu um erro. Tente novamente.";
    if (err instanceof Error) {
        try {
            const errorObj = JSON.parse(err.message);
            userFriendlyError = errorObj?.error?.message ? `Erro da API: ${errorObj.error.message}` : err.message;
        } catch (e) {
            userFriendlyError = err.message;
        }
    }
    console.error(err);
    return userFriendlyError;
  };

  const handleExtractFromImage = async () => {
    if (files.length === 0) {
        setErrorImage("Por favor, carregue uma imagem para extrair.");
        return;
    }
    setIsLoadingImage(true);
    setErrorImage(null);
    setFormData(initialPurchaseOrderState);
    try {
      const data = await extractPurchaseOrderData(files);
      setFormData(data);
    } catch (err) {
      setErrorImage(handleGeminiError(err));
    } finally {
      setIsLoadingImage(false);
    }
  };
  
  const handleProcessText = async () => {
    if (!inputText.trim()) {
      setErrorText("Por favor, insira o texto para extrair e resumir.");
      return;
    }
    setIsLoadingText(true);
    setErrorText(null);
    setSummary('');
    setFormData(initialPurchaseOrderState);
    try {
      const [summaryResult, data] = await Promise.all([
        generateSummary(inputText),
        extractPurchaseOrderDataFromText(inputText)
      ]);
      setSummary(summaryResult);
      setFormData(data);
    } catch (err) {
      setErrorText(handleGeminiError(err));
    } finally {
      setIsLoadingText(false);
    }
  };

  const handleCopySummary = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderMarkdown = (text: string) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(boldRegex, '<strong>$1</strong>').replace(linkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-500 hover:underline">$1</a>').replace(/\n/g, '<br />');
    return { __html: html };
  };
  
  const handleDataChange = <K extends keyof ExtractedPurchaseOrder>(key: K, value: ExtractedPurchaseOrder[K]) => setFormData(prev => ({ ...prev, [key]: value }));
  
  const handleItemChange = <K extends keyof PurchaseOrderItem>(index: number, key: K, value: PurchaseOrderItem[K]) => {
      setFormData(prevData => {
        const newItems = [...prevData.items];
        const itemToUpdate = { ...newItems[index], [key]: value };
        if(key === 'quantidade' || key === 'precoUnitario') {
            const qty = key === 'quantidade' ? (value as number) : itemToUpdate.quantidade;
            const price = key === 'precoUnitario' ? (value as number) : itemToUpdate.precoUnitario;
            itemToUpdate.precoTotal = parseFloat((qty * price).toFixed(2));
        }
        newItems[index] = itemToUpdate;
        const newTotalGeral = newItems.reduce((total, item) => total + (item.precoTotal || 0), 0);
        return { ...prevData, items: newItems, totalGeral: parseFloat(newTotalGeral.toFixed(2)) };
      });
  };

  const handleAddItem = () => setFormData(prev => ({ ...prev, items: [...prev.items, { codigo: '', descricao: '', unidade: '', quantidade: 0, precoUnitario: 0, precoTotal: 0 }] }));

  const handleRemoveItem = (indexToRemove: number) => {
    setFormData(prevData => {
        const newItems = prevData.items.filter((_, index) => index !== indexToRemove);
        const newTotalGeral = newItems.reduce((total, item) => total + (item.precoTotal || 0), 0);
        return { ...prevData, items: newItems, totalGeral: parseFloat(newTotalGeral.toFixed(2)) };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let finalOrderData = { ...formData };
      if (formData.items?.length > 0 && !formData.nomeReferencia) {
        try {
          finalOrderData.nomeReferencia = await generateOrderReferenceName(formData.items);
        } catch (genError) {
          console.error("Failed to generate reference name, saving without it.", genError);
        }
      }
      await onSaveSuccess(finalOrderData);
      setFiles([]); setPreviews([]); setInputText(''); setSummary('');
      setFormData(initialPurchaseOrderState);
    } catch (err) {
      setErrorImage(err instanceof Error ? err.message : "Falha ao salvar a ordem de compra.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderInputField = (label: string, value: string | number, key: keyof ExtractedPurchaseOrder, type: 'text' | 'number' = 'text') => (
      <div>
          <label className="block text-sm font-semibold text-slate-700">{label}</label>
          <input type={type} value={value || ''} onChange={(e) => handleDataChange(key, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
      </div>
  );
  
  const renderCheckbox = (label: string, key: keyof ExtractedPurchaseOrder) => (
    <div className="flex items-center">
      <input id={key as string} name={key as string} type="checkbox" checked={!!formData[key]} onChange={(e) => handleDataChange(key, e.target.checked as any)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"/>
      <label htmlFor={key as string} className="ml-2 block text-sm text-slate-900">{label}</label>
    </div>
  );
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* === LEFT COLUMN: EXTRACTION === */}
        <div className="bg-white p-6 rounded-lg shadow-lg space-y-6 self-start">
          <h2 className="text-2xl font-bold text-slate-800">1. Extrair Dados</h2>
          
           <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700">De Texto</h3>
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Cole o texto da ordem de compra aqui..." className="w-full h-40 p-3 bg-white border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" disabled={isLoadingText || isLoadingImage} />
            <div className="flex flex-wrap justify-end gap-3">
              <button onClick={handleProcessText} disabled={isLoadingText || !inputText} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-300 flex items-center">{isLoadingText && <Spinner small />}<span className={isLoadingText ? 'ml-2' : ''}>Gerar Resumo</span></button>
            </div>
            {isLoadingText && <div className="flex justify-center items-center p-4 rounded-md bg-slate-50"><Spinner /><p className="ml-4 text-slate-700">Processando texto...</p></div>}
            {errorText && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert"><strong className="font-bold">Erro: </strong><span className="block sm:inline">{errorText}</span></div>}
            {summary && (
              <div className="space-y-2 pt-4 animate-content-fade-in">
                <h4 className="text-base font-semibold text-slate-700">Resumo Gerado</h4>
                <div className="relative w-full max-h-60 p-3 bg-slate-50 border border-slate-200 rounded-lg overflow-auto">
                    <div dangerouslySetInnerHTML={renderMarkdown(summary)} className="prose prose-sm max-w-none break-words text-slate-800" />
                    <button onClick={handleCopySummary} className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors" title={copied ? "Copiado!" : "Copiar"}>
                      {copied ? (
                        <>
                          <CheckIcon className="w-4 h-4 text-green-600" />
                          <span className="font-semibold">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <ClipboardIcon className="w-4 h-4" />
                          <span className="font-semibold">Copiar</span>
                        </>
                      )}
                    </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative flex py-2 items-center"><div className="flex-grow border-t border-slate-200"></div><span className="flex-shrink mx-4 text-slate-500 font-semibold">OU</span><div className="flex-grow border-t border-slate-200"></div></div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700">De Imagem</h3>
            <div {...getRootProps()} className={`p-8 border-2 border-dashed rounded-lg text-center transition-colors ${isLoadingImage ? 'cursor-not-allowed bg-slate-50' : isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 cursor-pointer'}`}>
              <input {...getInputProps()} />
              <UploadIcon className="w-10 h-10 mx-auto text-slate-400" />
              <p className="mt-2 text-slate-700">Arraste, cole (Ctrl+V) ou clique para selecionar</p>
              <p className="text-xs text-slate-500 mt-1">PNG, JPG, WEBP</p>
            </div>
            <button onClick={() => setIsCameraOpen(true)} disabled={isLoadingImage || isLoadingText} className="w-full flex items-center justify-center py-2.5 text-base font-semibold text-slate-700 bg-slate-100 rounded-lg border border-slate-300 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"><CameraIcon className="w-5 h-5 mr-2" /> Usar Câmera</button>
            {previews.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Pré-visualização:</h3>
                <div className="grid grid-cols-3 gap-4">
                  {previews.map((preview, index) => (
                    <div key={preview} className="relative group"><img src={preview} alt={`preview ${index}`} className="w-full h-24 object-cover rounded-md" /><button onClick={() => removeFile(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4" /></button></div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={handleExtractFromImage} disabled={isLoadingImage || files.length === 0} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center">{isLoadingImage && <Spinner small />}<span className={isLoadingImage ? 'ml-2' : ''}>Preencher Formulário</span></button>
            </div>
            {isLoadingImage && <div className="flex justify-center items-center p-4 rounded-md bg-slate-50"><Spinner /><p className="ml-4 text-slate-700">Analisando imagem...</p></div>}
            {errorImage && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert"><strong className="font-bold">Erro: </strong><span className="block sm:inline">{errorImage}</span></div>}
          </div>
        </div>

        {/* === RIGHT COLUMN: FORM === */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">2. Dados da Ordem de Compra</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {renderInputField("Fornecedor", formData.fornecedor, 'fornecedor')}
              {renderInputField("CNPJ", formData.cnpj || '', 'cnpj')}
              {renderInputField("Operação", formData.operacao, 'operacao')}
              {renderInputField("Filial", formData.filial, 'filial')}
              {renderInputField("Pedido", formData.pedido, 'pedido')}
              {renderInputField("Sequência", formData.sequencia, 'sequencia')}
              {renderInputField("Nota Fiscal", formData.notaFiscal || '', 'notaFiscal')}
              {renderInputField("Data", formData.data, 'data')}
              {renderInputField("Emissão", formData.emissao, 'emissao')}
              {renderInputField("Recebimento", formData.recebimento, 'recebimento')}
          </div>
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-700">Classificação</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 mt-2 p-4 border border-slate-200 rounded-lg bg-slate-50/50">
              {renderCheckbox("Book", 'isBook')}
              {renderCheckbox("Site", 'isSite')}
              {renderCheckbox("Revisão de Impostos", 'isRevisaoImpostos')}
              {renderCheckbox("Casado", 'isCasado')}
              {renderCheckbox("Estoque", 'isEstoque')}
              {renderCheckbox("Remarcar", 'isRemarcar')}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
              {renderInputField("link do pedido", formData.observacoes, 'observacoes')}
              {renderInputField("link de entrada", formData.linkEntrada || '', 'linkEntrada')}
          </div>
          <h3 className="text-lg font-semibold mt-6 mb-4 text-slate-700">Itens do Pedido</h3>
          <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                      <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider w-1/5">Código</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider w-2/5">Descrição</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Unid.</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Qtd.</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Preço Un.</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Preço Total</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Ação</th>
                      </tr>
                  </thead>
                   <tbody className="bg-white divide-y divide-slate-200">
                       {formData.items.map((item, index) => (
                          <tr key={index}>
                              <td className="px-1 py-1"><input value={item.codigo || ''} onChange={(e) => handleItemChange(index, 'codigo', e.target.value)} className="w-full text-sm bg-slate-50 px-2 py-1 border border-slate-300 rounded-md"/></td>
                              <td className="px-1 py-1"><input value={item.descricao || ''} onChange={(e) => handleItemChange(index, 'descricao', e.target.value)} className="w-full text-sm bg-slate-50 px-2 py-1 border border-slate-300 rounded-md"/></td>
                              <td className="px-1 py-1"><input value={item.unidade || ''} onChange={(e) => handleItemChange(index, 'unidade', e.target.value)} className="w-16 text-sm bg-slate-50 px-2 py-1 border border-slate-300 rounded-md"/></td>
                              <td className="px-1 py-1"><input type="number" value={item.quantidade || ''} onChange={(e) => handleItemChange(index, 'quantidade', parseFloat(e.target.value) || 0)} className="w-24 text-sm bg-slate-50 px-2 py-1 border border-slate-300 rounded-md"/></td>
                              <td className="px-1 py-1"><input type="number" value={item.precoUnitario || ''} onChange={(e) => handleItemChange(index, 'precoUnitario', parseFloat(e.target.value) || 0)} className="w-28 text-sm bg-slate-50 px-2 py-1 border border-slate-300 rounded-md"/></td>
                              <td className="px-1 py-1"><input type="number" readOnly value={item.precoTotal || ''} className="w-28 text-sm bg-slate-100 px-2 py-1 border border-slate-300 rounded-md cursor-not-allowed"/></td>
                              <td className="px-1 py-1 text-center"><button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100"><TrashIcon className="w-5 h-5"/></button></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
          <button onClick={handleAddItem} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold">+ Adicionar Item</button>
          <div className="flex justify-end mt-4">
              <div className="text-right">
                  <label className="block text-sm font-semibold text-slate-700">Total Geral</label>
                  <input type="number" value={formData.totalGeral || ''} onChange={(e) => handleDataChange('totalGeral', parseFloat(e.target.value))} className="mt-1 w-48 text-lg font-bold text-right border-slate-300 rounded-md" />
              </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
            <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500 flex items-center">{isSaving ? <Spinner small /> : null}<span className={isSaving ? 'ml-2' : ''}>Salvar Ordem de Compra</span></button>
          </div>
        </div>
      </div>
      <CameraCapture isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />
    </div>
  );
};

export default ExtractorPage;