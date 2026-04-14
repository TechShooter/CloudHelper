'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface FoodEntry {
  id: string;
  time: string;
  food: string;
  grams: number;
  cost: number;
  energy: number;
  protein: number;
  carbs: number;
  fats: number;
  saturatedFats: number;
  fibers: number;
  sugars: number;
  salt: number;
  vitaminD: number;
  vitaminB1: number;
  vitaminB2: number;
  vitaminB3: number;
  vitaminB5: number;
  vitaminB6: number;
  vitaminB9: number;
  vitaminE: number;
  vitaminK: number;
  calcium: number;
  iron: number;
  phosphorus: number;
  magnesium: number;
  potassium: number;
  zinc: number;
  copper: number;
  manganese: number;
  selenium: number;
}

// Food entry item with delete confirmation
const FoodEntryItem = React.memo(({ entry, onDelete, onEdit, onHide, hidden }: { 
  entry: any; 
  onDelete: (id: string) => void; 
  onEdit: (id: string) => void; 
  onHide: (id: string) => void; 
  hidden: boolean;
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  
  const handleDelete = React.useCallback(() => {
    onDelete(entry.id);
  }, [onDelete, entry.id]);
  
  return (
    <div className={`bg-gray-800 rounded p-3 ${hidden ? 'opacity-50 border-l-4 border-yellow-500' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium text-white">{entry.food}</div>
          <div className="text-xs text-gray-400">
            {new Date(entry.time).toLocaleString()} • {entry.grams}g
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Energy: {entry.energy.toFixed(0)} kJ | Protein: {entry.protein.toFixed(1)}g | Carbs: {entry.carbs.toFixed(1)}g | Fats: {entry.fats.toFixed(1)}g
          </div>
          <div className="text-xs text-green-400 mt-1 font-medium">
            {entry.cost > 0 ? (
              <>💶 €{entry.cost.toFixed(2)}</>
            ) : (
              <span className="text-gray-500">💶 Prezzo non disponibile</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(entry.id)}
            className="text-blue-400 hover:text-blue-300 text-sm cursor-pointer"
          >
            📝 Edit
          </button>
          <button
            onClick={() => onHide(entry.id)}
            className={`text-sm cursor-pointer ${hidden ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-400 hover:text-gray-300'}`}
            title={hidden ? 'Show meal' : 'Hide meal'}
          >
            ☁️ {hidden ? 'Show' : 'Hide'}
          </button>
          
          {/* Delete button with confirmation */}
          <div className="relative">
            {showDeleteConfirm ? (
              <div className="flex gap-1">
                <button
                  onClick={handleDelete}
                  className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 cursor-pointer"
                  title="Confirm delete"
                >
                  ✓
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700 cursor-pointer"
                  title="Cancel"
                >
                  ✗
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-400 hover:text-red-300 text-sm cursor-pointer p-1 rounded hover:bg-gray-600"
                title="Delete entry"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

FoodEntryItem.displayName = 'FoodEntryItem';

interface WeightEntry {
  date: string;
  weight: number;
}

interface NutrientGoals {
  energyKJ: number;
  protein: number;
  carbs: number;
  fats: number;
  saturatedFats: number;
  fibers: number;
  sugars: number;
  salt: number;
  vitaminD: number;
  vitaminB1: number;
  vitaminB2: number;
  vitaminB3: number;
  vitaminB5: number;
  vitaminB6: number;
  vitaminB9: number;
  vitaminE: number;
  vitaminK: number;
  calcium: number;
  iron: number;
  phosphorus: number;
  magnesium: number;
  potassium: number;
  zinc: number;
  copper: number;
  manganese: number;
  selenium: number;
}

interface NutrientNotes {
  [key: string]: string;
}

interface NutrientEditState {
  isOpen: boolean;
  nutrientKey: string;
  nutrientName: string;
  currentValue: number;
  currentGoal: number;
  unit: string;
  isLimit?: boolean;
}

interface Props {
  sheetData: any;
  userProfile: any;
  onEntriesChange?: (entries: FoodEntry[]) => void;
}

export default function NutrientTracker({ sheetData, userProfile, onEntriesChange }: Props) {
  // Load initial data from localStorage
  const getInitialEntries = (): FoodEntry[] => {
    try {
      const saved = localStorage.getItem('nutrientEntries');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load entries:', error);
      return [];
    }
  };

  const getInitialGoals = (): NutrientGoals => {
    try {
      const saved = localStorage.getItem('nutrientGoals');
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.error('Failed to load goals:', error);
    }
    return {
      energyKJ: 8000,
      protein: 150,
      carbs: 200,
      fats: 65,
      saturatedFats: 20,
      fibers: 25,
      sugars: 50,
      salt: 6,
      vitaminD: 10,
      vitaminB1: 1.2,
      vitaminB2: 1.3,
      vitaminB3: 16,
      vitaminB5: 5,
      vitaminB6: 1.3,
      vitaminB9: 400,
      vitaminE: 12,
      vitaminK: 70,
      calcium: 800,
      iron: 14,
      phosphorus: 700,
      magnesium: 320,
      potassium: 2000,
      zinc: 8,
      copper: 0.9,
      manganese: 2,
      selenium: 55
    };
  };

  const getInitialWeightHistory = (): WeightEntry[] => {
    try {
      const saved = localStorage.getItem('weightHistory');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  };

  const getInitialGoalsText = (): string => {
    try {
      const saved = localStorage.getItem('goalsText');
      return saved || '';
    } catch (error) {
      return '';
    }
  };

  const getInitialNotesText = (): string => {
    try {
      const saved = localStorage.getItem('notesText');
      return saved || '';
    } catch (error) {
      return '';
    }
  };

  const getInitialNutrientNotes = (): NutrientNotes => {
    try {
      const saved = localStorage.getItem('nutrientNotes');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      return {};
    }
  };

  const [entries, setEntries] = useState<FoodEntry[]>(getInitialEntries());
  const [selectedFood, setSelectedFood] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [time, setTime] = useState('');
  const [grams, setGrams] = useState<number>(100);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editGrams, setEditGrams] = useState<number>(100);
  const [editTime, setEditTime] = useState<string>('');
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>(getInitialWeightHistory());
  const [newWeight, setNewWeight] = useState<number>(0);
  const [weightDate, setWeightDate] = useState('');
  const [goals, setGoals] = useState<NutrientGoals>(getInitialGoals());
  const [editingGoals, setEditingGoals] = useState(false);
  const [tempGoals, setTempGoals] = useState<NutrientGoals>(goals);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [goalsText, setGoalsText] = useState<string>(getInitialGoalsText());
  const [hiddenEntries, setHiddenEntries] = useState<Set<string>>(new Set());
  const [notesText, setNotesText] = useState<string>(getInitialNotesText());
  const [selectedNutrient, setSelectedNutrient] = useState<{
    name: string;
    value: number;
    unit: string;
    contributions: Array<{
      food: string;
      amount: number;
      percentage: number;
    }>;
  } | null>(null);
  const [nutrientNotes, setNutrientNotes] = useState<NutrientNotes>(getInitialNutrientNotes());
  const [nutrientEditState, setNutrientEditState] = useState<NutrientEditState>({
    isOpen: false,
    nutrientKey: '',
    nutrientName: '',
    currentValue: 0,
    currentGoal: 0,
    unit: ''
  });
  const [tempGoalValue, setTempGoalValue] = useState<number>(0);
  const [tempNoteValue, setTempNoteValue] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setTime(localTime);
    setWeightDate(localTime.slice(0, 10));
  }, []);

  useEffect(() => {
    setSaveStatus('saving');
    try {
      localStorage.setItem('nutrientEntries', JSON.stringify(entries));
      const saved = localStorage.getItem('nutrientEntries');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      }
    } catch (error) {
      setSaveStatus(null);
    }
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

  useEffect(() => {
    localStorage.setItem('goalsText', goalsText);
  }, [goalsText]);

  useEffect(() => {
    localStorage.setItem('notesText', notesText);
  }, [notesText]);

  useEffect(() => {
    localStorage.setItem('nutrientNotes', JSON.stringify(nutrientNotes));
  }, [nutrientNotes]);

  // Funzione per pulire i valori di costo dal formato italiano
  const parseItalianCost = (costStr: string): number => {
    if (!costStr || typeof costStr !== 'string') return 0;
    
    // Rimuovi simboli € e spazi
    let cleaned = costStr.replace(/[€\s]/g, '');
    
    // Sostituisci virgola con punto per decimali
    cleaned = cleaned.replace(/,/g, '.');
    
    // Converti in numero
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? 0 : parsed;
  };

  const getFoodOptions = () => {
    if (!sheetData || !Array.isArray(sheetData)) {
      return [];
    }
    
    const foods: any[] = [];
    let totalRowsProcessed = 0;
    
    sheetData.forEach((sheet: any, sheetIndex: number) => {
      if (sheet.data && Array.isArray(sheet.data)) {
        sheet.data.forEach((row: string[], rowIndex: number) => {
          totalRowsProcessed++;
          
          if (row.length >= 15 && row[0]) {
            foods.push({
              name: row[0],
              usualGrams: parseFloat(row[5]) || 100,
              costPerKg: parseItalianCost(row[6]),         // Colonna G: €/kg (formato italiano)
              _debugCostPerKg: row[6], // Debug per vedere il valore originale
              _debugParsedCost: parseItalianCost(row[6]), // Debug per vedere il valore parsato
              _debugRowLength: row.length, // Debug per vedere lunghezza riga
              energyPer100g: parseFloat(row[11]) || 0,      // Colonna L: Energy
              fatsPer100g: parseFloat(row[12]) || 0,        // Colonna M: Fats %
              saturatedFatsPer100g: parseFloat(row[13]) || 0, // Colonna N: di cui saturi
              carbsPer100g: parseFloat(row[14]) || 0,        // Colonna O: Carbo %
              sugarsPer100g: parseFloat(row[15]) || 0,       // Colonna P: di cui zuccheri
              fibersPer100g: parseFloat(row[16]) || 0,       // Colonna Q: Fibre %
              proteinPer100g: parseFloat(row[17]) || 0,       // Colonna R: Proteine %
              saltPer100g: parseFloat(row[18]) || 0,         // Colonna S: Sale %
              vitaminDPer100g: parseFloat(row[20]) || 0,     // Colonna U: Vit D
              vitaminB1Per100g: parseFloat(row[21]) || 0,    // Colonna V: Vit B1
              vitaminB2Per100g: parseFloat(row[22]) || 0,    // Colonna W: Vit B2
              vitaminB3Per100g: parseFloat(row[23]) || 0,    // Colonna X: Vit B3
              vitaminB5Per100g: parseFloat(row[24]) || 0,    // Colonna Y: Vit B5
              vitaminB6Per100g: parseFloat(row[25]) || 0,    // Colonna Z: Vit B6
              vitaminB9Per100g: parseFloat(row[26]) || 0,    // Colonna AA: Vit B9
              vitaminEPer100g: parseFloat(row[31]) || 0,     // Colonna AF: Vit E
              vitaminKPer100g: parseFloat(row[32]) || 0,     // Colonna AG: Vit K
              calciumPer100g: parseFloat(row[27]) || 0,       // Colonna AB: Calcio
              ironPer100g: parseFloat(row[28]) || 0,         // Colonna AC: Ferro
              phosphorusPer100g: parseFloat(row[29]) || 0,   // Colonna AD: Fosforo
              magnesiumPer100g: parseFloat(row[30]) || 0,      // Colonna AE: Magnesio
              potassiumPer100g: parseFloat(row[33]) || 0,      // Colonna AH: Potassio
              zincPer100g: parseFloat(row[34]) || 0,          // Colonna AI: Zinco
              copperPer100g: parseFloat(row[35]) || 0,         // Colonna AJ: Rame
              manganesePer100g: parseFloat(row[36]) || 0,      // Colonna AK: Manganese
              seleniumPer100g: parseFloat(row[37]) || 0,       // Colonna AL: Selenio
            });
          }
        });
      }
    });
    
    // DEBUG: Mostra i primi 5 alimenti con i loro costi
    console.log('=== DEBUG PRIMI 5 ALIMENTI E COSTI ===');
    foods.slice(0, 5).forEach((food, idx) => {
      console.log(`${idx + 1}. ${food.name}:`);
      console.log(`   - Costo/kg: ${food.costPerKg}`);
      console.log(`   - Valore origine colonna G: "${food._debugCostPerKg}"`);
      console.log(`   - Valore parsato: ${food._debugParsedCost}`);
      console.log(`   - Lunghezza riga: ${food._debugRowLength}`);
      console.log(`   - Tipo costPerKg: ${typeof food.costPerKg}`);
    });
    console.log('=====================================');
    
    return foods;
  };

  const filteredFoods = useMemo(() => {
    const foods = getFoodOptions();
    const filtered = foods.filter(food => 
      food.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered;
  }, [sheetData, searchTerm]);

  const addEntry = () => {
    if (!selectedFood || !time || !grams) return;

    const food = getFoodOptions().find(f => f.name === selectedFood);
    if (!food) return;

    const multiplier = grams / 100;
    
    // DEBUG COSTO DETTAGLIATO
    console.log('=== DEBUG COSTO DETTAGLIATO ===');
    console.log('1. Food selezionato:', food.name);
    console.log('2. Costo per kg dal foglio:', food.costPerKg);
    console.log('3. Valore originale colonna G:', (food as any)._debugCostPerKg || 'N/A');
    console.log('4. Grammi inseriti:', grams);
    console.log('5. Calcolo: (€/kg) × (grammi/1000)');
    console.log('6. Formula: ' + (food.costPerKg || 0) + ' × (' + grams + '/1000)');
    console.log('7. Risultato: €' + ((food.costPerKg || 0) * (grams / 1000)).toFixed(2));
    console.log('8. Tipo di costPerKg:', typeof food.costPerKg);
    console.log('9. È NaN?:', isNaN(food.costPerKg));
    console.log('=============================');

    const newEntry: FoodEntry = {
      id: Date.now().toString(),
      time,
      food: food.name,
      grams,
      cost: (food.costPerKg || 0) * (grams / 1000), // Cost = €/kg * kg
      energy: food.energyPer100g * multiplier,
      protein: food.proteinPer100g * multiplier,
      carbs: food.carbsPer100g * multiplier,
      fats: food.fatsPer100g * multiplier,
      saturatedFats: food.saturatedFatsPer100g * multiplier,
      fibers: food.fibersPer100g * multiplier,
      sugars: food.sugarsPer100g * multiplier,
      salt: food.saltPer100g * multiplier,
      vitaminD: food.vitaminDPer100g * multiplier,
      vitaminB1: food.vitaminB1Per100g * multiplier,
      vitaminB2: food.vitaminB2Per100g * multiplier,
      vitaminB3: food.vitaminB3Per100g * multiplier,
      vitaminB5: food.vitaminB5Per100g * multiplier,
      vitaminB6: food.vitaminB6Per100g * multiplier,
      vitaminB9: food.vitaminB9Per100g * multiplier,
      vitaminE: food.vitaminEPer100g * multiplier,
      vitaminK: food.vitaminKPer100g * multiplier,
      calcium: food.calciumPer100g * multiplier,
      iron: food.ironPer100g * multiplier,
      phosphorus: food.phosphorusPer100g * multiplier,
      magnesium: food.magnesiumPer100g * multiplier,
      potassium: food.potassiumPer100g * multiplier,
      zinc: food.zincPer100g * multiplier,
      copper: food.copperPer100g * multiplier,
      manganese: food.manganesePer100g * multiplier,
      selenium: food.seleniumPer100g * multiplier
    };

    setEntries(prev => {
      const updated = [...prev, newEntry].sort((a, b) => 
        new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      return updated;
    });
    setSelectedFood('');
    setSearchTerm('');
    setGrams(100);
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const toggleHideEntry = (id: string) => {
    setHiddenEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
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
        cost: (food.costPerKg || 0) * (newGrams / 1000), // Cost = €/kg * kg
        energy: food.energyPer100g * multiplier,
        protein: food.proteinPer100g * multiplier,
        carbs: food.carbsPer100g * multiplier,
        fats: food.fatsPer100g * multiplier,
        saturatedFats: food.saturatedFatsPer100g * multiplier,
        fibers: food.fibersPer100g * multiplier,
        sugars: food.sugarsPer100g * multiplier,
        salt: food.saltPer100g * multiplier,
        vitaminD: food.vitaminDPer100g * multiplier,
        vitaminB1: food.vitaminB1Per100g * multiplier,
        vitaminB2: food.vitaminB2Per100g * multiplier,
        vitaminB3: food.vitaminB3Per100g * multiplier,
        vitaminB5: food.vitaminB5Per100g * multiplier,
        vitaminB6: food.vitaminB6Per100g * multiplier,
        vitaminB9: food.vitaminB9Per100g * multiplier,
        calcium: food.calciumPer100g * multiplier,
        iron: food.ironPer100g * multiplier,
        phosphorus: food.phosphorusPer100g * multiplier,
        magnesium: food.magnesiumPer100g * multiplier
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
        cost: (food.costPerKg || 0) * (newGrams / 1000), // Cost = €/kg * kg
        energy: food.energyPer100g * multiplier,
        protein: food.proteinPer100g * multiplier,
        carbs: food.carbsPer100g * multiplier,
        fats: food.fatsPer100g * multiplier,
        saturatedFats: food.saturatedFatsPer100g * multiplier,
        fibers: food.fibersPer100g * multiplier,
        sugars: food.sugarsPer100g * multiplier,
        salt: food.saltPer100g * multiplier,
        vitaminD: food.vitaminDPer100g * multiplier,
        vitaminB1: food.vitaminB1Per100g * multiplier,
        vitaminB2: food.vitaminB2Per100g * multiplier,
        vitaminB3: food.vitaminB3Per100g * multiplier,
        vitaminB5: food.vitaminB5Per100g * multiplier,
        vitaminB6: food.vitaminB6Per100g * multiplier,
        vitaminB9: food.vitaminB9Per100g * multiplier,
        calcium: food.calciumPer100g * multiplier,
        iron: food.ironPer100g * multiplier,
        phosphorus: food.phosphorusPer100g * multiplier,
        magnesium: food.magnesiumPer100g * multiplier
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

  // Filter entries for last 24h for totals display (excludes hidden entries)
  const last24hEntries = useMemo(() => {
    const now = new Date();
    return entries.filter(entry => {
      const entryTime = new Date(entry.time);
      return (now.getTime() - entryTime.getTime()) < 24 * 60 * 60 * 1000 && !hiddenEntries.has(entry.id);
    });
  }, [entries, hiddenEntries]);

  // All entries from last 24h for display (includes hidden entries)
  const last24hEntriesForDisplay = useMemo(() => {
    const now = new Date();
    return entries.filter(entry => {
      const entryTime = new Date(entry.time);
      return (now.getTime() - entryTime.getTime()) < 24 * 60 * 60 * 1000;
    });
  }, [entries]);

  const totals = last24hEntries.reduce((acc: any, entry: FoodEntry) => ({
    energy: acc.energy + (entry.energy || 0),
    protein: acc.protein + (entry.protein || 0),
    carbs: acc.carbs + (entry.carbs || 0),
    fats: acc.fats + (entry.fats || 0),
    saturatedFats: acc.saturatedFats + (entry.saturatedFats || 0),
    fibers: acc.fibers + (entry.fibers || 0),
    sugars: acc.sugars + (entry.sugars || 0),
    salt: acc.salt + (entry.salt || 0),
    vitaminD: acc.vitaminD + (entry.vitaminD || 0),
    vitaminB1: acc.vitaminB1 + (entry.vitaminB1 || 0),
    vitaminB2: acc.vitaminB2 + (entry.vitaminB2 || 0),
    vitaminB3: acc.vitaminB3 + (entry.vitaminB3 || 0),
    vitaminB5: acc.vitaminB5 + (entry.vitaminB5 || 0),
    vitaminB6: acc.vitaminB6 + (entry.vitaminB6 || 0),
    vitaminB9: acc.vitaminB9 + (entry.vitaminB9 || 0),
    vitaminE: acc.vitaminE + (entry.vitaminE || 0),
    vitaminK: acc.vitaminK + (entry.vitaminK || 0),
    calcium: acc.calcium + (entry.calcium || 0),
    iron: acc.iron + (entry.iron || 0),
    phosphorus: acc.phosphorus + (entry.phosphorus || 0),
    magnesium: acc.magnesium + (entry.magnesium || 0),
    potassium: acc.potassium + (entry.potassium || 0),
    zinc: acc.zinc + (entry.zinc || 0),
    copper: acc.copper + (entry.copper || 0),
    manganese: acc.manganese + (entry.manganese || 0),
    selenium: acc.selenium + (entry.selenium || 0),
    cost: acc.cost + (entry.cost || 0)
  }), { 
    energy: 0, protein: 0, carbs: 0, fats: 0, saturatedFats: 0, fibers: 0, sugars: 0, salt: 0,
    vitaminD: 0, vitaminB1: 0, vitaminB2: 0, vitaminB3: 0, vitaminB5: 0, vitaminB6: 0, vitaminB9: 0,
    vitaminE: 0, vitaminK: 0, calcium: 0, iron: 0, phosphorus: 0, magnesium: 0,
    potassium: 0, zinc: 0, copper: 0, manganese: 0, selenium: 0, cost: 0
  });

  const getProgressColor = (current: number, target: number) => {
    if (!target) return 'bg-gray-600';
    const percentage = (current / target) * 100;
    if (percentage < 80) return 'bg-red-500';
    if (percentage < 95) return 'bg-orange-500';
    if (percentage <= 110) return 'bg-green-500';
    return 'bg-yellow-500';
  };

  const getLimitProgressColor = (current: number, limit: number) => {
    if (!limit) return 'bg-gray-600';
    const percentage = (current / limit) * 100;
    if (percentage <= 80) return 'bg-green-500';
    if (percentage <= 100) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getProgressPercentage = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.round((current / target) * 100);
  };

  const calculateNutrientContributions = (nutrientKey: keyof FoodEntry, name: string, unit: string) => {
    const contributions = last24hEntries.map(entry => {
      const amount = entry[nutrientKey] as number;
      return {
        food: entry.food,
        amount,
        percentage: totals[nutrientKey as keyof typeof totals] > 0 
          ? Math.round((amount / totals[nutrientKey as keyof typeof totals]) * 100)
          : 0
      };
    }).filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return {
      name,
      value: totals[nutrientKey as keyof typeof totals],
      unit,
      contributions
    };
  };

  const handleNutrientClick = (nutrientKey: keyof FoodEntry, name: string, unit: string) => {
    const details = calculateNutrientContributions(nutrientKey, name, unit);
    setSelectedNutrient(details);
  };

  const handleNutrientEdit = (nutrientKey: string, name: string, currentValue: number, goal: number, unit: string, isLimit: boolean = false) => {
    setNutrientEditState({
      isOpen: true,
      nutrientKey,
      nutrientName: name,
      currentValue,
      currentGoal: goal,
      unit,
      isLimit
    });
    setTempGoalValue(goal);
    setTempNoteValue(nutrientNotes[nutrientKey] || '');
  };

  const saveNutrientEdit = () => {
    // Update goal
    setGoals(prev => ({
      ...prev,
      [nutrientEditState.nutrientKey]: tempGoalValue
    }));
    
    // Update note
    setNutrientNotes(prev => ({
      ...prev,
      [nutrientEditState.nutrientKey]: tempNoteValue
    }));
    
    // Close modal
    setNutrientEditState({
      isOpen: false,
      nutrientKey: '',
      nutrientName: '',
      currentValue: 0,
      currentGoal: 0,
      unit: ''
    });
  };

  const cancelNutrientEdit = () => {
    setNutrientEditState({
      isOpen: false,
      nutrientKey: '',
      nutrientName: '',
      currentValue: 0,
      currentGoal: 0,
      unit: ''
    });
  };

  const targets = {
    energy: goals.energyKJ,
    protein: goals.protein,
    carbs: goals.carbs,
    fats: goals.fats
  };

  const currentWeight = weightHistory.length > 0 ? weightHistory[0].weight : null;

  return (
    <div className="flex flex-col bg-gray-900 min-h-screen">
      <div className="bg-gray-800 border-b border-gray-700 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-white">🥗 Nutrient Tracker</h2>
            {saveStatus && (
              <span className={`text-xs px-2 py-1 rounded ${
                saveStatus === 'saving' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-green-600 text-white'
              }`}>
                {saveStatus === 'saving' ? '💾 Saving...' : '✅ Saved'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                setEditingGoals(!editingGoals);
                if (!editingGoals) setTempGoals(goals);
              }}
              className="text-xs bg-purple-600 text-white px-2 sm:px-3 py-2 rounded hover:bg-purple-700 cursor-pointer"
            >
              {editingGoals ? 'Cancel' : '⚙️ Goals'}
            </button>
            <button
              onClick={() => {
                const weightSection = document.getElementById('weight-tracker');
                if (weightSection) {
                  weightSection.classList.toggle('hidden');
                }
              }}
              className="text-xs bg-blue-600 text-white px-2 sm:px-3 py-2 rounded hover:bg-blue-700 cursor-pointer"
            >
              ⚖️ Weight
            </button>
          </div>
        </div>

        {/* Goals Editor */}
        {editingGoals && (
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-white mb-3">Daily Goals</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
              <div>
                <label className="text-xs text-gray-400 block mb-1">Sat. Fats (g) ⚠️</label>
                <input
                  type="number"
                  value={tempGoals.saturatedFats}
                  onChange={(e) => setTempGoals({...tempGoals, saturatedFats: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Fibers (g)</label>
                <input
                  type="number"
                  value={tempGoals.fibers}
                  onChange={(e) => setTempGoals({...tempGoals, fibers: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Sugars (g)</label>
                <input
                  type="number"
                  value={tempGoals.sugars}
                  onChange={(e) => setTempGoals({...tempGoals, sugars: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Salt (g) ⚠️</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempGoals.salt}
                  onChange={(e) => setTempGoals({...tempGoals, salt: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vit D (μg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempGoals.vitaminD}
                  onChange={(e) => setTempGoals({...tempGoals, vitaminD: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vit B1 (mg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={tempGoals.vitaminB1}
                  onChange={(e) => setTempGoals({...tempGoals, vitaminB1: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vit B2 (mg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={tempGoals.vitaminB2}
                  onChange={(e) => setTempGoals({...tempGoals, vitaminB2: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vit B3 (mg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempGoals.vitaminB3}
                  onChange={(e) => setTempGoals({...tempGoals, vitaminB3: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vit B5 (mg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempGoals.vitaminB5}
                  onChange={(e) => setTempGoals({...tempGoals, vitaminB5: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vit B6 (mg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={tempGoals.vitaminB6}
                  onChange={(e) => setTempGoals({...tempGoals, vitaminB6: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vit B9 (μg)</label>
                <input
                  type="number"
                  value={tempGoals.vitaminB9}
                  onChange={(e) => setTempGoals({...tempGoals, vitaminB9: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Calcium (mg)</label>
                <input
                  type="number"
                  value={tempGoals.calcium}
                  onChange={(e) => setTempGoals({...tempGoals, calcium: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Iron (mg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempGoals.iron}
                  onChange={(e) => setTempGoals({...tempGoals, iron: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Phosphorus (mg)</label>
                <input
                  type="number"
                  value={tempGoals.phosphorus}
                  onChange={(e) => setTempGoals({...tempGoals, phosphorus: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Magnesium (mg)</label>
                <input
                  type="number"
                  value={tempGoals.magnesium}
                  onChange={(e) => setTempGoals({...tempGoals, magnesium: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
                />
              </div>
            </div>
            
            {/* Text areas for Goals and Notes */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Goals</label>
                <textarea
                  value={goalsText}
                  onChange={(e) => setGoalsText(e.target.value)}
                  placeholder="Enter your nutrition goals here..."
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm h-20 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Notes</label>
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Add any notes about your nutrition plan..."
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm h-20 resize-none"
                />
              </div>
            </div>
            
            <button
              onClick={saveGoals}
              className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm cursor-pointer"
            >
              Save Goals
            </button>
          </div>
        )}

        {/* Add Entry Form - MOVED TO TOP */}
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Add Food Entry</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm flex-1 sm:flex-initial"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedFood('');
              }}
              placeholder="Search food..."
              className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={grams}
                onChange={(e) => setGrams(Math.max(1, parseFloat(e.target.value) || 1))}
                placeholder="Grams"
                className="w-20 sm:w-24 px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 text-sm"
              />
              <span className="text-gray-400 text-sm">g</span>
            </div>
            <button
              onClick={addEntry}
              disabled={!selectedFood || !time || !grams}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-600 text-sm whitespace-nowrap"
            >
              Add
            </button>
          </div>
          
          {searchTerm && filteredFoods.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto bg-gray-800 rounded border border-gray-600">
              {(() => {
                return filteredFoods.slice(0, 150).map((food, idx) => (
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
                ));
              })()}
            </div>
          )}
        </div>
        
        {/* Food Entries (Last 24h) - MOVED TO TOP */}
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">🍽️ Food Entries (Last 24h)</h3>
          {last24hEntriesForDisplay.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <p>No entries yet. Add your first food!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {last24hEntriesForDisplay.map(entry => (
                <div key={entry.id} className={`bg-gray-800 rounded p-3 ${hiddenEntries.has(entry.id) ? 'opacity-50 border-l-4 border-yellow-500' : ''}`}>
                  {editingEntry === entry.id ? (
                    <div className="flex gap-2 flex-wrap">
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
                        className="w-20 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 text-sm"
                      />
                      <span className="text-gray-400 text-sm">g</span>
                      <button
                        onClick={() => updateEntry(entry.id, editGrams, editTime)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingEntry(null)}
                        className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-white">{entry.food}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(entry.time).toLocaleString()} • {entry.grams}g
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Energy: {entry.energy.toFixed(0)} kJ | Protein: {entry.protein.toFixed(1)}g | Carbs: {entry.carbs.toFixed(1)}g | Fats: {entry.fats.toFixed(1)}g
                        </div>
                        <div className="text-xs text-green-400 mt-1 font-medium">
                          {entry.cost > 0 ? (
                            <>💶 €{entry.cost.toFixed(2)}</>
                          ) : (
                            <span className="text-gray-500">💶 Prezzo non disponibile</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingEntry(entry.id);
                            setEditGrams(entry.grams);
                            setEditTime(entry.time);
                          }}
                          className="text-blue-400 hover:text-blue-300 text-sm cursor-pointer"
                        >
                          📝 Edit
                        </button>
                        <button
                          onClick={() => toggleHideEntry(entry.id)}
                          className={`text-sm cursor-pointer ${hiddenEntries.has(entry.id) ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-400 hover:text-gray-300'}`}
                          title={hiddenEntries.has(entry.id) ? 'Show meal' : 'Hide meal'}
                        >
                          ☁️ {hiddenEntries.has(entry.id) ? 'Show' : 'Hide'}
                        </button>
                        {/* Delete button with confirmation */}
                        <div className="relative">
                          {deleteConfirmId === entry.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                                title="Confirm delete"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700"
                                title="Cancel"
                              >
                                ✗
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(entry.id)}
                              className="text-red-400 hover:text-red-300 text-sm cursor-pointer p-1 rounded hover:bg-gray-600"
                              title="Delete entry"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Weight Tracker - MOVED TO TOP */}
        <div id="weight-tracker" className="bg-gray-700 rounded-lg p-4 mb-4 hidden">
          <h3 className="text-sm font-semibold text-white mb-3">⚖️ Weight Tracker</h3>
          {currentWeight && (
            <div className="text-sm text-gray-300 mb-3">
              Current: <span className="font-bold text-white">{currentWeight} kg</span>
            </div>
          )}
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
                      {new Date(entry.date).toLocaleDateString()}
                    </span>
                    <span className="font-bold text-white">{entry.weight} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Summary Cards */}
        <div className="space-y-3 mb-4">
          {/* Daily Cost Summary */}
          {totals.cost > 0 ? (
            <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-green-500">
              <div className="text-xs text-gray-400 mb-1">Daily Cost (Last 24h)</div>
              <div className="text-2xl font-bold text-green-400">
                💶 €{totals.cost.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                From {last24hEntries.length} food entries
              </div>
            </div>
          ) : (
            <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-gray-500">
              <div className="text-xs text-gray-400 mb-1">Daily Cost (Last 24h)</div>
              <div className="text-2xl font-bold text-gray-500">
                💶 Prezzo non disponibile
              </div>
              <div className="text-xs text-gray-400 mt-1">
                From {last24hEntries.length} food entries
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-blue-500">
              <div className="text-xs text-gray-400 mb-1">Energy (kJ)</div>
              <div 
                className="text-xl font-bold text-white cursor-pointer hover:text-blue-300 transition-colors flex items-center gap-2"
                onClick={() => handleNutrientEdit('energyKJ', 'Energy', totals.energy, targets.energy, 'kJ')}
              >
                {totals.energy.toFixed(0)}
                <span className="text-xs text-gray-500">✏️</span>
              </div>
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
              {nutrientNotes.energyKJ && (
                <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.energyKJ}</div>
              )}
            </div>

            <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-green-500">
              <div className="text-xs text-gray-400 mb-1">Protein (g)</div>
              <div 
                className="text-xl font-bold text-white cursor-pointer hover:text-green-300 transition-colors flex items-center gap-2"
                onClick={() => handleNutrientEdit('protein', 'Protein', totals.protein, targets.protein, 'g')}
              >
                {totals.protein.toFixed(1)}
                <span className="text-xs text-gray-500">✏️</span>
              </div>
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
              {nutrientNotes.protein && (
                <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.protein}</div>
              )}
            </div>

            <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-yellow-500">
              <div className="text-xs text-gray-400 mb-1">Carbs (g)</div>
              <div 
                className="text-xl font-bold text-white cursor-pointer hover:text-yellow-300 transition-colors flex items-center gap-2"
                onClick={() => handleNutrientEdit('carbs', 'Carbs', totals.carbs, targets.carbs, 'g')}
              >
                {totals.carbs.toFixed(1)}
                <span className="text-xs text-gray-500">✏️</span>
              </div>
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
              {nutrientNotes.carbs && (
                <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.carbs}</div>
              )}
            </div>

            <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-purple-500">
              <div className="text-xs text-gray-400 mb-1">Fats (g)</div>
              <div 
                className="text-xl font-bold text-white cursor-pointer hover:text-purple-300 transition-colors flex items-center gap-2"
                onClick={() => handleNutrientEdit('fats', 'Fats', totals.fats, targets.fats, 'g')}
              >
                {totals.fats.toFixed(1)}
                <span className="text-xs text-gray-500">✏️</span>
              </div>
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
              {nutrientNotes.fats && (
                <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.fats}</div>
              )}
            </div>
          </div>
          
          {/* Secondary nutrients */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-red-500">
              <div className="text-xs text-gray-400 mb-1">Sat. Fats (g)</div>
              <div 
                className="text-lg font-bold text-white cursor-pointer hover:text-red-300 transition-colors flex items-center gap-2"
                onClick={() => handleNutrientEdit('saturatedFats', 'Saturated Fats', totals.saturatedFats, goals.saturatedFats, 'g', true)}
              >
                {totals.saturatedFats.toFixed(1)}
                <span className="text-xs text-gray-500">✏️</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Limit: {goals.saturatedFats}g ⚠️</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-gray-600 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      totals.saturatedFats > goals.saturatedFats 
                        ? 'bg-red-500' 
                        : totals.saturatedFats > goals.saturatedFats * 0.75 
                        ? 'bg-orange-500' 
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((totals.saturatedFats / goals.saturatedFats) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs font-bold text-white">{Math.min(Math.round((totals.saturatedFats / goals.saturatedFats) * 100), 100)}%</span>
              </div>
              {totals.saturatedFats > goals.saturatedFats && (
                <div className="text-xs text-red-400 mt-1">Over limit</div>
              )}
              {nutrientNotes.saturatedFats && (
                <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.saturatedFats}</div>
              )}
            </div>

            <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-orange-500">
              <div className="text-xs text-gray-400 mb-1">Salt (g)</div>
              <div 
                className="text-lg font-bold text-white cursor-pointer hover:text-orange-300 transition-colors flex items-center gap-2"
                onClick={() => handleNutrientEdit('salt', 'Salt', totals.salt, goals.salt, 'g', true)}
              >
                {totals.salt.toFixed(1)}
                <span className="text-xs text-gray-500">✏️</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Limit: {goals.salt}g ⚠️</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-gray-600 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      totals.salt > goals.salt 
                        ? 'bg-red-500' 
                        : totals.salt > goals.salt * 0.75 
                        ? 'bg-orange-500' 
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((totals.salt / goals.salt) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs font-bold text-white">{Math.min(Math.round((totals.salt / goals.salt) * 100), 100)}%</span>
              </div>
              {totals.salt > goals.salt && (
                <div className="text-xs text-red-400 mt-1">Over limit</div>
              )}
              {nutrientNotes.salt && (
                <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.salt}</div>
              )}
            </div>

            <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-pink-500">
              <div className="text-xs text-gray-400 mb-1">Sugars (g)</div>
              <div 
                className="text-lg font-bold text-white cursor-pointer hover:text-pink-300 transition-colors flex items-center gap-2"
                onClick={() => handleNutrientEdit('sugars', 'Sugars', totals.sugars, goals.sugars, 'g')}
              >
                {totals.sugars.toFixed(1)}
                <span className="text-xs text-gray-500">✏️</span>
              </div>
              {goals.sugars > 0 && (
                <>
                  <div className="text-xs text-gray-400 mt-1">Goal: {goals.sugars}g</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-gray-600 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${getProgressColor(totals.sugars, goals.sugars)}`}
                        style={{ width: `${Math.min((totals.sugars / goals.sugars) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-white">{getProgressPercentage(totals.sugars, goals.sugars)}%</span>
                  </div>
                </>
              )}
              {nutrientNotes.sugars && (
                <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.sugars}</div>
              )}
            </div>
          </div>

          {/* Vitamins Section */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-white mb-3">🌟 Vitamins</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-indigo-500">
                <div className="text-xs text-gray-400 mb-1">Vit D (μg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-indigo-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('vitaminD', 'Vitamin D', totals.vitaminD, goals.vitaminD, 'μg')}
                >
                  {totals.vitaminD.toFixed(1)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.vitaminD > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.vitaminD}μg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.vitaminD, goals.vitaminD)}`}
                          style={{ width: `${Math.min((totals.vitaminD / goals.vitaminD) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.vitaminD, goals.vitaminD)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.vitaminD && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.vitaminD}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-cyan-500">
                <div className="text-xs text-gray-400 mb-1">Vit B1 (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-cyan-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('vitaminB1', 'Vitamin B1', totals.vitaminB1, goals.vitaminB1, 'mg')}
                >
                  {totals.vitaminB1.toFixed(2)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.vitaminB1 > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.vitaminB1}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.vitaminB1, goals.vitaminB1)}`}
                          style={{ width: `${Math.min((totals.vitaminB1 / goals.vitaminB1) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.vitaminB1, goals.vitaminB1)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.vitaminB1 && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.vitaminB1}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-teal-500">
                <div className="text-xs text-gray-400 mb-1">Vit B2 (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-teal-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('vitaminB2', 'Vitamin B2', totals.vitaminB2, goals.vitaminB2, 'mg')}
                >
                  {totals.vitaminB2.toFixed(2)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.vitaminB2 > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.vitaminB2}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.vitaminB2, goals.vitaminB2)}`}
                          style={{ width: `${Math.min((totals.vitaminB2 / goals.vitaminB2) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.vitaminB2, goals.vitaminB2)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.vitaminB2 && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.vitaminB2}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-yellow-500">
                <div className="text-xs text-gray-400 mb-1">Vit B3 (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-yellow-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('vitaminB3', 'Vitamin B3', totals.vitaminB3, goals.vitaminB3, 'mg')}
                >
                  {totals.vitaminB3.toFixed(1)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.vitaminB3 > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.vitaminB3}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.vitaminB3, goals.vitaminB3)}`}
                          style={{ width: `${Math.min((totals.vitaminB3 / goals.vitaminB3) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.vitaminB3, goals.vitaminB3)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.vitaminB3 && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.vitaminB3}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-purple-500">
                <div className="text-xs text-gray-400 mb-1">Vit B5 (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-purple-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('vitaminB5', 'Vitamin B5', totals.vitaminB5, goals.vitaminB5, 'mg')}
                >
                  {totals.vitaminB5.toFixed(1)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.vitaminB5 > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.vitaminB5}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.vitaminB5, goals.vitaminB5)}`}
                          style={{ width: `${Math.min((totals.vitaminB5 / goals.vitaminB5) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.vitaminB5, goals.vitaminB5)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.vitaminB5 && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.vitaminB5}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-pink-500">
                <div className="text-xs text-gray-400 mb-1">Vit B6 (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-pink-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('vitaminB6', 'Vitamin B6', totals.vitaminB6, goals.vitaminB6, 'mg')}
                >
                  {totals.vitaminB6.toFixed(2)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.vitaminB6 > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.vitaminB6}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.vitaminB6, goals.vitaminB6)}`}
                          style={{ width: `${Math.min((totals.vitaminB6 / goals.vitaminB6) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.vitaminB6, goals.vitaminB6)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.vitaminB6 && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.vitaminB6}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-orange-500">
                <div className="text-xs text-gray-400 mb-1">Vit B9 (μg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-orange-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('vitaminB9', 'Vitamin B9', totals.vitaminB9, goals.vitaminB9, 'μg')}
                >
                  {totals.vitaminB9.toFixed(0)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.vitaminB9 > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.vitaminB9}μg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.vitaminB9, goals.vitaminB9)}`}
                          style={{ width: `${Math.min((totals.vitaminB9 / goals.vitaminB9) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.vitaminB9, goals.vitaminB9)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.vitaminB9 && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.vitaminB9}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-amber-500">
                <div className="text-xs text-gray-400 mb-1">Vit E (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-amber-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('vitaminE', 'Vitamin E', totals.vitaminE, goals.vitaminE, 'mg')}
                >
                  {totals.vitaminE.toFixed(1)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.vitaminE > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.vitaminE}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.vitaminE, goals.vitaminE)}`}
                          style={{ width: `${Math.min((totals.vitaminE / goals.vitaminE) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.vitaminE, goals.vitaminE)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.vitaminE && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.vitaminE}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-lime-500">
                <div className="text-xs text-gray-400 mb-1">Vit K (μg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-lime-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('vitaminK', 'Vitamin K', totals.vitaminK, goals.vitaminK, 'μg')}
                >
                  {totals.vitaminK.toFixed(0)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.vitaminK > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.vitaminK}μg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.vitaminK, goals.vitaminK)}`}
                          style={{ width: `${Math.min((totals.vitaminK / goals.vitaminK) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.vitaminK, goals.vitaminK)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.vitaminK && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.vitaminK}</div>
                )}
              </div>
            </div>
          </div>

          {/* Minerals Section */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-white mb-3">💎 Minerals</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-blue-500">
                <div className="text-xs text-gray-400 mb-1">Calcium (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-blue-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('calcium', 'Calcium', totals.calcium, goals.calcium, 'mg')}
                >
                  {totals.calcium.toFixed(0)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.calcium > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.calcium}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.calcium, goals.calcium)}`}
                          style={{ width: `${Math.min((totals.calcium / goals.calcium) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.calcium, goals.calcium)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.calcium && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.calcium}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-green-500">
                <div className="text-xs text-gray-400 mb-1">Iron (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-green-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('iron', 'Iron', totals.iron, goals.iron, 'mg')}
                >
                  {totals.iron.toFixed(1)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.iron > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.iron}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.iron, goals.iron)}`}
                          style={{ width: `${Math.min((totals.iron / goals.iron) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.iron, goals.iron)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.iron && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.iron}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Phosphorus (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-gray-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('phosphorus', 'Phosphorus', totals.phosphorus, goals.phosphorus, 'mg')}
                >
                  {totals.phosphorus.toFixed(0)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.phosphorus > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.phosphorus}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.phosphorus, goals.phosphorus)}`}
                          style={{ width: `${Math.min((totals.phosphorus / goals.phosphorus) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.phosphorus, goals.phosphorus)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.phosphorus && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.phosphorus}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Magnesium (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-gray-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('magnesium', 'Magnesium', totals.magnesium, goals.magnesium, 'mg')}
                >
                  {totals.magnesium.toFixed(0)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.magnesium > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.magnesium}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.magnesium, goals.magnesium)}`}
                          style={{ width: `${Math.min((totals.magnesium / goals.magnesium) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.magnesium, goals.magnesium)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.magnesium && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.magnesium}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-yellow-500">
                <div className="text-xs text-gray-400 mb-1">Potassium (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-yellow-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('potassium', 'Potassium', totals.potassium, goals.potassium, 'mg')}
                >
                  {totals.potassium.toFixed(0)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.potassium > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.potassium}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.potassium, goals.potassium)}`}
                          style={{ width: `${Math.min((totals.potassium / goals.potassium) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.potassium, goals.potassium)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.potassium && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.potassium}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-orange-500">
                <div className="text-xs text-gray-400 mb-1">Zinc (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-orange-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('zinc', 'Zinc', totals.zinc, goals.zinc, 'mg')}
                >
                  {totals.zinc.toFixed(1)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.zinc > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.zinc}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.zinc, goals.zinc)}`}
                          style={{ width: `${Math.min((totals.zinc / goals.zinc) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.zinc, goals.zinc)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.zinc && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.zinc}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-red-500">
                <div className="text-xs text-gray-400 mb-1">Copper (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-red-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('copper', 'Copper', totals.copper, goals.copper, 'mg')}
                >
                  {totals.copper.toFixed(2)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.copper > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.copper}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.copper, goals.copper)}`}
                          style={{ width: `${Math.min((totals.copper / goals.copper) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.copper, goals.copper)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.copper && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.copper}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-purple-500">
                <div className="text-xs text-gray-400 mb-1">Manganese (mg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-purple-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('manganese', 'Manganese', totals.manganese, goals.manganese, 'mg')}
                >
                  {totals.manganese.toFixed(2)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.manganese > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.manganese}mg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.manganese, goals.manganese)}`}
                          style={{ width: `${Math.min((totals.manganese / goals.manganese) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.manganese, goals.manganese)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.manganese && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.manganese}</div>
                )}
              </div>

              <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-pink-500">
                <div className="text-xs text-gray-400 mb-1">Selenium (μg)</div>
                <div 
                  className="text-lg font-bold text-white cursor-pointer hover:text-pink-300 transition-colors flex items-center gap-2"
                  onClick={() => handleNutrientEdit('selenium', 'Selenium', totals.selenium, goals.selenium, 'μg')}
                >
                  {totals.selenium.toFixed(0)}
                  <span className="text-xs text-gray-500">✏️</span>
                </div>
                {goals.selenium > 0 && (
                  <>
                    <div className="text-xs text-gray-400 mt-1">Goal: {goals.selenium}μg</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-600 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${getProgressColor(totals.selenium, goals.selenium)}`}
                          style={{ width: `${Math.min((totals.selenium / goals.selenium) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white">{getProgressPercentage(totals.selenium, goals.selenium)}%</span>
                    </div>
                  </>
                )}
                {nutrientNotes.selenium && (
                  <div className="text-xs text-gray-400 mt-1 italic">{nutrientNotes.selenium}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Weight Tracker */}
        <div id="weight-tracker" className="bg-gray-700 rounded-lg p-4 hidden">
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

      {/* Nutrient Edit Modal */}
      {nutrientEditState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                ⚙️ Edit {nutrientEditState.nutrientName}
              </h3>
              <button
                onClick={cancelNutrientEdit}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">
                Current: {nutrientEditState.currentValue.toFixed(1)} {nutrientEditState.unit}
              </div>
              
              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">
                  {nutrientEditState.isLimit ? 'Daily Limit' : 'Daily Goal'} ({nutrientEditState.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tempGoalValue}
                  onChange={(e) => setTempGoalValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
                  placeholder={`Enter ${nutrientEditState.isLimit ? 'limit' : 'goal'}...`}
                />
              </div>
              
              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">
                  Notes
                </label>
                <textarea
                  value={tempNoteValue}
                  onChange={(e) => setTempNoteValue(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 text-sm h-20 resize-none"
                  placeholder="Add notes about this nutrient..."
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveNutrientEdit}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
              >
                Save
              </button>
              <button
                onClick={cancelNutrientEdit}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nutrient Details Modal */}
      {selectedNutrient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                📊 {selectedNutrient!.name} Details
              </h3>
              <button
                onClick={() => setSelectedNutrient(null)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <div className="text-2xl font-bold text-white mb-1">
                {selectedNutrient!.value.toFixed(1)} {selectedNutrient!.unit}
              </div>
              <div className="text-sm text-gray-400">
                Total from {last24hEntries.length} food entries
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Food Contributions:</h4>
              {selectedNutrient!.contributions.length === 0 ? (
                <div className="text-gray-500 text-sm">No contributions found</div>
              ) : (
                selectedNutrient!.contributions.map((contrib, index) => (
                  <div key={index} className="bg-gray-700 rounded p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-white font-medium">{contrib.food}</div>
                        <div className="text-xs text-gray-400">
                          {contrib.amount.toFixed(1)} {selectedNutrient!.unit}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-400">
                          {contrib.percentage}%
                        </div>
                        <div className="w-16 bg-gray-600 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-400 h-2 rounded-full"
                            style={{ width: `${contrib.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
