'use client';

import { Card, CardContent } from '@cove/ui/card';
import type React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

interface LazyChartWrapperProps {
  children: React.ReactNode;
  height?: string;
  rootMargin?: string;
}

// Context to provide visibility state to child components
const VisibilityContext = createContext<boolean>(false);

/**
 * Hook to check if the chart is visible (for deferring API calls)
 */
export function useChartVisibility() {
  return useContext(VisibilityContext);
}

/**
 * LazyChartWrapper - Lazy loads charts using IntersectionObserver
 * Only renders children when the component is visible or near the viewport
 * Also defers API calls until the chart is about to be visible
 */
export function LazyChartWrapper({
  children,
  height = '250px',
  rootMargin = '200px',
}: LazyChartWrapperProps) {
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasBeenVisible(true);
          }
        }
      },
      {
        // Start loading 200px before the element enters viewport
        rootMargin,
        // Trigger when at least 10% is visible
        threshold: 0.1,
      },
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [rootMargin]);

  return (
    <VisibilityContext.Provider value={hasBeenVisible}>
      <div ref={containerRef} style={{ contain: 'layout style' }}>
        {hasBeenVisible ? (
          children
        ) : (
          <Card style={{ contain: 'layout style paint' }}>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
              <div
                className="w-full animate-pulse bg-muted rounded"
                style={{ height }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </VisibilityContext.Provider>
  );
}
