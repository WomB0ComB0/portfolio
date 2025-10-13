'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import Layout from '@/components/layout/layout';
import GoogleMaps from '@/components/markers/map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import places from '@/data/places';
import type { PlaceItem } from '@/types/places';

export const Places = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedPlacePhotos, setSelectedPlacePhotos] = useState<PlaceItem['photos']>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>('');

  const categories = useMemo(() => ['All', ...new Set(places.map((p) => p.category))], []);

  const filteredPlaces = useMemo(() => {
    return places.filter(
      (place) => selectedCategory === 'All' || place.category === selectedCategory,
    );
  }, [selectedCategory]);

  const openModal = (place: PlaceItem) => {
    if (place.photos && place.photos.length > 0) {
      setSelectedPlacePhotos(place.photos);
      setSelectedPlaceName(place.name);
      setCurrentPhotoIndex(0);
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPlacePhotos([]);
    setSelectedPlaceName('');
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prevIndex) => (prevIndex + 1) % selectedPlacePhotos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex(
      (prevIndex) => (prevIndex - 1 + selectedPlacePhotos.length) % selectedPlacePhotos.length,
    );
  };

  return (
    <Layout>
      <div className="w-full min-h-screen p-4 md:p-8 text-[#ba9bdd]">
        <Card className="w-full max-w-4xl mx-auto bg-[#242424] border-[#560BAD] rounded-xl overflow-hidden">
          <CardHeader className="bg-[#2a2a2a] p-6">
            <div className="flex items-center gap-3 mb-2 sr-only">
              <FaInfoCircle className="text-3xl text-[#ba9bdd]" />
              <CardTitle className="text-3xl md:text-4xl font-bold text-[#ba9bdd]">
                My Places
              </CardTitle>
            </div>
            <CardDescription className="text-[#ba9bdd]/80 text-lg">
              Explore the locations I've visited, including hackathons, tech events, and notable
              places. Use the filter to narrow down by category.
            </CardDescription>
            <div className="mt-4">
              <label
                htmlFor="category-filter"
                className="block text-sm font-medium text-[#ba9bdd]/90 mb-1"
              >
                Filter by Category:
              </label>
              <select
                id="category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full md:w-1/3 bg-[#2a2a2a] border border-[#560BAD] text-[#ba9bdd] rounded-md p-2 focus:ring-[#7c3aed] focus:border-[#7c3aed]"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-[#2a2a2a] rounded-lg p-1 mb-6">
                <TabsTrigger
                  value="map"
                  className="text-[#ba9bdd] data-[state=active]:bg-[#560BAD]"
                >
                  Map View
                </TabsTrigger>
                <TabsTrigger
                  value="list"
                  className="text-[#ba9bdd] data-[state=active]:bg-[#560BAD]"
                >
                  List View
                </TabsTrigger>
              </TabsList>
              <TabsContent value="map">
                <div className="w-full h-[500px] rounded-lg overflow-hidden">
                  <GoogleMaps placesToDisplay={filteredPlaces} />
                </div>
              </TabsContent>
              <TabsContent value="list">
                <ScrollArea className="h-[500px] w-full pr-4">
                  {filteredPlaces.length > 0 ? (
                    filteredPlaces.map((place) => (
                      <Card
                        key={place.id}
                        className="mb-4 bg-[#2a2a2a] border-purple-700 border rounded-lg hover:bg-[#3a3a3a] transition-colors"
                      >
                        <CardHeader className="pb-2">
                          <Link
                            href={`https://maps.google.com/?q=${place.latitude},${place.longitude}`}
                            target="_blank"
                            className="w-full h-full group block"
                            rel="noopener noreferrer"
                          >
                            <CardTitle className="text-xl text-[#ba9bdd] group-hover:text-purple-400 transition-colors">
                              {place.name}
                            </CardTitle>
                            <CardDescription className="text-[#ba9bdd]/70 text-base mt-1">
                              {place.description}
                            </CardDescription>
                            <p className="text-xs text-purple-400 mt-2">{place.category}</p>
                          </Link>
                        </CardHeader>
                        <CardContent className="pt-2 pb-4 px-6">
                          {place.photos && place.photos.length > 0 && (
                            <Button
                              onClick={() => openModal(place)}
                              variant="outline"
                              size="sm"
                              className="mt-2 w-full bg-purple-700 hover:bg-purple-600 border-purple-600 text-purple-100"
                            >
                              View Photos ({place.photos.length})
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-gray-400 py-10">
                      No places match the selected category.
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Modal for Photos */}
      {isModalOpen && selectedPlacePhotos.length > 0 && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#2a2a2a] p-5 md:p-6 rounded-lg shadow-xl max-w-2xl w-full relative border border-purple-700">
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 text-gray-300 hover:text-white text-3xl font-bold leading-none"
              aria-label="Close modal"
            >
              &times;
            </button>
            <h3 className="text-xl lg:text-2xl font-bold text-purple-300 mb-1">
              {selectedPlaceName}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Photo {currentPhotoIndex + 1} of {selectedPlacePhotos.length}
            </p>
            <div className="relative mb-4 aspect-video">
              {selectedPlacePhotos[currentPhotoIndex] && (
                <img
                  src={selectedPlacePhotos[currentPhotoIndex].url}
                  alt={
                    selectedPlacePhotos[currentPhotoIndex].caption ||
                    `Photo ${currentPhotoIndex + 1} of ${selectedPlaceName}`
                  }
                  className="w-full h-full object-contain rounded-md"
                />
              )}
            </div>
            {selectedPlacePhotos[currentPhotoIndex]?.caption && (
              <p className="text-center text-sm text-gray-300 mt-2 mb-4">
                {selectedPlacePhotos[currentPhotoIndex].caption}
              </p>
            )}
            <div className="flex justify-between items-center mt-4">
              <Button
                onClick={prevPhoto}
                disabled={selectedPlacePhotos.length <= 1}
                variant="outline"
                className="bg-purple-700 hover:bg-purple-600 border-purple-600 text-purple-100 disabled:opacity-50"
              >
                Previous
              </Button>
              <Button
                onClick={nextPhoto}
                disabled={selectedPlacePhotos.length <= 1}
                variant="outline"
                className="bg-purple-700 hover:bg-purple-600 border-purple-600 text-purple-100 disabled:opacity-50"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
