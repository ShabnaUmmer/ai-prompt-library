import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FaUserPlus, FaUser, FaLock, FaEye, FaEyeSlash, FaCheck, FaTimes } from 'react-icons/fa';
import './Register.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const Register = ({ onLogin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    if (name === 'password') {
      validatePasswordStrength(value);
    }
  };

  const validatePasswordStrength = (password) => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    });
  };

  const getPasswordStrengthScore = () => {
    const strength = Object.values(passwordStrength).filter(Boolean).length;
    return strength;
  };

  const getPasswordStrengthText = () => {
    const score = getPasswordStrengthScore();
    if (score <= 2) return { text: 'Weak', color: '#f44336', width: '25%' };
    if (score <= 3) return { text: 'Fair', color: '#ff9800', width: '50%' };
    if (score <= 4) return { text: 'Good', color: '#2196f3', width: '75%' };
    return { text: 'Strong', color: '#4caf50', width: '100%' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    const strengthScore = getPasswordStrengthScore();
    if (strengthScore < 3) {
      toast.error('Please choose a stronger password (at least 3 requirements)');
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Registration successful!');
        onLogin(data.user);
        navigate('/');
      } else {
        toast.error(data.error || 'Registration failed');
      }
    } catch (error) {
      toast.error('Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const toggleShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const strength = getPasswordStrengthText();

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1><FaUserPlus /> Register</h1>
        <p>Create an account to start saving prompts</p>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label><FaUser /> Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength="3"
              placeholder="Choose a username (min 3 characters)"
            />
          </div>

          <div className="form-group">
            <label><FaLock /> Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Choose a strong password"
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={toggleShowPassword}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="password-strength-container">
                <div className="strength-bar">
                  <div 
                    className="strength-fill" 
                    style={{ 
                      width: strength.width, 
                      backgroundColor: strength.color 
                    }}
                  />
                </div>
                <div className="strength-text" style={{ color: strength.color }}>
                  Password Strength: {strength.text}
                </div>
                
                <div className="password-requirements">
                  <div className={`requirement ${passwordStrength.hasMinLength ? 'met' : ''}`}>
                    {passwordStrength.hasMinLength ? <FaCheck /> : <FaTimes />}
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`requirement ${passwordStrength.hasUpperCase ? 'met' : ''}`}>
                    {passwordStrength.hasUpperCase ? <FaCheck /> : <FaTimes />}
                    <span>At least 1 uppercase letter</span>
                  </div>
                  <div className={`requirement ${passwordStrength.hasLowerCase ? 'met' : ''}`}>
                    {passwordStrength.hasLowerCase ? <FaCheck /> : <FaTimes />}
                    <span>At least 1 lowercase letter</span>
                  </div>
                  <div className={`requirement ${passwordStrength.hasNumber ? 'met' : ''}`}>
                    {passwordStrength.hasNumber ? <FaCheck /> : <FaTimes />}
                    <span>At least 1 number</span>
                  </div>
                  <div className={`requirement ${passwordStrength.hasSpecialChar ? 'met' : ''}`}>
                    {passwordStrength.hasSpecialChar ? <FaCheck /> : <FaTimes />}
                    <span>At least 1 special character (!@#$%^&*)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm your password"
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={toggleShowConfirmPassword}
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <div className="error-message">
                <FaTimes /> Passwords do not match
              </div>
            )}
            {formData.confirmPassword && formData.password === formData.confirmPassword && formData.password && (
              <div className="success-message">
                <FaCheck /> Passwords match
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="auth-btn">
            <FaUserPlus /> {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;