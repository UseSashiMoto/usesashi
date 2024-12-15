// HomePage.test.tsx
import { HEADER_SESSION_TOKEN } from '@/utils/contants';
import { render, screen } from '@testing-library/react';
import axios from 'axios';
import React from 'react';
import { HomePage } from '../pages/HomePage';

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
  });

  it('sets connectedToHub to true when API returns connected: true', async () => {
    // Mock fetch to return connected: true
    fetchMock.mockResponseOnce(JSON.stringify({ connected: true }));

    // Mock axios for metadata and repos
    mockedAxios.get
      .mockResolvedValueOnce({ data: { functions: [] } }) // metadata call
      .mockResolvedValueOnce({ data: { repos: [] } }); // repos call

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

    // Verify axios.get was called twice
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(1, `${mockApiUrl}/metadata`, {
      headers: { [HEADER_SESSION_TOKEN]: mockSessionToken },
    });
    expect(mockedAxios.get).toHaveBeenNthCalledWith(2, `${mockApiUrl}/repos`, {
      headers: { [HEADER_SESSION_TOKEN]: mockSessionToken },
    });
  });

  it('sets connectedToHub to false when fetch returns connected: false', async () => {
    // Mock fetch to return connected: false
    fetchMock.mockResponseOnce(JSON.stringify({ connected: false }));

    // Mock axios for metadata and repos
    mockedAxios.get
      .mockResolvedValueOnce({ data: { functions: [] } }) // metadata call
      .mockResolvedValueOnce({ data: { repos: [] } }); // repos call

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

    // Verify axios.get was called twice
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(1, `${mockApiUrl}/metadata`, {
      headers: { [HEADER_SESSION_TOKEN]: mockSessionToken },
    });
    expect(mockedAxios.get).toHaveBeenNthCalledWith(2, `${mockApiUrl}/repos`, {
      headers: { [HEADER_SESSION_TOKEN]: mockSessionToken },
    });
  });

  it('sets connectedToHub to false when fetch throws an error', async () => {
    // Mock fetch to throw an error
    fetchMock.mockRejectOnce(new Error('Network error'));

    // Mock axios for metadata and repos
    mockedAxios.get
      .mockResolvedValueOnce({ data: { functions: [] } }) // metadata call
      .mockResolvedValueOnce({ data: { repos: [] } }); // repos call

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

    // Verify axios.get was called twice
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(1, `${mockApiUrl}/metadata`, {
      headers: { [HEADER_SESSION_TOKEN]: mockSessionToken },
    });
    expect(mockedAxios.get).toHaveBeenNthCalledWith(2, `${mockApiUrl}/repos`, {
      headers: { [HEADER_SESSION_TOKEN]: mockSessionToken },
    });
  });
});
