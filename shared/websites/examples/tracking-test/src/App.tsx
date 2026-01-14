import { useState, FormEvent } from 'react';
import { L10 } from './lib/tracking';

function App() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      await L10.createLead(email);
      setMessage('Success!');
      setIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed');
      setIsError(true);
    }
  };

  const handleCustomEvent = () => {
    L10.trackEvent('button_click', { button: 'hero_cta' });
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>L10 Tracking Test Page</h1>
      <p>This page tests the real L10 tracking library.</p>

      <form id="lead-form" onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          style={{ padding: '0.5rem', marginRight: '0.5rem', fontSize: '1rem' }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
          Sign Up
        </button>
      </form>

      <p id="message" style={{ color: isError ? 'red' : 'green', marginTop: '1rem' }}>
        {message}
      </p>

      <button
        id="custom-event-btn"
        onClick={handleCustomEvent}
        style={{ marginTop: '2rem', padding: '0.5rem 1rem', fontSize: '1rem' }}
      >
        Track Custom Event
      </button>
    </div>
  );
}

export default App;
