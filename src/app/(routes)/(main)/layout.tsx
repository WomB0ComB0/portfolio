/**
 * Main layout component for the application routes.
 * Renders the main content and modal overlay.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The main content to render.
 * @param {React.ReactNode} props.modal - The modal content to render.
 * @returns {JSX.Element} The rendered layout.
 * @author Mike Odnis
 * @version 1.0.0
 */
export default function MainLayout({
  children,
  // modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/* {modal} */}
    </>
  );
}
