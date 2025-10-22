import React from 'react';

type ErrorCardProps = {
  message: string;
};
export const ErrorCard = ({ message }: ErrorCardProps) => {
  return (
    <div className="flex items-center justify-center rounded-md bg-red-50 dark:bg-red-950 py-4 border border-red-200 dark:border-red-800">
      <div className="flex flex-col justify-center">
        <p className="text-sm text-red-900 dark:text-red-200">{message}</p>
      </div>
    </div>
  );
};
