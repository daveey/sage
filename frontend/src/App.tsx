import { useState, useEffect } from 'react';
import './App.css';

interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(err => setError(err.message));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🧠 Personality Profiling App</h1>
        <p>V1 MVP - Infrastructure Test</p>

        {health && (
          <div className="status-card">
            <h2>✅ Backend Connected</h2>
            <p>Status: {health.status}</p>
            <p>Version: {health.version}</p>
            <p>Last updated: {new Date(health.timestamp).toLocaleTimeString()}</p>
          </div>
        )}

        {error && (
          <div className="error-card">
            <h2>❌ Backend Error</h2>
            <p>{error}</p>
          </div>
        )}

        <div className="info-card">
          <h3>Coming Soon:</h3>
          <ul>
            <li>✅ Google OAuth Sign In</li>
            <li>✅ Personality Profile (MBTI + Enneagram)</li>
            <li>✅ Statement Validation</li>
            <li>✅ AI-Generated Artifacts</li>
          </ul>
        </div>
      </header>
    </div>
  );
}

export default App;
