// HomePage.test.tsx
import { HEADER_SESSION_TOKEN } from '@/utils/contants';
import { render, screen } from './test-utils'; // Use custom render
import axios from 'axios';
import React from 'react';
import { HomePage } from '../pages/HomePage';
import useAppStore from '../store/chat-store';

// Mock axios module
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HomePage', () => {
  const mockApiUrl = 'http://mockapi.com';
  const mockSessionToken = 'mockSessionToken';

  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.resetMocks();
    localStorage.clear(); // Clear persisted store state

    // Set the store state with the mock values
    useAppStore.setState({ apiUrl: mockApiUrl, sessionToken: mockSessionToken });
  });

  it('sets connectedToHub to true when API returns connected: true', async () => {
    // Mock fetch to return connected: true
    fetchMock.mockResponseOnce(JSON.stringify({ connected: true }));

    // Mock axios for metadata
    mockedAxios.get.mockResolvedValueOnce({ data: { functions: [] } });

    render(<HomePage />);

    // Use findByTestId which waits for the element to appear
    const statusElement = await screen.findByTestId('connected-status');

    expect(statusElement).toHaveTextContent('Connected');

    // Verify fetch was called correctly
    expect(fetchMock).toHaveBeenCalledWith(`${mockApiUrl}/check_hub_connection`, {
      method: 'GET',
      headers: {
        [HEADER_SESSION_TOKEN]: mockSessionToken,
      },
    });

    // Verify axios.get was called once
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);

    // Verify the axios.get call
    expect(mockedAxios.get).toHaveBeenCalledWith(`${mockApiUrl}/metadata`, {
      headers: { [HEADER_SESSION_TOKEN]: mockSessionToken },
    });
  });

  it('sets connectedToHub to false when fetch returns connected: false', async () => {
    // Mock fetch to return connected: false
    fetchMock.mockResponseOnce(JSON.stringify({ connected: false }));

    // Mock axios for metadata
    mockedAxios.get.mockResolvedValueOnce({ data: { functions: [] } });

    render(<HomePage />);

    const statusElement = await screen.findByTestId('connected-status');

    expect(statusElement).toHaveTextContent('Not Connected');

    // Verify fetch was called correctly
    expect(fetchMock).toHaveBeenCalledWith(`${mockApiUrl}/check_hub_connection`, {
      method: 'GET',
      headers: {
        [HEADER_SESSION_TOKEN]: mockSessionToken,
      },
    });

    // Verify axios.get was called once
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);

    // Verify the axios.get call
    expect(mockedAxios.get).toHaveBeenCalledWith(`${mockApiUrl}/metadata`, {
      headers: { [HEADER_SESSION_TOKEN]: mockSessionToken },
    });
  });

  it('sets connectedToHub to false when fetch throws an error', async () => {
    // Mock fetch to throw an error
    fetchMock.mockRejectOnce(new Error('Network error'));

    // Mock axios for metadata
    mockedAxios.get.mockResolvedValueOnce({ data: { functions: [] } });

    render(<HomePage />);

    // Optionally debug the rendered component
    // screen.debug();

    const statusElement = await screen.findByTestId('connected-status');

    expect(statusElement).toHaveTextContent('Not Connected');

    // Verify fetch was called correctly
    expect(fetchMock).toHaveBeenCalledWith(`${mockApiUrl}/check_hub_connection`, {
      method: 'GET',
      headers: {
        [HEADER_SESSION_TOKEN]: mockSessionToken,
      },
    });

    // Verify axios.get was called once
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);

    // Verify the axios.get call
    expect(mockedAxios.get).toHaveBeenCalledWith(`${mockApiUrl}/metadata`, {
      headers: { [HEADER_SESSION_TOKEN]: mockSessionToken },
    });
  });
});
