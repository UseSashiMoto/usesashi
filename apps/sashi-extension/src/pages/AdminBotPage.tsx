import { Heading, IconButton, Input, InputGroup, InputRightElement, VStack } from '@chakra-ui/react';
import { Bot, SendHorizontal, SettingsIcon, UserRound, X } from 'lucide-react';
import React, { CSSProperties } from 'react';
import Markdown from 'react-markdown';
import LoadingText from '../components/LoadingText';
import { sendMessageToBackgroundScript } from '../lib/backgroundMessaging';
import useAppStore from '../store/chat-store';
import { useSettingStore } from '../store/use-setting.store';

interface StyleMap {
  container: CSSProperties;
  main: CSSProperties;
  header: CSSProperties;
  headerName: CSSProperties;
  headerDesc: CSSProperties;
  messages: CSSProperties;
  message: CSSProperties;
  messageLastChild: CSSProperties;
  text: CSSProperties;
  textImg: CSSProperties;
  messageOddText: CSSProperties;
  chat: CSSProperties;
  tool: CSSProperties;
  input: CSSProperties;
  loader: CSSProperties;
}
const styles: StyleMap = {
  container: {
    height: '100%',
    width: '100%',
  },
  main: {
    height: '100%',
    width: '100%',
  },
  header: {
    boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px',
    backgroundColor: '#fff',
    // backgroundColor: '#a5e8',
    width: '100%',
    padding: '1rem',
    boxSizing: 'border-box',
    zIndex: 5,
  },
  headerName: {
    textTransform: 'capitalize',
    marginRight: '1rem',
  },
  headerDesc: {
    fontSize: '0.9rem',
    opacity: 0.6,
  },
  messages: {
    width: '100%',
    height: 'calc(100% - 40px)', // 120
    overflowY: 'auto',
    scrollBehavior: 'smooth',
    zIndex: 1,
  },
  message: {
    padding: '1rem 1rem 0 1rem',
    display: 'flex',
  },
  messageLastChild: {
    paddingBottom: '1rem',
  },
  text: {
    backgroundColor: '#ccf6ff',
    borderRadius: '12px',
    width: '100%',
    padding: '1rem',
    margin: 0,
    // whiteSpace: 'pre-wrap',
  },
  textImg: {
    width: '80%',
    maxWidth: '1024px',
    height: 'auto',
  },
  messageOddText: {
    backgroundColor: '#efefef',
  },
  chat: {
    // backgroundColor: 'gray',

    width: '100%',
    zIndex: 5,
    display: 'flex',
    alignItems: 'center',
    paddingTop: '10px',
  },
  tool: {
    // backgroundColor: 'aquamarine',
    width: '70px',
  },
  input: {
    backgroundColor: 'green',
    // backgroundColor: 'palevioletred',
    // margin: '1rem 1rem 3rem 1rem',
    height: '40px',
    width: '100%',
  },
  loader: {
    padding: '1rem 0',
  },
};
interface SettingPageProps {}

interface MessageItem {
  id: string;
  created_at: string;
  role: string;
  content: string;
}

function getUniqueId() {
  return Math.random().toString(36).substring(2) + new Date().getTime().toString(36);
}

const AdminBotPage: React.FC<SettingPageProps> = ({}) => {
  const { accountId, setAccountId } = useSettingStore();
  const storedMessages = useAppStore((state) => state.messages);
  const storedMode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const addMessage = useAppStore((state) => state.addMessage);
  const clearMessages = useAppStore((state) => state.clearMessages);

  const threadId = useAppStore((state) => state.threadId);
  const setThreadId = useAppStore((state) => state.setThreadId);

  const messageRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [isMounted, setMounted] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [inputText, setInputText] = React.useState('');
  const [messageItems, setMessageItems] = React.useState<MessageItem[]>([]);

  const [funcType, setFuncType] = React.useState(0);

  const [isDialogShown, setDialogShown] = React.useState(false);
  const [selFuncType, setSelFuncType] = React.useState(0);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (isMounted) {
      setFuncType(storedMode);
      setMessageItems(storedMessages);
    }
  }, [isMounted]);

  const handleDialogCancel = () => {
    setDialogShown(false);
  };

  const deleteThread = async () => {
    try {
      setLoading(true);

      const response = await fetch('/assistant/thread', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ threadId: threadId }),
      });

      if (!response.ok) {
        console.log('Oops, an error occurred', response.status);
      }

      const result = await response.json();

      console.log(result);
    } catch (error: any) {
      console.log(error.name, error.message);
    } finally {
      setLoading(false);
      setThreadId('');
    }
  };

  const handleDialogConfirm = async () => {
    await handleClearMessages();

    setMode(selFuncType);
    setFuncType(selFuncType);
    setDialogShown(false);
  };

  const submitChatCompletion = async () => {
    chrome.runtime.sendMessage({ type: 'GET_TAB_INFO' }, (response) => {
      console.log('Tab Info:', response);
    });

    setLoading(true);

    const text = inputText;

    setInputText('');
    inputRef.current?.blur();

    let previous = messageItems.map((item) => {
      return {
        role: item.role,
        content: item.content,
      };
    });

    const newUserMessage = {
      id: getUniqueId(),
      created_at: new Date().toISOString(),
      role: 'user',
      content: text,
    };
    setMessageItems((prev) => [...prev, ...[newUserMessage]]);
    addMessage(newUserMessage);

    resetScroll();

    let result_tools = [];
    let isCompleted = false;
    let MAX_LOOP_COUNT = 10; // Don't want to let it run loose
    let loopCount = 0;

    try {
      do {
        const url: string = result_tools.length > 0 ? '/chat/function' : '/chat/message';

        const payload: { tools?: any[]; inquiry?: string; previous: any; type: string } =
          result_tools.length > 0
            ? { tools: result_tools, previous, type: '/chat/function' }
            : { inquiry: text, previous, type: '/chat/message' };

        const result = await sendMessageToBackgroundScript({
          action: 'send-message',
          payload: payload,
        });

        console.log('admin-bot-response', result);

        if (result.output.content) {
          console.log(result.output.content);

          const newAssistantMessage = {
            id: getUniqueId(),
            created_at: new Date().toISOString(),
            role: 'assistant',
            content: result.output.content,
          };
          setMessageItems((prev) => [...prev, ...[newAssistantMessage]]);
          addMessage(newAssistantMessage);

          previous.push({ role: 'assistant', content: result.output.content });

          resetScroll();
        }

        if (result.output.tool_calls) {
          loopCount++;

          if (loopCount >= MAX_LOOP_COUNT) {
            isCompleted = true;
          } else {
            result_tools = result.output.tool_calls;
          }
        } else {
          isCompleted = true;
        }
      } while (!isCompleted);
    } catch (error: any) {
      console.log('admin bot error here', error.name, error.message);
    } finally {
      setLoading(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const submitAssistant = async () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      let currentTab = tabs[0];
      console.log('Current Tab URL:', currentTab.url);
      console.log('Current Tab ID:', currentTab.id);
      console.log('Current Tab Title:', currentTab.title);
    });

    setLoading(true);

    const text = inputText;

    setInputText('');
    inputRef.current?.blur();

    const message_id = getUniqueId();

    const newUserMessage = {
      id: getUniqueId(),
      created_at: new Date().toISOString(),
      role: 'user',
      content: text,
    };
    setMessageItems((prev) => [...prev, ...[newUserMessage]]);
    addMessage(newUserMessage);

    resetScroll();

    try {
      console.log('submit-assistant', threadId, text);

      const thread_id = threadId ? threadId : '';

      const response = await fetch('/assistant/message', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inquiry: text,
          threadId: thread_id,
          messageId: message_id,
        }),
      });

      if (!response.ok) {
        console.log('Oops, an error occurred', response.status);
      }

      const result = await response.json();

      console.log('assistant', result);

      setThreadId(result.threadId);

      if (result.messages.length > 0) {
        let new_messages = [];

        for (let i = 0; i < result.messages.length; i++) {
          const msg = result.messages[i];

          if (Object.prototype.hasOwnProperty.call(msg.metadata, 'id')) {
            if (msg.metadata.id === message_id) {
              break; // last message
            }
          } else {
            new_messages.push({
              id: msg.id,
              created_at: msg.created_at,
              role: msg.role,
              content: msg.content[0].text.value,
            });
          }
        }

        if (new_messages.length > 0) {
          setMessageItems((prev) => [...prev, ...new_messages]);

          for (let newmsg of new_messages) {
            addMessage(newmsg);
          }

          resetScroll();
        }
      }
    } catch (error: any) {
      console.log(error.name, error.message);
    } finally {
      setLoading(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    if (funcType > 0) {
      submitAssistant();
    } else {
      submitChatCompletion();
    }
  };

  const resetScroll = () => {
    setTimeout(() => {
      if (!messageRef.current) return;
      messageRef.current.scrollTop = (messageRef.current?.scrollHeight ?? 0) + 24;
    }, 100);
  };

  const handleClearMessages = async () => {
    if (funcType > 0 && threadId) {
      await deleteThread();
    }

    setMessageItems([]);
    clearMessages();
  };

  return (
    <VStack width={'100%'} height={'100%'} spacing={4} align="flex-start">
      <Heading>Admin Bot</Heading>

      <div style={styles.main}>
        <div ref={messageRef} style={styles.messages}>
          {messageItems.map((item) => (
            <div key={item.id} style={styles.message}>
              {item.role === 'assistant' && <Bot sx={{ mt: 1, ml: 1, mr: 2 }} />}
              {item.role === 'function' && <SettingsIcon sx={{ mt: 1, ml: 1, mr: 2 }} />}
              <div style={item.role === 'user' ? styles.text : styles.messageOddText}>
                <Markdown>{item.content}</Markdown>
              </div>
              {item.role === 'user' && <UserRound sx={{ mt: 1, ml: 2, mr: 1 }} />}
            </div>
          ))}
          {loading && (
            <div style={styles.loader}>
              <LoadingText />
            </div>
          )}
        </div>
        <div style={styles.chat}>
          <div style={styles.tool}>
            {/*        <Fab onClick={handleClearMessages} disabled={messageItems.length === 0 || loading} color="primary">
              <ResetIcon />
            </Fab> */}
          </div>

          <InputGroup>
            <Input
              size="md"
              width={'100%'}
              height={'40px'}
              variant={'outline'}
              autoFocus
              placeholder="Send message"
              isDisabled={loading}
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <InputRightElement>
              <IconButton
                aria-label="Send"
                icon={<SendHorizontal />}
                isDisabled={loading || inputText.length === 0}
                onClick={(e) => handleSubmit(e)}
                size="sm"
                ml={2}
              />
            </InputRightElement>
          </InputGroup>
          <IconButton
            icon={<X />}
            isDisabled={loading || inputText.length === 0}
            onClick={(e) => handleClearMessages()}
            aria-label={''}
          ></IconButton>
        </div>
      </div>
      {/*       {isDialogShown &&
        createPortal(
          <Dialog disabled={loading} onCancel={handleDialogCancel} onConfirm={handleDialogConfirm} />,
          document.body
        )} */}
    </VStack>
  );
};

export default AdminBotPage;
