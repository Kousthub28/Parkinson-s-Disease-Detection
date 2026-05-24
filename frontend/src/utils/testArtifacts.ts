import { mongodb } from '../lib/mongodbClient';

export type TestArtifactKind = 'image' | 'audio' | 'video';

const LOCAL_ARTIFACT_MAX_BYTES = 4 * 1024 * 1024;
const LOCAL_PATH_MARKERS = new Set(['local-analysis', 'local-capture', 'local-voice', 'motor-game']);

export const getArtifactKindForTest = (testType?: string | null, mimeType?: string | null): TestArtifactKind | null => {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType?.startsWith('audio/')) return 'audio';
  if (testType === 'spiral' || testType === 'wave') return 'image';
  if (testType === 'speech') return 'audio';
  if (testType === 'video') return 'video';
  return null;
};

const getExtension = (file: Blob, fallback: string) => {
  const typeExtension = file.type.split('/')[1]?.split(';')[0];
  if (typeExtension) return typeExtension.replace('mpeg', 'mp3').replace('x-wav', 'wav');
  return fallback;
};

export const isStoredArtifactPath = (path?: string | null) => {
  if (!path || LOCAL_PATH_MARKERS.has(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return false;
  }
  return true;
};

export const blobToDataUrl = (blob: Blob): Promise<string | null> => {
  if (blob.size > LOCAL_ARTIFACT_MAX_BYTES) return Promise.resolve(null);

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
};

export const uploadTestArtifact = async (
  userId: string,
  testType: string,
  file: Blob,
  fallbackExtension: string,
) => {
  try {
    const extension = getExtension(file, fallbackExtension);
    const fileName = `${userId}-${Date.now()}.${extension}`;
    const filePath = `${testType}/${userId}/${fileName}`;
    const uploadPromise = mongodb.storage.from('test_artifacts').upload(filePath, file);
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Upload timeout')), 7000);
    });
    const { error } = await Promise.race([uploadPromise, timeoutPromise]) as any;
    return error ? null : filePath;
  } catch {
    return null;
  }
};

export const fetchStoredArtifactObjectUrl = async (path: string) => {
  const token = mongodb.getToken();
  const response = await fetch(mongodb.storage.from('test_artifacts').getPublicUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error('Unable to load saved artifact');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
