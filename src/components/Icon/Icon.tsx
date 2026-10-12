import React from 'react';

// TODO: make sure to import only these icons and not all icons
export type IconName = 
    | 'arrow_back_ios_new'
    | 'home'
    | 'computer' 
    | 'linked_services' 
    | 'frame_exclamation' 
    | 'mystery'
    | 'close'
    | 'delete'
    | 'search'
    | 'arrow_drop_down'
    | 'add'

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: IconName;
}

export function Icon({ name, className }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}