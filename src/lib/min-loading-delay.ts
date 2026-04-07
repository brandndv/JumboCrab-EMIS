export async function withMinimumDelay<T>(
  task: Promise<T>,
  minimumMs = 450,
): Promise<T> {
  const delayPromise = new Promise((resolve) => {
    window.setTimeout(resolve, minimumMs);
  });

  try {
    const result = await task;
    await delayPromise;
    return result;
  } catch (error) {
    await delayPromise;
    throw error;
  }
}
