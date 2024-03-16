import useSWR from "swr";
export const sendMessage = async (message: Message) => { 
  const response = await fetch('/api/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
  return response.json();
}
