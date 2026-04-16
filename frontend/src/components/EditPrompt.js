import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FaArrowLeft, FaSave, FaTimes } from 'react-icons/fa';
import './AddPrompt.css';

const API_URL = 'http://localhost:5000/api';

const EditPrompt = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    complexity: 5,
    tags: []
  });

  useEffect(() => {
    if (user) {
      loadPrompt();
      loadTags();
    }
  }, [id, user]);

  const loadPrompt = async () => {
    try {
      const response = await fetch(`${API_URL}/prompts/${id}`, { 
        credentials: 'include' 
      });
      const data = await response.json();
      if (data.success) {
        setFormData({
          title: data.data.title,
          content: data.data.content,
          complexity: data.data.complexity,
          tags: data.data.tags?.map(t => t.id) || []
        });
      } else {
        toast.error('Prompt not found');
        navigate('/');
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Failed to load prompt');
      navigate('/');
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
      console.error('Failed to load tags:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'complexity' ? parseInt(value) : value
    }));
  };

  const handleTagToggle = (tagId) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(id => id !== tagId)
        : [...prev.tags, tagId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const response = await fetch(`${API_URL}/prompts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('Prompt updated successfully!');
        navigate('/');
      } else {
        toast.error(data.error || 'Failed to update prompt');
      }
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update prompt');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading prompt...</p>
      </div>
    );
  }

  return (
    <div className="add-prompt-container">
      <div className="form-header">
        <Link to="/" className="back-btn">
          <FaArrowLeft /> Back to Library
        </Link>
        <h1>Edit Prompt</h1>
      </div>

      <form onSubmit={handleSubmit} className="prompt-form">
        <div className="form-group">
          <label>Title *</label>
          <input 
            type="text" 
            name="title" 
            value={formData.title} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div className="form-group">
          <label>Content *</label>
          <textarea 
            name="content" 
            value={formData.content} 
            onChange={handleChange} 
            rows={8} 
            required 
          />
        </div>

        <div className="form-group">
          <label>Complexity *</label>
          <input 
            type="range" 
            name="complexity" 
            min="1" 
            max="10" 
            value={formData.complexity} 
            onChange={handleChange} 
          />
          <span className="complexity-value">{formData.complexity}/10</span>
        </div>

        <div className="form-group">
          <label>Tags (Optional)</label>
          <div className="tags-selector">
            {allTags.map(tag => (
              <button
                key={tag.id}
                type="button"
                className={`tag-option ${formData.tags.includes(tag.id) ? 'selected' : ''}`}
                onClick={() => handleTagToggle(tag.id)}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/')} className="cancel-btn">
            <FaTimes /> Cancel
          </button>
          <button type="submit" disabled={submitting} className="submit-btn">
            <FaSave /> {submitting ? 'Updating...' : 'Update Prompt'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditPrompt;