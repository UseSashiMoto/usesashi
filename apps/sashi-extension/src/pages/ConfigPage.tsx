import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Edit3 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useSettingStore } from '../store/use-setting.store';

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

  const handleAddConfig = () => {
    console.log('handleAddConfig', newConfig);
    console.log('newConfig', newConfig);
    setEditingConfig({ key: '', value: '', accountid: '', editable: true });
  };

  const { accountId } = useSettingStore();

  if (editingConfig) {
    console.log('showing editingConfig', editingConfig);
    return <EditConfigPage config={editingConfig} onSave={handleSaveClick} onCancel={() => setEditingConfig(null)} />;
  }

  console.log('configs', configs);

  return (
    <VStack spacing={4}>
      <VStack justifyContent={'flex-start'} alignItems={'flex-start'} textAlign={'left'}>
        <Heading>Config List</Heading>
        <Text fontSize="xs">account ID: {accountId}</Text>
      </VStack>

      {configs.map((config) => (
        <Box width={'100%'} key={config.key} bg="card" p={4} rounded="lg" shadow="md">
          <Flex justify="space-between" align="center">
            <Box>
              <Text fontWeight="bold" color="card-foreground">
                {config.key}
              </Text>
              <Text mt={1} color="card-foreground">
                {config.value}
              </Text>
            </Box>
            <Flex>
              <IconButton aria-label="Edit" onClick={() => handleEditClick(config)} icon={<Edit3 size={20} />} />
            </Flex>
          </Flex>
        </Box>
      ))}

      <Button onClick={handleAddConfig}>Add Config</Button>
    </VStack>
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
    <VStack spacing={4} p={4} bg="card" rounded="lg" shadow="md">
      <Text fontSize="xl" fontWeight="bold">
        Edit Configuration
      </Text>

      <FormControl>
        <FormLabel>Key</FormLabel>
        <Input type="text" value={key} onChange={(e) => setKey(e.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel>Value</FormLabel>
        <Input type="text" value={value} onChange={(e) => setValue(e.target.value)} />
      </FormControl>
      <HStack width={'100%'} mt={4} gap={4} spacing={8}>
        <Button onClick={handleSaveClick}>Save</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </HStack>
    </VStack>
  );
};

export default ConfigPage;
