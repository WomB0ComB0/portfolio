import { $ } from 'bun';
import sharp from 'sharp';

sharp.cache(false);

const generateLazyImage = async (
  src: string,
  width: number,
  height: number,
): Promise<{
  src: string;
  lqip: string;
}> => {
  const body = await Bun.file(src).arrayBuffer();

  const sharpImage = sharp(body);
  const metadata = await sharpImage.metadata();
  const format = metadata.format;

  const lqipBuf = await sharpImage.resize({ width, height, fit: 'inside' }).toBuffer();

  const lqip = `data:image/${format};base64,${lqipBuf.toString('base64')}`;

  return {
    src: src.split('/').pop()!.split('.')[0]!,
    lqip,
  };
};

class ImageToB64 {
  // @ts-ignore
  private readonly images: string[];
  private readonly width: number;
  private readonly height: number;

  constructor(images: string[], width: number, height: number) {
    this.images = images;
    this.width = width;
    this.height = height;
  }

  async generateLazyImage(image: string): Promise<{ src: string; lqip: string }> {
    return await generateLazyImage(image, this.width, this.height);
  }
}

if (require.main === module) {
  const [directory, dimensions] = process.argv.slice(2);
  const [width, height] = dimensions?.split('x').map(Number) ?? [0, 0];

  if (!width || !height) {
    console.error('Usage: node script.js <directory> <width>x<height>');
    process.exit(1);
  }

  if (!directory || !dimensions || isNaN(width) || isNaN(height)) {
    console.error('Usage: node script.js <directory> <width>x<height>');
    process.exit(1);
  }

  const images = (await $`find public/assets/images/${directory} -name '*.webp'`.text())
    .split('\n')
    .filter(Boolean);
  for (const image of images) {
    const imageToB64 = new ImageToB64([image], width, height);
    if (images.length === 0) {
      console.error('No images found in the directory');
      process.exit(1);
    }
    imageToB64
      .generateLazyImage(image)
      .then((lqip) => console.log(lqip))
      .catch(console.error);
  }
}
