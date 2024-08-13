// ConfigPage.tsx
import { FormControl, FormHelperText, FormLabel, Heading, Input, VStack } from '@chakra-ui/react';
import React from 'react';
import { useSettingStore } from '../store/use-setting.store';

interface SettingPageProps {}

const SettingPage: React.FC<SettingPageProps> = ({}) => {
  const { accountId, setAccountId } = useSettingStore();

  return (
    <VStack width={'100%'} spacing={4} align="flex-start">
      <Heading>Settings</Heading>
      <FormControl>
        <FormLabel>Account ID:</FormLabel>
        <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} />
        <FormHelperText>Enter your account ID</FormHelperText>
      </FormControl>
    </VStack>
  );
};

export default SettingPage;
