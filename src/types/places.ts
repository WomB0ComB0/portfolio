export interface PhotoItem {
  url: string;
  caption?: string;
}

export interface PlaceItem {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  category: string; // "Hackathon", "Tech Office", "Conference", "Scenic", "Event", "Other"
  photos: PhotoItem[];
}
