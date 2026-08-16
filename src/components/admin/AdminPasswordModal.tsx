import React, { useState } from 'react';
import { X, Key, Check, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface AdminPasswordModalProps {
  isOpen: boolean;
  user: { id: string; username: string; nickname: string; password?: string } | null;
  onClose: () => void;
  onSuccess: (updatedUser: any) => void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setError('请输入新密码');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.updateUserPassword(user.id, newPassword.trim());
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="admin-password-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        id="admin-password-modal-content"
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">修改用户密码</h3>
              <p className="text-xs text-stone-500">
                目标用户：{user.nickname} (@{user.username})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {user.password && (
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex items-center justify-between">
            <span className="text-stone-500">当前存储密码：</span>
            <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
              {user.password}
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-1.5 border border-red-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              设置新密码
            </label>
            <input
              id="input-admin-new-password"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入重置后的密码（如：123456）"
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              id="btn-admin-save-password"
              type="submit"
              disabled={loading || !newPassword.trim()}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              {loading ? (
                '保存中...'
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>确认修改</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
