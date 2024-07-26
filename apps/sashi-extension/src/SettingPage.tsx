// ConfigPage.tsx
import { Box, FormControl, FormHelperText, FormLabel, Input, VStack } from '@chakra-ui/react';
import React from 'react';
import { useSettingStore } from './store/use-setting.store';

interface SettingPageProps {}

const SettingPage: React.FC<SettingPageProps> = ({}) => {
  const { accountId, setAccountId } = useSettingStore();

  return (
    <VStack spacing={4} align="flex-start">
      <Box>
        <FormControl>
          <FormLabel>Account ID:</FormLabel>
          <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          <FormHelperText>Enter your account ID</FormHelperText>
        </FormControl>
      </Box>
    </VStack>
  );
};

export default SettingPage;
