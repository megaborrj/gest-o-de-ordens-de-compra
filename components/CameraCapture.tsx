import React, { useRef, useEffect, useState } from 'react';
import Spinner from './Spinner';

interface CameraCaptureProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const startCamera = async () => {
            try {
                setError(null);
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' } // Prefer rear camera
                });
                if (isMounted) {
                    setStream(mediaStream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = mediaStream;
                    }
                } else {
                     mediaStream.getTracks().forEach(track => track.stop());
                }
            } catch (err) {
                if (isMounted) {
                    console.error("Error accessing camera:", err);
                    let errorMessage = "Não foi possível acessar a câmera. Verifique as permissões do seu navegador.";
                    if (err instanceof Error && err.name === "NotAllowedError") {
                        errorMessage = "A permissão para usar a câmera foi negada. Você precisa permitir o acesso nas configurações do seu navegador.";
                    }
                    setError(errorMessage);
                }
            }
        };
        
        const stopCamera = () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
        };

        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
        }

        return () => {
            isMounted = false;
            stopCamera();
        };
    }, [isOpen]);

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsCapturing(true);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    const now = new Date();
                    const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
                    const imageFile = new File([blob], `captura-${timestamp}.jpg`, { type: 'image/jpeg' });
                    onCapture(imageFile);
                }
                setIsCapturing(false);
            }, 'image/jpeg', 0.95);
        } else {
            setIsCapturing(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex flex-col justify-center items-center p-4 animate-backdrop-fade-in">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl animate-modal-content-fade-in relative flex flex-col max-h-[90vh]">
                <div className="p-4 border-b flex-shrink-0">
                    <h3 className="text-lg font-bold text-slate-800">Capturar Imagem</h3>
                    <button onClick={onClose} disabled={isCapturing} className="text-slate-500 hover:text-slate-800 text-3xl absolute top-2 right-4">&times;</button>
                </div>

                <div className="p-4 bg-black flex-grow overflow-hidden flex justify-center items-center">
                    {error ? (
                        <div className="h-full flex items-center justify-center text-center text-white bg-slate-800 rounded-md p-4">
                            {error}
                        </div>
                    ) : stream ? (
                        <video ref={videoRef} autoPlay playsInline className="w-full h-auto max-h-full rounded-md" />
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <Spinner />
                        </div>
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="p-4 border-t flex justify-center flex-shrink-0">
                    <button
                        onClick={handleCapture}
                        disabled={!stream || isCapturing}
                        className="p-4 bg-blue-600 rounded-full text-white shadow-lg hover:bg-blue-700 disabled:bg-slate-500 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all"
                        aria-label="Tirar foto"
                    >
                        {isCapturing ? <Spinner small /> : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CameraCapture;