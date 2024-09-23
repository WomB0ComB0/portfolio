import axios from 'axios';
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;

const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

/**
 * Makes a request to the Spotify API to obtain a new access token using a refresh token.
 */
const getAccessToken = async (): Promise<{ access_token: string }> => {
  try {
    // Make a POST request to the Spotify API to request a new access token
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token!,
      }),
      {
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    // Return the JSON response from the API
    return response.data;
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    throw error;
  }
};

/**
 * Makes a request to the Spotify API to retrieve the user's top tracks.
 */
export const topTracks = async (): Promise<any[]> => {
  // Obtain an access token
  const { access_token }: { access_token: string } = await getAccessToken();

  // Make a request to the Spotify API to retrieve the user's top tracks in last 4 weeks

  const response = await axios.get(
    'https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=short_term',
    {
      headers: {
        // Set the Authorization header with the access token
        Authorization: `Bearer ${access_token}`,
      },
    },
  );

  // Handle the response and convert it to the expected type
  if (response.status !== 200) {
    throw new Error('Failed to fetch top artists.');
  }
  const data = response.data;
  return data.items as any[];
};

/**
 * Makes a request to the Spotify API to retrieve the user's top artists.
 */
export const topArtists = async (): Promise<any[]> => {
  // Obtain an access token
  const { access_token } = await getAccessToken();

  // Make a request to the Spotify API to retrieve the user's top artists in last 4 weeks
  const response = await axios.get(
    'https://api.spotify.com/v1/me/top/artists?limit=5&time_range=short_term',
    {
      headers: {
        // Set the Authorization header with the access token
        Authorization: `Bearer ${access_token}`,
      },
    },
  );

  // Handle the response and convert it to the expected type
  if (response.status !== 200) {
    throw new Error('Failed to fetch top artists.');
  }

  const data = response.data;
  return data.items as any[];
};

/**
 * Makes a request to the Spotify API to retrieve the currently playing song for the user.
 */
export const currentlyPlayingSong = async () => {
  try {
    const { access_token } = await getAccessToken();

    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (response.status === 204 || response.status > 400) {
      console.error(`function-currently-playing-response-error`, response.status);
      return null;
    }

    const data = await response.json();
    // console.log(`function-currently-playing-response`, data);
    return data;
  } catch (error) {
    console.error('Error fetching currently playing song:', error);
    return null;
  }
};
