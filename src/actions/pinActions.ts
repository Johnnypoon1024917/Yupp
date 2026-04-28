'use server';

import { createClient } from '@/utils/supabase/server';
import { requireRegisteredUser } from '@/actions/auth';
import { validateName, validateUUID } from '@/actions/validation';
import type { ActionResult, Pin } from '@/types';

export async function updatePinAction(
  id: string,
  updates: Partial<Pin>
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const user = await requireRegisteredUser(supabase);
    const validId = validateUUID(id);

    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.collectionId !== undefined) {
      dbUpdates.collection_id = validateUUID(updates.collectionId);
    }
    if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
    if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.placeId !== undefined) dbUpdates.place_id = updates.placeId;
    if (updates.primaryType !== undefined) dbUpdates.primary_type = updates.primaryType;
    if (updates.rating !== undefined) dbUpdates.rating = updates.rating;

    if (Object.keys(dbUpdates).length === 0) {
      return { success: true, data: undefined };
    }

    const { error } = await supabase
      .from('pins')
      .update(dbUpdates)
      .eq('id', validId)
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function renameCollectionAction(
  id: string,
  newName: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const user = await requireRegisteredUser(supabase);
    const validId = validateUUID(id);
    const validName = validateName(newName);

    const { error } = await supabase
      .from('collections')
      .update({ name: validName })
      .eq('id', validId)
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function deleteCollectionAction(
  id: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const user = await requireRegisteredUser(supabase);
    const validId = validateUUID(id);

    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', validId)
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function persistCollectionAction(
  id: string,
  name: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const user = await requireRegisteredUser(supabase);
    const validId = validateUUID(id);
    const validName = validateName(name);

    const { error } = await supabase
      .from('collections')
      .insert({ id: validId, user_id: user.id, name: validName });

    if (error) throw error;
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
