import { motion } from 'framer-motion';
import React from 'react';

interface DataCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
}

export const DataCardComponent: React.FC<DataCardProps> = ({ title, value, change, icon }) => {
  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {icon && <div className="text-3xl mr-4">{icon}</div>}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {change !== undefined && (
          <p className={`text-sm ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </p>
        )}
      </div>
    </motion.div>
  );
};