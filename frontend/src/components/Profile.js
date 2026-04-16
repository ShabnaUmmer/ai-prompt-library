import React from 'react';
import { FaUser, FaSignOutAlt } from 'react-icons/fa';
import './Profile.css';

const Profile = ({ user, onLogout }) => {
  return (
    <div className="profile-dropdown">
      <div className="profile-icon">
        <FaUser /> {user?.username || 'User'}
        <div className="dropdown-content">
          <div className="dropdown-header">
            <strong>{user?.username}</strong>
            <small>Logged in</small>
          </div>
          <hr />
          <button onClick={onLogout} className="dropdown-logout">
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;