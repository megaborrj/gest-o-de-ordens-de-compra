import React from 'react';
import { handleSignIn } from '../services/firebase';
import { GoogleIcon } from './icons/GoogleIcon';

const LoginScreen: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-2xl text-center">
        <h1 className="text-4xl font-bold text-slate-800">
          Purchase Order AI Extractor
        </h1>
        <p className="text-slate-700">
          Faça login para começar a extrair dados de suas ordens de compra com a ajuda da IA.
        </p>
        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-transform transform hover:scale-105 duration-300"
        >
          <GoogleIcon className="w-6 h-6 mr-3" />
          Entrar com Google
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;