import React from 'react';

export default function Menu({ pages, activePage, onPageChange }) {
  const handlePageSelect = (id) => {
    onPageChange?.(id);
  };

  return (
    <div className="menu">
      <div className="menu-rail">
        <div className="menu-icons">
          {pages.map((page) => (
            <button
              key={page.id}
              className={`menu-icon ${activePage === page.id ? 'active' : ''}`}
              onClick={() => handlePageSelect(page.id)}
              type="button"
              aria-label={page.label}
            >
              {page.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
