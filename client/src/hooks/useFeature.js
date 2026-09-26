import { useLicense } from './useLicense';

export const useFeature = (featureName) => {
  const { hasFeature, promptUpgrade } = useLicense();
  const isAvailable = hasFeature(featureName);

  const requireFeature = () => {
    if (!isAvailable) {
      promptUpgrade(featureName);
      return false;
    }
    return true;
  };

  return { isAvailable, requireFeature };
};
