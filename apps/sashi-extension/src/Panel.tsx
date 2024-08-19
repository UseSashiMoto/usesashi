import { Box, ChakraProvider, Flex, IconButton, Input, ThemeConfig, VStack, extendTheme } from '@chakra-ui/react';
import { Blocks, Bolt, Bot } from 'lucide-react';
import React, { ReactElement, useEffect, useState } from 'react';
import ExpButton from './components/Button';
import { APP_COLLAPSE_WIDTH, APP_EXTEND_WIDTH } from './const';
import { sendMessageToBackgroundScript } from './lib/backgroundMessaging';
import AdminBotPage from './pages/AdminBotPage';
import ConfigPage from './pages/ConfigPage';
import SettingPage from './pages/SettingPage';
import { useSettingStore } from './store/use-setting.store';

// 2. Add your color mode config
const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

// 3. extend the theme
const theme = extendTheme({
  config,
  styles: {
    global: (props: { colorMode: string }) => ({
      'html, body': {
        fontSize: 'sm',
        color: props.colorMode === 'dark' ? '' : 'gray.600',
        lineHeight: 'tall',
      },
      a: {
        color: props.colorMode === 'dark' ? 'teal.300' : 'teal.500',
      },
    }),
  },
});

interface Config {
  key: string;
  value: string;
  accountid: string;
  editable: boolean;
}

export default function Panel({
  onWidthChange,
  initialEnabled,
}: {
  onWidthChange: (value: number) => void;
  initialEnabled: boolean;
}): ReactElement {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [sidePanelWidth, setSidePanelWidth] = useState(enabled ? APP_EXTEND_WIDTH : APP_COLLAPSE_WIDTH);
  const [configs, setConfig] = useState<Config[]>([]);
  const [activePage, setActivePage] = useState('adminbot_page');
  const [validKey, setValidKey] = useState(false);

  useEffect(() => {
    if (!validKey) {
      setActivePage('setting_page');
    } else {
      setActivePage('adminbot_page');
    }
  }, [validKey]);

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

  const { accountId, accountKey, accountSignature, serverAddress } = useSettingStore();

  useEffect(() => {
    const getConfig = async () => {
      if (!validKey) return;
      try {
        const response = await sendMessageToBackgroundScript({
          action: 'get-config',
          payload: { key: accountKey, signature: accountSignature, accountId: accountId, serverAddress: serverAddress },
        });
        setConfig(response?.payload?.configs ?? []);
      } catch (e) {
        console.error('Error fetching configs:', e);
      }
    };

    getConfig();
  }, [accountSignature, accountKey, accountId, validKey]);

  useEffect(() => {
    const validateKeys = async () => {
      if (!accountSignature || !accountKey || !accountId) return;

      console.log('validateKeys', accountSignature, accountKey, accountId, serverAddress);
      const response = await sendMessageToBackgroundScript({
        action: 'validate-key',
        payload: { key: accountKey, signature: accountSignature, accountId: accountId, serverAddress: serverAddress },
      });

      console.log('response', response);

      if (response?.valid) {
        setValidKey(true);
      } else {
        setValidKey(false);
      }
    };
    validateKeys();
  }, [accountSignature, accountKey, accountId, serverAddress]);

  const getIcon = (page: string) => {
    if (page === 'adminbot_page') {
      return <Bot size={16} />;
    }
    if (page === 'config_page') {
      return <Bolt size={16} />;
    }
    return <Blocks size={16} />;
  };

  const getPages = () => {
    if (validKey) {
      return ['adminbot_page', 'config_page', 'setting_page'];
    } else {
      return ['setting_page'];
    }
  };
  return (
    <ChakraProvider disableGlobalStyle cssVarsRoot="#componentRootStart" resetCSS={false} theme={theme}>
      <Box
        maxW={`${sidePanelWidth - 5}px`}
        w={`${sidePanelWidth - 5}px`}
        boxShadow="0px 0px 5px #0000009e"
        bg="gray.600"
        pos="absolute"
        top={0}
        right={0}
        bottom={0}
        zIndex="docked"
        transition="width 0.3s ease-in-out"
        overflow="hidden"
      >
        {' '}
        <VStack
          textAlign="center"
          fontSize="xl"
          fontWeight="bold"
          color="foreground"
          w="full"
          h="full"
          justifyContent="center"
          className={!enabled ? 'opacity-0 -z-10' : ''}
        >
          <Box w="full" p={2}>
            <Input variant={'filled'} type="search" placeholder="Search..." />
          </Box>

          <Flex w="full" justify="space-around" p={1} borderBottom="1px" borderTop="1px" borderColor="gray.700">
            {getPages().map((page) => (
              <IconButton
                key={page}
                aria-label={page}
                icon={getIcon(page)}
                color={activePage === page ? 'indigo.500' : 'gray.400'}
                variant="ghost"
                size="icon"
                onClick={() => setActivePage(page)}
              />
            ))}
          </Flex>

          <Box width={'100%'} p={4} flex="1" overflowY="auto">
            {activePage === 'adminbot_page' && <AdminBotPage />}
            {activePage === 'config_page' && <ConfigPage defaultConfigs={configs} />}
            {activePage === 'setting_page' && <SettingPage />}
          </Box>
        </VStack>
        <Flex pos="absolute" bottom={0} left={0} w="50px" zIndex="overlay" justify="center" align="center" p={1}>
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
        </Flex>
      </Box>
    </ChakraProvider>
  );
}
