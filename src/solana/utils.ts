export function promisify<T, Args extends unknown[]>(
  fn: (...args: [...Args, (err: Error | null, result: T) => void]) => void,
  ...args: Args
): Promise<T> {
  return new Promise((resolve, reject) => {
    const callback: (err: Error | null, result: T) => void = (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    };

    fn(...args, callback);
  });
}
