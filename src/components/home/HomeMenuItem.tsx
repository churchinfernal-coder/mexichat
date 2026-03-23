/**
 * MEXICHAT — HomeMenuItem
 * Large, mobile-first icon tile for the HomeScreen grid.
 * Fills screen width, animated hover/press, pulsing badge.
 */

import React from 'react';

export interface HomeMenuItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  disabled?: boolean;
  onClick: () => void;
}

const HomeMenuItem: React.FC<HomeMenuItemProps> = ({
  icon,
  label,
  badge,
  disabled = false,
  onClick,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="home-tile group"
    style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
  >
    {/* Pulsing badge */}
    {typeof badge === 'number' && badge > 0 && (
      <span className="home-tile-badge">
        {badge > 99 ? '99+' : badge}
      </span>
    )}

    {/* Icon area */}
    <div className="home-tile-icon">
      {icon}
    </div>

    {/* Label */}
    <span className="home-tile-label">{label}</span>
  </button>
);

export default React.memo(HomeMenuItem);
