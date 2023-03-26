export const isAnyUndefined = (...args: any[]): boolean => {
  for (let arg of args) {
    if (arg === undefined) {
      return true;
    }
  }
  return false;
};
