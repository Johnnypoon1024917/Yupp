'use server';

import { createClient } from '@/utils/supabase/server';
import { requireRegisteredUser } from '@/actions/auth';
import { validateName, validateUUID, validateTripDate } from '@/actions/validation';
import type { ActionResult, Itinerary, SaveDayItem } from '@/types';


export async function createItineraryAction(
  name: string,
  tripDate?: string
): Promise<ActionResult<Itinerary>> {
  try {
    const supabase = await createClient();
    const user = await requireRegisteredUser(supabase);
    const validName = validateName(name);
    const validDate = validateTripDate(tripDate);

    const { data, error } = await supabase
      .from('itineraries')
      .insert({ user_id: user.id, name: validName, trip_date: validDate })
      .select()
      .single();

    if (error) return { success: false, error: `Failed to create itinerary: ${error.message}` };

    return {
      success: true,
      data: {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        tripDate: data.trip_date,
        createdAt: data.created_at,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function deleteItineraryAction(
  itineraryId: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const user = await requireRegisteredUser(supabase);
    const validId = validateUUID(itineraryId);

    const { error } = await supabase
      .from('itineraries')
      .delete()
      .eq('id', validId)
      .eq('user_id', user.id);

    if (error) return { success: false, error: `Failed to delete itinerary: ${error.message}` };

    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function renameItineraryAction(
  itineraryId: string,
  newName: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const user = await requireRegisteredUser(supabase);
    const validId = validateUUID(itineraryId);
    const validName = validateName(newName);

    const { error } = await supabase
      .from('itineraries')
      .update({ name: validName })
      .eq('id', validId)
      .eq('user_id', user.id);

    if (error) return { success: false, error: `Failed to rename itinerary: ${error.message}` };

    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function saveItineraryAction(
  itineraryId: string,
  items: SaveDayItem[]
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const user = await requireRegisteredUser(supabase);
    const validId = validateUUID(itineraryId);

    // Validate each item
    for (const item of items) {
      validateUUID(item.pinId);
      if (!Number.isInteger(item.dayNumber) || item.dayNumber < 0) {
        throw new Error('Day number must be a non-negative integer');
      }
    }

    // Verify ownership of the itinerary
    const { data: itinerary, error: fetchError } = await supabase
      .from('itineraries')
      .select('id')
      .eq('id', validId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !itinerary) {
      return { success: false, error: 'Itinerary not found or access denied' };
    }

    // Delete existing items (RLS enforces ownership)
    const { error: deleteError } = await supabase
      .from('itinerary_items')
      .delete()
      .eq('itinerary_id', validId);

    if (deleteError) {
      return { success: false, error: `Failed to save itinerary: ${deleteError.message}` };
    }

    // Insert new items
    if (items.length > 0) {
      const rows = items.map((item) => ({
        itinerary_id: validId,
        pin_id: item.pinId,
        day_number: item.dayNumber,
        sort_order: item.sortOrder,
      }));

      const { error: insertError } = await supabase
        .from('itinerary_items')
        .insert(rows);

      if (insertError) {
        return { success: false, error: `Failed to save itinerary: ${insertError.message}` };
      }
    }

    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function cloneItineraryAction(
  sourceItineraryId: string
): Promise<ActionResult<string>> {
  try {
    const supabase = await createClient();
    const user = await requireRegisteredUser(supabase);
    const validSourceId = validateUUID(sourceItineraryId);

    // Fetch source itinerary (any user can clone public itineraries)
    const { data: source, error: fetchError } = await supabase
      .from('itineraries')
      .select('name, trip_date')
      .eq('id', validSourceId)
      .single();

    if (fetchError || !source) {
      return { success: false, error: 'Source itinerary not found' };
    }

    // Create new itinerary owned by the caller
    const { data: newItinerary, error: createError } = await supabase
      .from('itineraries')
      .insert({
        user_id: user.id,
        name: `${source.name} (copy)`,
        trip_date: source.trip_date,
      })
      .select('id')
      .single();

    if (createError || !newItinerary) {
      return { success: false, error: `Failed to clone itinerary: ${createError?.message ?? 'Unknown error'}` };
    }

    // Copy items from source to new itinerary
    const { data: sourceItems, error: itemsError } = await supabase
      .from('itinerary_items')
      .select('pin_id, day_number, sort_order')
      .eq('itinerary_id', validSourceId);

    if (itemsError) {
      return { success: false, error: `Failed to clone itinerary items: ${itemsError.message}` };
    }

    if (sourceItems && sourceItems.length > 0) {
      const newItems = sourceItems.map(item => ({
        itinerary_id: newItinerary.id,
        pin_id: item.pin_id,
        day_number: item.day_number,
        sort_order: item.sort_order,
      }));

      const { error: insertError } = await supabase
        .from('itinerary_items')
        .insert(newItems);

      if (insertError) {
        return { success: false, error: `Failed to clone itinerary items: ${insertError.message}` };
      }
    }

    return { success: true, data: newItinerary.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
