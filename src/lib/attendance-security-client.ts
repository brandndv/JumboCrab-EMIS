export const collectAttendanceLocation = async (enabled: boolean) => {
  if (!enabled || typeof window === "undefined" || !navigator.geolocation) {
    return { latitude: null, longitude: null };
  }

  return new Promise<{ latitude: number | null; longitude: number | null }>(
    (resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          resolve({ latitude: null, longitude: null });
        },
        {
          enableHighAccuracy: false,
          timeout: 7000,
          maximumAge: 60_000,
        },
      );
    },
  );
};

export const collectAttendanceContext = async (config: {
  gpsValidationEnabled: boolean;
}) => {
  const location = await collectAttendanceLocation(config.gpsValidationEnabled);

  return {
    latitude: location.latitude,
    longitude: location.longitude,
  };
};
