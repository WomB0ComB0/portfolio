function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

type JsonValidationResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: Error };

export function validateJsonObject(json: string): JsonValidationResult {
  try {
    const parsedJSON: unknown = JSON.parse(json);
    if (!isRecord(parsedJSON)) {
      return {
        success: false,
        error: new Error('The JSON string is not a valid object'),
      };
    }
    return {
      success: true,
      data: parsedJSON,
    };
  } catch (e) {
    if (e instanceof Error) {
      return {
        success: false,
        error: e,
      };
    }
    return {
      success: false,
      error: new Error('An unknown error occurred'),
    };
  }
}

/**
 * const jsonString = `{"name": "John Doe", "age": 30}`
 * const jsonObjectValidation = validateJsonObject(jsonString)
 * jsonObjectValidation.success ? console.log(jsonObjectValidation.data) : console.error(jsonObjectValidation.error)
 */

export async function fetchData<JSON>(input: RequestInfo, init?: RequestInit): Promise<JSON> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const json = await response.json();
    const jsonObjectValidation = validateJsonObject(json);
    // Check this
    if (jsonObjectValidation.success) {
      throw new Error(JSON.stringify(jsonObjectValidation.data, null, 2));
    } else {
      throw jsonObjectValidation.error;
    }
  }
  return response.json();
}

const get = async (url: string, input: Record<string, string>, props: any) => {
  return fetchData<typeof props>(`${url}?${new URLSearchParams(input).toString()}`);
};

const put = async (url: string, input: Record<string, string>) => {
  return fetch(url, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
};

const patch = async (url: string, input: Record<string, string>) => {
  return fetch(url, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
};

const del = async (url: string) => {
  return fetch(url, {
    method: 'DELETE',
  });
};

const post = async (url: string, input: Record<string, string>) => {
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(input),
  });
};

export const api = {
  get,
  put,
  patch,
  delete: del,
  post,
};

interface Artist {
  external_urls: {
    spotify: string;
  };
  href: string;
  id: string;
  name: string;
  type: string;
  uri: string;
}

interface Image {
  height: number;
  url: string;
  width: number;
}

interface Album {
  album_type: string;
  artists: Artist[];
  available_markets: string[];
  external_urls: {
    spotify: string;
  };
  href: string;
  id: string;
  images: Image[];
  name: string;
  release_date: string;
  release_date_precision: string;
  total_tracks: number;
  type: string;
  uri: string;
}

interface TopArtistsResponse {
  items: {
    album: Album;
    artists: Artist[];
  }[];
  total: number;
  limit: number;
  offset: number;
  href: string;
  next: string | null;
  previous: string | null;
}
