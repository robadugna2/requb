'use client';
import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SearchInput() {
  return (
    <div className='w-full space-y-2'>
      <Button
        variant='outline'
        className='bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 relative h-9 w-full justify-start rounded-lg text-sm font-normal shadow-sm sm:pr-12 md:w-40 lg:w-64 border-gray-200 dark:border-gray-800'
      >
        <Search className='mr-2 h-4 w-4' />
        Search...
        <kbd className='bg-gray-100 dark:bg-white/[0.08] pointer-events-none absolute top-[0.3rem] right-[0.3rem] hidden h-6 items-center gap-1 rounded border border-gray-200 dark:border-gray-800 px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex'>
          <span className='text-xs'>⌘</span>K
        </kbd>
      </Button>
    </div>
  );
}
