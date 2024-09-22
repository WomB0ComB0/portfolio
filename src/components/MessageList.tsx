import { useGetMessages } from '../hooks/useMessages';

export function MessageList() {
  const { data: messages, isLoading, error } = useGetMessages();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>An error occurred: {error.message}</div>;

  return (
    <ul>
      {messages?.map((message) => (
        <li key={message.id}>{message.message}</li>
      ))}
    </ul>
  );
}
