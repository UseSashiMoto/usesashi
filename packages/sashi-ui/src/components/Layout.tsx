import { FunctionSwitch } from '@/models/function-switch';
import useAppStore from '@/store/chat-store';
import { Metadata } from '@/store/models';
import { HEADER_SESSION_TOKEN } from '@/utils/contants';
import { WorkflowStorage } from '@/utils/workflowStorage';
import { DashboardIcon, GearIcon, GitHubLogoIcon } from '@radix-ui/react-icons';
import * as Toast from '@radix-ui/react-toast';
import axios from 'axios';
import { ChevronDown, ChevronUp, History, HomeIcon, MessageSquare } from 'lucide-react';
import React, { useEffect, useMemo, useState, type FC, type PropsWithChildren } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './Button';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

export function FunctionsDropdown({
  functions: accessible_functions,
  onFunctionSwitch,
}: {
  functions: FunctionSwitch[];
  onFunctionSwitch: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [functions, setFunctions] = useState<FunctionSwitch[]>([]);

  const toggleBot = (id: string) => {
    setFunctions((prevBots) => prevBots.map((bot) => (bot.id === id ? { ...bot, isActive: !bot.isActive } : bot)));
    onFunctionSwitch(id);
  };

  useEffect(() => {
    setFunctions(accessible_functions);
  }, [accessible_functions]);

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
            {accessible_functions.length === 0 && <p className="text-sm text-slate-500">No functions running</p>}
            <ul className="space-y-2">
              {accessible_functions.map((bot) => (
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

export const Layout: FC<{} & PropsWithChildren> = ({ children }) => {
  const setMetadata = useAppStore((state: { setMetadata: any }) => state.setMetadata);
  const sessionToken = useAppStore((state) => state.sessionToken);
  const apiUrl = useAppStore((state) => state.apiUrl);
  const metadata: Metadata | undefined = useAppStore((state: { metadata: any }) => state.metadata);
  const connectedToHub: boolean = useAppStore((state: { connectedToHub: any }) => state.connectedToHub);
  const location = useLocation();
  const setConnectedToHub = useAppStore((state: { setConnectedToHub: any }) => state.setConnectedToHub);

  const setHubUrl = useAppStore((state) => state.setHubUrl);
  const hubUrl = useAppStore((state) => state.hubUrl);
  const functions: FunctionSwitch[] = useMemo<FunctionSwitch[]>(() => {
    return (metadata?.functions.map((func) => ({
      id: func.name,
      name: func.name,
      description: func.description,
      isActive: func.active,
      repo: '',
    })) ?? []) satisfies FunctionSwitch[];
  }, [metadata]);

  useEffect(() => {
    if (metadata && metadata.hubUrl && !hubUrl) {
      setHubUrl(metadata.hubUrl);
    }
  }, [metadata]);

  useEffect(() => {
    const checkConnectedToHub = async () => {
      try {
        console.log('checking hub connection', apiUrl, sessionToken);
        const response = await fetch(`${apiUrl}/check_hub_connection`, {
          method: 'GET',
          headers: {
            [HEADER_SESSION_TOKEN]: sessionToken ?? '',
          },
        });
        const data = await response.json();
        console.log('hub connection data', data);
        setConnectedToHub(data.connected);
      } catch (error) {
        console.error('Error checking hub connection', error);
        setConnectedToHub(false);
      }
    };
    checkConnectedToHub();
  }, [apiUrl, sessionToken]);

  const getMetadata = async () => {
    try {
      const response = await axios.get(`${apiUrl}/metadata`, {
        headers: {
          [HEADER_SESSION_TOKEN]: sessionToken,
        },
      });

      setMetadata(response.data);
    } catch (e) {
      console.error('Error getting metadata', e);
    }
  };
  useEffect(() => {
    getMetadata();
  }, [apiUrl, sessionToken]);

  const onFunctionSwitch = (id: string) => {
    axios.get(`${apiUrl}/functions/${id}/toggle_active`).then(() => {
      getMetadata();
    });
  };

  const storage = new WorkflowStorage({
    serverUrl: apiUrl,
  });

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
                <div className="h-px w-full bg-slate-100 dark:bg-slate-700" />
                <div className="w-full space-y-1"></div>
                <div className="w-full space-y-1">
                  <Link
                    to="/"
                    className="flex items-center space-x-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100 dark:text-slate-50 dark:hover:bg-slate-800"
                  >
                    <MessageSquare className="h-5 w-5" />
                    <span className="text-sm font-medium">Chat</span>
                  </Link>

                  <Link
                    to="/dashboard"
                    className="flex items-center space-x-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100 dark:text-slate-50 dark:hover:bg-slate-800"
                  >
                    <DashboardIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">Dashboard</span>
                  </Link>

                  <Link
                    to="/audit-logs"
                    className="flex items-center space-x-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100 dark:text-slate-50 dark:hover:bg-slate-800"
                  >
                    <History className="h-5 w-5" />
                    <span className="text-sm font-medium">Audit Logs</span>
                  </Link>

                  <Link
                    to="/setting"
                    className="flex items-center space-x-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100 dark:text-slate-50 dark:hover:bg-slate-800"
                  >
                    <GearIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">Settings</span>
                  </Link>
                </div>
                <FunctionsDropdown onFunctionSwitch={onFunctionSwitch} functions={functions} />
                <div className="h-px w-full bg-slate-100 dark:bg-slate-700" />
                <div className="w-full space-y-1"></div>
              </div>
            </div>

            <div className="flex w-full items-center justify-between">
              <div className="flex flex-row space-x-2">
                <Link
                  to="/"
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-900 shadow-sm transition duration-150 ease-in-out hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-600 dark:text-slate-50 dark:hover:bg-slate-500"
                >
                  <HomeIcon style={{ width: '12px', height: '12px' }} />
                </Link>
                {location.pathname === '/dashboard' ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-200 text-slate-900 shadow-sm dark:bg-slate-500 dark:text-slate-50">
                    <DashboardIcon />
                  </span>
                ) : (
                  <Link
                    to="/dashboard"
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-900 shadow-sm transition duration-150 ease-in-out hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-600 dark:text-slate-50 dark:hover:bg-slate-500"
                  >
                    <DashboardIcon />
                  </Link>
                )}
                <a
                  href="https://github.com/radzell/sashi"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-900 shadow-sm transition duration-150 ease-in-out hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-600 dark:text-slate-50 dark:hover:bg-slate-500"
                >
                  <GitHubLogoIcon />
                </a>
                {location.pathname === '/setting' ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-200 text-slate-900 shadow-sm dark:bg-slate-500 dark:text-slate-50">
                    <GearIcon />
                  </span>
                ) : (
                  <Link
                    to="setting"
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-900 shadow-sm transition duration-150 ease-in-out hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-600 dark:text-slate-50 dark:hover:bg-slate-500"
                  >
                    <GearIcon />
                  </Link>
                )}
                {location.pathname === '/audit-logs' ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-200 text-slate-900 shadow-sm dark:bg-slate-500 dark:text-slate-50">
                    <History className="h-4 w-4" />
                  </span>
                ) : (
                  <Link
                    to="/audit-logs"
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-900 shadow-sm transition duration-150 ease-in-out hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-600 dark:text-slate-50 dark:hover:bg-slate-500"
                  >
                    <History className="h-4 w-4" />
                  </Link>
                )}
              </div>

              <ThemeSwitcher />
            </div>
          </div>
        </div>

        <div className="bg-white  dark:bg-[#121212]">
          <div className="max-w-[1280px]">{children}</div>
        </div>
      </div>
      <Toast.Viewport className="fixed bottom-0 right-0 z-[2147483647] m-0 flex max-w-[100vw] list-none flex-col gap-2 p-6 outline-none" />
    </Toast.Provider>
  );
};
