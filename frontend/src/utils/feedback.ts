import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';
import type { NotificationInstance } from 'antd/es/notification/interface';

let messageInstance: MessageInstance | null = null;
let modalInstance: Omit<ModalStaticFunctions, 'warn'> | null = null;
let notificationInstance: NotificationInstance | null = null;

export const registerFeedbackInstances = (instances: {
  message: MessageInstance;
  modal: Omit<ModalStaticFunctions, 'warn'>;
  notification: NotificationInstance;
}) => {
  messageInstance = instances.message;
  modalInstance = instances.modal;
  notificationInstance = instances.notification;
};

export const feedback = {
  get message(): MessageInstance {
    if (!messageInstance) {
      console.warn('[feedback] messageInstance not registered yet. Falling back to console.');
      return {
        open: console.log,
        success: console.log,
        error: console.error,
        info: console.info,
        warning: console.warn,
        loading: console.log,
        destroy: () => {},
      } as unknown as MessageInstance;
    }
    return messageInstance;
  },
  get modal() {
    return modalInstance;
  },
  get notification(): NotificationInstance {
    return notificationInstance!;
  },
};
