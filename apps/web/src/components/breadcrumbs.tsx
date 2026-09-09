'use client';

import React, { Fragment } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs';

export function Breadcrumbs() {
  const items = useBreadcrumbs();
  if (items.length === 0) return null;

  return (
    <nav aria-label="breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 break-words text-sm text-gray-500 sm:gap-2.5">
        {items.map((item, index) => (
          <Fragment key={item.title}>
            {index !== items.length - 1 && (
              <li className="hidden md:inline-flex items-center gap-1.5">
                <Link href={item.link} className="transition-colors hover:text-gray-900">
                  {item.title}
                </Link>
              </li>
            )}
            {index < items.length - 1 && (
              <li role="presentation" aria-hidden="true" className="hidden md:block [&>svg]:size-3.5">
                <ChevronRight />
              </li>
            )}
            {index === items.length - 1 && (
              <li className="font-normal text-gray-900">
                <span role="link" aria-disabled="true" aria-current="page">
                  {item.title}
                </span>
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
