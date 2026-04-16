import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FaPlus, FaEdit, FaTrash, FaTag } from 'react-icons/fa';
import Profile from './Profile';
import './PromptList.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const PromptList = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTag, setFilterTag] = useState('all');
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    if (user) {
      loadPrompts();
      loadTags();
    }
  }, [user]);

  const loadPrompts = async () => {
    try {
      const response = await fetch(`${API_URL}/prompts`, { 
        credentials: 'include' 
      });
      const data = await response.json();
      
      if (data.success) {
        setPrompts(data.data);
      } else if (data.error === 'Please login first') {
        navigate('/login');
      }
    } catch (error) {
      toast.error('Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const response = await fetch(`${API_URL}/tags`);
      const data = await response.json();
      if (data.success) {
        setAllTags(data.data);
      }
    } catch (error) {
      console.error('Failed to load tags');
    }
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this prompt?')) {
      try {
        const response = await fetch(`${API_URL}/prompts/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
          toast.success('Prompt deleted successfully');
          setPrompts(prompts.filter(prompt => prompt.id !== id));
        } else {
          toast.error(data.error || 'Failed to delete prompt');
        }
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Failed to delete prompt');
      }
    }
  };

  const handleEdit = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/edit/${id}`);
  };

  const filteredPrompts = filterTag === 'all' 
    ? prompts 
    : prompts.filter(prompt => prompt.tags?.some(tag => tag.id === parseInt(filterTag)));

  const getComplexityColor = (complexity) => {
    if (complexity <= 3) return 'complexity-low';
    if (complexity <= 7) return 'complexity-medium';
    return 'complexity-high';
  };

  if (!user) return null;
  if (loading) return <div className="loading-container"><div className="loader"></div></div>;

  return (
    <div className="prompt-list-container">
        <div className="top-bar ">
          <h1 className='title-section'>AI Prompt Library</h1>
          <div className="profile-section">
            <Profile user={user} onLogout={onLogout} />
            </div>
        </div>
        
            
        <div className="add-button-section">
            <Link to="/add" className="add-prompt-btn">
                <FaPlus /> Add New Prompt
            </Link>
        </div>

      {allTags.length > 0 && (
        <div className="filter-section">
          <FaTag />
          <label>Filter by tag:</label>
          <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
            <option value="all">All Prompts</option>
            {allTags.map(tag => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        </div>
      )}

      {filteredPrompts.length === 0 ? (
        <div className="empty-state">
          <p>No prompts yet. Create your first prompt!</p>
          <Link to="/add" className="create-first-btn">
            <FaPlus /> Create First Prompt
          </Link>
        </div>
      ) : (
        <div className="prompts-grid">
          {filteredPrompts.map((prompt) => (
            <div key={prompt.id} className="prompt-card">
              <Link to={`/prompt/${prompt.id}`} className="prompt-link">
                <h3>{prompt.title}</h3>
                <div className="prompt-meta">
                  <span className={`complexity-badge ${getComplexityColor(prompt.complexity)}`}>
                    Complexity: {prompt.complexity}/10
                  </span>
                  <span className="date">{new Date(prompt.created_at).toLocaleDateString()}</span>
                </div>
                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="prompt-tags">
                    {prompt.tags.map(tag => (
                      <span key={tag.id} className="tag-badge">#{tag.name}</span>
                    ))}
                  </div>
                )}
              </Link>
              <div className="prompt-actions">
                <button onClick={(e) => handleEdit(prompt.id, e)} className="edit-btn">
                  <FaEdit /> Edit
                </button>
                <button onClick={(e) => handleDelete(prompt.id, e)} className="delete-btn">
                  <FaTrash /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PromptList;