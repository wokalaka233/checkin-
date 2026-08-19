import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  User,
  QrCode,
  Bell,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Send,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();

  const [sendKey, setSendKey] = useState(user?.serverchanSendKey || '');
  const [isSaving, setIsSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testMessage, setTestMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [showManualKey, setShowManualKey] = useState(false);

  useEffect(() => {
    if (user?.serverchanSendKey) {
      setSendKey(user.serverchanSendKey);
    }
  }, [user?.serverchanSendKey]);

  const isBound = Boolean(user?.serverchanSendKey && user.serverchanSendKey.trim().length > 0);

  // Save SendKey
  const handleSaveSendKey = async (keyToSave: string) => {
    setIsSaving(true);
    setTestMessage(null);
    try {
      await api.updateSendKey(keyToSave);
      await refreshUser();
      setShowManualKey(false);
    } catch (err: any) {
      alert(err.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // Unbind
  const handleUnbind = async () => {
    if (!confirm('确认解绑微信打卡通知吗？')) return;
    setIsSaving(true);
    setTestMessage(null);
    try {
      await api.updateSendKey('');
      setSendKey('');
      await refreshUser();
    } catch (err: any) {
      alert(err.message || '解绑失败');
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger Real Test WeChat Notification
  const handleSendTestNotification = async () => {
    setTestSending(true);
    setTestMessage(null);
    try {
      const res = await api.testPush(sendKey);
      setTestMessage({ success: true, text: res.message || '微信模板消息已成功送达您的微信服务号！' });
    } catch (err: any) {
      setTestMessage({
        success: false,
        text: err.message || '微信推送失败，请检查 SendKey 是否填写正确。',
      });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-24 space-y-5">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-900 tracking-tight">个人中心</h1>
        <p className="text-xs text-stone-500 mt-0.5">账号设置与消息推送配置</p>
      </div>

      {/* User Information Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <img
            src={
              user?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
            }
            alt={user?.nickname}
            className="w-14 h-14 rounded-full object-cover border border-stone-200 shadow-2xs"
          />
          <div>
            <div className="text-base font-bold text-stone-900">{user?.nickname}</div>
            <div className="text-xs text-stone-500 mt-0.5">账号：@{user?.username}</div>
            <div className="text-[11px] text-stone-400 mt-1">
              注册时间：{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '近期'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-1 bg-stone-100 rounded-full text-stone-700 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-stone-600" />
          <span>打卡成员</span>
        </div>
      </div>

      {/* Server酱 WeChat Push Notification Binding Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <span>Server酱 · 微信打卡与私聊提醒</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isBound
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isBound ? '已绑定微信' : '未绑定'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                绑定后每日未打卡时，将由微信服务号推送提醒
              </p>
            </div>
          </div>
        </div>

        {!isBound ? (
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-center space-y-4">
            <div className="flex flex-col items-center justify-center">
              {/* QR Code Graphic Display */}
              <a
                href="https://sct.ftqq.com/"
                target="_blank"
                rel="noreferrer"
                className="w-44 h-44 bg-white p-3 rounded-2xl border border-stone-200 shadow-xs flex flex-col items-center justify-center relative group cursor-pointer hover:border-emerald-500 transition-colors"
              >
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full text-stone-900 group-hover:text-emerald-700 transition-colors"
                  fill="currentColor"
                >
                  <rect x="5" y="5" width="26" height="26" rx="4" fill="currentColor" />
                  <rect x="9" y="9" width="18" height="18" rx="2" fill="white" />
                  <rect x="13" y="13" width="10" height="10" rx="1" fill="currentColor" />

                  <rect x="69" y="5" width="26" height="26" rx="4" fill="currentColor" />
                  <rect x="73" y="9" width="18" height="18" rx="2" fill="white" />
                  <rect x="77" y="13" width="10" height="10" rx="1" fill="currentColor" />

                  <rect x="5" y="69" width="26" height="26" rx="4" fill="currentColor" />
                  <rect x="9" y="73" width="18" height="18" rx="2" fill="white" />
                  <rect x="13" y="77" width="10" height="10" rx="1" fill="currentColor" />

                  <rect x="36" y="8" width="8" height="8" rx="1" />
                  <rect x="48" y="8" width="6" height="6" rx="1" />
                  <rect x="58" y="10" width="6" height="6" rx="1" />
                  <rect x="36" y="20" width="6" height="6" rx="1" />
                  <rect x="46" y="20" width="8" height="8" rx="1" />
                  <rect x="8" y="36" width="6" height="6" rx="1" />
                  <rect x="18" y="36" width="8" height="8" rx="1" />
                  <rect x="8" y="48" width="8" height="8" rx="1" />
                  <rect x="20" y="48" width="6" height="6" rx="1" />
                  <rect x="36" y="36" width="10" height="10" rx="1" />
                  <rect x="52" y="36" width="8" height="8" rx="1" />
                  <rect x="66" y="36" width="6" height="6" rx="1" />
                  <rect x="78" y="36" width="14" height="6" rx="1" />
                  <rect x="36" y="50" width="8" height="8" rx="1" />
                  <rect x="48" y="50" width="12" height="6" rx="1" />
                  <rect x="66" y="48" width="8" height="8" rx="1" />
                  <rect x="80" y="48" width="12" height="8" rx="1" />
                  <rect x="36" y="64" width="6" height="6" rx="1" />
                  <rect x="46" y="64" width="12" height="12" rx="1" />
                  <rect x="64" y="64" width="8" height="8" rx="1" />
                  <rect x="78" y="64" width="14" height="6" rx="1" />
                  <rect x="36" y="78" width="8" height="8" rx="1" />
                  <rect x="64" y="78" width="10" height="10" rx="1" />
                  <rect x="80" y="76" width="12" height="14" rx="1" />
                </svg>

                <div className="absolute inset-0 bg-stone-900/5 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-1 rounded-md shadow-xs flex items-center gap-1">
                    <span>打开 Server酱 官网</span>
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </a>

              <div className="text-xs text-stone-700 mt-3 font-semibold flex items-center gap-1.5 justify-center">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>微信免费获取 SendKey 步骤</span>
              </div>
              <ol className="text-[11px] text-stone-500 mt-1 max-w-sm mx-auto text-left list-decimal list-inside space-y-1">
                <li>
                  点击屏幕二维码或打开{' '}
                  <a
                    href="https://sct.ftqq.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 font-semibold underline"
                  >
                    sct.ftqq.com
                  </a>
                </li>
                <li>点击右上角登陆使用微信扫码并关注服务号</li>
                <li>复制网站上的 <b>SendKey</b> 粘贴到下方保存即可！</li>
              </ol>
            </div>

            {/* Input Key Block */}
            <div className="pt-2 border-t border-stone-200 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-serverchan-sendkey"
                    type="text"
                    value={sendKey}
                    onChange={(e) => setSendKey(e.target.value)}
                    placeholder="SCTxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <button
                  id="btn-save-sendkey"
                  type="button"
                  onClick={() => handleSaveSendKey(sendKey)}
                  disabled={isSaving || !sendKey.trim()}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>保存绑定</span>}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-950">
                    已成功绑定 Server酱 微信推送服务
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    SendKey: {user?.serverchanSendKey?.slice(0, 8)}••••••••••••••••
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUnbind}
                disabled={isSaving}
                className="text-xs text-stone-400 hover:text-red-600 transition-colors underline"
              >
                解绑
              </button>
            </div>

            {/* Test Send Trigger */}
            <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between flex-wrap gap-2">
              <button
                id="btn-test-wechat-push"
                type="button"
                onClick={handleSendTestNotification}
                disabled={testSending}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
              >
                {testSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>正在投递到微信...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>立即发送微信推送测试</span>
                  </>
                )}
              </button>

              <span className="text-[11px] text-emerald-800">
                测试成功后将直接在微信服务号收到卡片
              </span>
            </div>

            {testMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  testMessage.success
                    ? 'bg-white border-emerald-300 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {testMessage.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <span>{testMessage.text}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Out Action */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
        <button
          id="btn-profile-logout"
          type="button"
          onClick={logout}
          className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 active:scale-[0.99] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>退出当前账号登录</span>
        </button>
      </div>
    </div>
  );
};
