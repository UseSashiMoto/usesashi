import { Button } from '@/components/Button';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useAppStore from '@/store/chat-store';
import React, { FormEvent, useEffect, useState } from 'react';

export const SettingPage = () => {
  const apiUrl = useAppStore((state) => state.apiUrl);
  const sessionToken = useAppStore((state) => state.sessionToken);
  const hubUrl = useAppStore((state) => state.hubUrl);
  const setApiUrl = useAppStore((state) => state.setAPIUrl);
  const setHubUrl = useAppStore((state) => state.setHubUrl);

  const [tempHubUrl, setTempHubUrl] = useState(hubUrl);
  const [tempApiUrl, setTempApiUrl] = useState(apiUrl);
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    console.log('Form submitted with values:', { tempApiUrl, tempHubUrl });
    if (tempHubUrl) setHubUrl(tempHubUrl);
    if (tempApiUrl) setApiUrl(tempApiUrl);
  };

  useEffect(() => {
    console.log('hub url', hubUrl);
    if (hubUrl) {
      setTempHubUrl(hubUrl);
    }
  }, [hubUrl]);
  return (
    <Layout>
      <div className="w-full h-dvh pt-20">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Update your settings</CardDescription>
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
      </div>
    </Layout>
  );
};
