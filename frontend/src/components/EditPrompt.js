import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FaArrowLeft, FaSave } from 'react-icons/fa';
import './AddPrompt.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

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

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadPrompt();
    loadTags();
  }, [id]);

  const loadPrompt = async () => {
    try {
      const response = await fetch(`${API_URL}/prompts/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`   
        }
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
      console.error('Failed to load tags');
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`   
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Prompt updated successfully!');
        navigate('/');
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update prompt');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  return (
    <div className="add-prompt-container">
      <div className="form-header">
        <Link to="/" className="back-btn">
          <FaArrowLeft /> Back
        </Link>
        <h1>Edit Prompt</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          name="title"
          value={formData.title}
          onChange={handleChange}
        />

        <textarea
          name="content"
          value={formData.content}
          onChange={handleChange}
        />

        <input
          type="range"
          name="complexity"
          min="1"
          max="10"
          value={formData.complexity}
          onChange={handleChange}
        />

        <div>
          {allTags.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleTagToggle(tag.id)}
            >
              #{tag.name}
            </button>
          ))}
        </div>

        <button type="submit" disabled={submitting}>
          <FaSave /> {submitting ? 'Updating...' : 'Update'}
        </button>
      </form>
    </div>
  );
};

export default EditPrompt;
