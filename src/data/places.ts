import { PlaceItem, PhotoItem } from '../types/places';

const placeholderPhotos: PhotoItem[] = [
  { url: 'https://via.placeholder.com/600x400.png?text=Landmark+View', caption: 'View from the location.' },
  { url: 'https://via.placeholder.com/600x400.png?text=Event+Snapshot', caption: 'A snapshot from the event.' },
];

const assignCategory = (name: string, description: string): string => {
  const lowerName = name.toLowerCase();
  const lowerDescription = description.toLowerCase();

  if (lowerName.includes('hack') || lowerDescription.includes('hackathon')) return 'Hackathon';
  if (lowerName.includes('devfest') || lowerName.includes('lisat') || lowerName.includes('field day') || lowerName.includes('conference')) return 'Conference';
  if (lowerName.includes('jane street') || lowerName.includes('squarespace') || lowerName.includes('google') && (lowerName.includes('office') || lowerName.includes('event'))) return 'Tech Office'; // Google event could be tech office visit
  if (lowerName.includes('columbia') && lowerDescription.includes('mentor')) return 'Event'; // Could be hackathon too, but let's be specific if possible
  return 'Event'; // Default category
};

const rawPlacesData: Array<[string, string, number, number]> = [
  ['Hopper hacks x2', '2x mentor', 40.917137, -73.122467],
  ['SBU hacks', 'First hackathon 2022', 40.916233, -73.125833],
  ['Hack Cewit x2', '2x speaker', 40.902315, -73.134435],
  ['Hack NYU', 'Mentor and Judge', 40.69417, -73.986839], // This entry is duplicated later, will handle by ID
  ['Treehacks', 'Mentor', 37.431314, -122.169365],
  ['Jane street', 'Visited as part of ColorStack', 40.714443, -74.015849],
  ['Squarespace', 'Got invited to visit', 40.729735, -74.0106],
  ['Devfest NYC', 'Cool event', 40.755556, -73.988105],
  ['GitHub Field day', 'I was there in spirit', 40.756763, -73.98984],
  ['Hack Dartmouth - 2024', 'Hacker', 43.7037946, -72.2946593],
  ['HackMIT - 2024', 'Hacker', 42.360092, -71.094162],
  ['DivHacks - 2024', 'Mentor/Judge', 40.807537, -73.96257],
  ['MHacks - 2024', 'Mentor/Judge', 42.291160, -83.715830],
  ['Hack Dearborn 3: Rewind Reality - 2024', 'Volunteer', 42.317220, -83.230400],
  ['Googly DevFest NYC 2024', 'Attendee',40.743661, -74.009000],
  ['HackRU - Fall - 2024', 'Mentor/Hacker', 40.500820, -74.447395],
  ['HackPrinceton - Fall -2024', 'Hacker', 40.350292, -74.652831],
  ['IEEE LISAT 2024', 'Research presenter', 40.819012, -73.068539],
  ['Google and Palo Alto Networks Cloud Hero Event', 'Attendee', 40.727630, -74.009924],
  ['Hack Brown - 2025', 'Hacker', 41.826771, -71.402550],
  ['Hack NYU', 'Hacker', 40.694632, -73.986704], // Duplicate name, different coords slightly & role
  ['Columbia DevFest', 'Mentor', 40.807427, -73.962519],
];

export const places: PlaceItem[] = rawPlacesData.map((place, index) => {
  const [name, description, latitude, longitude] = place;
  // Create a more unique ID based on name and index to handle duplicates like "Hack NYU"
  const idSuffix = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + index;
  return {
    id: `place-${idSuffix}`,
    name,
    description,
    latitude,
    longitude,
    category: assignCategory(name, description),
    photos: placeholderPhotos.map(photo => ({ ...photo })), // Create new photo instances
  };
});

export default places; // Default export remains the same array, now of PlaceItem[]

export const MapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#242424' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242424' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#ba9bdd' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#2a2a2a' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#560BAD' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#560BAD' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#242424' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#1c1c1c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#242424' }],
  },
];
