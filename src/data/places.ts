export type RawPlace = [string, string, number, number];

export const places: RawPlace[] = [
  ['Hopper hacks x2', '2x mentor', 40.917137, -73.122467],
  ['SBU hacks', 'First hackathon 2022', 40.916233, -73.125833],
  ['Hack Cewit x2', '2x speaker', 40.902315, -73.134435],
  ['NYU Hacks', 'Mentor and Judge', 40.69417, -73.986839],
  ['Treehacks', 'Mentor', 37.431314, -122.169365],
  ['Jane street', 'Visited as part of ColorStack', 40.714443, -74.015849],
  ['Squarespace', 'Got invited to visit', 40.729735, -74.0106],
  ['Devfest NYC', 'Cool event', 40.755556, -73.988105],
  ['GitHub Field day', 'I was there in spirit', 40.756763, -73.98984],
  ['Hack Dartmouth - 2024', 'Hacker', 43.7037946, -72.2946593],
  ['HackMIT - 2024', 'Hacker', 42.360092, -71.094162],
  ['DivHacks - 2024', 'Mentor/Judge', 40.807537, -73.96257],
  ['MHacks - 2024', 'Mentor/Judge', 42.291160, -83.715830],
  ['Hack Dearborn 3: Rewind Reality - 2024', 'Mentor', 42.317220, -83.230400],
];

export default places;

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
