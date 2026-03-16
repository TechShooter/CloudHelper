'use client';

import { useState, useEffect } from 'react';

interface UserProfile {
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  goal: string;
  notes: string;
}

interface Props {
  onProfileChange: (profile: UserProfile | null) => void;
}

export default function UserProfile({ onProfileChange }: Props) {
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    goal: '',
    notes: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
      const parsed = JSON.parse(saved);
      setProfile(parsed);
      onProfileChange(parsed);
    }
  }, []);

  const saveProfile = () => {
    localStorage.setItem('userProfile', JSON.stringify(profile));
    onProfileChange(profile);
    setShowProfile(false);
    alert('Profile saved!');
  };

  const hasProfile = profile.calories || profile.protein || profile.goal;

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-gray-300">My Profile & Goals</h2>
        <button
          onClick={() => setShowProfile(!showProfile)}
          className={`text-xs px-3 py-1 rounded ${
            hasProfile ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
          } text-white`}
        >
          {hasProfile ? '✓ Profile Set' : 'Set Profile'}
        </button>
      </div>

      {showProfile && (
        <div className="bg-gray-700 p-4 rounded space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Daily Calories (2000 kcal)"
              value={profile.calories}
              onChange={(e) => setProfile({ ...profile, calories: e.target.value })}
              className="px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
            />
            <input
              type="text"
              placeholder="Protein (150g)"
              value={profile.protein}
              onChange={(e) => setProfile({ ...profile, protein: e.target.value })}
              className="px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
            />
            <input
              type="text"
              placeholder="Carbs (200g)"
              value={profile.carbs}
              onChange={(e) => setProfile({ ...profile, carbs: e.target.value })}
              className="px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
            />
            <input
              type="text"
              placeholder="Fats (70g)"
              value={profile.fats}
              onChange={(e) => setProfile({ ...profile, fats: e.target.value })}
              className="px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
            />
          </div>
          <input
            type="text"
            placeholder="Goal (lose weight, build muscle...)"
            value={profile.goal}
            onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
          />
          <textarea
            placeholder="Notes (allergies, preferences...)"
            value={profile.notes}
            onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
            rows={2}
          />
          <button
            onClick={saveProfile}
            className="text-xs bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Save Profile
          </button>
        </div>
      )}
    </div>
  );
}