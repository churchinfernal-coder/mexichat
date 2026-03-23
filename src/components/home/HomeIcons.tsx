/**
 * MEXICHAT — HomeScreen icon components.
 * Uses custom PNG icon assets for the 4 main tiles.
 * Settings uses a clean SVG gear.
 */

import React from 'react';
import chatsIcon from '@/assets/home-icons/chats.png';
import gruposIcon from '@/assets/home-icons/grupos.png';
import pagosIcon from '@/assets/home-icons/pagos.png';
import comunidadIcon from '@/assets/home-icons/comunidad.png';

interface IconImgProps {
  src: string;
  alt: string;
}

const IconImg: React.FC<IconImgProps> = ({ src, alt }) => (
  <img
    src={src}
    alt={alt}
    draggable={false}
    style={{
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      borderRadius: '22px',
      pointerEvents: 'none',
    }}
  />
);

/** Blue chat bubble with 3 dots */
export const ChatBubblesIcon: React.FC = () => (
  <IconImg src={chatsIcon} alt="Chats" />
);

/** Blue speech bubble with group of people */
export const GroupPeopleIcon: React.FC = () => (
  <IconImg src={gruposIcon} alt="Grupos" />
);

/** Green dollar sign */
export const PaymentsIcon: React.FC = () => (
  <IconImg src={pagosIcon} alt="Pagos" />
);

/** Colorful 4-quadrant community icon */
export const CommunityIcon: React.FC = () => (
  <IconImg src={comunidadIcon} alt="Comunidad" />
);

/** Clean settings gear icon */
export const SettingsGearIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"
      stroke="#475569"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.14 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.82 19.14a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.86 8.82a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9.18a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9.18a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      stroke="#475569"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);