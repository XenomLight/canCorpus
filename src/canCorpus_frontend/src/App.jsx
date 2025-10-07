import { useEffect, useState } from 'react';
import { canCorpus_backend } from 'declarations/canCorpus_backend';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (loggedIn) {
      loadEntries();
    }
  }, [loggedIn]);

  async function loadEntries() {
    try {
      const list = await canCorpus_backend.listEntries();
      setEntries(list || []);
    } catch (e) {
      console.error(e);
      setStatus('Failed to load entries');
    }
  }

  // Placeholder Internet Identity login: toggles admin mode.
  // In a production app, replace with real II auth using @dfinity/auth-client.
  function handleLogin() {
    setLoggedIn(true);
    setStatus('Logged in as admin (simulated)');
  }

  function handleLogout() {
    setLoggedIn(false);
    setStatus('Logged out');
  }

  async function handleAddEntry(e) {
    e.preventDefault();
    if (!newEntry.trim()) return;
    try {
      await canCorpus_backend.addEntry(newEntry.trim());
      setNewEntry('');
      await loadEntries();
      setStatus('Entry added');
    } catch (err) {
      console.error(err);
      setStatus('Failed to add entry');
    }
  }

  async function handleClear() {
    try {
      await canCorpus_backend.clearEntries();
      await loadEntries();
      setStatus('All entries cleared');
    } catch (err) {
      console.error(err);
      setStatus('Failed to clear entries');
    }
  }

  async function handleAsk(e) {
    e?.preventDefault();
    if (!question.trim()) return;
    setAnswer('...thinking');
    try {
      const res = await canCorpus_backend.ask(question.trim());
      setAnswer(res);
    } catch (err) {
      console.error(err);
      setAnswer('Error asking canister');
    }
  }

  // Optional: populate demo data after login
  async function populateDemo() {
    const demo = [
      'Our refund policy: refunds within 30 days with receipt.',
      'Shipping: standard shipping takes 3-5 business days.',
      'Support hours: 9am-5pm Monday to Friday.'
    ];
    try {
      for (const d of demo) {
        await canCorpus_backend.addEntry(d);
      }
      await loadEntries();
      setStatus('Demo data populated');
    } catch (err) {
      console.error(err);
      setStatus('Failed to populate demo data');
    }
  }

  return (
    <main className="app-container">
      <div className="header">
        <img src="/logo2.svg" alt="logo" />
      </div>

      <div className="controls">
        {!loggedIn ? (
          <button className="btn" onClick={handleLogin}>
            Login with II (simulated)
          </button>
        ) : (
          <>
            <button className="btn secondary" onClick={handleLogout}>
              Logout
            </button>
            <button className="btn ghost" onClick={populateDemo}>
              Populate Demo Data
            </button>
          </>
        )}
      </div>

      <section className="panel">
        <h3>User: Ask a question</h3>
        <form onSubmit={handleAsk} className="user-form">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter your question"
            style={{ width: '60%' }}
          />
          <button className="btn" type="submit" style={{ marginLeft: 8 }}>
            Ask
          </button>
        </form>
        <div style={{ marginTop: 8 }}>
          <strong>Answer:</strong>
          <div id="answer">{answer}</div>
        </div>
      </section>

      <section className="panel">
        <h3>Admin: Manage entries</h3>
        {!loggedIn ? (
          <div className="admin-note">You must log in with II to manage entries.</div>
        ) : (
          <>
            <form onSubmit={handleAddEntry}>
              <textarea
                className="textarea"
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                rows={3}
                placeholder="New knowledge entry"
              />
              <br />
              <button className="btn" type="submit">
                Add Entry
              </button>
              <button className="btn secondary" type="button" onClick={handleClear} style={{ marginLeft: 8 }}>
                Clear All
              </button>
            </form>

            <div style={{ marginTop: 12 }}>
              <strong>Stored entries ({entries.length}):</strong>
              <ul className="entries-list">
                {entries.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <section className="status">{status}</section>
    </main>
  );
}

export default App;
