import useAppStore from '../store/useAppStore';

export const confirmDialog = async (title, message) => {
  return await useAppStore.getState().confirm(title, message);
};
