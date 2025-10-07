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
      const list = actor ? await actor.listEntries() : await canCorpus_backend.listEntries();
      setEntries(list || []);
    } catch (e) {
      console.error(e);
      setStatus('Failed to load entries');
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
      const target = actor || canCorpus_backend;
      await target.addEntry(newEntry.trim());
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
      const target = actor || canCorpus_backend;
      await target.clearEntries();
      await loadEntries();
      setStatus('All entries cleared');
    } catch (err) {
      console.error(err);
      setStatus('Failed to clear entries');
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
    }
  }

  async function populateDemo() {
    const demo = [
      'Our refund policy: refunds within 30 days with receipt.',
      'Shipping: standard shipping takes 3-5 business days.',
      'Support hours: 9am-5pm Monday to Friday.',
    ];
    try {
      const target = actor || canCorpus_backend;
      for (const d of demo) {
        await target.addEntry(d);
      }
      await loadEntries();
      setStatus('Demo data populated');
    } catch (err) {
      console.error(err);
      setStatus('Failed to populate demo data');
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
            <button className="btn" onClick={login}>
              Login to populate data
            </button>
          ) : (
            <button className="btn secondary" onClick={logout}>
              Logout
            </button>
          )}

          {isAuthenticated && (
            <button className="btn ghost" onClick={populateDemo}>
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
            <button className="btn" type="submit" style={{ marginLeft: 8 }}>
              Ask
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
          </section>
        )}

        <section className="status">{status}</section>
      </main>
    </>
  );
}

export default App;