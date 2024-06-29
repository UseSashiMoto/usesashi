import { Input } from '@/components/ui/input';
import { Edit3, Save, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import Button from './components/Button';
import IconButton from './components/ui/iconbutton';

interface Config {
  key: string;
  value: string;
  accountid: string;
  editable: boolean;
}

interface ConfigPageProps {
  defaultConfigs: Config[];
}

const ConfigPage: React.FC<ConfigPageProps> = ({ defaultConfigs }) => {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [editingConfig, setEditingConfig] = useState<Config | null>(null);
  const [newConfig, setNewConfig] = useState<Config>({ key: '', value: '', accountid: '', editable: true });

  useEffect(() => {
    setConfigs(defaultConfigs);
  }, [defaultConfigs]);

  const handleEditClick = (config: Config) => {
    console.log('handleEditClick', config);
    setEditingConfig(config);
  };

  const handleSaveClick = (updatedConfig: Config) => {
    const updatedConfigs = configs.map((config) => (config.key === updatedConfig.key ? updatedConfig : config));
    setConfigs(updatedConfigs);
    setEditingConfig(null);
  };

  const handleDeleteClick = (key: string) => {
    const updatedConfigs = configs.filter((config) => config.key !== key);
    setConfigs(updatedConfigs);
  };

  const handleToggleEditable = (key: string) => {
    const updatedConfigs = configs.map((config) =>
      config.key === key ? { ...config, editable: !config.editable } : config
    );
    setConfigs(updatedConfigs);
  };

  const handleAddConfig = () => {
    if (newConfig.key && newConfig.value) {
      setConfigs([...configs, newConfig]);
      setNewConfig({ key: '', value: '', accountid: '', editable: true });
    }
  };

  if (editingConfig) {
    console.log('showing editingConfig', editingConfig);
    return <EditConfigPage config={editingConfig} onSave={handleSaveClick} onCancel={() => setEditingConfig(null)} />;
  }

  return (
    <div className="flex flex-col space-y-4">
      {configs.map((config) => (
        <div key={config.key} className="bg-card dark:bg-card p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="font-bold text-card-foreground dark:text-card-foreground">{config.key}</span>
              <span className="mt-1 text-card-foreground dark:text-card-foreground">{config.value}</span>
            </div>
            <div className="flex space-x-2 items-center">
              <IconButton onClick={() => handleEditClick(config)} icon={<Edit3 className="h-5 w-5" />} />
            </div>
          </div>
        </div>
      ))}

      <Button onClick={handleAddConfig}>Add Config</Button>
    </div>
  );
};

interface EditConfigPageProps {
  config: Config;
  onSave: (config: Config) => void;
  onCancel: () => void;
}

const EditConfigPage: React.FC<EditConfigPageProps> = ({ config, onSave, onCancel }) => {
  const [key, setKey] = useState(config.key);
  const [value, setValue] = useState(config.value);

  const handleSaveClick = () => {
    onSave({ ...config, key, value });
  };

  return (
    <div className="flex flex-col space-y-4 p-4 bg-card dark:bg-card rounded-lg shadow-md">
      <h2 className="text-xl font-bold">Edit Configuration</h2>
      <Input
        type="text"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Key"
        className="bg-background text-foreground border-0 rounded-lg"
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Value"
        className="bg-background text-foreground border-0 rounded-lg"
      />
      <div className="flex space-x-2 items-center mt-4">
        <IconButton onClick={handleSaveClick} icon={<Save className="h-6 w-6 text-indigo-500" />} />
        <IconButton onClick={onCancel} icon={<Trash2 className="h-6 w-6 text-red-500" />} />
      </div>
    </div>
  );
};

export default ConfigPage;
