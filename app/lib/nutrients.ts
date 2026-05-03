// Centralized nutrient configuration
export const NUTRIENTS = {
  // Macronutrients
  energy: { name: 'Energy', unit: 'kJ', dbKey: 'energy', defaultGoal: 8000 },
  protein: { name: 'Protein', unit: 'g', dbKey: 'protein', defaultGoal: 150 },
  carbs: { name: 'Carbs', unit: 'g', dbKey: 'carbs', defaultGoal: 200 },
  fats: { name: 'Fats', unit: 'g', dbKey: 'fats', defaultGoal: 65 },
  
  // Carbohydrate breakdown
  saturatedFats: { name: 'Saturated Fats', unit: 'g', dbKey: 'saturated_fats', defaultGoal: 20, isLimit: true },
  fibers: { name: 'Fiber', unit: 'g', dbKey: 'fibers', defaultGoal: 25 },
  sugars: { name: 'Sugars', unit: 'g', dbKey: 'sugars', defaultGoal: 50 },
  salt: { name: 'Salt', unit: 'g', dbKey: 'salt', defaultGoal: 6, isLimit: true },
  
  // Vitamins
  vitaminA: { name: 'Vitamin A', unit: 'µg', dbKey: 'vitamin_a', defaultGoal: 900 },
  vitaminB1: { name: 'Vitamin B1', unit: 'mg', dbKey: 'vitamin_b1', defaultGoal: 1.2 },
  vitaminB2: { name: 'Vitamin B2', unit: 'mg', dbKey: 'vitamin_b2', defaultGoal: 1.3 },
  vitaminB3: { name: 'Vitamin B3', unit: 'mg', dbKey: 'vitamin_b3', defaultGoal: 16 },
  vitaminB5: { name: 'Vitamin B5', unit: 'mg', dbKey: 'vitamin_b5', defaultGoal: 5 },
  vitaminB6: { name: 'Vitamin B6', unit: 'mg', dbKey: 'vitamin_b6', defaultGoal: 1.3 },
  vitaminB9: { name: 'Folate', unit: 'µg', dbKey: 'vitamin_b9', defaultGoal: 400 },
  vitaminB12: { name: 'Vitamin B12', unit: 'µg', dbKey: 'vitamin_b12', defaultGoal: 2.4 },
  vitaminC: { name: 'Vitamin C', unit: 'mg', dbKey: 'vitamin_c', defaultGoal: 90 },
  vitaminD: { name: 'Vitamin D', unit: 'µg', dbKey: 'vitamin_d', defaultGoal: 10 },
  vitaminE: { name: 'Vitamin E', unit: 'mg', dbKey: 'vitamin_e', defaultGoal: 12 },
  vitaminK: { name: 'Vitamin K', unit: 'µg', dbKey: 'vitamin_k', defaultGoal: 70 },
  
  // Minerals
  calcium: { name: 'Calcium', unit: 'mg', dbKey: 'calcium', defaultGoal: 800 },
  chromium: { name: 'Chromium', unit: 'µg', dbKey: 'chromium', defaultGoal: 35 },
  copper: { name: 'Copper', unit: 'mg', dbKey: 'copper', defaultGoal: 0.9 },
  fluoride: { name: 'Fluoride', unit: 'µg', dbKey: 'fluoride', defaultGoal: 4000 },
  iodine: { name: 'Iodine', unit: 'µg', dbKey: 'iodine', defaultGoal: 150 },
  iron: { name: 'Iron', unit: 'mg', dbKey: 'iron', defaultGoal: 14 },
  magnesium: { name: 'Magnesium', unit: 'mg', dbKey: 'magnesium', defaultGoal: 320 },
  manganese: { name: 'Manganese', unit: 'mg', dbKey: 'manganese', defaultGoal: 2 },
  molybdenum: { name: 'Molybdenum', unit: 'µg', dbKey: 'molybdenum', defaultGoal: 45 },
  phosphorus: { name: 'Phosphorus', unit: 'mg', dbKey: 'phosphorus', defaultGoal: 700 },
  potassium: { name: 'Potassium', unit: 'mg', dbKey: 'potassium', defaultGoal: 2000 },
  selenium: { name: 'Selenium', unit: 'µg', dbKey: 'selenium', defaultGoal: 55 },
  sodium: { name: 'Sodium', unit: 'mg', dbKey: 'sodium', defaultGoal: 2300, isLimit: true },
  zinc: { name: 'Zinc', unit: 'mg', dbKey: 'zinc', defaultGoal: 8 },
} as const;

export type NutrientKey = keyof typeof NUTRIENTS;

export function getDefaultGoals() {
  const goals: any = { energyKJ: NUTRIENTS.energy.defaultGoal };
  Object.entries(NUTRIENTS).forEach(([key, config]) => {
    if (key !== 'energy') goals[key] = config.defaultGoal;
  });
  return goals;
}
