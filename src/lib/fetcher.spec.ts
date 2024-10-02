import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import fetcher from './fetcher';

// Mock the axios module
vi.mock('axios');

describe('fetcher', () => {
  it('should fetch data successfully', async () => {
    // Arrange: mock axios.get to return a resolved promise with some data
    const mockData = { id: 1, name: 'Test' };
    (axios.get as any).mockResolvedValueOnce({ data: mockData });

    // Act: call the fetcher function
    const result = await fetcher<{ id: number; name: string }>('https://api.example.com/data');

    // Assert: verify the function returns the expected data
    expect(result).toEqual(mockData);
    expect(axios.get).toHaveBeenCalledWith('https://api.example.com/data', undefined);
  });

  it('should handle axios errors', async () => {
    // Arrange: mock axios.get to reject with an error
    const mockError = new Error('Network Error');
    (axios.get as any).mockRejectedValueOnce(mockError);

    // Act & Assert: verify that the fetcher function throws the same error
    await expect(fetcher('https://api.example.com/data')).rejects.toThrow('Network Error');
  });
});
