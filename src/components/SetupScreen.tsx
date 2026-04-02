import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { languages, proficiencyLevels, scenarios, Scenario } from '../data/scenarios';
import { tutors, Tutor } from '../data/tutors';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { globalAudioPlayer } from '../lib/audio-utils';

interface SetupScreenProps {
  onStart: (config: { language: string; level: string; tutor: Tutor; scenario: Scenario }) => void;
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [language, setLanguage] = useState(languages[0].code);
  const [level, setLevel] = useState(proficiencyLevels[0].id);
  const [selectedTutorId, setSelectedTutorId] = useState(tutors[0].id);
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0].id);

  const handleStart = () => {
    // Unlock iOS Audio with the user gesture, wrapped in try-catch to prevent UI crash
    try {
      globalAudioPlayer.init();
      if (globalAudioPlayer.getAudioContext()?.state === 'suspended') {
        globalAudioPlayer.getAudioContext()?.resume();
      }
    } catch (e) {
      console.error('Failed to initialize AudioContext on user gesture:', e);
    }
    
    const tutor = tutors.find(t => t.id === selectedTutorId)!;
    const scenario = scenarios.find(s => s.id === selectedScenarioId)!;
    onStart({ language, level, tutor, scenario });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-8">
      <div className="text-center space-y-2 mt-8">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Talk AI</h1>
        <p className="text-muted-foreground text-lg">Your personal AI language tutor</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass border-none shadow-none">
          <CardHeader>
            <CardTitle>Language & Level</CardTitle>
            <CardDescription>What do you want to practice?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="bg-background/50 border-none glass">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="glass border-none">
                  {languages.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Proficiency Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="bg-background/50 border-none glass">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent className="glass border-none">
                  {proficiencyLevels.map(lvl => (
                    <SelectItem key={lvl.id} value={lvl.id}>{lvl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-none shadow-none">
          <CardHeader>
            <CardTitle>Scenario</CardTitle>
            <CardDescription>Choose a role-play situation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {scenarios.map(scenario => (
                <div
                  key={scenario.id}
                  className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer ${selectedScenarioId === scenario.id ? 'border-primary bg-primary/20 ring-1 ring-primary/30' : 'border-white/5 hover:bg-white/5'}`}
                  onClick={() => setSelectedScenarioId(scenario.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{scenario.icon}</span>
                    <div>
                      <h4 className="font-medium text-sm">{scenario.title}</h4>
                      <p className="text-xs text-muted-foreground">{scenario.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-none shadow-none">
        <CardHeader>
          <CardTitle>Choose your Tutor</CardTitle>
          <CardDescription>Select an AI personality to practice with</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tutors.map(tutor => (
              <div
                key={tutor.id}
                className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${selectedTutorId === tutor.id ? 'border-primary ring-2 ring-primary/20 bg-primary/20' : 'border-white/5 hover:border-primary/30 hover:bg-white/5'}`}
                onClick={() => setSelectedTutorId(tutor.id)}
              >
                <div className="flex items-center gap-4 mb-3">
                  <Avatar className="h-12 w-12 border-none ring-1 ring-white/20">
                    <AvatarFallback className="text-2xl bg-background/50">{tutor.avatar}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{tutor.name}</h3>
                    <Badge variant="secondary" className="text-[10px] font-normal bg-white/10 text-foreground border-none">Voice: {tutor.voice}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{tutor.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center pb-12">
        <Button size="lg" className="w-full max-w-md text-lg h-14 rounded-full" onClick={handleStart}>
          Start Practice
        </Button>
      </div>
    </div>
  );
}
