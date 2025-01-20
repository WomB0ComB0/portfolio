import axios, { type AxiosRequestConfig } from 'axios';

export default async function fetcher<T>(input: string, init?: AxiosRequestConfig): Promise<T> {
  const res = await axios.get<T>(input, init);
  // console.log('fetcher', {
  //   type: typeof res.data,
  //   data: res.data,
  // });
  return res.data;
}
