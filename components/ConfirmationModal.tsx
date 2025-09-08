import React from 'react';
import { WarningIcon } from '../assets/icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md transform transition-all animate-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start">
            <div className="mr-4 flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-yellow-900/50 flex items-center justify-center">
                    <WarningIcon />
                </div>
            </div>
            <div>
                <h2 className="text-xl font-bold text-white">{title}</h2>
                <p className="text-gray-400 mt-2">{message}</p>
            </div>
        </div>
        
        <div className="mt-8 flex justify-end space-x-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-2 rounded-md font-semibold text-white bg-yellow-600 hover:bg-yellow-500 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};