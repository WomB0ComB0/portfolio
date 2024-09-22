'use client';

import React, { useState, type FormEvent } from 'react';
import { usePostMessage } from '../hooks/useMessages';

export function MessageForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const postMessage = usePostMessage();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    postMessage.mutate({ email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit">Submit</button>
    </form>
  );
}
