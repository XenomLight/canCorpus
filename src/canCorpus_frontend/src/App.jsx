import React, { useEffect, useState, useRef } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { createActor, canisterId, canCorpus_backend } from 'declarations/canCorpus_backend';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState('');
  const [status, setStatus] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [messages, setMessages] = useState([]); 
  const chatContainerRef = useRef(null); 

  const [authClient, setAuthClient] = useState(null);
  const [actor, setActor] = useState(undefined);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState('Click "Whoami" to see your principal ID');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });
  // editing state for entries
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    (async () => {
      await updateActor();
      await loadEntries();
      // show starter assistant message on first load
      setMessages([{ sender: 'ai', text: "Hi! I'm here to assist you, kindly ask any question" }]);
    })();
  }, []);

  async function loadEntries() {
    try {
      setBusy(true);
      const list = actor ? await actor.listEntries() : await canCorpus_backend.listEntries();
      setEntries(list || []);
    } catch (e) {
      console.error(e);
      showToast('Failed to load entries', 'error');
    } finally {
      setBusy(false);
    }
  }

  const network = process.env.DFX_NETWORK;
  const identityProvider = network === 'ic'
    ? 'https://id.ai/'
    : `http://${process.env.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`;

  async function updateActor() {
    const ac = await AuthClient.create();
    const identity = ac.getIdentity();
    const authActor = createActor(canisterId, { agentOptions: { identity } });
    const auth = await ac.isAuthenticated();
    setAuthClient(ac);
    setActor(authActor);
    setIsAuthenticated(auth);
    setLoggedIn(auth);
    if (auth) {
      await loadEntries();
    }
  }

  function showToast(message, type = 'info', timeout = 3000) {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), timeout);
  }

  const login = async () => {
    if (!authClient) {
      setStatus('Auth client not ready');
      return;
    }
    await authClient.login({
      identityProvider,
      onSuccess: updateActor,
    });
  };

  const logout = async () => {
    if (!authClient) return;
    await authClient.logout();
    await updateActor();
    setPrincipal('Click "Whoami" to see your principal ID');
  };

  async function handleAddEntry(e) {
    e.preventDefault();
    if (!newEntry.trim()) return;
    try {
      setBusy(true);
      const target = actor || canCorpus_backend;
      await target.addEntry(newEntry.trim());
      setNewEntry('');
      await loadEntries();
      showToast('Entry added', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to add entry', 'error');
    }
    finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    try {
      setBusy(true);
      const target = actor || canCorpus_backend;
      await target.clearEntries();
      await loadEntries();
      showToast('All entries cleared', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to clear entries', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleAsk(e) {
    e?.preventDefault();
    const questionToAsk = currentQuestion.trim();
    if (!questionToAsk) return;

    // Add user's question and a thinking bubble to the chat
    setMessages(prev => [
      ...prev,
      { sender: 'user', text: questionToAsk },
      { sender: 'ai', text: '...thinking' }
    ]);
    setCurrentQuestion('');

    try {
      setBusy(true);
      const target = actor || canCorpus_backend;
      const res = await target.ask(questionToAsk);
      // Update the "thinking" bubble with the actual answer
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].text = res;
        return newMessages;
      });
    } catch (err) {
      console.error(err);
      // Update the "thinking" bubble with an error message
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].text = 'Error asking canister';
        return newMessages;
      });
      showToast('Failed to get answer', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function populateDemo() {
    const demo = [
      'Our refund policy: refunds within 30 days with receipt.',
      'Shipping: standard shipping takes 3-5 business days.',
      'Support hours: 9am-5pm Monday to Friday.',
    ];
    try {
      setBusy(true);
      const target = actor || canCorpus_backend;
      for (const d of demo) {
        await target.addEntry(d);
      }
      await loadEntries();
      showToast('Demo data populated', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to populate demo data', 'error');
    }
    finally {
      setBusy(false);
    }
  }

  return (
    <>
      <main className="app-container">
        <div className="header">
          <img className="logo" src="/logo2.svg" alt="logo" />
        </div>

        <div className="controls">
          {!isAuthenticated ? (
            <button className="btn" onClick={login} disabled={busy}>
              Login to populate data
            </button>
          ) : (
            <button className="btn secondary" onClick={logout} disabled={busy}>
              Logout
            </button>
          )}

          {isAuthenticated && (
            <button className="btn ghost" onClick={populateDemo} disabled={busy}>
              Populate Demo Data
            </button>
          )}
        </div>

        {/*CHAT UI*/}
        <section className="panel">
          <h3>canCorpus's Chat</h3>
          <div className="chat-container" ref={chatContainerRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
          </div>
            <form onSubmit={handleAsk} className="user-form" style={{ marginTop: '16px' }}>
            <input
              value={currentQuestion}
              onChange={(e) => setCurrentQuestion(e.target.value)}
              placeholder="Enter your question"
              style={{ width: '60%' }}
            />
            <button className="btn" type="submit" style={{ marginLeft: 8 }} disabled={busy}>
              {busy ? 'Please wait...' : 'Ask'}
            </button>
          </form>
        </section>

        {isAuthenticated && (
          <section className="panel">
            <h3>Admin: Manage entries</h3>
            <form onSubmit={handleAddEntry}>
              <textarea
                className="textarea"
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                rows={3}
                placeholder="New knowledge entry"
              />
              <br />
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Working...' : 'Add Entry'}
              </button>
              <button className="btn secondary" type="button" onClick={handleClear} style={{ marginLeft: 8 }} disabled={busy}>
                Clear All
              </button>
            </form>

            <div style={{ marginTop: 12 }}>
              <strong>Stored entries ({entries.length}):</strong>
              <ul className="entries-list">
                {entries.map((e, idx) => (
                  <li key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {editingIndex === idx ? (
                      <div>
                        <textarea
                          className="textarea"
                          value={editingText}
                          onChange={(ev) => setEditingText(ev.target.value)}
                        />
                        <div style={{ marginTop: 8 }}>
                          <button className="btn" onClick={async () => {
                            if (busy) return;
                            try {
                              setBusy(true);
                              const target = actor || canCorpus_backend;
                              await target.editEntry(BigInt(idx), editingText);
                              setEditingIndex(null);
                              setEditingText('');
                              await loadEntries();
                              showToast('Entry updated', 'success');
                            } catch (err) {
                              console.error(err);
                              showToast('Failed to update entry', 'error');
                            } finally {
                              setBusy(false);
                            }
                          }}>Save</button>
                          <button className="btn secondary" onClick={() => { setEditingIndex(null); setEditingText(''); }} style={{ marginLeft: 8 }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ flex: 1 }}>{e}</span>
                        <div>
                          <button className="btn ghost" onClick={() => { setEditingIndex(idx); setEditingText(e); }}>Edit</button>
                          <button className="btn secondary" onClick={async () => {
                            if (busy) return;
                            if (!confirm('Delete this entry?')) return;
                            try {
                              setBusy(true);
                              const target = actor || canCorpus_backend;
                              await target.deleteEntry(BigInt(idx));
                              await loadEntries();
                              showToast('Entry deleted', 'success');
                            } catch (err) {
                              console.error(err);
                              showToast('Failed to delete entry', 'error');
                            } finally {
                              setBusy(false);
                            }
                          }} style={{ marginLeft: 8 }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="status">{status}</section>
        {toast.message && (
          <div className={`toast ${toast.type}`}>{toast.message}</div>
        )}
      </main>
    </>
  );
}

export default App;