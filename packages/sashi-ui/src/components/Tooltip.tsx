import * as TooltipRadix from '@radix-ui/react-tooltip';
import type { PropsWithChildren } from 'react';
import React from 'react';

type TooltipProps = {
  message: string;
};

export const Tooltip = ({ children, message }: PropsWithChildren<TooltipProps>) => {
  return (
    <TooltipRadix.Provider>
      <TooltipRadix.Root>
        <TooltipRadix.Trigger asChild>{children}</TooltipRadix.Trigger>
        <TooltipRadix.Portal>
          <TooltipRadix.Content
            className="rounded-md bg-white dark:bg-gray-800 py-1 px-2 text-sm text-slate-900 dark:text-slate-100 shadow-md border border-gray-200 dark:border-gray-700"
            sideOffset={6}
          >
            {message}
            <TooltipRadix.Arrow className="fill-white dark:fill-gray-800" />
          </TooltipRadix.Content>
        </TooltipRadix.Portal>
      </TooltipRadix.Root>
    </TooltipRadix.Provider>
  );
};
