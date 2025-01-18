import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Settings, LogOut } from 'lucide-react';
import Masonry from 'react-masonry-css';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, formatStorageUsed } from '../lib/s3';

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

export default function Gallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
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

      // Get signed URLs for each photo
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
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">PhotosXP</h1>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <Masonry
            breakpointCols={breakpointColumns}
            className="flex -ml-4 w-auto"
            columnClassName="pl-4 bg-clip-padding"
          >
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="mb-4 break-inside-avoid"
              >
                <div className="group relative bg-white rounded-lg shadow-sm overflow-hidden">
                  <img
                    src={photo.signedUrl}
                    alt={photo.filename}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-sm truncate">{photo.filename}</p>
                    <p className="text-white/80 text-xs">
                      {format(new Date(photo.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </Masonry>
        )}
      </main>
    </div>
  );
}