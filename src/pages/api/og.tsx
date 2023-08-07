import { ImageResponse } from '@vercel/og';
import { PurpleBackground } from '@/components/svg/PurpleBackground';
export const config = {
  runtime: 'edge',
};
export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: '#d6b3f0',
          width: '100%',
          height: '100%',
          display: 'flex',
          textAlign: 'center',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PurpleBackground/>
      </div>
    ),
    {
      width: 2560,
      height: 1440,
    },
  );
}