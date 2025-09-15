import { Toaster } from '@/components/ui/sonner';
export const Events: React.FC<
  Readonly<{
    children: React.ReactNode;
  }>
> = ({ children }) => {
  return (
    <>
      <Toaster
        theme={`system`}
        position={`top-center`}
        duration={5000}
        richColors
        toastOptions={{
          className: `

          `,
        }}
      />
      {children}
    </>
  );
};
Events.displayName = 'Events';
export default Events;
