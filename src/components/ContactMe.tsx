"use client"
import React, {useState} from 'react'
import { useForm, SubmitHandler } from "react-hook-form";
type Inputs = {
  name: string;
  email: string;
  subject: string;
  message: string;
};
function ContactMe() {
  const { register, handleSubmit} = useForm<Inputs>();
  const onSubmit: SubmitHandler<Inputs> = (formData) => {window.location.href = `mailto:mikeodnis3242004@gmail.com?subject=${formData.subject}&body=${formData.message}`};
  const [charactersLeft, setCharactersLeft] = useState(500);
    const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const currentLength = event.target.value.length;
    const remaining = 500 - currentLength;
    setCharactersLeft(remaining);
  };
  return (
    <div className="relative flex flex-col items-center h-screen px-10 mx-auto text-center md:text-left md:flex-row max-w-7xl justify-evenly">
      <h3 className='absolute uppercase top-24 tracking-[20px] text-gray-500 text-2xl select-none hidden'>
        Contact Me
      </h3>
      <div className='flex flex-col space-y-10'>
        <h4 className='text-4xl font-semibold text-center'>
          I have got just what you need.{" "}
          <span className='decoration-[#560BAD]/50 underline'>Lets talk</span>
        </h4>
        <div className='flex'>
        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col mx-auto space-y-2 select-none w-[80vw]' action="" autoComplete='on'>
          <div className='flex space-x-2'>
            <input {...register('name')} placeholder='Name' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#BA9BDD] text-gray-500 placeholder-gray-500 transition-all focus:border-[#560BAD]/40 focus:text-[#ffffff]/40 w-[50%]' type="text" required/>
            <input {...register('email')} placeholder='Email' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#BA9BDD] text-gray-500 placeholder-gray-500 transition-all focus:border-[#560BAD]/40 focus:text-[#ffffff]/40 w-[50%]' type="email" required/>
          </div>
          <input {...register('subject')} placeholder='Subject' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#BA9BDD] text-gray-500 placeholder-gray-500 transition-all focus:border-[#560BAD]/40 focus:text-[#ffffff]/40' type="text" required/>
          <textarea autoCapitalize='sentences' autoCorrect='on' spellCheck="true" {...register('message')} placeholder='Message' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#BA9BDD] text-gray-500 placeholder-gray-500 transition-all focus:border-[#560BAD]/40 focus:text-[#ffffff]/40 max-h-[500px] min-h-[100px]' maxLength={500} required onChange={handleTextareaChange}/>
          <p className='text-sm text-gray-500'>Characters left: {charactersLeft}</p>
          <button type='submit' className='bg-[#560BAD] py-5 px-10 rounded-md text-[#BA9BDD] font-bold text-lg hover:brightness-125 transition-colors'>Submit</button>
        </form>
      </div>
      </div>
    </div>
  )
}
export default ContactMe