import React, { useState } from 'react';
import SplashScreen from './components/SplashScreen';
import AuthModal from './components/AuthModal';
import AgentPromptScreen from './components/AgentPromptScreen';
import VoiceSelectionScreen from './components/VoiceSelectionScreen';
import MainWorkspace from './components/MainWorkspace';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('splash'); // 'splash' | 'auth' | 'prompt' | 'voice' | 'workspace'
  const [currentUser, setCurrentUser] = useState(null);
  const [agentConfig, setAgentConfig] = useState(null);

  // 1. After 2s Splash Screen completes
  const handleSplashFinish = () => {
    setCurrentScreen('auth');
  };

  // 2. Newly Registered user proceeds to Prompt setup
  const handleRegistered = (user) => {
    setCurrentUser(user);
    setCurrentScreen('prompt');
  };

  // 3. Returning user logs in directly bypassing onboarding
  const handleLoggedIn = (user, config) => {
    setCurrentUser(user);
    setAgentConfig(config);
    setCurrentScreen('workspace');
  };

  // 4. Agent prompt saved
  const handlePromptSaved = (promptText) => {
    setAgentConfig(prev => ({ ...(prev || {}), system_prompt: promptText }));
    setCurrentScreen('voice');
  };

  // 5. Voice selected
  const handleVoiceSelected = (voiceType) => {
    setAgentConfig(prev => ({ ...(prev || {}), selected_voice: voiceType }));
    setCurrentScreen('workspace');
  };

  // 6. Logout
  const handleLogout = () => {
    setCurrentUser(null);
    setAgentConfig(null);
    setCurrentScreen('auth');
  };

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 font-sans">
      {currentScreen === 'splash' && (
        <SplashScreen onFinish={handleSplashFinish} />
      )}

      {currentScreen === 'auth' && (
        <AuthModal
          onRegistered={handleRegistered}
          onLoggedIn={handleLoggedIn}
        />
      )}

      {currentScreen === 'prompt' && currentUser && (
        <AgentPromptScreen
          user={currentUser}
          onPromptSaved={handlePromptSaved}
        />
      )}

      {currentScreen === 'voice' && currentUser && (
        <VoiceSelectionScreen
          user={currentUser}
          onVoiceSelected={handleVoiceSelected}
        />
      )}

      {currentScreen === 'workspace' && currentUser && (
        <MainWorkspace
          user={currentUser}
          initialConfig={agentConfig}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
