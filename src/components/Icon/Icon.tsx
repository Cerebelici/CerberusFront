import React from 'react';

// TODO: make sure to import only these icons and not all icons
export type IconName = 
    | 'arrow_back_ios_new'
    | 'arrow_forward_ios'
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
    | 'radar'
    | 'bug_report'
    | 'progress_activity'
    | 'refresh'
    | 'report'
    | 'settings'

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