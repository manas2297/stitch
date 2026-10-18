import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold uppercase [&>svg]:size-3 [&>svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: '',
        blue: 'bg-primary/10 text-primary',
        green: 'bg-success/12 text-success',
        orange: 'bg-warning/12 text-warning',
        red: 'bg-destructive/12 text-destructive',
        purple: 'bg-[rgba(124,58,237,0.1)] text-[#7c3aed]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean };

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
