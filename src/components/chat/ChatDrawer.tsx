import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Image as ImageIcon,
  Mic,
  Play,
  Pause,
  Check,
  CheckCheck,
  ChevronLeft,
} from 'lucide-react';
import { FriendUser, ChatMessage } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { VoiceRecorder } from '../ui/VoiceRecorder';

interface ChatDrawerProps {
  isOpen: boolean;
  friend: FriendUser | null;
  onClose: () => void;
  onMessagesUpdated: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  friend,
  onClose,
  onMessagesUpdated,
}) => {
  const { user, refreshBadge } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const fetchMessages = async () => {
    if (!friend) return;
    try {
      const list = await api.getMessages(friend.id);
      setMessages(list);
      await refreshBadge();
      onMessagesUpdated();
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && friend) {
      setLoading(true);
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, friend?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen || !friend) return null;

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const content = textInput.trim();
    setTextInput('');

    try {
      const newMsg = await api.sendMessage({
        receiverId: friend.id,
        type: 'text',
        content,
      });
      setMessages((prev) => [...prev, newMsg]);
    } catch (e: any) {
      alert(e.message || '发送失败');
    }
  };

  const handleSendVoice = async (audioUrl: string, duration: number) => {
    setIsRecordingVoice(false);
    try {
      const newMsg = await api.sendMessage({
        receiverId: friend.id,
        type: 'audio',
        content: audioUrl,
        audioDuration: duration,
      });
      setMessages((prev) => [...prev, newMsg]);
    } catch (e: any) {
      alert(e.message || '发送语音失败');
    }
  };

  const handleSendImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      if (typeof reader.result === 'string') {
        try {
          const newMsg = await api.sendMessage({
            receiverId: friend.id,
            type: 'image',
            content: reader.result,
          });
          setMessages((prev) => [...prev, newMsg]);
        } catch (err: any) {
          alert(err.message || '发送图片失败');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const playVoice = (msgId: string, audioUrl: string) => {
    if (playingAudioId === msgId) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingAudioId(null);
      audio.play();
      setPlayingAudioId(msgId);
    }
  };

  return (
    <div
      id="chat-drawer-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end"
    >
      <div
        id="chat-drawer-content"
        className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Chat Top Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              id="btn-back-chat"
              type="button"
              onClick={onClose}
              className="p-1 -ml-1 text-stone-500 hover:text-stone-900 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <img
              src={friend.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-stone-200"
            />
            <div>
              <div className="text-xs font-bold text-stone-900">
                {friend.nickname}
              </div>
              <div className="text-[10px] text-stone-400">
                @{friend.username}
              </div>
            </div>
          </div>

          <button
            id="btn-close-chat"
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/50">
          {loading ? (
            <div className="py-12 text-center text-xs text-stone-400">
              加载聊天记录中...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center text-xs text-stone-400">
              与 {friend.nickname} 开启私聊吧，发送问候或者打卡心得～
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === user?.id;
              const isPlayingThis = playingAudioId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isMine ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-3 shadow-2xs ${
                      isMine
                        ? 'bg-stone-900 text-white rounded-br-xs'
                        : 'bg-white text-stone-900 border border-stone-200 rounded-bl-xs'
                    }`}
                  >
                    {/* Text Message */}
                    {msg.type === 'text' && (
                      <div className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                    )}

                    {/* Image Message */}
                    {msg.type === 'image' && (
                      <button
                        type="button"
                        onClick={() => setLightboxImage(msg.content)}
                        className="rounded-xl overflow-hidden max-w-xs block cursor-pointer"
                      >
                        <img
                          src={msg.content}
                          alt=""
                          className="max-h-60 rounded-xl object-cover"
                        />
                      </button>
                    )}

                    {/* Audio Voice Message */}
                    {msg.type === 'audio' && (
                      <div
                        onClick={() => playVoice(msg.id, msg.content)}
                        className="flex items-center gap-2 cursor-pointer select-none py-0.5"
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            isMine ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-900'
                          }`}
                        >
                          {isPlayingThis ? (
                            <Pause className="w-3 h-3 fill-current" />
                          ) : (
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                          )}
                        </div>

                        {/* Waveform graphic */}
                        <div className="flex items-center gap-0.5 px-1">
                          <div className={`w-0.5 h-3 rounded-full ${isMine ? 'bg-white/80' : 'bg-stone-400'} ${isPlayingThis ? 'animate-pulse' : ''}`} />
                          <div className={`w-0.5 h-4 rounded-full ${isMine ? 'bg-white/80' : 'bg-stone-400'} ${isPlayingThis ? 'animate-pulse' : ''}`} />
                          <div className={`w-0.5 h-2.5 rounded-full ${isMine ? 'bg-white/80' : 'bg-stone-400'} ${isPlayingThis ? 'animate-pulse' : ''}`} />
                          <div className={`w-0.5 h-5 rounded-full ${isMine ? 'bg-white/80' : 'bg-stone-400'} ${isPlayingThis ? 'animate-pulse' : ''}`} />
                          <div className={`w-0.5 h-3 rounded-full ${isMine ? 'bg-white/80' : 'bg-stone-400'} ${isPlayingThis ? 'animate-pulse' : ''}`} />
                        </div>

                        <span
                          className={`text-xs font-mono font-medium ${
                            isMine ? 'text-white' : 'text-stone-700'
                          }`}
                        >
                          {msg.audioDuration || 1}&quot;
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Message footer: Time & Read receipt */}
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[9px] text-stone-400">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isMine && (
                      <span className="text-[9px] text-stone-400 flex items-center">
                        {msg.isRead ? (
                          <CheckCheck className="w-3 h-3 text-emerald-500" title="已读" />
                        ) : (
                          <Check className="w-3 h-3 text-stone-400" title="已送达" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Voice Recorder Overlay in Chat */}
        {isRecordingVoice && (
          <div className="p-3 bg-stone-100 border-t border-stone-200">
            <VoiceRecorder
              compact
              onRecordingComplete={handleSendVoice}
              onCancel={() => setIsRecordingVoice(false)}
            />
          </div>
        )}

        {/* Bottom Input Action Bar */}
        <div className="p-3 bg-white border-t border-stone-200">
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            {/* Voice Record trigger */}
            <button
              id="btn-trigger-voice-msg"
              type="button"
              onClick={() => setIsRecordingVoice((prev) => !prev)}
              className={`p-2 rounded-xl transition-colors ${
                isRecordingVoice
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
              }`}
              title="录制语音"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Photo picker */}
            <label
              htmlFor="chat-image-input"
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl cursor-pointer transition-colors"
              title="发送图片"
            >
              <ImageIcon className="w-5 h-5" />
            </label>
            <input
              id="chat-image-input"
              type="file"
              accept="image/*"
              onChange={handleSendImage}
              className="hidden"
            />

            {/* Text input */}
            <input
              id="input-chat-text"
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="输入私聊消息..."
              className="flex-1 px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white"
            />

            {/* Send button */}
            <button
              id="btn-send-chat-msg"
              type="submit"
              disabled={!textInput.trim()}
              className="p-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition-colors disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Lightbox for HD images in chat */}
      {lightboxImage && (
        <div
          id="chat-lightbox"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={lightboxImage}
            alt=""
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
