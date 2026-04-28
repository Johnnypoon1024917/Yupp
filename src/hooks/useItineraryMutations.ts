import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createItineraryAction,
  deleteItineraryAction,
  renameItineraryAction,
  cloneItineraryAction,
  saveItineraryAction,
} from '@/actions/itineraryActions';
import type { SaveDayItem } from '@/types';
import { itineraryKeys } from '@/hooks/useItineraryQueries';
import useToastStore from '@/store/useToastStore';

// ---------------------------------------------------------------------------
// useCreateItinerary
// ---------------------------------------------------------------------------

export function useCreateItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { name: string; tripDate?: string }) => {
      const result = await createItineraryAction(variables.name, variables.tripDate);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
    onError: (error: Error) => {
      useToastStore.getState().addToast(error.message, 'error');
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteItinerary
// ---------------------------------------------------------------------------

export function useDeleteItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itineraryId: string) => {
      const result = await deleteItineraryAction(itineraryId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
    onError: (error: Error) => {
      useToastStore.getState().addToast(error.message, 'error');
    },
  });
}


// ---------------------------------------------------------------------------
// useRenameItinerary
// ---------------------------------------------------------------------------

export function useRenameItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { itineraryId: string; newName: string }) => {
      const result = await renameItineraryAction(variables.itineraryId, variables.newName);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
    onError: (error: Error) => {
      useToastStore.getState().addToast(error.message, 'error');
    },
  });
}

// ---------------------------------------------------------------------------
// useCloneItinerary
// ---------------------------------------------------------------------------

export function useCloneItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceItineraryId: string) => {
      const result = await cloneItineraryAction(sourceItineraryId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.all });
    },
    onError: (error: Error) => {
      useToastStore.getState().addToast(error.message, 'error');
    },
  });
}

// ---------------------------------------------------------------------------
// useSaveItinerary
// ---------------------------------------------------------------------------

export function useSaveItinerary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { itineraryId: string; items: SaveDayItem[] }) => {
      const result = await saveItineraryAction(variables.itineraryId, variables.items);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: itineraryKeys.detail(variables.itineraryId) });
    },
    onError: (error: Error) => {
      useToastStore.getState().addToast(error.message, 'error');
    },
  });
}
