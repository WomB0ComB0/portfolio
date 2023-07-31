"use client"
import React, {useState} from 'react'
import { PhoneIcon, MapPinIcon, EnvelopeIcon } from '@heroicons/react/24/solid'
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
      <h3 className='absolute uppercase top-24 tracking-[20px] text-gray-500 text-2xl select-none'>
        Contact Me
      </h3>
      <div className='flex flex-col space-y-10'>
        <h4 className='text-4xl font-semibold text-center'>
          I have got just what you need.{" "}
          <span className='decoration-[#560BAD]/50 underline'>Lets talk</span>
        </h4>
        <div className='space-y-5'>
          <div className='flex items-center justify-center space-x-5'>
            <PhoneIcon className='text-[#560BAD] h-7 w-7 animate-pulse' />
            <a href="tel:+1-934-218-7852" className='text-2xl rel="noopener noreferrer'>
              +1 (934)-218-7852
            </a>
          </div>
          <div className='flex items-center justify-center space-x-5'>
            <EnvelopeIcon className='text-[#560BAD] h-7 w-7 animate-pulse' />
            <a href="mailto:mikeodnis3242004@gmail.com" className='text-2xl rel="noopener noreferrer' target='_blank'>
             mikeodnis3242004@gmail.com
            </a>
          </div>
          <div className='flex items-center justify-center space-x-5'>
            <MapPinIcon className='text-[#560BAD] h-7 w-7 animate-pulse' />
            <a href="https://www.google.com/maps/place/Brentwood,+NY/@40.7809543,-73.3350217,12z/data=!4m6!3m5!1s0x89e8319349a7a5e1:0xfc8ed3b854bd231a!8m2!3d40.7812093!4d-73.2462273!16zL20vMHk4MzM?entry=ttu" target="_blank" rel="noopener noreferrer" className='text-2xl'>Brentwood, NY</a>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col mx-auto space-y-2 w-fit' action="" autoComplete='on'>
          <div className='flex space-x-2'>
            <input {...register('name')} placeholder='Name' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#BA9BDD] text-gray-500 placeholder-gray-500 transition-all focus:border-[#560BAD]/40 focus:text-[#ffffff]/40' type="text" required/>
            <input {...register('email')} placeholder='Email' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#BA9BDD] text-gray-500 placeholder-gray-500 transition-all focus:border-[#560BAD]/40 focus:text-[#ffffff]/40' type="email" required/>
          </div>
          <input {...register('subject')} placeholder='Subject' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#BA9BDD] text-gray-500 placeholder-gray-500 transition-all focus:border-[#560BAD]/40 focus:text-[#ffffff]/40' type="text" required/>
          <textarea autoCapitalize='sentences' autoCorrect='on' spellCheck="true" {...register('message')} placeholder='Message' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#BA9BDD] text-gray-500 placeholder-gray-500 transition-all focus:border-[#560BAD]/40 focus:text-[#ffffff]/40 max-h-[500px] min-h-[100px]' maxLength={500} required onChange={handleTextareaChange}/>
          <p className='text-sm text-gray-500'>Characters left: {charactersLeft}</p>
          <button type='submit' className='bg-[#560BAD] py-5 px-10 rounded-md text-[#BA9BDD] font-bold text-lg hover:brightness-125 transition-colors'>Submit</button>
        </form>
      </div>
    </div>
  )
}
export default ContactMe