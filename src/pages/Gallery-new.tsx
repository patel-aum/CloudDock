import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Settings, LogOut, ChevronLeft, ChevronRight, Download, X, Trash2 } from 'lucide-react';
import Masonry from 'react-masonry-css';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, formatStorageUsed,DeleteObjectCommand } from '../lib/s3';
import clouddockicon from '../icons/ClouDocklogo-transparent.png';
import '../styles/PhotoModal.css';

interface Photo {
  id: string;
  filename: string;
  s3_key: string;
  created_at: string;
  metadata: any;
  signedUrl?: string;
}

interface StorageInfo {
  storage_used: number;
  is_premium: boolean;
}

interface PhotoGroup {
  date: string;
  photos: Photo[];
}

interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onDelete: (photo: Photo) => Promise<void>;
  hasNext: boolean;
  hasPrevious: boolean;
}

const PhotoModal: React.FC<PhotoModalProps> = ({
  photo,
  onClose,
  onNext,
  onPrevious,
  onDelete,
  hasNext,
  hasPrevious,
}) => {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      switch (e.key) {
        case 'ArrowLeft':
          if (hasPrevious) onPrevious();
          break;
        case 'ArrowRight':
          if (hasNext) onNext();
          break;
        case 'Escape':
          onClose();
          break;
      }
      
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious, hasNext, hasPrevious]);

  const DeleteConfirmationModal: React.FC<{
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }> = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Photo</h3>
          <p className="text-gray-600 mb-4">
            Are you sure you want to delete this photo? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };


  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (!photo.signedUrl) return;

      const response = await fetch(photo.signedUrl);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = photo.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading photo:', error);
    }
  }, [photo]);

  const handleModalClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(photo);
      onClose();
    } catch (error) {
      console.error('Error deleting photo:', error);
      // You might want to show an error toast here
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmation(false);
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
      onClick={handleModalClick}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 z-50"
        aria-label="Close modal"
      >
        <X className="h-6 w-6" />
      </button>
      
      <button
        onClick={handleDownload}
        className="absolute top-4 right-16 text-white hover:text-gray-300 p-2 z-50"
        aria-label="Download photo"
      >
        <Download className="h-6 w-6" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowDeleteConfirmation(true);
        }}
        disabled={isDeleting}
        className="absolute top-4 right-28 text-white hover:text-gray-300 p-2 z-50"
        aria-label="Delete photo"
      >
        <Trash2 className="h-6 w-6" />
      </button>

      <DeleteConfirmationModal
        isOpen={showDeleteConfirmation}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirmation(false)}
      />

      <div className="relative w-full h-full flex items-center justify-center">
        {hasPrevious && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
            className="absolute left-4 text-white hover:text-gray-300 p-4 z-50"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
        )}

        <img
          src={photo.signedUrl}
          alt={photo.filename}
          className={`max-h-[90vh] max-w-[90vw] object-contain photo-modal-image ${isSwiping ? 'swiping' : ''}`}
          onClick={handleImageClick}
          onTouchStart={(e) => {
            setSwipeStartX(e.touches[0].clientX);
            setIsSwiping(true);
          }}
          onTouchMove={(e) => {
            if (isSwiping) {
              const currentX = e.touches[0].clientX;
              const diff = currentX - swipeStartX;
              if (Math.abs(diff) > 100) {
                if (diff > 0 && hasPrevious) {
                  onPrevious();
                } else if (diff < 0 && hasNext) {
                  onNext();
                }
                setIsSwiping(false);
              }
            }
          }}
          onTouchEnd={() => {
            setIsSwiping(false);
          }}
        />

        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 text-white hover:text-gray-300 p-4 z-50"
            aria-label="Next photo"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-center">
        <p className="text-sm">{photo.filename}</p>
        <p className="text-xs text-gray-300">
          {format(new Date(photo.created_at), 'MMMM d, yyyy')}
        </p>
      </div>
    </div>
  );
};

export default function Gallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoGroups, setPhotoGroups] = useState<PhotoGroup[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState(0);
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const breakpointColumns = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1
  };

  useEffect(() => {
    fetchPhotos();
    fetchStorageInfo();
  }, []);

  useEffect(() => {
    const groups = photos.reduce((acc: PhotoGroup[], photo) => {
      const date = format(parseISO(photo.created_at), 'MMMM d, yyyy');
      const existingGroup = acc.find(group => group.date === date);
      
      if (existingGroup) {
        existingGroup.photos.push(photo);
      } else {
        acc.push({ date, photos: [photo] });
      }
      
      return acc;
    }, []);

    setPhotoGroups(groups);
  }, [photos]);

  const fetchStorageInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('user_storage')
        .select('storage_used, is_premium')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setStorageInfo(data);
    } catch (error) {
      console.error('Error fetching storage info:', error);
    }
  };

  const fetchPhotos = async () => {
    try {
      const { data: photosData, error } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const photosWithUrls = await Promise.all(
        photosData.map(async (photo) => {
          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: photo.s3_key,
          });
          const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
          return { ...photo, signedUrl };
        })
      );

      setPhotos(photosWithUrls);
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = async (photo: Photo) => {
    try {
      // Delete from S3
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: photo.s3_key,
      });
      await s3Client.send(deleteCommand);  // Ensure this resolves successfully
  
      // Delete from Supabase
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id);
  
      if (error) throw error;  // Ensure you handle any error from Supabase
  
      // Update storage info
      await fetchStorageInfo();  // To keep the storage info updated
  
      // Update local state
      setPhotos(prevPhotos => prevPhotos.filter(p => p.id !== photo.id));
  
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error; // Re-throw the error so it can be caught in the modal component
    }
  };
  


  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const handleModalClose = () => {
    setSelectedPhoto(null);
  };

  const handleNext = () => {
    if (!selectedPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    if (currentIndex < photos.length - 1) {
      setSelectedPhoto(photos[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    if (!selectedPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    if (currentIndex > 0) {
      setSelectedPhoto(photos[currentIndex - 1]);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-4">
              <img src={clouddockicon} alt="Cloud Dock Logo" className="h-8 w-8"/>
              <h1 className="text-2xl font-bold text-gray-900">Cloud Dock</h1>
            </div>
            <div className="flex items-center space-x-4">
              {storageInfo && (
                <div className="text-sm text-gray-600">
                  Storage: {formatStorageUsed(storageInfo.storage_used)} / {storageInfo.is_premium ? "Unlimited" : "5 GB"}
                </div>
              )}
              <button
                onClick={() => navigate('/upload')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex justify-center">
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No photos</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by uploading a photo.</p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/upload')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload photos
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-8">
            {photoGroups.map((group) => (
              <div key={group.date} className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">{group.date}</h2>
                <Masonry
                  breakpointCols={breakpointColumns}
                  className="flex -ml-4 w-auto"
                  columnClassName="pl-4 bg-clip-padding"
                >
                  {group.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="mb-4 break-inside-avoid cursor-pointer"
                      onClick={() => handlePhotoClick(photo)}
                    >
                      <div className="group relative bg-white rounded-lg shadow-sm overflow-hidden">
                        <img
                          src={photo.signedUrl}
                          alt={photo.filename}
                          className="w-full h-auto object-cover gallery-image"
                          loading="lazy"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-sm truncate">{photo.filename}</p>
                          <p className="text-white/80 text-xs">
                            {format(new Date(photo.created_at), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </Masonry>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={handleModalClose}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onDelete={deletePhoto}
          hasNext={photos.findIndex(p => p.id === selectedPhoto.id) < photos.length - 1}
          hasPrevious={photos.findIndex(p => p.id === selectedPhoto.id) > 0}
        />
      )}
    </div>
  );
}