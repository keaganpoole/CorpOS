import React from 'react';

export default function ProfileMenu({ user = { name: 'Aria Nova', status: 'On Duty' } }) {
  return (
    <div className="profile-menu">
      <div className="profile-avatar">{user.name.split(' ').map((n) => n[0]).join('')}</div>
      <div className="profile-details">
        <strong>{user.name}</strong>
        <span>{user.status}</span>
      </div>
    </div>
  );
}
