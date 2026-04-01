import React, { useEffect, useRef, useState } from 'react';
import { Tutor } from '../data/tutors';
import { languages, proficiencyLevels, Scenario } from '../data/scenarios';
import { useLiveAPI } from '../lib/gemini-live';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, Send, PhoneOff, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GoogleGenAI } from '@google/genai';

interface ChatScreenProps {
  config: {
    language: string;
    level: string;
    tutor: Tutor;
    scenario: Scenario;
  };
  onEnd: () => void;
}

export function ChatScreen({ config, onEnd }: ChatScreenProps) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showTranslation, setShowTranslation] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const aiRef = useRef<GoogleGenAI | null>(null);
  const translatingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!aiRef.current) {
      try {
        // @ts-ignore - process might only be partially defined by Vite
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API key is empty");
        aiRef.current = new GoogleGenAI({ apiKey });
      } catch (e) {
        console.error("Please configure VITE_GEMINI_API_KEY in your .env file", e);
      }
    }
  }, []);

  const langName = languages.find(l => l.code === config.language)?.name || config.language;
  const levelName = proficiencyLevels.find(l => l.id === config.level)?.name || config.level;

  const systemInstruction = `
You are ${config.tutor.name}, an AI language tutor helping the user practice ${langName}.
Your personality: ${config.tutor.personality}
Your backstory: ${config.tutor.backstory}

The user's proficiency level is: ${levelName}. Adjust your vocabulary, grammar complexity, and speaking speed accordingly.
If they make mistakes, gently correct them in a supportive way.

Current Scenario: ${config.scenario.title}
Scenario details: ${config.scenario.systemPrompt}

Guidelines:
- Always respond in ${langName} unless the user explicitly asks for a translation or explanation in another language.
- Keep your responses concise and conversational, suitable for spoken dialogue.
- Ask follow-up questions to keep the conversation going.
- Stay in character at all times.
`;

  const {
    isConnected,
    isRecording,
    messages,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage,
  } = useLiveAPI({
    systemInstruction,
    voiceName: config.tutor.voice,
  });

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!showTranslation || !aiRef.current) return;

    messages.forEach(msg => {
      if (msg.isFinal && msg.text.trim() && !translations[msg.id] && !translatingRef.current.has(msg.id)) {
        translatingRef.current.add(msg.id);
        setTranslations(prev => ({ ...prev, [msg.id]: '...' }));
        
        console.log('Translating message:', msg.text);
        aiRef.current!.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Translate the following text to Traditional Chinese (繁體中文). Only return the translation, nothing else.\n\nText: ${msg.text}`
        }).then(res => {
          console.log('Translation result:', res.text);
          setTranslations(prev => ({ ...prev, [msg.id]: res.text || '' }));
        }).catch(err => {
          console.error('Translation error:', err);
          setTranslations(prev => ({ ...prev, [msg.id]: '(翻譯失敗)' }));
        });
      }
    });
  }, [messages, showTranslation, translations]);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendTextMessage(inputText);
    setInputText('');
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-3xl mx-auto bg-transparent">
      {/* Header */}
      <header className="flex items-center justify-between p-4 glass border-none rounded-b-2xl z-20">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-none ring-1 ring-white/20">
            <AvatarFallback className="text-xl bg-background/50">{config.tutor.avatar}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">{config.tutor.name}</h2>
            <p className="text-[10px] text-muted-foreground">
              {config.scenario.title} • {langName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="translation-mode" checked={showTranslation} onCheckedChange={setShowTranslation} />
            <Label htmlFor="translation-mode" className="text-[10px] cursor-pointer font-medium">中英字幕</Label>
          </div>
          <Button variant="destructive" size="icon" onClick={onEnd} title="End Conversation" className="rounded-full h-8 w-8">
            <PhoneOff className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Connection Status */}
      {!isConnected && !error && (
        <div className="flex items-center justify-center p-2 glass mx-4 mt-2 rounded-full text-xs text-muted-foreground gap-2 z-10">
          <Loader2 className="h-3 w-3 animate-spin" /> Connecting to AI Tutor...
        </div>
      )}
      {error && (
        <div className="p-2 glass mx-4 mt-2 rounded-full bg-destructive/10 text-destructive text-xs text-center z-10">
          Error: {error}
        </div>
      )}

      {/* Chat Area */}
      <ScrollArea className="flex-1 px-4 py-2" ref={scrollRef}>
        <div className="space-y-6 py-4">
          {messages.length === 0 && isConnected && (
            <div className="text-center text-muted-foreground mt-20 space-y-4">
              <div className="inline-block p-4 rounded-full glass animate-bounce">
                <span className="text-4xl">{config.tutor.avatar}</span>
              </div>
              <div>
                <p className="text-lg font-medium">Connected!</p>
                <p className="text-sm opacity-70">Say hello to {config.tutor.name} to begin.</p>
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={msg.id + idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'glass text-foreground rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                {showTranslation && translations[msg.id] && (
                  <div className={`mt-2 pt-2 border-t text-[13px] leading-relaxed opacity-80 ${msg.role === 'user' ? 'border-primary-foreground/20' : 'border-white/10'}`}>
                    {translations[msg.id] === '...' ? <Loader2 className="h-3 w-3 animate-spin" /> : translations[msg.id]}
                  </div>
                )}
                {!msg.isFinal && msg.role === 'model' && (
                  <span className="inline-block w-1.5 h-1.5 ml-1 bg-current rounded-full animate-pulse" />
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Controls */}
      <div className="p-4 pb-8 z-20">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <Button
              size="lg"
              variant={isRecording ? 'destructive' : 'default'}
              className={`rounded-full w-16 h-16 md:w-20 md:h-20 shadow-2xl transition-all duration-500 ${isRecording ? 'animate-pulse scale-110 ring-4 ring-destructive/20' : 'hover:scale-105'}`}
              onClick={toggleRecording}
              disabled={!isConnected}
            >
              {isRecording ? <MicOff className="h-6 w-6 md:h-8 md:w-8" /> : <Mic className="h-6 w-6 md:h-8 md:w-8" />}
            </Button>
          </div>
          
          <form onSubmit={handleSendText} className="flex gap-2 glass p-1.5 rounded-full">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              disabled={!isConnected || isRecording}
              className="rounded-full bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 h-10 px-4"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="rounded-full shrink-0 h-10 w-10 shadow-lg"
              disabled={!isConnected || !inputText.trim() || isRecording}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
