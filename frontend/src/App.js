import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import PromptList from './components/PromptList';
import PromptDetail from './components/PromptDetail';
import AddPrompt from './components/AddPrompt';
import EditPrompt from './components/EditPrompt';
import Login from './components/Login';
import Register from './components/Register';
import './App.css';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/me`, { 
        credentials: 'include' 
      });
      const data = await response.json();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
        <Routes>
          <Route path="/login" element={
            user ? <Navigate to="/" /> : <Login onLogin={setUser} />
          } />
          <Route path="/register" element={
            user ? <Navigate to="/" /> : <Register onLogin={setUser} />
          } />
          <Route path="/" element={
            user ? <PromptList user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" />
          } />
          <Route path="/prompt/:id" element={
            user ? <PromptDetail user={user} /> : <Navigate to="/login" />
          } />
          <Route path="/add" element={
            user ? <AddPrompt user={user} /> : <Navigate to="/login" />
          } />
          <Route path="/edit/:id" element={
            user ? <EditPrompt user={user} /> : <Navigate to="/login" />
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;