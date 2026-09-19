import React, { useEffect } from 'react';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import { registerFeedbackInstances } from './utils/feedback';
import AppRouter from './router';

dayjs.locale('zh-cn');

const AppFeedbackRegistrar: React.FC = () => {
  const { message, modal, notification } = AntdApp.useApp();

  useEffect(() => {
    registerFeedbackInstances({ message, modal, notification });
  }, [message, modal, notification]);

  return null;
};

export const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#0066ff',
          colorInfo: '#0066ff',
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#ff4d4f',
          borderRadius: 6,
          wireframe: false,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            siderBg: '#001529',
          },
          Menu: {
            darkItemBg: '#001529',
            darkSubMenuItemBg: '#000c17',
          },
          Card: {
            headerHeight: 48,
          },
          Button: {
            controlHeight: 32,
            borderRadius: 4,
          },
          Table: {
            borderRadius: 6,
          },
        },
      }}
    >
      <AntdApp>
        <AppFeedbackRegistrar />
        <AppRouter />
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
