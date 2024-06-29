import { cn } from '@/lib/utils'; // Assuming you have a utility for conditional class names
import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
}

const IconButton: React.FC<IconButtonProps> = ({ icon, className, ...props }) => {
  return (
    <button
      className={cn(
        'p-2 rounded-full transition-transform duration-200 ease-in-out',
        'hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-105',
        'active:bg-gray-300 dark:active:bg-gray-600 active:scale-95',
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
};

export default IconButton;
