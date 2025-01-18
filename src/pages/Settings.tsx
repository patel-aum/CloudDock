import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { MAX_FREE_STORAGE, formatStorageUsed } from '../lib/s3';

interface StorageInfo {
  storage_used: number;
  is_premium: boolean;
}

export default function Settings() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
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
  

  const handleUpgradeClick = () => {
    // TODO: Implement payment integration
    alert('Payment integration coming soon!');
  };

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

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Account Settings
            </h3>

            <div className="mt-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900">Storage Usage</h4>
                {storageInfo && (
                  <>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Used</span>
                        <span className="font-medium text-gray-900">
                          {formatStorageUsed(storageInfo.storage_used)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-gray-500">Total</span>
                        <span className="font-medium text-gray-900">
                          {storageInfo.is_premium ? "Unlimited" : "5 GB"}
                        </span>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{
                            width: `${Math.min(
                              (storageInfo.storage_used / MAX_FREE_STORAGE) * 100,
                              100
                            )}%`
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {storageInfo && !storageInfo.is_premium && (
                <div className="mt-6">
                  <div className="rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
                    <h4 className="text-lg font-semibold">Upgrade to Premium</h4>
                    <p className="mt-2">
                      Get unlimited storage and premium features for just ₹499/month
                    </p>
                    <ul className="mt-4 space-y-2">
                      <li className="flex items-center">
                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Unlimited storage space
                      </li>
                      <li className="flex items-center">
                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Priority support
                      </li>
                      <li className="flex items-center">
                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Advanced sharing features
                      </li>
                    </ul>
                    <button
                      onClick={handleUpgradeClick}
                      className="mt-6 w-full bg-white text-indigo-600 py-2 px-4 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-indigo-600 focus:ring-white"
                    >
                      <CreditCard className="inline-block h-5 w-5 mr-2" />
                      Upgrade Now
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900">Account Information</h4>
                <div className="mt-2 space-y-4">
                  <div>
                    <label className="block text-sm text-gray-500">Email</label>
                    <p className="mt-1 text-sm font-medium text-gray-900">{user?.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500">Account Type</label>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {storageInfo?.is_premium ? "Premium" : "Free"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}