import { Toaster } from "@/components/ui/sonner"
const Events: React.FC<Readonly<{
  children: React.ReactNode
}>> = ({ children }) => {
  return (
    <>
      <Toaster
        theme={`system`}
        position={`top-center`}
        duration={5000}
        richColors
        toastOptions={{
          className: `

          `
        }}
      />
      {children}
    </>
  )
}

export default Events
