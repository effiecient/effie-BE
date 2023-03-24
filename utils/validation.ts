const isRelativePathValid = (path: string): boolean => {
  // should not be empty, contain only alphanumeric characters and dashes, and not start with a dash
  return /^[a-zA-Z0-9]+[a-zA-Z0-9-]*$/.test(path);
};

export { isRelativePathValid };
