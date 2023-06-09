"use client"
import React from 'react'
import { PhoneIcon, MapPinIcon, EnvelopeIcon } from '@heroicons/react/24/solid'
import { useForm, SubmitHandler } from "react-hook-form";
type Props = {}

type Inputs = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

function ContactMe({}: Props) {
  const { register, handleSubmit} = useForm<Inputs>();
  const onSubmit: SubmitHandler<Inputs> = (formData) => {window.location.href = `mailto:mikeodnis3242004@gmail.com?subject=${formData.subject}&body=${formData.message}`};
  return (
    <div className="relative flex flex-col items-center h-screen px-10 mx-auto text-center md:text-left md:flex-row max-w-7xl justify-evenly">
      <h3 className='absolute uppercase top-24 tracking-[20px] text-gray-500 text-2xl'>
        Contact Me
      </h3>
      <div className='flex flex-col space-y-10'>
        <h4 className='text-4xl font-semibold text-center'>
          I have got just what you need.{" "}
          <span className='decoration-[#f7ab0a]/50 underline'>Lets talk</span>
        </h4>
        
        <div className='space-y-10'>
          <div className='flex items-center justify-center space-x-5'>
            <PhoneIcon className='text-[#f7ab0a] h-7 w-7 animate-pulse' />
            {/* Telephone number */}
            <a href="tel:+1-934-218-7852" className='text-2xl rel="noopener noreferrer'>
              +1 (934)-218-7852
            </a>
          </div>
          <div className='flex items-center justify-center space-x-5'>
            <EnvelopeIcon className='text-[#f7ab0a] h-7 w-7 animate-pulse' />
            {/* Telephone number */}
            <a href="mailto:mikeodnis3242004@gmail.com" className='text-2xl rel="noopener noreferrer' target='_blank'>
             mikeodnis3242004@gmail.com
            </a>
          </div>
          <div className='flex items-center justify-center space-x-5'>
            <MapPinIcon className='text-[#f7ab0a] h-7 w-7 animate-pulse' />
            {/* Exact location */}
            <a href="https://www.google.com/maps/place/Brentwood,+NY/@40.7809543,-73.3350217,12z/data=!4m6!3m5!1s0x89e8319349a7a5e1:0xfc8ed3b854bd231a!8m2!3d40.7812093!4d-73.2462273!16zL20vMHk4MzM?entry=ttu" target="_blank" rel="noopener noreferrer" className='text-2xl'>Brentwood, NY</a>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col mx-auto space-y-2 w-fit' action="" autoComplete=''>
          <div className='flex space-x-2'>
            
            <input {...register('name')} placeholder='Name' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#242424] text-gray-500 placeholder-gray-500 transition-all focus:border-[#f7ab0a]/40 focus:text-[#f7ab0a]/40' type="text" required/>
            <input {...register('email')} placeholder='Email' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#242424] text-gray-500 placeholder-gray-500 transition-all focus:border-[#f7ab0a]/40 focus:text-[#f7ab0a]/40' type="email" required/>
          </div>
          <input {...register('subject')} placeholder='Subject' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#242424] text-gray-500 placeholder-gray-500 transition-all focus:border-[#f7ab0a]/40 focus:text-[#f7ab0a]/40' type="text" required/>
          <textarea autoCapitalize='sentences' autoCorrect='on' spellCheck="true" {...register('message')} placeholder='Message' className='outline-none bg-slate-400/10 rounded-sm border-b px-6 py-4 border-[#242424] text-gray-500 placeholder-gray-500 transition-all focus:border-[#f7ab0a]/40 focus:text-[#f7ab0a]/40' />
          <button type='submit' className='bg-[#f7ab0a] py-5 px-10 rounded-md text-black font-bold text-lg'>Submit</button>
        </form>
      </div>
    </div>
  )
}

export default ContactMe