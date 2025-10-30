import React from 'react';
import { handleSignOut } from '../services/firebase';
import { LogoutIcon } from './icons/LogoutIcon';
import type { User } from '../types';
import type { Page } from '../types';

interface HeaderProps {
  user: User;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

const NavButton: React.FC<{
    page: Page;
    currentPage: Page;
    setCurrentPage: (page: Page) => void;
    children: React.ReactNode;
}> = ({ page, currentPage, setCurrentPage, children }) => {
    const isActive = currentPage === page;
    const activeClasses = 'bg-indigo-600 text-white shadow-md';
    const inactiveClasses = 'text-slate-700 hover:bg-slate-200 hover:text-slate-800';
    return (
        <button
            onClick={() => setCurrentPage(page)}
            className={`px-4 py-2 rounded-md font-semibold transition-colors duration-200 ${isActive ? activeClasses : inactiveClasses}`}
        >
            {children}
        </button>
    );
};


const Header: React.FC<HeaderProps> = ({ user, currentPage, setCurrentPage }) => {
  return (
    <header className="bg-white shadow-md p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
      <div className="flex items-center gap-4">
        <img src="https://pages.megaborrj.com.br/wp-content/uploads/2025/10/megabor.png" alt="Megabor Logo" className="h-10" />
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Sistema de Gestão de Entradas</h1>
      </div>

      <nav className="flex items-center gap-2 sm:gap-4 bg-slate-100 p-1 rounded-lg">
          <NavButton page="extractor" currentPage={currentPage} setCurrentPage={setCurrentPage}>Extrator</NavButton>
          <NavButton page="orders" currentPage={currentPage} setCurrentPage={setCurrentPage}>Ordens</NavButton>
          <NavButton page="overview" currentPage={currentPage} setCurrentPage={setCurrentPage}>Visão Geral</NavButton>
          <NavButton page="destinations" currentPage={currentPage} setCurrentPage={setCurrentPage}>Destinos</NavButton>
      </nav>

      <div className="flex items-center gap-4">
        <span className="text-slate-700 hidden sm:block">Olá, {user.displayName || user.email}</span>
        <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-slate-700 hover:text-indigo-600 transition-colors">
          <LogoutIcon className="w-5 h-5" /> Sair
        </button>
      </div>
    </header>
  );
};

export default Header;