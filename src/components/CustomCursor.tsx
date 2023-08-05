// "use client"
// import React, {useEffect, useRef} from 'react'
// import {gsap} from  'gsap'
// type Props = {}
// const CustomCursor = (props: Props) => {
//   const cursorRef = useRef<HTMLDivElement>(null)
//   const followerRef = useRef<HTMLDivElement>(null)
//   const moveCursor = (e: MouseEvent): void => {
//     gsap.to(cursorRef.current, {
//       x: e.clientX,
//       y: e.clientY,
//       duration: 0.2,
//     })
//     gsap.to(followerRef.current, {
//       x: e.clientX,
//       y: e.clientY,
//       duration: 0.9,
//     })
//   }
//   useEffect(() => {
//     gsap.set(cursorRef, {
//       xPercent: 100,
//       yPercent: 100,
//     });
//     gsap.set(followerRef,  {
//       xPercent: -20,
//       yPercent: -20,
//     });
//     window.addEventListener('mousemove', moveCursor)
//   }, []);
//   return (
//     <div>
//       <div ref={cursorRef} className="cursor"/>
//       <div ref={followerRef} className="follower-cursor"/>
//     </div>
//   )
// }
// export default CustomCursor