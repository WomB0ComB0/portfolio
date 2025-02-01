import { currentlyPlayingSong, getAccessToken } from '@/lib/spotify';
import { z } from 'zod';
import mongoose, { ConnectOptions } from 'mongoose';

// (async () => {
//   const schema = z.object({
//     isPlaying: z.boolean(),
//     songName: z.string().optional(),
//     artistName: z.string().optional(),
//     songURL: z.string().optional(),
//     imageURL: z.string().optional(),
//   });

//   const { Schema } = mongoose;

//   const spotifySchema = new Schema({
//     isPlaying: Boolean,
//     songName: String,
//     artistName: String,
//     songURL: String,
//     imageURL: String,
//   });

//   const Spotify = mongoose.model('Spotify', spotifySchema);

//   try {
//     const response = await currentlyPlayingSong();
//     const data = await response.json();

//     const validatedData = schema.parse(data);

//     await mongoose.connect(process.env.MONGODB_URI!, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//       bufferCommands: true,
//       autoIndex: true,
//     } as ConnectOptions);

//     const spotifyRecord = new Spotify(validatedData);

//     await spotifyRecord.save();

//     console.log('Spotify data saved successfully:', spotifyRecord);
//   } catch (error) {
//     console.error('Error fetching or saving Spotify data:', error);
//   } finally {
//     await mongoose.connection.close();
//   }
// })();

(async () => {
  const accessToken = await getAccessToken();
  console.log(accessToken);
})();
