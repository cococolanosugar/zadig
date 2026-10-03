import http from './client';

export interface NotificationItem {
  id: string;
  type: number; // 1: 公告, 2: 流水线状态, 3: 系统消息, 4: 工作流任务状态
  receiver?: string;
  content: {
    // Type 2 / 4 Pipeline / Workflow Task
    task_id?: number;
    product_name?: string;
    pipeline_name?: string;
    workflow_name?: string;
    workflow_display_name?: string;
    type?: string;
    status?: string;
    executor?: string;
    // Type 3 Message
    title?: string;
    content?: string;
    req_id?: string;
    // Type 1 Announcement
    priority?: number;
  };
  create_time?: number;
  is_read?: boolean;
}

export const notificationApi = {
  /**
   * 拉取当前用户的系统通知列表
   * GET /api/aslan/system/notification
   */
  async getNotifications(): Promise<NotificationItem[]> {
    try {
      const res = await http.get<NotificationItem[]>('/api/aslan/system/notification', {
        skipErrorHandler: true,
      });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  /**
   * 标记通知为已读
   * PUT /api/aslan/system/notification/read
   * body: { ids: string[] }
   */
  async markAsRead(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    await http.put('/api/aslan/system/notification/read', { ids }, { skipErrorHandler: true });
  },

  /**
   * 删除系统通知
   * POST /api/aslan/system/notification/delete
   * body: { ids: string[] }
   */
  async deleteNotifications(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    await http.post('/api/aslan/system/notification/delete', { ids }, { skipErrorHandler: true });
  },

  /**
   * 获取当前用户的通知订阅列表
   * GET /api/aslan/system/notification/subscribe
   */
  async listSubscriptions(): Promise<SubscriptionItem[]> {
    try {
      const res = await http.get<SubscriptionItem[]>('/api/aslan/system/notification/subscribe', {
        skipErrorHandler: true,
      });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  /**
   * 订阅或更新通知类型
   * POST /api/aslan/system/notification/subscribe
   */
  async upsertSubscription(payload: UpsertSubscriptionArgs): Promise<void> {
    await http.post('/api/aslan/system/notification/subscribe', payload);
  },

  /**
   * 更新某种类型的订阅配置
   * PUT /api/aslan/system/notification/subscribe/:type
   */
  async updateSubscription(type: number, payload: { pipelinestatus?: string }): Promise<void> {
    await http.put(`/api/aslan/system/notification/subscribe/${type}`, payload);
  },

  /**
   * 取消某种通知类型的订阅
   * DELETE /api/aslan/system/notification/unsubscribe/notifytype/:type
   */
  async unsubscribe(type: number): Promise<void> {
    await http.delete(`/api/aslan/system/notification/unsubscribe/notifytype/${type}`);
  },
};

export interface SubscriptionItem {
  subscriber?: string;
  type: number; // 1: 公告, 2: 流水线状态, 3: 系统消息, 4: 工作流任务状态
  create_time?: number;
  pipelinestatus?: string;
}

export interface UpsertSubscriptionArgs {
  type: number;
  pipelinestatus?: string;
}

export default notificationApi;
