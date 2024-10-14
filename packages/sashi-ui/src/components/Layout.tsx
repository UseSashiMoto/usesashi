import { FunctionSwitch } from '@/models/function-switch';
import { RepoMetadata } from '@/store/models';
import { DashboardIcon, GitHubLogoIcon } from '@radix-ui/react-icons';
import * as Toast from '@radix-ui/react-toast';
import { ChevronDown, ChevronUp, GitBranchIcon } from 'lucide-react';
import { useEffect, useState, type FC, type PropsWithChildren } from 'react';
import { Button } from './Button';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

// Add this new component
export function ReposDropdown({ repos }: { repos: { id: string; name: string; url: string }[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger className="mb-4" asChild>
        <Button variant="ghost" className="w-full justify-between" aria-expanded={isOpen}>
          Connected Repositories
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="h-[300px] w-full rounded-md border p-4">
          <>
            {repos.length === 0 && <p className="text-sm text-slate-500">No repositories connected</p>}
            <ul className="space-y-2">
              {repos.map((repo) => (
                <li key={repo.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <GitBranchIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">{repo.name}</span>
                  </div>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          </>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FunctionsDropdown({
  functions,
  onFunctionSwitch,
}: {
  functions: FunctionSwitch[];
  onFunctionSwitch: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [bots, setBots] = useState<FunctionSwitch[]>([]);

  const toggleBot = (id: string) => {
    setBots((prevBots) => prevBots.map((bot) => (bot.id === id ? { ...bot, isActive: !bot.isActive } : bot)));
    onFunctionSwitch(id);
  };

  useEffect(() => {
    setBots(functions);
  }, [functions]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger className="mb-4" asChild>
        <Button variant="ghost" className="w-full justify-between" aria-expanded={isOpen}>
          Functions Running
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="h-[300px] w-full rounded-md border p-4">
          <>
            {bots.length === 0 && <p className="text-sm text-slate-500">No functions running</p>}
            <ul className="space-y-2">
              {bots.map((bot) => (
                <li key={bot.id} className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm font-medium cursor-help">{bot.name}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{bot.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      size="sm"
                      variant={bot.isActive ? 'default' : 'outline'}
                      className={`w-12 h-6 ${
                        bot.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                      }`}
                      onClick={() => toggleBot(bot.id)}
                    >
                      <span className="sr-only">
                        {bot.isActive ? 'Deactivate' : 'Activate'} {bot.name}
                      </span>
                      {bot.isActive ? 'On' : 'Off'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{bot.description}</p>
                </li>
              ))}
            </ul>
          </>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const Layout: FC<
  {
    connectedToHub: boolean;
    functions: FunctionSwitch[];
    repos: RepoMetadata[];
    onFunctionSwitch: (id: string) => void;
  } & PropsWithChildren
> = ({ children, functions, repos, onFunctionSwitch, connectedToHub }) => {
  return (
    <Toast.Provider swipeDirection="right">
      <div className="grid xl:grid-cols-[auto,1fr]">
        <div className="hidden w-64 xl:block">
          <div className="sticky top-0 isolate flex h-full max-h-screen min-h-screen flex-col justify-between overflow-hidden border-r border-brand-50 px-4 pt-8 pb-4 shadow-sm dark:border-slate-700 dark:bg-black">
            <svg
              viewBox="0 0 1108 632"
              aria-hidden="true"
              className="absolute top-10 left-[calc(50%-24rem)] -z-10 w-[69.25rem] max-w-none rotate-90 transform-gpu opacity-50 blur-3xl lg:top-[calc(50%-30rem)]"
            >
              <path
                fill="url(#175c433f-44f6-4d59-93f0-c5c51ad5566d)"
                fillOpacity=".2"
                d="M235.233 402.609 57.541 321.573.83 631.05l234.404-228.441 320.018 145.945c-65.036-115.261-134.286-322.756 109.01-230.655C968.382 433.026 1031 651.247 1092.23 459.36c48.98-153.51-34.51-321.107-82.37-385.717L810.952 324.222 648.261.088 235.233 402.609Z"
              />
              <defs>
                <linearGradient
                  id="175c433f-44f6-4d59-93f0-c5c51ad5566d"
                  x1="1220.59"
                  x2="-85.053"
                  y1="432.766"
                  y2="638.714"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#bbebff" />
                  <stop offset={1} stopColor="#ffffff" />
                </linearGradient>
              </defs>
            </svg>
            <div className="space-y-8">
              <div className="flex items-center space-x-2 text-slate-900 dark:text-brand-50">
                <p className="text-lg font-semibold">Sashi</p>
              </div>

              <div className="w-full space-y-4">
                <DashboardIcon className="mb-0.5" height={16} width={16} />
                <div className="flex items-center space-x-2 mb-4">
                  <span className="text-sm font-medium">Hub Status:</span>
                  <div
                    className={`w-3 h-3 rounded-full ${connectedToHub ? 'bg-green-500' : 'bg-red-500'} shadow-lg ${
                      connectedToHub ? 'animate-pulse-green' : 'animate-pulse-red'
                    }`}
                  ></div>
                  <span className={`text-sm ${connectedToHub ? 'text-green-500' : 'text-red-500'}`}>
                    {connectedToHub ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {/*<ReposDropdown repos={repos} /> */}
                <FunctionsDropdown onFunctionSwitch={onFunctionSwitch} functions={functions} />
                <div className="h-px w-full bg-slate-100 dark:bg-slate-700" />
                <div className="w-full space-y-1"></div>
              </div>
            </div>

            <div className="flex w-full items-center justify-between">
              <a
                href="https://github.com/radzell/sashi"
                target="_blank"
                rel="noreferrer"
                className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-900 shadow-sm transition duration-150 ease-in-out hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-600 dark:text-slate-50 dark:hover:bg-slate-500"
              >
                <GitHubLogoIcon />
              </a>

              <ThemeSwitcher />
            </div>
          </div>
        </div>

        <div className="bg-white px-4 py-3 dark:bg-[#121212] lg:px-10 lg:py-8">
          <div className="max-w-[1280px]">{children}</div>
        </div>
      </div>
      <Toast.Viewport className="fixed bottom-0 right-0 z-[2147483647] m-0 flex max-w-[100vw] list-none flex-col gap-2 p-6 outline-none" />
    </Toast.Provider>
  );
};
