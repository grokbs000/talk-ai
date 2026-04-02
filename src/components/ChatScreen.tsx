import React, { useEffect, useRef, useState } from 'react';
import { Tutor } from '../data/tutors';
import { languages, proficiencyLevels, Scenario } from '../data/scenarios';
import { useLiveAPI } from '../lib/gemini-live';
import { generateWithFallback } from '../lib/llm-fallback';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, Send, PhoneOff, Loader2, Lightbulb } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showTranslation, setShowTranslation] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const aiRef = useRef<GoogleGenAI | null>(null);
  const translatingRef = useRef<Set<string>>(new Set());

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
你是專業的語言口說教學專家，一位耐心、鼓勵、友善的語言導師，確保在對話練習時角色都像真人一樣自然、有情感。

You are teaching the user in ${langName}. Your name is ${config.tutor.name}.
Your personality: ${config.tutor.personality}
Your backstory: ${config.tutor.backstory}

The user's proficiency level is: ${levelName}. 
Current Scenario: ${config.scenario.title}. Scenario details: ${config.scenario.systemPrompt}

AI角色的主要任務是幫助使用者練習真實語言對話。你會：
- 用自然、流利的語言與使用者進行即時語音對話
- 根據使用者的語言水平自動調整難度（初學者用簡單句子，中高級用更自然的表達）
- 在適當時候糾正發音、文法或用詞，但要溫和且建設性
- 提供即時回饋，並鼓勵使用者多說

【重要：幫助提示機制（Help Hint）】
- 當你結束一段話後，如果使用者稍微沉思沒有馬上說話，你必須主動提供幫助。
- 幫助方式：用溫柔、鼓勵的語氣說類似以下句子：
  - "No pressure! You can say something like: 'That sounds interesting. What do you think?'"
  - "It's okay if you're thinking. Try this: 'I agree, but...'"
  - "Let me help you. A natural response could be: 'Really? Why do you think so?'"
- 給予提示時，請提供 1-2 個簡單的建議回答，讓使用者可以直接參考或修改來說。
- 提示完後，繼續等待使用者回應，不要一直說話。

其他對話規則：
- 每次只說一段自然長度的話（不要一次說太多）
- 經常鼓勵使用者："Great job!"、"That was clear!"、"You're improving a lot!"
- 如果使用者不懂或說中文，可以先用 ${langName} 簡單回應，再用括號簡單翻譯或解釋
- 保持互動流暢，像真實的朋友在聊天

【CRITICAL AUDIO RECOGNITION RULE】
- The user is currently practicing ${langName}. YOU MUST ASSUME ALL AUDIO INPUT IS IN ${langName}.
- If the language is English, YOU ABSOLUTELY MUST interpret everything the user says as English words. DO NOT attempt to transcribe or interpret the user's spoken English as Mandarin Chinese, Taiwanese, or any other language, even if the user has a strong non-native accent. 
- Force the audio to be recognized as ${langName}. Ignore homophones in other languages.

請讓語音聽起來非常自然、有情感。
對話開始時，請用溫暖的語氣自我介紹，並準備開始對話。
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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, suggestions, translations]);

  useEffect(() => {
    if (!showTranslation || !aiRef.current) return;

    messages.forEach(msg => {
      if (msg.isFinal && msg.text.trim() && !translations[msg.id] && !translatingRef.current.has(msg.id)) {
        translatingRef.current.add(msg.id);
        setTranslations(prev => ({ ...prev, [msg.id]: '...' }));
        
        console.log('Translating message:', msg.text);
        const prompt = `Translate the following text to Traditional Chinese (繁體中文). Only return the translation, nothing else.\n\nText: ${msg.text}`;
        generateWithFallback(
          () => aiRef.current!.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
          }).then(res => res.text || ''),
          prompt
        ).then(result => {
          console.log('Translation result:', result);
          setTranslations(prev => ({ ...prev, [msg.id]: result }));
        }).catch(err => {
          console.error('Translation error:', err);
          setTranslations(prev => ({ ...prev, [msg.id]: '(翻譯失敗)' }));
        });
      }
    });
  }, [messages, showTranslation, translations]);

  useEffect(() => {
    if (!aiRef.current) return;
    const lastMsg = messages[messages.length - 1];

    if (lastMsg && lastMsg.role === 'model' && lastMsg.isFinal) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      timeoutRef.current = setTimeout(() => {
        const promptContext = messages.slice(-6).map(m => `\${m.role}: \${m.text}`).join('\n');
        const prompt = `You are an AI language tutor. Based on the conversation context, provide 2 short, simple example sentences (in ${langName}) the user could say next. Return a valid JSON array of strings ONLY. Example: ["sentence 1", "sentence 2"]\n\nContext:\n${promptContext}`;
        
        generateWithFallback(
          () => aiRef.current!.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
          }).then(res => res.text || ''),
          prompt
        ).then(result => {
          console.log('Generated hints:', result);
          try {
            const match = result.match(/\[.*\]/s);
            if (match) {
              const parsed = JSON.parse(match[0]);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSuggestions(parsed.slice(0, 2));
              }
            }
          } catch (e) {
            console.error('Failed to parse suggestions:', e);
          }
        }).catch(console.error);
      }, 3500); // Wait 3.5 seconds of silence
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (lastMsg && lastMsg.role === 'user') {
        setSuggestions([]);
      }
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [messages, langName]);

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
            <Label htmlFor="translation-mode" className="text-[10px] cursor-pointer font-medium">中文字幕</Label>
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
      <ScrollArea className="flex-1 px-4 py-2">
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
          {suggestions.length > 0 && messages[messages.length - 1]?.role === 'model' && (
            <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4">
              <div className="flex flex-col gap-2 max-w-[90%]">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500/80 justify-center mb-1">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>你可以這樣說 (Try saying):</span>
                </div>
                {suggestions.map((s, i) => (
                  <button 
                    key={i}
                    onClick={() => {
                      sendTextMessage(s);
                      setSuggestions([]);
                    }}
                    className="text-sm px-4 py-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
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
