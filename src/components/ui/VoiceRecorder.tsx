import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Check } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingComplete: (audioUrl: string, duration: number) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onCancel,
  compact = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorMessage('');
    
    // 兼容性环境核验：如果当前浏览器缺少 getUserMedia 标准接口，抛出友好指引并阻断卡死
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('提示：当前浏览器或环境不支持网页录音，请确保使用原生的 Safari 浏览器（iOS）或 Chrome 浏览器打开网站，且确保在 https:// 加密地址下访问。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 动态编码核验：自动探测当前浏览器最偏爱的音频格式（苹果走 mp4，安卓和 Chrome 走 webm），防范苹果手机直接报错卡死
      let options = {};
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // 动态 Blob 生成：自动根据当前实际的录制编码生成 Blob，拒绝强制套 WebM 导致苹果设备无法回放或上传
        const recordedType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setRecordedAudio(reader.result as string);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setDuration(0);

      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsed);
        if (elapsed >= 60) {
          stopRecording();
        }
      }, 500);
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setErrorMessage('无法访问麦克风，请检查手机系统设置及浏览器权限');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const togglePlayback = () => {
    if (!recordedAudio) return;
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(recordedAudio);
      audioPlayerRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const resetRecording = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
    setRecordedAudio(null);
    setDuration(0);
  };

  const handleConfirm = () => {
    if (recordedAudio) {
      onRecordingComplete(recordedAudio, duration || 1);
      resetRecording();
    }
  };

  return (
    <div
      id="voice-recorder-container"
      className={`rounded-2xl border border-stone-200 bg-stone-50 p-4 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      {errorMessage && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 p-2.5 rounded-xl mb-2 font-medium leading-relaxed">
          {errorMessage}
        </div>
      )}

      {!isRecording && !recordedAudio && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-stone-600 flex items-center gap-1.5 flex-shrink-0 mr-2">
            <Mic className="w-4 h-4 text-stone-700" />
            <span>点击开始录制语音</span>
          </div>
          <button
            id="btn-start-record"
            type="button"
            onClick={startRecording}
            className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs ml-auto"
          >
            <Mic className="w-3.5 h-3.5" />
            开始录音
          </button>
        </div>
      )}

      {isRecording && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <div className="flex items-center gap-1">
              {/* Animated waveform bars */}
              <div className="w-1 h-3 bg-red-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1 h-5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1 h-4 bg-red-500 rounded-full animate-bounce" />
              <div className="w-1 h-6 bg-red-500 rounded-full animate-bounce [animation-delay:-0.2s]" />
              <div className="w-1 h-3 bg-red-500 rounded-full animate-bounce [animation-delay:-0.4s]" />
            </div>
            <span className="text-xs font-mono font-medium text-stone-900">
              00:{duration < 10 ? `0${duration}` : duration}
            </span>
          </div>
          <button
            id="btn-stop-record"
            type="button"
            onClick={stopRecording}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            结束录音
          </button>
        </div>
      )}

      {recordedAudio && !isRecording && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              id="btn-preview-audio"
              type="button"
              onClick={togglePlayback}
              className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center hover:bg-stone-800 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            <span className="text-xs font-mono text-stone-700">
              语音时长 {duration}秒
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="btn-discard-audio"
              type="button"
              onClick={resetRecording}
              className="p-2 text-stone-500 hover:text-red-600 rounded-lg hover:bg-stone-200/60 transition-colors"
              title="重录"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              id="btn-confirm-audio"
              type="button"
              onClick={handleConfirm}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              使用该录音
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
