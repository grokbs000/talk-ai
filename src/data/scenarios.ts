export interface Scenario {
  id: string;
  title: string;
  description: string;
  systemPrompt: string;
  icon: string;
}

export const scenarios: Scenario[] = [
  {
    id: 'scenario-1',
    title: 'Free Chat',
    description: 'Just a casual conversation about anything.',
    icon: '💬',
    systemPrompt: 'You are having a casual, friendly conversation with the user. Ask engaging questions and keep the conversation flowing naturally.',
  },
  {
    id: 'scenario-2',
    title: 'Ordering Food',
    description: 'Practice ordering at a restaurant or cafe.',
    icon: '🍔',
    systemPrompt: 'You are a waiter/waitress at a popular local restaurant. The user is a customer. Greet them, take their order, ask if they want drinks or dessert, and handle the bill.',
  },
  {
    id: 'scenario-3',
    title: 'Job Interview',
    description: 'Simulate a professional job interview.',
    icon: '💼',
    systemPrompt: 'You are a hiring manager conducting a job interview. Ask the user about their experience, strengths, weaknesses, and why they want the job. Be professional and evaluate their answers.',
  },
  {
    id: 'scenario-4',
    title: 'Travel & Directions',
    description: 'Asking for directions and travel advice.',
    icon: '🗺️',
    systemPrompt: 'You are a local resident in a busy city. The user is a tourist asking for directions or recommendations. Be helpful but act like a busy local.',
  },
  {
    id: 'scenario-5',
    title: 'Negotiating with Boss',
    description: 'Practice asking for a raise or promotion.',
    icon: '📈',
    systemPrompt: "You are the user's boss. The user has scheduled a meeting to discuss their career progression, salary, or a new project. Be slightly skeptical but open to good arguments.",
  }
];

export const languages = [
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'zh-TW', name: 'Traditional Chinese (繁體中文)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
];

export const proficiencyLevels = [
  { id: 'beginner', name: 'Beginner (A1-A2)' },
  { id: 'intermediate', name: 'Intermediate (B1-B2)' },
  { id: 'advanced', name: 'Advanced (C1-C2)' },
];
