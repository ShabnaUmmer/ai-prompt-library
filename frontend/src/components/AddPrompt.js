import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FaArrowLeft, FaPlus, FaTimes } from 'react-icons/fa';
import './AddPrompt.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const AddPrompt = ({ user }) => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    complexity: 5,
    tags: []
  });
  const [errors, setErrors] = useState({});

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadTags();
  }, []);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'complexity' ? parseInt(value) : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleTagToggle = (tagId) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(id => id !== tagId)
        : [...prev.tags, tagId]
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim() || formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }
    if (!formData.content.trim() || formData.content.length < 20) {
      newErrors.content = 'Content must be at least 20 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Prompt created successfully!');
        navigate('/');
      } else {
        toast.error(data.error || 'Failed to create prompt');
      }
    } catch (error) {
      toast.error('Failed to create prompt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-prompt-container">
      <div className="form-header">
        <Link to="/" className="back-btn">
          <FaArrowLeft /> Back to Library
        </Link>
        <h1>Create New Prompt</h1>
      </div>

      <form onSubmit={handleSubmit} className="prompt-form">
        <div className="form-group">
          <label>Title <span className="required-star">*</span></label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter prompt title"
          />
          {errors.title && <span className="error-message">{errors.title}</span>}
        </div>

        <div className="form-group">
          <label>Content <span className="required-star">*</span></label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            rows={8}
            placeholder="Enter prompt content (min 20 characters)"
          />
          {errors.content && <span className="error-message">{errors.content}</span>}
          <small>{formData.content.length}/20+ characters</small>
        </div>

        <div className="form-group">
          <label>Complexity <span className="required-star">*</span></label>
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
                className={formData.tags.includes(tag.id) ? 'selected' : ''}
                onClick={() => handleTagToggle(tag.id)}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/')}>
            <FaTimes /> Cancel
          </button>
          <button type="submit" disabled={submitting}>
            <FaPlus /> {submitting ? 'Creating...' : 'Create Prompt'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddPrompt;