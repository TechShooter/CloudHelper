import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

// GET: Fetch nutrient data
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (type === 'entries') {
      const { data: entries, error } = await supabase
        .from('nutrient_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('time', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Transform to match frontend format
      const transformedEntries = entries?.map(entry => ({
        id: entry.id,
        time: entry.time,
        food: entry.food,
        grams: entry.grams,
        cost: entry.cost,
        energy: entry.energy,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats,
        saturatedFats: entry.saturated_fats,
        fibers: entry.fibers,
        sugars: entry.sugars,
        salt: entry.salt,
        vitaminA: entry.vitamin_a,
        vitaminB1: entry.vitamin_b1,
        vitaminB2: entry.vitamin_b2,
        vitaminB3: entry.vitamin_b3,
        vitaminB5: entry.vitamin_b5,
        vitaminB6: entry.vitamin_b6,
        vitaminB9: entry.vitamin_b9,
        vitaminB12: entry.vitamin_b12,
        vitaminC: entry.vitamin_c,
        vitaminD: entry.vitamin_d,
        vitaminE: entry.vitamin_e,
        vitaminK: entry.vitamin_k,
        calcium: entry.calcium,
        chromium: entry.chromium,
        copper: entry.copper,
        fluoride: entry.fluoride,
        iodine: entry.iodine,
        iron: entry.iron,
        magnesium: entry.magnesium,
        manganese: entry.manganese,
        molybdenum: entry.molybdenum,
        phosphorus: entry.phosphorus,
        potassium: entry.potassium,
        selenium: entry.selenium,
        sodium: entry.sodium,
        zinc: entry.zinc
      })) || [];

      return NextResponse.json({ entries: transformedEntries });
    }

    if (type === 'goals') {
      const { data: goals, error } = await supabase
        .from('nutrient_goals')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const transformedGoals = goals ? {
        energyKJ: goals.energy_kj,
        protein: goals.protein,
        carbs: goals.carbs,
        fats: goals.fats,
        saturatedFats: goals.saturated_fats,
        fibers: goals.fibers,
        sugars: goals.sugars,
        salt: goals.salt,
        vitaminA: goals.vitamin_a,
        vitaminB1: goals.vitamin_b1,
        vitaminB2: goals.vitamin_b2,
        vitaminB3: goals.vitamin_b3,
        vitaminB5: goals.vitamin_b5,
        vitaminB6: goals.vitamin_b6,
        vitaminB9: goals.vitamin_b9,
        vitaminB12: goals.vitamin_b12,
        vitaminC: goals.vitamin_c,
        vitaminD: goals.vitamin_d,
        vitaminE: goals.vitamin_e,
        vitaminK: goals.vitamin_k,
        calcium: goals.calcium,
        chromium: goals.chromium,
        copper: goals.copper,
        fluoride: goals.fluoride,
        iodine: goals.iodine,
        iron: goals.iron,
        magnesium: goals.magnesium,
        manganese: goals.manganese,
        molybdenum: goals.molybdenum,
        phosphorus: goals.phosphorus,
        potassium: goals.potassium,
        selenium: goals.selenium,
        sodium: goals.sodium,
        zinc: goals.zinc
      } : null;

      return NextResponse.json({ goals: transformedGoals });
    }

    if (type === 'weight') {
      const { data: weightHistory, error } = await supabase
        .from('weight_history')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const transformedWeight = weightHistory?.map(entry => ({
        date: entry.date,
        weight: entry.weight
      })) || [];

      return NextResponse.json({ weightHistory: transformedWeight });
    }

    if (type === 'notes') {
      const { data: notes, error } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const goalsText = notes?.find(n => n.note_type === 'goals')?.content || '';
      const notesText = notes?.find(n => n.note_type === 'general')?.content || '';

      return NextResponse.json({ goalsText, notesText });
    }

    if (type === 'nutrient-notes') {
      const { data: notes, error } = await supabase
        .from('nutrient_notes')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const nutrientNotes: { [key: string]: string } = {};
      notes?.forEach(note => {
        nutrientNotes[note.nutrient_key] = note.note;
      });

      return NextResponse.json({ nutrientNotes });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Save nutrient data
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, data } = await req.json();

    if (type === 'entries') {
      // Delete existing entries
      await supabase
        .from('nutrient_entries')
        .delete()
        .eq('user_id', user.id);

      // Insert new entries
      if (data && Array.isArray(data) && data.length > 0) {
        const entriesToInsert = data.map((entry: any) => ({
          user_id: user.id,
          time: entry.time,
          food: entry.food,
          grams: entry.grams,
          cost: entry.cost,
          energy: entry.energy,
          protein: entry.protein,
          carbs: entry.carbs,
          fats: entry.fats,
          saturated_fats: entry.saturatedFats,
          fibers: entry.fibers,
          sugars: entry.sugars,
          salt: entry.salt,
          vitamin_a: entry.vitaminA,
          vitamin_b1: entry.vitaminB1,
          vitamin_b2: entry.vitaminB2,
          vitamin_b3: entry.vitaminB3,
          vitamin_b5: entry.vitaminB5,
          vitamin_b6: entry.vitaminB6,
          vitamin_b9: entry.vitaminB9,
          vitamin_b12: entry.vitaminB12,
          vitamin_c: entry.vitaminC,
          vitamin_d: entry.vitaminD,
          vitamin_e: entry.vitaminE,
          vitamin_k: entry.vitaminK,
          calcium: entry.calcium,
          chromium: entry.chromium,
          copper: entry.copper,
          fluoride: entry.fluoride,
          iodine: entry.iodine,
          iron: entry.iron,
          magnesium: entry.magnesium,
          manganese: entry.manganese,
          molybdenum: entry.molybdenum,
          phosphorus: entry.phosphorus,
          potassium: entry.potassium,
          selenium: entry.selenium,
          sodium: entry.sodium,
          zinc: entry.zinc
        }));

        const { error } = await supabase
          .from('nutrient_entries')
          .insert(entriesToInsert);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true });
    }

    if (type === 'goals') {
      const { error } = await supabase
        .from('nutrient_goals')
        .upsert({
          user_id: user.id,
          energy_kj: data.energyKJ,
          protein: data.protein,
          carbs: data.carbs,
          fats: data.fats,
          saturated_fats: data.saturatedFats,
          fibers: data.fibers,
          sugars: data.sugars,
          salt: data.salt,
          vitamin_a: data.vitaminA,
          vitamin_b1: data.vitaminB1,
          vitamin_b2: data.vitaminB2,
          vitamin_b3: data.vitaminB3,
          vitamin_b5: data.vitaminB5,
          vitamin_b6: data.vitaminB6,
          vitamin_b9: data.vitaminB9,
          vitamin_b12: data.vitaminB12,
          vitamin_c: data.vitaminC,
          vitamin_d: data.vitaminD,
          vitamin_e: data.vitaminE,
          vitamin_k: data.vitaminK,
          calcium: data.calcium,
          chromium: data.chromium,
          copper: data.copper,
          fluoride: data.fluoride,
          iodine: data.iodine,
          iron: data.iron,
          magnesium: data.magnesium,
          manganese: data.manganese,
          molybdenum: data.molybdenum,
          phosphorus: data.phosphorus,
          potassium: data.potassium,
          selenium: data.selenium,
          sodium: data.sodium,
          zinc: data.zinc
        }, { onConflict: 'user_id' });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (type === 'weight') {
      // Delete existing weight history
      await supabase
        .from('weight_history')
        .delete()
        .eq('user_id', user.id);

      // Insert new weight entries
      if (data && Array.isArray(data) && data.length > 0) {
        const weightToInsert = data.map((entry: any) => ({
          user_id: user.id,
          date: entry.date,
          weight: entry.weight
        }));

        const { error } = await supabase
          .from('weight_history')
          .insert(weightToInsert);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true });
    }

    if (type === 'notes') {
      const { goalsText, notesText } = data;

      // Delete existing notes for this user
      await supabase
        .from('user_notes')
        .delete()
        .eq('user_id', user.id);

      // Insert goals text
      if (goalsText) {
        await supabase
          .from('user_notes')
          .insert({
            user_id: user.id,
            note_type: 'goals',
            content: goalsText
          });
      }

      // Insert general notes
      if (notesText) {
        await supabase
          .from('user_notes')
          .insert({
            user_id: user.id,
            note_type: 'general',
            content: notesText
          });
      }

      return NextResponse.json({ success: true });
    }

    if (type === 'nutrient-notes') {
      // Delete existing nutrient notes
      await supabase
        .from('nutrient_notes')
        .delete()
        .eq('user_id', user.id);

      // Insert new nutrient notes
      if (data && typeof data === 'object') {
        const notesToInsert = Object.entries(data).map(([key, value]) => ({
          user_id: user.id,
          nutrient_key: key,
          note: value
        }));

        const { error } = await supabase
          .from('nutrient_notes')
          .insert(notesToInsert);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
