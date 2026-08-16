import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { NotificationConfig, AdminUserSummary } from '../../types';
import { api } from '../../services/api';

interface AdminNotificationManagerProps {
  users: AdminUserSummary[];
}

export const AdminNotificationManager: React.FC<AdminNotificationManagerProps> = ({ users: _users }) => {
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Create Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<NotificationConfig | null>(null);
  const [formData, setFormData] = useState({
    type: 'daily_uncheck_reminder',
    name: '',
    description: '',
    enabled: true,
    triggerTime: '21:00',
    titleTemplate: '⏰ 每日打卡提醒',
    contentTemplate: '【{nickname}】，您参与的项目【{projectTitle}】今天还没有打卡哦，快去完成吧！',
    quotaCostNote: '',
  });

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getNotificationConfigs();
      setConfigs(data);
    } catch (e) {
      console.error('Failed to load notification configs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleOpenCreate = () => {
    setEditingConfig(null);
    setFormData({
      type: 'custom',
      name: '',
      description: '',
      enabled: true,
      triggerTime: '21:00',
      titleTemplate: '⏰ 打卡提醒通知',
      contentTemplate: '【{nickname}】，您参与的项目【{projectTitle}】今天还没有打卡哦，快去完成吧！',
      quotaCostNote: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (cfg: NotificationConfig) => {
    setEditingConfig(cfg);
    setFormData({
      type: cfg.type,
      name: cfg.name,
      description: cfg.description || '',
      enabled: cfg.enabled,
      triggerTime: cfg.triggerTime || '21:00',
      titleTemplate: cfg.titleTemplate,
      contentTemplate: cfg.contentTemplate,
      quotaCostNote: cfg.quotaCostNote || '',
    });
    setModalOpen(true);
  };

  const handleToggle = async (cfg: NotificationConfig) => {
    try {
      const nextEnabled = !cfg.enabled;
      await api.toggleNotificationConfig(cfg.id, nextEnabled);
      setConfigs((prev) =>
        prev.map((c) => (c.id === cfg.id ? { ...c, enabled: nextEnabled } : c))
      );
    } catch (err: any) {
      alert(err.message || '更新状态失败');
    }
  };

  const handleDelete = async (cfg: NotificationConfig) => {
    if (!confirm(`确定要删除提醒规则【${cfg.name}】吗？`)) return;
    try {
      await api.deleteNotificationConfig(cfg.id);
      setConfigs((prev) => prev.filter((c) => c.id !== cfg.id));
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('请填写提醒名称');
      return;
    }

    try {
      if (editingConfig) {
        const res = await api.updateNotificationConfig(editingConfig.id, formData);
        setConfigs((prev) =>
          prev.map((c) => (c.id === editingConfig.id ? res.config : c))
        );
      } else {
        const res = await api.createNotificationConfig(formData);
        setConfigs((prev) => [...prev, res.config]);
      }
      setModalOpen(false);
    } catch (err: any) {
      alert(err.message || '保存失败');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action: Only the green button */}
      <div className="flex justify-end">
        <button
          id="btn-admin-add-notification"
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>添加提醒</span>
        </button>
      </div>

      {/* Notification Configs Cards List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-stone-500" />
          正在加载...
        </div>
      ) : configs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400 text-xs">
          暂无提醒规则，点击右上角绿色按钮添加提醒
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {configs.map((cfg) => (
            <div
              key={cfg.id}
              className={`bg-white rounded-2xl border transition-all p-4 shadow-xs flex items-center justify-between gap-4 ${
                cfg.enabled
                  ? 'border-emerald-300 ring-1 ring-emerald-400/20'
                  : 'border-stone-200 opacity-75'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    cfg.enabled
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : 'bg-stone-100 text-stone-400 border border-stone-200'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-stone-900">{cfg.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        cfg.enabled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {cfg.enabled ? '已开启' : '已关闭'}
                    </span>
                  </div>
                  {cfg.description && (
                    <p className="text-xs text-stone-400 mt-0.5">{cfg.description}</p>
                  )}
                </div>
              </div>

              {/* Actions & Switch */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggle(cfg)}
                  className={`p-1 rounded-xl transition-colors ${
                    cfg.enabled
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-stone-400 hover:bg-stone-100'
                  }`}
                  title={cfg.enabled ? '点击关闭提醒' : '点击开启提醒'}
                >
                  {cfg.enabled ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(cfg)}
                  className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                  title="编辑"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cfg)}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-stone-200 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">
                {editingConfig ? '编辑提醒' : '添加提醒'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-xs font-bold px-2 py-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-700 font-bold mb-1">提醒名称</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：每日未打卡提醒"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-bold mb-1">简短描述 (可选)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="例如：允许项目创建者设置每日微信催促"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="checkbox-enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="checkbox-enabled" className="text-stone-800 font-semibold cursor-pointer">
                  开启此提醒通道
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-bold transition-all"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
