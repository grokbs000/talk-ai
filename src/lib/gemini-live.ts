import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioPlayer, AudioRecorder } from './audio-utils';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isFinal?: boolean;
}

interface UseLiveAPIProps {
  systemInstruction: string;
  voiceName: string;
}

export function useLiveAPI({ systemInstruction, voiceName }: UseLiveAPIProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    try {
      // @ts-ignore
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key is empty");
      aiRef.current = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.error("Missing Gemini API key", e);
      setError("Please check your GEMINI_API_KEY in .env file.");
    }
    audioRecorderRef.current = new AudioRecorder();
    audioPlayerRef.current = new AudioPlayer();

    return () => {
      disconnect();
    };
  }, []);

  const connect = useCallback(async () => {
    if (!aiRef.current) return;
    setError(null);
    setMessages([]);

    try {
      audioPlayerRef.current?.init();

      const sessionPromise = aiRef.current.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          systemInstruction,
          // Enable transcriptions
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
          },
          onmessage: async (message: LiveServerMessage) => {
            // console.log('Live API Message:', message);

            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              audioPlayerRef.current?.playBase64(base64Audio);
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              audioPlayerRef.current?.stop();
              audioPlayerRef.current?.init();
            }

            // Handle transcriptions
            const modelTranscript = message.serverContent?.outputTranscription;
            if (modelTranscript) {
              console.log('Output transcription:', modelTranscript);
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model' && !last.isFinal) {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...last, text: last.text + (modelTranscript.text || ''), isFinal: modelTranscript.finished || false };
                  return updated;
                } else if (modelTranscript.text) {
                  // Mark previous message as final if it wasn't
                  const updated = prev.map(m => ({ ...m, isFinal: true }));
                  return [...updated, { id: Date.now().toString(), role: 'model', text: modelTranscript.text, isFinal: modelTranscript.finished || false }];
                }
                return prev;
              });
            }

            // Fallback: check modelTurn.parts for text
            const modelParts = message.serverContent?.modelTurn?.parts;
            if (modelParts && !modelTranscript) {
              const textPart = modelParts.find(p => p.text);
              if (textPart && textPart.text) {
                console.log('Model turn text part:', textPart.text);
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'model' && !last.isFinal) {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...last, text: last.text + textPart.text };
                    return updated;
                  } else {
                    const updated = prev.map(m => ({ ...m, isFinal: true }));
                    return [...updated, { id: Date.now().toString(), role: 'model', text: textPart.text, isFinal: false }];
                  }
                });
              }
            }

            const inTranscript = message.serverContent?.inputTranscription;
            if (inTranscript) {
              console.log('Input transcription:', inTranscript);
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'user' && !last.isFinal) {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...last, text: last.text + (inTranscript.text || ''), isFinal: inTranscript.finished || false };
                  return updated;
                } else if (inTranscript.text) {
                  // Mark previous message as final if it wasn't
                  const updated = prev.map(m => ({ ...m, isFinal: true }));
                  return [...updated, { id: Date.now().toString(), role: 'user', text: inTranscript.text, isFinal: inTranscript.finished || false }];
                }
                return prev;
              });
            }

            if (message.serverContent?.turnComplete) {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model') {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...last, isFinal: true };
                  return updated;
                }
                return prev;
              });
            }

            if (inTranscript?.finished) {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'user') {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...last, isFinal: true };
                  return updated;
                }
                return prev;
              });
            }
          },
          onclose: () => {
            setIsConnected(false);
            setIsRecording(false);
          },
          onerror: (err) => {
            console.error('Live API Error:', err);
            setError(err.message || 'An error occurred');
            disconnect();
          },
        },
      });

      sessionRef.current = sessionPromise;
      await sessionPromise;

    } catch (err: any) {
      console.error('Failed to connect:', err);
      setError(err.message || 'Failed to connect');
      setIsConnected(false);
    }
  }, [systemInstruction, voiceName]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close()).catch(console.error);
      sessionRef.current = null;
    }
    audioRecorderRef.current?.stop();
    audioPlayerRef.current?.stop();
    setIsConnected(false);
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!isConnected || !sessionRef.current) return;
    
    setIsRecording(true);
    audioRecorderRef.current?.start((base64Data) => {
      sessionRef.current?.then((session: any) => {
        session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      });
    }).catch(err => {
      console.error('Failed to start recording:', err);
      setIsRecording(false);
    });
  }, [isConnected]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    audioRecorderRef.current?.stop();
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    if (!isConnected || !sessionRef.current) return;
    
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text, isFinal: true }]);
    
    sessionRef.current?.then((session: any) => {
      session.sendRealtimeInput({
        text: text
      });
    });
  }, [isConnected]);

  return {
    isConnected,
    isRecording,
    messages,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage,
  };
}
