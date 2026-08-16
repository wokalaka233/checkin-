/**
 * 微信通知推送服务 (预留接口与 Server酱 / PushDeer / 微信Webhook 适配器)
 */

export interface PushMessagePayload {
  title: string;
  desp: string;
  url?: string;
}

export class NotificationService {
  /**
   * 发送 Server酱 微信模板消息 (通过 SendKey 精准 1对1 投递)
   * 支持国内网络直连，无需代理
   */
  static async sendServerChan(sendKey: string, payload: PushMessagePayload): Promise<boolean> {
    if (!sendKey || sendKey.trim() === '') {
      return false;
    }

    try {
      const url = `https://sctapi.ftqq.com/${encodeURIComponent(sendKey.trim())}.send`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          title: payload.title,
          desp: payload.desp + (payload.url ? `\n\n[点击查看详情](${payload.url})` : ''),
        }),
      });

      const resJson = await response.json();
      return resJson && (resJson.code === 0 || resJson.errno === 0);
    } catch (err) {
      console.error('Server酱 推送失败:', err);
      return false;
    }
  }

  /**
   * 发送打卡成功通知给项目好友
   */
  static async notifyCheckIn(userNickname: string, projectTitle: string, sendKeys: string[]) {
    const validKeys = sendKeys.filter(k => !!k && k.trim().length > 0);
    if (validKeys.length === 0) return;

    const payload: PushMessagePayload = {
      title: `✨ ${userNickname} 完成了「${projectTitle}」打卡！`,
      desp: `### 打卡动态\n- **成员**：${userNickname}\n- **打卡项目**：${projectTitle}\n- **时间**：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n大家快去打卡日历点赞围观吧！`,
    };

    await Promise.allSettled(
      validKeys.map(key => this.sendServerChan(key, payload))
    );
  }

  /**
   * 发送私聊消息微信提醒
   */
  static async notifyDirectMessage(senderNickname: string, receiverSendKey: string, messagePreview: string) {
    if (!receiverSendKey || receiverSendKey.trim() === '') return;

    const payload: PushMessagePayload = {
      title: `💬 收到来自 ${senderNickname} 的新消息`,
      desp: `**${senderNickname}**：${messagePreview}\n\n*时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*`,
    };

    await this.sendServerChan(receiverSendKey, payload);
  }
}
