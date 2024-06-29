import { Input } from '@/components/ui/input';
import classNames from 'classnames';
import { Blocks, Bolt, Edit3, PlusCircle, Save, Trash2 } from 'lucide-react';
import React, { ReactElement, useEffect, useState } from 'react';
import ExpButton from './components/Button';
import { Button } from './components/ui/button';
import IconButton from './components/ui/iconbutton';
import { Switch } from './components/ui/switch'; // Assuming you have a Switch component
import { APP_COLLAPSE_WIDTH, APP_EXTEND_WIDTH } from './const';

interface Config {
  key: string;
  value: string;
  accountid: string;
  editable: boolean; // Add editable flag
}

export default function Panel({
  onWidthChange,
  initialEnabled,
  sashiKey,
  sashiSignature,
}: {
  onWidthChange: (value: number) => void;
  initialEnabled: boolean;
  sashiSignature: string;
  sashiKey: string;
}): ReactElement {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [sidePanelWidth, setSidePanelWidth] = useState(enabled ? APP_EXTEND_WIDTH : APP_COLLAPSE_WIDTH);
  const [configs, setConfig] = useState<Config[]>([]);

  function handleOnToggle(enabled: boolean) {
    const value = enabled ? APP_EXTEND_WIDTH : APP_COLLAPSE_WIDTH;
    setSidePanelWidth(value);
    onWidthChange(value);

    window['chrome'].storage?.local.set({ enabled });
  }

  function openPanel(force?: boolean) {
    const newValue = force || !enabled;
    setEnabled(newValue);
    handleOnToggle(newValue);
  }

  function sendMessageToBackgroundScript(message: string | Record<string, any>) {
    return new Promise<Record<string, any>>((resolve, reject) => {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        console.log('Sending message to background script:', message);
        chrome.runtime.sendMessage(message, (response: Record<string, any>) => {
          console.log;
          if (chrome.runtime.lastError) {
            console.error('Error sending message to background script:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('Response from background script:', response);
            resolve(response);
          }
        });
      } else {
        const error = new Error('chrome.runtime.sendMessage is not available');
        console.error(error);
        reject(error);
      }
    });
  }

  console.log('configs', configs);

  console.log('Configs here', configs, enabled);

  useEffect(() => {
    const getConfig = async () => {
      try {
        const response = await sendMessageToBackgroundScript({
          action: 'get-config',
          payload: { key: sashiKey, signature: sashiSignature },
        });
        console.log('config response 2', response);
        setConfig(response?.payload?.configs ?? []);
      } catch (e) {
        console.error('Error fetching configs 2:', e);
      }
    };

    getConfig();
  }, [sashiKey, sashiSignature]);
  const [activePage, setActivePage] = useState('page1');

  return (
    <div
      style={{
        width: sidePanelWidth - 5,
        boxShadow: '0px 0px 5px #0000009e',
      }}
      className="dark bg-background absolute top-0 right-0 bottom-0 z-max ease-in-out duration-300 overflow-hidden"
    >
      <div
        className={classNames(
          'text-foreground absolute w-full h-full justify-center text-xl font-bold items-center flex flex-col',
          {
            'opacity-0': !enabled,
            '-z-10': !enabled,
          }
        )}
      >
        <div className={classNames('w-full', 'p-2')}>
          <Input className="rounded-full" type="search" placeholder="Search..." />
        </div>

        <div className="w-full flex justify-around p-1 border-b border-t border-gray-700">
          {['page1', 'page2'].map((page) => {
            if (page === 'page2') {
              return (
                <Button
                  className={`${activePage === page ? 'text-indigo-500' : 'text-gray-400'}`}
                  onClick={() => setActivePage('page2')}
                  variant="ghost"
                  size="icon"
                >
                  <Bolt className="h-3 w-3" />
                </Button>
              );
            }

            if (page === 'page1') {
              return (
                <Button
                  className={`${activePage === page ? 'text-indigo-500' : 'text-gray-400'}`}
                  onClick={() => setActivePage('page1')}
                  variant="ghost"
                  size="icon"
                >
                  <Blocks className="h-3 w-3" />
                </Button>
              );
            }
            return <></>;
          })}
        </div>

        <div className="p-4 flex-1 overflow-auto">
          {activePage === 'page1' && <ConfigPage defaultConfigs={configs} />}
          {activePage === 'page2' && <Page title="Page 2" content="Content for page 2..." />}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-[50px] z-10 flex justify-center items-center p-1">
        <ExpButton active={enabled} onClick={() => openPanel()}>
          <span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={
                  enabled
                    ? 'M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25'
                    : 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15'
                }
              />
            </svg>
          </span>
        </ExpButton>
      </div>
    </div>
  );
}

function ConfigPage({ defaultConfigs }: { defaultConfigs: Config[] }) {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editedValue, setEditedValue] = useState<string>('');
  const [newConfig, setNewConfig] = useState<Config>({ key: '', value: '', accountid: '', editable: true });

  useEffect(() => setConfigs(defaultConfigs), [defaultConfigs]);

  function handleEditClick(key: string, value: string) {
    setEditingKey(key);
    setEditedValue(value);
  }

  function handleSaveClick(key: string) {
    const updatedConfigs = configs.map((config) => (config.key === key ? { ...config, value: editedValue } : config));
    setConfigs(updatedConfigs);
    setEditingKey(null);
  }

  function handleDeleteClick(key: string) {
    const updatedConfigs = configs.filter((config) => config.key !== key);
    setConfigs(updatedConfigs);
  }

  function handleToggleEditable(key: string) {
    const updatedConfigs = configs.map((config) =>
      config.key === key ? { ...config, editable: !config.editable } : config
    );
    setConfigs(updatedConfigs);
  }

  function handleAddConfig() {
    if (newConfig.key && newConfig.value) {
      setConfigs([...configs, newConfig]);
      setNewConfig({ key: '', value: '', accountid: '', editable: true });
    }
  }

  return (
    <div className="flex flex-col space-y-4">
      {configs.map((config) => (
        <div key={config.key} className="flex flex-col space-y-2 bg-card dark:bg-card p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="font-bold text-card-foreground dark:text-card-foreground">{config.key}</span>
              {editingKey === config.key ? (
                <Input
                  type="text"
                  value={editedValue}
                  onChange={(e) => setEditedValue(e.target.value)}
                  className="mt-2"
                />
              ) : (
                <span className="mt-1 text-card-foreground dark:text-card-foreground">{config.value}</span>
              )}
            </div>
            <div className="flex space-x-2 items-center">
              <Switch checked={config.editable} onChange={() => handleToggleEditable(config.key)} className="mr-2" />
              {editingKey === config.key ? (
                <IconButton onClick={() => handleSaveClick(config.key)} icon={<Save className="h-5 w-5" />} />
              ) : (
                <IconButton
                  onClick={() => handleEditClick(config.key, config.value)}
                  icon={<Edit3 className="h-5 w-5" />}
                  disabled={!config.editable}
                />
              )}
              <IconButton onClick={() => handleDeleteClick(config.key)} icon={<Trash2 className="h-5 w-5" />} />
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-col space-y-2 bg-card dark:bg-card p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <Input
              type="text"
              value={newConfig.key}
              onChange={(e) => setNewConfig({ ...newConfig, key: e.target.value })}
              placeholder="Key"
              className="mt-2 bg-background text-foreground border-0 rounded-lg"
            />
            <Input
              type="text"
              value={newConfig.value}
              onChange={(e) => setNewConfig({ ...newConfig, value: e.target.value })}
              placeholder="Value"
              className="mt-2 bg-background text-foreground border-0 rounded-lg"
            />
          </div>
          <div className="flex space-x-2 items-center">
            <IconButton onClick={handleAddConfig} icon={<PlusCircle className="h-6 w-6 text-indigo-500" />} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Page({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p>{content}</p>
    </div>
  );
}
