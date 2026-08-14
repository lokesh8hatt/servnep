'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN' | 'DISPATCHER';
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated - redirect to login
    if (!isAuthenticated || !user) {
      router.push('/login');
      return;
    }

    // Wrong role - redirect to their correct dashboard
    if (requiredRole === 'ADMIN' && user.role !== 'ADMIN' && user.role !== 'DISPATCHER') {
      router.push('/dashboard/customer');
      return;
    }

    if (requiredRole === 'CUSTOMER' && user.role !== 'CUSTOMER') {
      if (user.role === 'TECHNICIAN') {
        router.push('/dashboard/technician');
      } else {
        router.push('/dashboard/admin');
      }
      return;
    }

    if (requiredRole === 'TECHNICIAN' && user.role !== 'TECHNICIAN') {
      if (user.role === 'CUSTOMER') {
        router.push('/dashboard/customer');
      } else {
        router.push('/dashboard/admin');
      }
      return;
    }
  }, [isAuthenticated, user, isLoading, requiredRole, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#328CC1] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Verifying your session...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#328CC1] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Role mismatch
  const roleMatches = 
    (requiredRole === 'ADMIN' && (user.role === 'ADMIN' || user.role === 'DISPATCHER')) ||
    requiredRole === user.role;

  if (!roleMatches) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#328CC1] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}