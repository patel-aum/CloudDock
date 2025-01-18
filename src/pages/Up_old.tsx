  import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload as UploadIcon, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, MAX_FREE_STORAGE } from '../lib/s3';

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
  cached?: boolean;
}

interface CachedFile {
  key: string;
  url: string;
  expiryTime: number;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export default function Upload() {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const cachedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
    const now = Date.now();
    const validCachedFiles = cachedFiles.filter((file: CachedFile) => file.expiryTime > now);
    localStorage.setItem('uploadedFiles', JSON.stringify(validCachedFiles));
  }, []);

  const cacheFile = useCallback((key: string, url: string) => {
    const cachedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
    const expiryTime = Date.now() + CACHE_DURATION;
    
    cachedFiles.push({ key, url, expiryTime });
    localStorage.setItem('uploadedFiles', JSON.stringify(cachedFiles));
  }, []);

  const getCachedFile = useCallback((key: string): string | null => {
    const cachedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
    const cachedFile = cachedFiles.find((file: CachedFile) => file.key === key);
    
    if (cachedFile && cachedFile.expiryTime > Date.now()) {
      return cachedFile.url;
    }
    return null;
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Check storage limit
    const { data: storageData, error: storageError } = await supabase
      .from('user_storage')
      .select('storage_used, is_premium')
      .eq('user_id', user?.id)
      .single();

    if (storageError) {
      console.error('Error checking storage:', storageError);
      return;
    }

    const totalUploadSize = acceptedFiles.reduce((acc, file) => acc + file.size, 0);

    if (!storageData.is_premium && storageData.storage_used + totalUploadSize > MAX_FREE_STORAGE) {
      alert('Storage limit exceeded. Please upgrade to premium to upload more files.');
      return;
    }

    const newFiles = acceptedFiles.map(file => ({
      file,
      progress: 0
    }));

    setUploadingFiles(prev => [...prev, ...newFiles]);

    for (const fileData of newFiles) {
      try {
        const file = fileData.file;
        const key = `${user?.id}/${Date.now()}-${file.name}`;
        
        // Check if file is already cached
        const cachedUrl = getCachedFile(key);
        if (cachedUrl) {
          setUploadingFiles(prev =>
            prev.map(f =>
              f.file === file ? { ...f, progress: 100, cached: true } : f
            )
          );
          continue;
        }

        // Upload to S3
        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: await file.arrayBuffer(),
          ContentType: file.type,
          CacheControl: 'public, max-age=31536000, immutable',
          Expires: new Date(Date.now() + 31536000000)
        });

        await s3Client.send(command);

        // Cache the uploaded file
        const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
        cacheFile(key, fileUrl);

        // Update database
        const { error: dbError } = await supabase
          .from('photos')
          .insert({
            user_id: user?.id,
            s3_key: key,
            filename: file.name,
            size: file.size,
            mime_type: file.type,
            metadata: {}
          });

        if (dbError) throw dbError;

        // Update storage usage
        const { error: storageError } = await supabase
          .rpc('increment_storage_used', {
            user_id: user?.id,
            size_increment: file.size
          });

        if (storageError) throw storageError;

        setUploadingFiles(prev =>
          prev.map(f =>
            f.file === file ? { ...f, progress: 100 } : f
          )
        );
      } catch (error: any) {
        console.error('Upload error:', error);
        setUploadingFiles(prev =>
          prev.map(f =>
            f.file === fileData.file ? { ...f, error: error.message || 'Upload failed' } : f
          )
        );
      }
    }
  }, [user, cacheFile, getCachedFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Gallery
          </button>
        </div>

        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
            transition-colors duration-150 ease-in-out cursor-pointer
          `}
        >
          <input {...getInputProps()} />
          <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-900">
            Drag & drop photos here
          </p>
          <p className="mt-1 text-sm text-gray-500">
            or click to select files
          </p>
        </div>

        {uploadingFiles.length > 0 && (
          <div className="mt-8 bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Uploads
              </h3>
              <div className="mt-4 space-y-4">
                {uploadingFiles.map((fileData, index) => (
                  <div key={index} className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {fileData.file.name}
                        </p>
                        {fileData.error ? (
                          <span className="text-red-500 text-sm">
                            {fileData.error}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">
                            {fileData.progress}%
                          </span>
                        )}
                      </div>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            fileData.error ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${fileData.progress}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setUploadingFiles(prev => prev.filter(f => f !== fileData))}
                      className="ml-4 text-gray-400 hover:text-gray-500"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}