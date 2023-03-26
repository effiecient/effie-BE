export const isAnyDefined = (...args: any[]): boolean => {
  for (let arg of args) {
    if (arg !== undefined) {
      return true;
    }
  }
  return false;
};
