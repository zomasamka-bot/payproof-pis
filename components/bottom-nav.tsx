'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, ShieldCheck, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/',        label: 'Home',    icon: LayoutDashboard },
  { href: '/history', label: 'History', icon: Clock           },
  { href: '/verify',  label: 'Verify',  icon: ShieldCheck     },
  { href: '/export',  label: 'Backup',  icon: Download        },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="max-w-lg mx-auto flex items-stretch">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs transition-colors',
                isActive
                  ? 'text-accent'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.25]')} />
              <span className={cn('font-medium', isActive && 'font-semibold')}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
