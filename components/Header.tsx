import React from 'react';
import { Sparkles, ShoppingBag } from 'lucide-react';
import { AppView } from '../types';

interface HeaderProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  catalogCount: number;
  cartCount: number;
  onToggleCart: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onViewChange, catalogCount, cartCount, onToggleCart }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => onViewChange('STUDIO')}
          >
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-2 rounded-lg text-white">
              <Sparkles size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900 hidden sm:inline">
              Maria Rosa <span className="text-purple-600">Confecções</span>
            </span>
             <span className="font-bold text-xl tracking-tight text-gray-900 sm:hidden">
              Maria Rosa
            </span>
            <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-600 border border-purple-200">
              BETA
            </span>
          </div>
          
          <nav className="flex space-x-1 sm:space-x-4 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => onViewChange('STUDIO')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                currentView === 'STUDIO' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Studio
            </button>
            <button 
              onClick={() => onViewChange('CATALOG')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                currentView === 'CATALOG' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Catalog
              {catalogCount > 0 && (
                <span className="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full text-[10px]">
                  {catalogCount}
                </span>
              )}
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={onToggleCart}
              className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="Open Trolley"
            >
              <ShoppingBag size={22} />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 h-5 w-5 bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                  {cartCount}
                </span>
              )}
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
              MR
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};