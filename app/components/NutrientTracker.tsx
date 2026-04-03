'use client';

import { useState, useEffect } from 'react';

interface FoodEntry {
  id: string;
  time: string;
  food: string;
  grams: number;
  energy: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface WeightEntry {
  date: string;
  weight: number;
}

interface NutrientGoals {
  energyKJ: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface Props {
  sheetData: any;
  userProfile: any;
  onEntriesChange?: (entries: FoodEntry[]) => void;
}

export default function NutrientTracker({ sheetData, userProfile, onEntriesChange }: Props) {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [selectedFood, setSelectedFood] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [time, setTime] = useState('');
  const [grams, setGrams] = useState<number>(100);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editGrams, setEditGrams] = useState<number>(100);
  const [editTime, setEditTime] = useState<string>('');
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [newWeight, setNewWeight] = useState<number>(0);
  const [weightDate, setWeightDate] = useState('');
  const [goals, setGoals] = useState<NutrientGoals>({
    energyKJ: 8000,
    protein: 150,
    carbs: 200,
    fats: 60
  });
  const [editingGoals, setEditingGoals] = useState(false);
  const [tempGoals, setTempGoals] = useState<NutrientGoals>(goals);

  useEffect(() => {
    const saved = localStorage.getItem('nutrientEntries');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const now = new Date();
        const last24h = parsed.filter((entry: FoodEntry) => {
          const entryTime = new Date(entry.time);
          return (now.getTime() - entryTime.getTime()) < 24 * 60 * 60 * 1000;
        });
        setEntries(last24h);
      } catch (error) {
        console.error('Failed to load entries:', error);
      }
    }

    const savedGoals = localStorage.getItem('nutrientGoals');
    if (savedGoals) {
      try {
        const parsed = JSON.parse(savedGoals);
        setGoals(parsed);
        setTempGoals(parsed);
      } catch (error) {
        console.error('Failed to load goals:', error);
      }
    }

    const savedWeights = localStorage.getItem('weightHistory');
    if (savedWeights) {
      try {
        setWeightHistory(JSON.parse(savedWeights));
      } catch (error) {
        console.error('Failed to load weight history:', error);
      }
    }

    const now = new Date();
    const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setTime(localTime);
    setWeightDate(localTime.slice(0, 10));
  }, []);

  useEffect(() => {
    localStorage.setItem('nutrientEntries', JSON.stringify(entries));
    if (onEntriesChange) {
      onEntriesChange(entries);
    }
  }, [entries, onEntriesChange]);

  useEffect(() => {
    localStorage.setItem('nutrientGoals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem('weightHistory', JSON.stringify(weightHistory));
  }, [weightHistory]);

  const getFoodOptions = () => {
    if (!sheetData || !Array.isArray(sheetData)) return [];
    
    const foods: any[] = [];
    sheetData.forEach((sheet: any) => {
      if (sheet.data && Array.isArray(sheet.data)) {
        sheet.data.forEach((row: string[]) => {
          if (row.length >= 19 && row[0]) {
            foods.push({
              name: row[0],
              usualGrams: parseFloat(row[5]) || 100,
              energyPer100g: parseFloat(row[11]) || 0,
              fatsPer100g: parseFloat(row[12]) || 0,
              carbsPer100g: parseFloat(row[14]) || 0,
              proteinPer100g: parseFloat(row[17]) || 0
            });
          }
        });
      }
    });
    return foods;
  };

  const filteredFoods = getFoodOptions().filter(food => 
    food.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addEntry = () => {
    if (!selectedFood || !time || !grams) return;

    const food = getFoodOptions().find(f => f.name === selectedFood);
    if (!food) return;

    const multiplier = grams / 100;

    const newEntry: FoodEntry = {
      id: Date.now().toString(),
      time,
      food: food.name,
      grams,
      energy: food.energyPer100g * multiplier,
      protein: food.proteinPer100g * multiplier,
      carbs: food.carbsPer100g * multiplier,
      fats: food.fatsPer100g * multiplier
    };

    setEntries(prev => [...prev, newEntry].sort((a, b) => 
      new Date(b.time).getTime() - new Date(a.time).getTime()
    ));
    setSelectedFood('');
    setSearchTerm('');
    setGrams(100);
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const updateEntryGrams = (id: string, newGrams: number) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id !== id) return entry;
      
      const food = getFoodOptions().find(f => f.name === entry.food);
      if (!food) return entry;
      
      const multiplier = newGrams / 100;
      return {
        ...entry,
        grams: newGrams,
        energy: food.energyPer100g * multiplier,
        protein: food.proteinPer100g * multiplier,
        carbs: food.carbsPer100g * multiplier,
        fats: food.fatsPer100g * multiplier
      };
    }));
    setEditingEntry(null);
  };

  const updateEntry = (id: string, newGrams: number, newTime: string) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id !== id) return entry;
      
      const food = getFoodOptions().find(f => f.name === entry.food);
      if (!food) return entry;
      
      const multiplier = newGrams / 100;
      return {
        ...entry,
        time: newTime,
        grams: newGrams,
        energy: food.energyPer100g * multiplier,
        protein: food.proteinPer100g * multiplier,
        carbs: food.carbsPer100g * multiplier,
        fats: food.fatsPer100g * multiplier
      };
    }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    setEditingEntry(null);
  };

  const addWeight = () => {
    if (!newWeight || !weightDate) return;
    const entry: WeightEntry = {
      date: weightDate,
      weight: newWeight
    };
    setWeightHistory(prev => [...prev, entry].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ));
    setNewWeight(0);
  };

  const deleteWeight = (date: string) => {
    setWeightHistory(prev => prev.filter(w => w.date !== date));
  };

  const saveGoals = () => {
    setGoals(tempGoals);
    setEditingGoals(false);
  };

  const totals = entries.reduce((acc, entry) => ({
    energy: acc.energy + entry.energy,
    protein: acc.protein + entry.protein,
    carbs: acc.carbs + entry.carbs,
    fats: acc.fats + entry.fats
  }), { energy: 0, protein: 0, carbs: 0, fats: 0 });

  const getProgressColor = (current: number, target: number) => {
    if (!target) return 'bg-gray-600';
    const percentage = (current / target) * 100;
    if (percentage < 80) return 'bg-red-500';
    if (percentage < 95) return 'bg-orange-500';
    if (percentage <= 110) return 'bg-green-500';
    return 'bg-yellow-500';
  };

  const getProgressPercentage = (current: number, target: number) => {
    if (!target) return 0;
    return Math.round((current / target) * 100);
  };

  const targets = {
    energy: goals.energyKJ,
    protein: goals.protein,
    carbs: goals.carbs,
    fats: goals.fats
  };

  const currentWeight = weightHistory.length > 0 ? weightHistory[0].weight : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">🥗 Nutrient Tracker (Last 24h)</h2>
          <div className="flex items-center gap-3">
            {currentWeight && (
              <div className="text-sm text-gray-300">
                ⚖️ Current: <span className="font-bold text-white">{currentWeight} kg</span>
              </div>
            )}
            <button
              onClick={() => {
                setEditingGoals(!editingGoals);
                if (!editingGoals) setTempGoals(goals);
              }}
              className="text-xs bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700"
            >
              {editingGoals ? 'Cancel' : '⚙️ Edit Goals'}
            </button>
          </div>
        </div>

        {/* Goals Editor */}
        {editingGoals && (
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-white mb-3">Daily Goals</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Energy (kJ)</label>
                <input
                  type="number"
                  value={tempGoals.energyKJ}
                  onChange={(e) => setTempGoals({...tempGoals, energyKJ: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Protein (g)</label>
                <input
                  type="number"
                  value={tempGoals.protein}
                  onChange={(e) => setTempGoals({...tempGoals, protein: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Carbs (g)</label>
                <input
                  type="number"
                  value={tempGoals.carbs}
                  onChange={(e) => setTempGoals({...tempGoals, carbs: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Fats (g)</label>
                <input
                  type="number"
                  value={tempGoals.fats}
                  onChange={(e) => setTempGoals({...tempGoals, fats: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
            </div>
            <button
              onClick={saveGoals}
              className="mt-3 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
            >
              Save Goals
            </button>
          </div>
        )}
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Energy (kJ)</div>
            <div className="text-xl font-bold text-white">{totals.energy.toFixed(0)}</div>
            {targets.energy > 0 && (
              <>
                <div className="text-xs text-gray-400 mt-1">Goal: {targets.energy.toFixed(0)} kJ</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-gray-600 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${getProgressColor(totals.energy, targets.energy)}`}
                      style={{ width: `${Math.min((totals.energy / targets.energy) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-white">{getProgressPercentage(totals.energy, targets.energy)}%</span>
                </div>
              </>
            )}
          </div>

          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Protein (g)</div>
            <div className="text-xl font-bold text-white">{totals.protein.toFixed(1)}</div>
            {targets.protein > 0 && (
              <>
                <div className="text-xs text-gray-400 mt-1">Goal: {targets.protein}g</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-gray-600 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${getProgressColor(totals.protein, targets.protein)}`}
                      style={{ width: `${Math.min((totals.protein / targets.protein) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-white">{getProgressPercentage(totals.protein, targets.protein)}%</span>
                </div>
              </>
            )}
          </div>

          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Carbs (g)</div>
            <div className="text-xl font-bold text-white">{totals.carbs.toFixed(1)}</div>
            {targets.carbs > 0 && (
              <>
                <div className="text-xs text-gray-400 mt-1">Goal: {targets.carbs}g</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-gray-600 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${getProgressColor(totals.carbs, targets.carbs)}`}
                      style={{ width: `${Math.min((totals.carbs / targets.carbs) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-white">{getProgressPercentage(totals.carbs, targets.carbs)}%</span>
                </div>
              </>
            )}
          </div>

          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Fats (g)</div>
            <div className="text-xl font-bold text-white">{totals.fats.toFixed(1)}</div>
            {targets.fats > 0 && (
              <>
                <div className="text-xs text-gray-400 mt-1">Goal: {targets.fats}g</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-gray-600 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${getProgressColor(totals.fats, targets.fats)}`}
                      style={{ width: `${Math.min((totals.fats / targets.fats) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-white">{getProgressPercentage(totals.fats, targets.fats)}%</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Add Entry Form */}
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Add Food Entry</h3>
          <div className="flex gap-2 flex-wrap">
            <input
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedFood('');
              }}
              placeholder="Search food..."
              className="flex-1 min-w-[200px] px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={grams}
                onChange={(e) => setGrams(Math.max(1, parseFloat(e.target.value) || 1))}
                placeholder="Grams"
                className="w-24 px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
              />
              <span className="text-gray-400 text-sm">g</span>
            </div>
            <button
              onClick={addEntry}
              disabled={!selectedFood || !time || !grams}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-600 text-sm"
            >
              Add
            </button>
          </div>
          
          {searchTerm && filteredFoods.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto bg-gray-800 rounded border border-gray-600">
              {filteredFoods.slice(0, 10).map((food, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedFood(food.name);
                    setSearchTerm(food.name);
                    setGrams(food.usualGrams);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 border-b border-gray-700 last:border-b-0"
                >
                  <div className="font-medium">{food.name}</div>
                  <div className="text-xs text-gray-400">
                    Per 100g: {food.energyPer100g.toFixed(0)} kJ | P: {food.proteinPer100g}g | C: {food.carbsPer100g}g | F: {food.fatsPer100g}g
                    {food.usualGrams !== 100 && <span className="ml-2 text-blue-400">(Usual: {food.usualGrams}g)</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Weight Tracker */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">⚖️ Weight Tracker</h3>
          <div className="flex gap-2 flex-wrap mb-3">
            <input
              type="date"
              value={weightDate}
              onChange={(e) => setWeightDate(e.target.value)}
              className="px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
            />
            <input
              type="number"
              step="0.1"
              value={newWeight || ''}
              onChange={(e) => setNewWeight(parseFloat(e.target.value) || 0)}
              placeholder="Weight (kg)"
              className="w-32 px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
            />
            <button
              onClick={addWeight}
              disabled={!newWeight || !weightDate}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-600 text-sm"
            >
              Add Weight
            </button>
          </div>
          {weightHistory.length > 0 && (
            <div className="max-h-32 overflow-y-auto">
              <div className="space-y-1">
                {weightHistory.slice(0, 10).map((entry, idx) => (
                  <div key={entry.date} className="flex items-center justify-between text-sm bg-gray-800 rounded px-3 py-2">
                    <span className="text-gray-300">
                      {new Date(entry.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-white font-medium">{entry.weight} kg</span>
                    <button
                      onClick={() => deleteWeight(entry.date)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Food Entries (Last 24h)</h3>
        {entries.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>No entries yet. Add your first food!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div key={entry.id} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">{entry.food}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(entry.time).toLocaleString('it-IT', { 
                          day: 'numeric', 
                          month: 'short', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    
                    {editingEntry === entry.id ? (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <input
                          type="datetime-local"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 text-sm"
                        />
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={editGrams}
                          onChange={(e) => setEditGrams(Math.max(1, parseFloat(e.target.value) || 1))}
                          className="w-24 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 text-sm"
                        />
                        <span className="text-gray-400 text-sm">g</span>
                        <button
                          onClick={() => updateEntry(entry.id, editGrams, editTime)}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingEntry(null)}
                          className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-blue-400 font-medium">{entry.grams}g</span>
                        <div className="text-xs text-gray-400">
                          {entry.energy.toFixed(0)} kJ | P: {entry.protein.toFixed(1)}g | C: {entry.carbs.toFixed(1)}g | F: {entry.fats.toFixed(1)}g
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2">
                    {editingEntry !== entry.id && (
                      <button
                        onClick={() => {
                          setEditingEntry(entry.id);
                          setEditGrams(entry.grams);
                          setEditTime(entry.time);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-sm px-2 py-1"
                        title="Edit"
                      >
                        ✏️
                      </button>
                    )}
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
