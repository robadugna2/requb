'use client';
import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumbs } from '@/components/breadcrumbs';
import SearchInput from '@/components/search-input';

export default function Header() {
  return (
    <header className='bg-white/80 sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 backdrop-blur-md border-b border-gray-100 px-4 md:px-6'>
      <div className='flex items-center gap-2'>
        <SidebarTrigger className='-ml-1' />
        <Separator orientation='vertical' className='mr-2 h-4 bg-gray-200' />
        <Breadcrumbs />
      </div>

      <div className='flex items-center gap-2'>
        <div className='hidden md:flex'>
          <SearchInput />
        </div>
      </div>
    </header>
  );
}
