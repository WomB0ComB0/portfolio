import { cn } from '@/lib/utils';

interface BlobProps extends React.HTMLAttributes<HTMLDivElement> {
  firstBlobColor: string;
  secondBlobColor: string;
}

export const BlurryBlob = ({ className, firstBlobColor, secondBlobColor }: BlobProps) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="relative w-full h-full">
        <div
          className={cn(
            'absolute right-0 top-0 h-96 w-96 animate-blob rounded-full opacity-20 mix-blend-multiply filter blur-3xl',
            className,
            firstBlobColor,
          )}
        ></div>
        <div
          className={cn(
            'absolute right-32 top-32 h-96 w-96 animate-blob rounded-full opacity-20 mix-blend-multiply filter blur-3xl animation-delay-2000',
            className,
            secondBlobColor,
          )}
        ></div>
      </div>
    </div>
  );
};
BlurryBlob.displayName = 'BlurryBlob';
export default BlurryBlob;
