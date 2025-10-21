declare module 'streamdown' {
  import * as React from 'react';

  export interface StreamdownProps {
    children: string;
    parseIncompleteMarkdown?: boolean;
    className?: string;
    components?: Partial<Record<string, any>>;
    rehypePlugins?: any[];
    remarkPlugins?: any[];
    shikiTheme?: [any, any];
    mermaidConfig?: any;
    controls?: boolean | { table?: boolean; code?: boolean; mermaid?: boolean };
    isAnimating?: boolean;
  }

  export const Streamdown: React.FC<StreamdownProps>;
  export const defaultRehypePlugins: any;
  export const defaultRemarkPlugins: any;
}



