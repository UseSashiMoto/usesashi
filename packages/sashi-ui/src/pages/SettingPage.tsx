import { Button } from '@/components/Button';
import { Layout } from '@/components/Layout';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import useAppStore from '@/store/chat-store';
import { AlertCircle, CheckCircle2, ExternalLink, Github, Loader2 } from 'lucide-react';
import React, { FormEvent, useEffect, useState } from 'react';

export const SettingPage = () => {
  const apiUrl = useAppStore((state) => state.apiUrl);
  const sessionToken = useAppStore((state) => state.sessionToken);
  const hubUrl = useAppStore((state) => state.hubUrl);
  const setApiUrl = useAppStore((state) => state.setAPIUrl);
  const setHubUrl = useAppStore((state) => state.setHubUrl);
  const setConnectedToGithub = useAppStore((state) => state.setConnectedToGithub);
  const setGithubConfig = useAppStore((state) => state.setGithubConfig);

  // Regular settings
  const [tempHubUrl, setTempHubUrl] = useState(hubUrl);
  const [tempApiUrl, setTempApiUrl] = useState(apiUrl);

  // GitHub state
  const [githubToken, setGithubToken] = useState('');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubTokenLastFour, setGithubTokenLastFour] = useState(''); // Store last 4 chars for display
  const [isValidatingGithub, setIsValidatingGithub] = useState(false);
  const [githubValidationError, setGithubValidationError] = useState('');
  const [githubValidationSuccess, setGithubValidationSuccess] = useState(false);

  const { toast } = useToast();

  // Load GitHub config from hub on mount
  useEffect(() => {
    const loadGithubConfig = async () => {
      try {
        if (!sessionToken) {
          console.error('No session token available');
          return;
        }

        const response = await fetch(`${apiUrl}/github/config`, {
          headers: {
            'x-sashi-session-token': sessionToken, // Use session token header for middleware
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const config = await response.json();
          setGithubOwner(config.owner || '');
          setGithubRepo(config.repo || '');
          setGithubToken(''); // Don't load token for security
          setGithubValidationSuccess(true);

          // Update global store to reflect existing GitHub connection in Layout
          if (config.token && config.owner && config.repo) {
            setConnectedToGithub(true);
            setGithubConfig(config);
          }
        } else if (response.status !== 404) {
          console.error('Failed to load GitHub config:', response.statusText);
        }
      } catch (error) {
        console.error('Error loading GitHub config:', error);
      }
    };

    if (apiUrl && sessionToken) {
      loadGithubConfig();
    }
  }, [apiUrl, sessionToken]);

  const validateGithubConnection = async () => {
    if (!githubToken || !githubOwner || !githubRepo) {
      setGithubValidationError('Please fill in all GitHub fields');
      return;
    }

    if (!sessionToken) {
      setGithubValidationError('No session token available');
      return;
    }

    setIsValidatingGithub(true);
    setGithubValidationError('');
    setGithubValidationSuccess(false);

    try {
      console.log('testing github token', githubToken);
      console.log('testing github owner', githubOwner);
      console.log('testing github repo', githubRepo);

      // Test GitHub API connection directly first
      const response = await fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}`, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (response.ok) {
        const repoData = await response.json();

        // Save to hub via middleware
        const githubConfig = {
          token: githubToken,
          owner: githubOwner,
          repo: githubRepo,
          repoName: repoData.name,
          defaultBranch: repoData.default_branch,
        };

        try {
          console.log('Saving GitHub config via middleware');
          const hubResponse = await fetch(`${apiUrl}/github/config`, {
            method: 'POST',
            headers: {
              'x-sashi-session-token': sessionToken, // Use session token header for middleware
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(githubConfig),
          });

          if (hubResponse.ok) {
            console.log('GitHub config saved via middleware successfully');
            setGithubValidationSuccess(true);
            setGithubTokenLastFour(githubToken.slice(-4)); // Store last 4 chars for display
            setGithubToken(''); // Clear token from UI for security

            // Update global store to reflect GitHub connection in Layout
            setConnectedToGithub(true);
            setGithubConfig({
              token: githubToken,
              owner: githubOwner,
              repo: githubRepo,
              repoName: repoData.name,
              defaultBranch: repoData.default_branch,
            });

            toast({
              title: 'GitHub connected successfully',
              description: `Connected to ${repoData.full_name} and saved to hub`,
            });
          } else {
            const hubError = await hubResponse.json().catch(() => ({ message: hubResponse.statusText }));
            console.warn('GitHub connected but middleware save failed:', hubError);
            setGithubValidationError(`Failed to save via middleware: ${hubError.message}`);
          }
        } catch (hubError) {
          console.error('Middleware save error:', hubError);
          setGithubValidationError('Failed to save GitHub config via middleware');
        }
      } else {
        const errorData = await response.json();
        setGithubValidationError(errorData.message || `GitHub API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      setGithubValidationError(error instanceof Error ? error.message : 'Failed to connect to GitHub');
    } finally {
      setIsValidatingGithub(false);
    }
  };

  const disconnectGithub = async () => {
    try {
      if (!sessionToken) {
        console.error('No session token available');
        return;
      }

      // Delete via middleware instead of directly to hub
      await fetch(`${apiUrl}/github/config`, {
        method: 'DELETE',
        headers: {
          'x-sashi-session-token': sessionToken, // Use session token header for middleware
          'Content-Type': 'application/json',
        },
      });

      // Reset state
      setGithubToken('');
      setGithubOwner('');
      setGithubRepo('');
      setGithubTokenLastFour('');
      setGithubValidationSuccess(false);
      setGithubValidationError('');

      // Update global store to reflect GitHub disconnection in Layout
      setConnectedToGithub(false);
      setGithubConfig(undefined);

      toast({
        title: 'GitHub disconnected',
        description: 'GitHub integration has been removed via middleware',
      });
    } catch (error) {
      console.error('Error disconnecting GitHub:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect GitHub via middleware',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    console.log('Form submitted with values:', { tempApiUrl, tempHubUrl });
    if (tempHubUrl) setHubUrl(tempHubUrl);
    if (tempApiUrl) setApiUrl(tempApiUrl);
    toast({
      title: 'Settings updated',
      description: 'Your settings have been updated successfully',
    });
  };

  useEffect(() => {
    console.log('hub url', hubUrl);
    if (hubUrl) {
      setTempHubUrl(hubUrl);
    }
  }, [hubUrl]);

  return (
    <Layout>
      <div className="w-full h-screen flex flex-col">
        <div className="flex-1 overflow-y-auto pt-20">
          <div className="max-w-2xl mx-auto space-y-6 p-4 pb-8">
            {/* Regular Settings Card */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>API Settings</CardTitle>
                <CardDescription>Update your API configuration</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiurl">API URL</Label>
                    <Input
                      id="apiurl"
                      placeholder="Enter API URL"
                      value={tempApiUrl}
                      onChange={(e) => setTempApiUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="huburl">Hub URL</Label>
                    <Input
                      id="huburl"
                      placeholder="Enter Hub URL"
                      value={tempHubUrl}
                      onChange={(e) => setTempHubUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessiontoken">Session Token</Label>
                    <Input id="sessiontoken" value={sessionToken} disabled />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full">
                    Save Changes
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* GitHub Integration Card */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Github className="h-5 w-5" />
                  GitHub Integration
                </CardTitle>
                <CardDescription>
                  Connect your GitHub repository to enable AI-powered code changes and PR creation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Setup Instructions */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Setup Instructions:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>
                      Go to{' '}
                      <a
                        href="https://github.com/settings/tokens/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        GitHub Settings → Personal Access Tokens <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>Click "Generate new token (classic)"</li>
                    <li>Give it a name like "Sashi AI Assistant"</li>
                    <li>
                      Select these permissions: <code className="bg-blue-100 px-1 rounded">repo</code> (Full control of
                      private repositories)
                    </li>
                    <li>Click "Generate token" and copy the token</li>
                    <li>Paste the token below along with your repository details</li>
                  </ol>
                </div>

                {/* GitHub Configuration - Show different UI based on connection status */}
                {!githubValidationSuccess ? (
                  /* Configuration Form - Only show when not connected */
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="githubtoken">
                        Personal Access Token
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="githubtoken"
                        type="password"
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="githubowner">
                          Repository Owner
                          <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <Input
                          id="githubowner"
                          placeholder="username or organization"
                          value={githubOwner}
                          onChange={(e) => setGithubOwner(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="githubrepo">
                          Repository Name
                          <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <Input
                          id="githubrepo"
                          placeholder="repository-name"
                          value={githubRepo}
                          onChange={(e) => setGithubRepo(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Validation Messages */}
                    {githubValidationError && (
                      <div className="flex items-center gap-2 p-3 border border-red-200 bg-red-50 text-red-800 rounded-md">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{githubValidationError}</span>
                      </div>
                    )}

                    {/* Action Button for Connecting */}
                    <div className="flex gap-2">
                      <Button
                        onClick={validateGithubConnection}
                        disabled={isValidatingGithub || !githubToken || !githubOwner || !githubRepo}
                        className="flex-1"
                      >
                        {isValidatingGithub ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          'Connect Repository'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Connected Status Display */
                  <div className="space-y-4">
                    {/* Success Message */}
                    <div className="flex items-center gap-2 p-3 border border-green-200 bg-green-50 text-green-800 rounded-md">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm">
                        GitHub repository connected successfully! You can now ask the AI to make code changes.
                      </span>
                    </div>

                    {/* Connected Repository Details */}
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <h4 className="font-medium text-gray-900 mb-3">Connected Repository</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Repository:</span>
                          <span className="text-sm text-gray-900 font-mono bg-white px-2 py-1 rounded border">
                            {githubOwner}/{githubRepo}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Access Token:</span>
                          <span className="text-sm text-gray-900 font-mono bg-white px-2 py-1 rounded border">
                            ghp_****...****{githubTokenLastFour || 'xxxx'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Status:</span>
                          <span className="text-sm text-green-700 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Connected & Ready
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons for Connected State */}
                    <div className="flex gap-2">
                      <Button onClick={disconnectGithub} variant="outline" className="flex-1">
                        Disconnect GitHub
                      </Button>
                      <Button
                        onClick={() => {
                          setGithubValidationSuccess(false);
                          setGithubToken('');
                          setGithubTokenLastFour('');
                          // Reset global store state to show disconnected in Layout
                          setConnectedToGithub(false);
                          setGithubConfig(undefined);
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        Reconfigure
                      </Button>
                    </div>
                  </div>
                )}

                {/* Usage Guide */}
                {githubValidationSuccess && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">How to Use GitHub AI Assistant:</h4>
                    <p className="text-sm text-green-800 mb-3">
                      Now you can ask the AI to make code changes in chat! The AI will:
                    </p>

                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded border">
                        <h5 className="font-medium text-green-900 mb-1">1. Explain Changes First</h5>
                        <p className="text-sm text-green-700">
                          The AI will analyze your code, find the relevant files, and explain exactly what it will
                          change before doing anything.
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded border">
                        <h5 className="font-medium text-green-900 mb-1">2. Get Your Approval</h5>
                        <p className="text-sm text-green-700">
                          You'll see the current code and proposed changes, then decide whether to proceed with creating
                          a pull request.
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded border">
                        <h5 className="font-medium text-green-900 mb-1">3. Create Pull Request</h5>
                        <p className="text-sm text-green-700">
                          Once approved, the AI creates a new branch and pull request with your changes ready for
                          review.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h5 className="font-medium text-green-900 mb-2">Example Requests:</h5>
                      <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                        <li>"Change the login button text to say 'Welcome Back'"</li>
                        <li>"Update the footer copyright to 2025"</li>
                        <li>"Fix the spelling error on the homepage"</li>
                        <li>"Change the primary color from red to blue"</li>
                        <li>"Add a 'Contact Us' link to the navigation menu"</li>
                        <li>"Update the API endpoint URL in the config"</li>
                      </ul>
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm text-blue-800">
                        <strong>💡 Pro Tip:</strong> Be specific about what you want to change. The more detailed your
                        request, the better the AI can find and modify the right code.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};
