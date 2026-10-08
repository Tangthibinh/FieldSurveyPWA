import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';

export const isNativeApp = Capacitor.isNativePlatform();

export async function captureNativePhoto() {
  if (!isNativeApp) return null;

  const photo = await Camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.DataUrl,
    quality: 70,
    width: 800,
    height: 800,
    correctOrientation: true
  });

  return photo.dataUrl || null;
}

export async function saveNativePhoto(dataUrl, fileName) {
  if (!isNativeApp || !dataUrl) return null;

  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const result = await Filesystem.writeFile({
    path: `survey/${fileName}.jpg`,
    data: base64,
    directory: Directory.Data,
    recursive: true
  });

  return result.uri;
}

export async function getCurrentLocation() {
  try {
    if (isNativeApp) {
      const permission = await Geolocation.requestPermissions();
      if (permission.location === 'denied') return null;
    }

    if (!navigator.geolocation) return null;
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
  } catch (error) {
    console.warn('Location unavailable:', error);
    return null;
  }
}

export async function enablePushNotifications() {
  if (!isNativeApp) {
    return { enabled: false, message: 'Thông báo native chỉ khả dụng trong bản Android.' };
  }

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    return { enabled: false, message: 'Quyền thông báo chưa được cấp.' };
  }

  await PushNotifications.register();
  return { enabled: true, message: 'Đã bật thông báo trên thiết bị.' };
}
