import React, { useState } from 'react';
import { AppRoute } from './types';
import { HomePage } from './pages/HomePage';
import { HidePage } from './pages/HidePage';
import { RevealPage } from './pages/RevealPage';
import { EmojiHidePage } from './pages/EmojiHidePage';
import { EmojiRevealPage } from './pages/EmojiRevealPage';
import { AboutPage } from './pages/AboutPage';
import { Layout } from './components/Layout';
import { Analytics } from "@vercel/analytics/react";

const App: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>(AppRoute.HOME);

  const renderPage = () => {
    switch (route) {
      case AppRoute.HOME:
        return <HomePage onNavigate={setRoute} />;
      case AppRoute.HIDE:
        return <HidePage onNavigate={setRoute} />;
      case AppRoute.REVEAL:
        return <RevealPage onNavigate={setRoute} />;
      case AppRoute.EMOJI_HIDE:
        return <EmojiHidePage onNavigate={setRoute} />;
      case AppRoute.EMOJI_REVEAL:
        return <EmojiRevealPage onNavigate={setRoute} />;
      case AppRoute.ABOUT:
        return <AboutPage onNavigate={setRoute} />;
      default:
        return <HomePage onNavigate={setRoute} />;
    }
  };

  return (
    <Layout currentRoute={route} onNavigate={setRoute}>
      {renderPage()}
      <Analytics />
    </Layout>
  );
};

export default App;