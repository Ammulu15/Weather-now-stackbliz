import React from 'react';

export default function Card({ children, className = '', onClick }) {
  return (
    <div
      className={`rounded-3xl p-4 shadow-xl bg-white bg-opacity-5 backdrop-blur-sm border border-white border-opacity-10 ${className}`}
      onClick={onClick}
      style={{
        backdropFilter: 'blur(12px)',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      }}
    >
      {children}
    </div>
  );
}
