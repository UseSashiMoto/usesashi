// ConfigPage.tsx
import { FormControl, FormHelperText, FormLabel, Heading, Input, VStack } from '@chakra-ui/react';
import React from 'react';
import { useSettingStore } from '../store/use-setting.store';

interface SettingPageProps {}

const SettingPage: React.FC<SettingPageProps> = ({}) => {
  const {
    accountId,
    setAccountId,
    accountKey,
    setAccountKey,
    accountSignature,
    setAccountSignature,
    serverAddress,
    setServerAddress,
  } = useSettingStore();

  return (
    <VStack width={'100%'} spacing={4} align="flex-start">
      <Heading>Setup</Heading>
      <FormControl>
        <FormLabel>Account ID:</FormLabel>
        <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} />
        <FormHelperText>Enter your account ID</FormHelperText>
      </FormControl>
      <FormControl>
        <FormLabel>Server Address</FormLabel>
        <Input value={serverAddress} onChange={(e) => setServerAddress(e.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel>Account Key:</FormLabel>
        <Input value={accountKey} onChange={(e) => setAccountKey(e.target.value)} />
      </FormControl>
      <FormControl>
        <FormLabel>Account Signature:</FormLabel>
        <Input value={accountSignature} onChange={(e) => setAccountSignature(e.target.value)} />
      </FormControl>
    </VStack>
  );
};

export default SettingPage;
