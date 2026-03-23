'use client';

import { useState, useEffect } from 'react';

interface Meal {
  id: string;
  date: string;
  time: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food: string;
  calories?: string;
  notes?: string;
}

interface Props {
  onMealsChange: (meals: Meal[]) => void;
}

export default function MealTracker({ onMealsChange }: Props) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMeal, setNewMeal] = useState({
    type: 'lunch' as 'breakfast' | 'lunch' | 'dinner' | 'snack',
    food: '',
    calories: '',
    notes: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem('mealHistory');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Keep only last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const filtered = parsed.filter((m: Meal) => new Date(m.date) >= weekAgo);
      setMeals(filtered);
      onMealsChange(filtered);
      if (filtered.length !== parsed.length) {
        localStorage.setItem('mealHistory', JSON.stringify(filtered));
      }
    }
  }, []);

  const addMeal = () => {
    if (!newMeal.food) return;

    const now = new Date();
    const meal: Meal = {
      id: Date.now().toString(),
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      ...newMeal
    };

    const updated = [meal, ...meals];
    setMeals(updated);
    localStorage.setItem('mealHistory', JSON.stringify(updated));
    onMealsChange(updated);
    
    setNewMeal({ type: 'lunch', food: '', calories: '', notes: '' });
    setShowAdd(false);
  };

  const deleteMeal = (id: string) => {
    const updated = meals.filter(m => m.id !== id);
    setMeals(updated);
    localStorage.setItem('mealHistory', JSON.stringify(updated));
    onMealsChange(updated);
  };

  const getMealsByDay = () => {
    const grouped: { [key: string]: Meal[] } = {};
    meals.forEach(meal => {
      if (!grouped[meal.date]) grouped[meal.date] = [];
      grouped[meal.date].push(meal);
    });
    return grouped;
  };

  const mealsByDay = getMealsByDay();
  const hasMeals = meals.length > 0;

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-gray-300">
          Meal History {hasMeals && <span className="text-xs text-gray-500">({meals.length} meals)</span>}
        </h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700"
        >
          + Log Meal
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 bg-gray-700 rounded space-y-2">
          <select
            value={newMeal.type}
            onChange={(e) => setNewMeal({ ...newMeal, type: e.target.value as any })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
          <input
            type="text"
            placeholder="What did you eat?"
            value={newMeal.food}
            onChange={(e) => setNewMeal({ ...newMeal, food: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
          />
          <input
            type="text"
            placeholder="Calories (optional)"
            value={newMeal.calories}
            onChange={(e) => setNewMeal({ ...newMeal, calories: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={newMeal.notes}
            onChange={(e) => setNewMeal({ ...newMeal, notes: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
          />
          <button
            onClick={addMeal}
            className="text-xs bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Save Meal
          </button>
        </div>
      )}

      {hasMeals && (
        <div className="max-h-32 overflow-y-auto space-y-2 text-xs">
          {Object.entries(mealsByDay).sort(([a], [b]) => b.localeCompare(a)).map(([date, dayMeals]) => (
            <div key={date} className="bg-gray-700 p-2 rounded">
              <div className="font-medium text-gray-300 mb-1">
                {new Date(date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
              {dayMeals.map(meal => (
                <div key={meal.id} className="flex items-start justify-between text-gray-400 ml-2 mb-1">
                  <div className="flex-1">
                    <span className="text-orange-400">{meal.time}</span> - 
                    <span className="text-gray-300"> {meal.type}</span>: {meal.food}
                    {meal.calories && <span className="text-green-400"> ({meal.calories} kcal)</span>}
                  </div>
                  <button
                    onClick={() => deleteMeal(meal.id)}
                    className="text-red-400 hover:text-red-300 ml-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
