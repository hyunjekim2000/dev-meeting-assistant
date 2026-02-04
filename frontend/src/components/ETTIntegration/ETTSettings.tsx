'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ettService } from '@/services/ettService';

/**
 * ETT Settings Component
 *
 * Shows login form when ticket generation is enabled.
 * API URL comes from .env, auth is at runtime.
 */
export function ETTSettings() {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [authState, setAuthState] = React.useState(ettService.getAuthState());

  const hasApiUrl = ettService.hasApiUrl();
  const apiUrl = ettService.getApiUrl();

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await ettService.login(username, password);

    if (result.success) {
      setAuthState(ettService.getAuthState());
      setUsername('');
      setPassword('');
    } else {
      setError(result.message);
    }

    setIsLoading(false);
  };

  const handleLogout = () => {
    ettService.logout();
    setAuthState(ettService.getAuthState());
  };

  if (!hasApiUrl) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
        <p className="text-yellow-800 font-medium">API URL Not Configured</p>
        <p className="text-sm text-yellow-700 mt-1">
          Set <code>NEXT_PUBLIC_ETT_API_URL</code> in <code>.env</code> and rebuild the app.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Issue Tracker</h3>
        {authState.isAuthenticated ? (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            Logged in
          </span>
        ) : (
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full" />
            Not logged in
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Connected to: {apiUrl}
      </p>

      {authState.isAuthenticated ? (
        <div className="space-y-3">
          <div className="p-3 bg-muted rounded text-sm">
            <p><strong>User:</strong> {authState.userName}</p>
            <p><strong>ID:</strong> {authState.userId}</p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="w-full">
            Logout
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your ETT username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && (
            <div className="p-2 rounded bg-red-50 text-red-700 border border-red-200 text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleLogin}
            disabled={isLoading || !username || !password}
            className="w-full"
          >
            {isLoading ? 'Logging in...' : 'Login to ETT'}
          </Button>
        </div>
      )}
    </div>
  );
}
