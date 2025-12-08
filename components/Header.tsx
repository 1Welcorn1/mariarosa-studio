import React from 'react';
import { Sparkles, ShoppingBag } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-2 rounded-lg text-white">
              <Sparkles size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">
              Maria Rosa <span className="text-purple-600">AI Studio</span>
            </span>
            <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-600 border border-purple-200">
              BETA
            </span>
          </div>
          
          <nav className="hidden md:flex space-x-8">
            <a href="#" className="text-gray-500 hover:text-gray-900 font-medium transition-colors">Studio</a>
            <a href="#" className="text-gray-500 hover:text-gray-900 font-medium transition-colors">Catalog</a>
            <a href="#" className="text-gray-500 hover:text-gray-900 font-medium transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-400 hover:text-gray-500">
              <ShoppingBag size={20} />
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
