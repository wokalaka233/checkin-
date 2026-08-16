import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Search,
  Check,
  X,
  MessageSquare,
  Users,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { FriendUser, FriendRequest, User } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ChatDrawer } from '../chat/ChatDrawer';

export const FriendsView: React.FC = () => {
  const { user, refreshBadge } = useAuth();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<(FriendRequest & { fromUser: User })[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & add friend
  const [searchUsername, setSearchUsername] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Active chat friend
  const [chatFriend, setChatFriend] = useState<FriendUser | null>(null);

  const fetchFriendsAndRequests = async () => {
    try {
      setLoading(true);
      const [friendList, reqList] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
      ]);
      setFriends(friendList);
      setRequests(reqList);
      await refreshBadge();
    } catch (e) {
      console.error('Failed to load friends/requests:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriendsAndRequests();
  }, []);

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    setSearchLoading(true);
    setSearchFeedback(null);

    try {
      await api.sendFriendRequest(searchUsername.trim());
      setSearchFeedback({ type: 'success', msg: `已向 @${searchUsername.trim()} 发送好友申请` });
      setSearchUsername('');
    } catch (err: any) {
      setSearchFeedback({ type: 'error', msg: err.message || '发送申请失败' });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRespondRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      await api.respondFriendRequest(requestId, action);
      await fetchFriendsAndRequests();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">好友与私聊</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            共 {friends.length} 位打卡好友 · 实时双向私聊
          </p>
        </div>
      </div>

      {/* Add Friend Input Box */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3">
        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4 text-stone-700" />
          <span>添加好友 (输入账号)</span>
        </div>

        <form onSubmit={handleSendFriendRequest} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            <input
              id="input-add-friend-username"
              type="text"
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              placeholder="输入好友账号（例如：user2 或 user3）"
              className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
            />
          </div>
          <button
            id="btn-send-friend-req"
            type="submit"
            disabled={searchLoading || !searchUsername.trim()}
            className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-40"
          >
            {searchLoading ? '发送中...' : '发送申请'}
          </button>
        </form>

        {searchFeedback && (
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center gap-1.5 ${
              searchFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {searchFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <X className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{searchFeedback.msg}</span>
          </div>
        )}
      </div>

      {/* Pending Friend Requests Section */}
      {requests.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>待处理的好友申请 ({requests.length})</span>
            </span>
          </div>

          <div className="space-y-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 bg-white border border-amber-200/80 rounded-xl shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={req.fromUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover"
                  />
                  <div>
                    <div className="text-xs font-bold text-stone-900">
                      {req.fromUser?.nickname || '未知用户'}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      @{req.fromUser?.username} 请求添加你为好友
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRespondRequest(req.id, 'accept')}
                    className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>同意</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondRequest(req.id, 'reject')}
                    className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-xs transition-colors"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friend Roster List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-3">
        <div className="text-xs font-bold text-stone-900 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-stone-700" />
            <span>我的好友列表</span>
          </span>
          <span className="text-[11px] text-stone-400 font-normal">
            点击好友发起 1v1 私聊
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400">
            加载好友列表中...
          </div>
        ) : friends.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-400 bg-stone-50 rounded-xl border border-stone-100">
            暂无好友，在上方输入对方账号发起申请吧～
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {friends.map((friend) => {
              const unread = friend.unreadCount || 0;
              const lastMsg = friend.lastMessage;

              return (
                <div
                  key={friend.id}
                  id={`friend-row-${friend.id}`}
                  onClick={() => setChatFriend(friend)}
                  className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={friend.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-stone-200"
                      />
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                          {unread}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-stone-900 group-hover:text-stone-950">
                          {friend.nickname}
                        </span>
                        <span className="text-[10px] text-stone-400 font-normal">
                          @{friend.username}
                        </span>
                      </div>

                      <div className="text-[11px] text-stone-500 mt-0.5 max-w-[200px] sm:max-w-xs truncate">
                        {lastMsg ? (
                          lastMsg.type === 'image' ? (
                            '[图片]'
                          ) : lastMsg.type === 'audio' ? (
                            `[语音 ${lastMsg.audioDuration || 1}"]`
                          ) : (
                            lastMsg.content
                          )
                        ) : (
                          '暂无聊天记录，点击发起私聊'
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setChatFriend(friend);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-stone-100 hover:bg-stone-900 hover:text-white text-stone-700 rounded-xl text-xs font-medium transition-all shadow-2xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>发消息</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 1v1 Chat Drawer */}
      {chatFriend && (
        <ChatDrawer
          isOpen={!!chatFriend}
          friend={chatFriend}
          onClose={() => setChatFriend(null)}
          onMessagesUpdated={fetchFriendsAndRequests}
        />
      )}
    </div>
  );
};
