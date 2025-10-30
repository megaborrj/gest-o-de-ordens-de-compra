import React from 'react';

interface ScannerInstructionsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ScannerInstructionsModal: React.FC<ScannerInstructionsModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-backdrop-fade-in">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg relative animate-modal-content-fade-in">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800">Como Escanear e Anexar</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl absolute top-2 right-4">&times;</button>
                </div>
                
                <div className="mt-4 space-y-4 text-slate-700">
                    <p>
                        Por motivos de segurança, não podemos ativar seu scanner diretamente. Siga estes passos simples:
                    </p>
                    <ol className="list-decimal list-inside space-y-3 pl-2">
                        <li>
                            <span className="font-semibold">Use o software do seu scanner:</span> Abra o programa que veio com seu scanner (geralmente encontrado no menu Iniciar ou na pasta de Aplicativos) e digitalize seu documento.
                        </li>
                        <li>
                            <span className="font-semibold">Salve o arquivo:</span> Salve a imagem digitalizada em um local de fácil acesso no seu computador, como a 'Área de Trabalho' ou a pasta 'Documentos'. Use o formato PDF, JPG ou PNG.
                        </li>
                        <li>
                            <span className="font-semibold">Anexe o arquivo aqui:</span> Feche esta janela e clique no botão <span className="font-bold text-indigo-600">"+ Anexar Imagem Escaneada"</span>.
                        </li>
                        <li>
                            <span className="font-semibold">Selecione e envie:</span> Na janela que abrir, encontre e selecione o arquivo que você acabou de salvar.
                        </li>
                    </ol>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700"
                    >
                        Entendi
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScannerInstructionsModal;
