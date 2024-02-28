'use client';

import React, { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';

export const ContactMe = () => {
  const { register, handleSubmit } = useForm<Inputs>();
  const onSubmit: SubmitHandler<Inputs> = (formData) => {
    window.location.href = `mailto:mikeodnis3242004@gmail.com?subject=${formData.subject}&body=${formData.message}`;
  };
  const [charactersLeft, setCharactersLeft] = useState(500);
  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const currentLength = event.target.value.length;
    const remaining = 500 - currentLength;
    setCharactersLeft(remaining);
  };
  return (
    <div className="relative mx-auto flex h-screen max-w-7xl flex-col items-center justify-evenly px-10 text-center md:flex-row md:text-left">
      <h3 className="absolute top-24 hidden select-none text-2xl uppercase tracking-[20px] text-gray-500">
        Contact Me
      </h3>
      <div className="flex flex-col space-y-10">
        <h4 className="text-center text-4xl font-semibold">
          I have got just what you need. <span className="underline decoration-[#560BAD]/50">Lets talk</span>
        </h4>
        <div className="flex">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mx-auto flex w-[80vw] select-none flex-col space-y-2"
            action=""
            autoComplete="on"
          >
            <div className="flex space-x-2">
              <input
                {...register('name')}
                placeholder="Name"
                className="w-[50%] rounded-sm border-b border-[#BA9BDD] bg-slate-400/10 px-6 py-4 text-gray-500 outline-none transition-all placeholder:text-gray-500 focus:border-[#560BAD]/40 focus:text-[#ffffff]/40"
                type="text"
                required
              />
              <input
                {...register('email')}
                placeholder="Email"
                className="w-[50%] rounded-sm border-b border-[#BA9BDD] bg-slate-400/10 px-6 py-4 text-gray-500 outline-none transition-all placeholder:text-gray-500 focus:border-[#560BAD]/40 focus:text-[#ffffff]/40"
                type="email"
                required
              />
            </div>
            <input
              {...register('subject')}
              placeholder="Subject"
              className="rounded-sm border-b border-[#BA9BDD] bg-slate-400/10 px-6 py-4 text-gray-500 outline-none transition-all placeholder:text-gray-500 focus:border-[#560BAD]/40 focus:text-[#ffffff]/40"
              type="text"
              required
            />
            <textarea
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck="true"
              {...register('message')}
              placeholder="Message"
              className="max-h-[500px] min-h-[100px] rounded-sm border-b border-[#BA9BDD] bg-slate-400/10 px-6 py-4 text-gray-500 outline-none transition-all placeholder:text-gray-500 focus:border-[#560BAD]/40 focus:text-[#ffffff]/40"
              maxLength={500}
              required
              onChange={handleTextareaChange}
            />
            <p className="text-sm text-gray-500">Characters left: {charactersLeft}</p>
            <button
              type="submit"
              className="rounded-md bg-[#560BAD] px-10 py-5 text-lg font-bold text-[#BA9BDD] transition-colors hover:brightness-125"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
