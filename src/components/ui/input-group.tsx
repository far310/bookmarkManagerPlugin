import * as React from 'react';

import { cn } from '@src/lib/utils';

type InputGroupProps = React.ComponentProps<'div'>;

type InputGroupAddonProps = React.ComponentProps<'div'> & {
  side?: 'start' | 'end';
};

function InputGroup({ className, ...props }: InputGroupProps) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        'flex h-9 w-full items-center rounded-lg border border-border bg-background shadow-xs transition-[color,box-shadow,border-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        className,
      )}
      {...props}
    />
  );
}

function InputGroupAddon({ className, side = 'start', ...props }: InputGroupAddonProps) {
  return (
    <div
      data-slot="input-group-addon"
      data-side={side}
      className={cn('inline-flex shrink-0 items-center text-muted-foreground', side === 'start' ? 'pl-2' : 'pr-1', className)}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon };
