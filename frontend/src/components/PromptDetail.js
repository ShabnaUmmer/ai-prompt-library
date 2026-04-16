import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FaArrowLeft, FaEye, FaCalendarAlt } from 'react-icons/fa';
import './PromptDetail.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const PromptDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadPrompt();
  }, [id]);

  const loadPrompt = async () => {
    try {
      const response = await fetch(`${API_URL}/prompts/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setPrompt(data.data);
      } else {
        toast.error(data.error || 'Failed to load prompt');
        if (data.error === 'Access token required' || data.error === 'Invalid or expired token') {
          localStorage.removeItem('token');
          navigate('/login');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load prompt');
    } finally {
      setLoading(false);
    }
  };

  const getComplexityColor = (complexity) => {
    if (complexity <= 3) return 'complexity-low';
    if (complexity <= 7) return 'complexity-medium';
    return 'complexity-high';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading prompt details...</p>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="error-container">
        <p>Prompt not found</p>
        <Link to="/">Back to Library</Link>
      </div>
    );
  }

  return (
    <div className="prompt-detail-container">
      <div className="detail-header">
        <Link to="/" className="back-btn">
          <FaArrowLeft /> Back to Library
        </Link>
      </div>

      <div className="prompt-detail-card">
        <h1>{prompt.title}</h1>

        <div className="detail-meta">
          <span className={`complexity-badge ${getComplexityColor(prompt.complexity)}`}>
            Complexity: {prompt.complexity}/10
          </span>

          <span className="view-count">
            <FaEye /> Views: {prompt.view_count || 0}
          </span>

          <span className="date">
            <FaCalendarAlt /> Created: {formatDate(prompt.created_at)}
          </span>
        </div>

        <div className="prompt-content">
          <h3>Prompt Content:</h3>
          <div className="content-box">
            <p>{prompt.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptDetail;
