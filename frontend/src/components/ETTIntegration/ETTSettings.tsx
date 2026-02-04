'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ettService, ETTConfig } from '@/services/ettService';

interface ETTSettingsProps {
  onConfigured?: () => void;
}

export function ETTSettings({ onConfigured }: ETTSettingsProps) {
  const [apiUrl, setApiUrl] = React.useState('');
  const [accessToken, setAccessToken] = React.useState('');
  const [defaultBoardId, setDefaultBoardId] = React.useState('');
  const [defaultReporterId, setDefaultReporterId] = React.useState('');
  const [isConfigured, setIsConfigured] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  React.useEffect(() => {
    const config = ettService.getConfig();
    if (config) {
      setApiUrl(config.apiUrl || '');
      setDefaultBoardId(config.defaultBoardId?.toString() || '');
      setDefaultReporterId(config.defaultReporterId?.toString() || '');
      setIsConfigured(config.hasToken);
    }
  }, []);

  const handleSave = () => {
    const config: ETTConfig = {
      apiUrl: apiUrl.trim(),
      accessToken: accessToken.trim(),
      defaultBoardId: defaultBoardId ? parseInt(defaultBoardId, 10) : undefined,
      defaultReporterId: defaultReporterId ? parseInt(defaultReporterId, 10) : undefined,
    };

    ettService.configure(config);
    setIsConfigured(true);
    setAccessToken(''); // Clear from UI for security
    onConfigured?.();
  };

  const handleTest = async () => {
    if (!apiUrl || !accessToken) {
      setTestResult({ success: false, message: 'Please enter API URL and Access Token' });
      return;
    }

    // Temporarily configure for testing
    const tempConfig: ETTConfig = {
      apiUrl: apiUrl.trim(),
      accessToken: accessToken.trim(),
    };
    ettService.configure(tempConfig);

    setIsTesting(true);
    setTestResult(null);

    const result = await ettService.testConnection();
    setTestResult(result);
    setIsTesting(false);

    if (!result.success) {
      // Clear config if test failed
      ettService.clearConfig();
      setIsConfigured(false);
    }
  };

  const handleClear = () => {
    ettService.clearConfig();
    setApiUrl('');
    setAccessToken('');
    setDefaultBoardId('');
    setDefaultReporterId('');
    setIsConfigured(false);
    setTestResult(null);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Issue Tracker Integration</h3>
        {isConfigured && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            Connected
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Connect to your issue tracker to automatically create tickets from meeting summaries.
      </p>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="apiUrl">API URL</Label>
          <Input
            id="apiUrl"
            type="url"
            placeholder="https://your-api.example.com"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="accessToken">
            Access Token {isConfigured && '(saved)'}
          </Label>
          <Input
            id="accessToken"
            type="password"
            placeholder={isConfigured ? '••••••••' : 'Enter your access token'}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="boardId">Default Board ID (optional)</Label>
            <Input
              id="boardId"
              type="number"
              placeholder="e.g., 1"
              value={defaultBoardId}
              onChange={(e) => setDefaultBoardId(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="reporterId">Default Reporter ID (optional)</Label>
            <Input
              id="reporterId"
              type="number"
              placeholder="e.g., 1"
              value={defaultReporterId}
              onChange={(e) => setDefaultReporterId(e.target.value)}
            />
          </div>
        </div>
      </div>

      {testResult && (
        <div
          className={`p-3 rounded text-sm ${
            testResult.success
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {testResult.message}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleTest}
          disabled={isTesting || !apiUrl || !accessToken}
          variant="outline"
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </Button>

        <Button
          onClick={handleSave}
          disabled={!apiUrl || !accessToken}
        >
          Save Configuration
        </Button>

        {isConfigured && (
          <Button onClick={handleClear} variant="ghost" className="text-red-600">
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
}
