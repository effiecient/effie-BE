import { ShareConfiguration } from "../type/shareConfiguration";

// type Validator
export const isShareConfiguration = (shareConfiguration: ShareConfiguration): boolean => {
  if (typeof shareConfiguration.isShared !== "boolean") {
    return false;
  }
  if (shareConfiguration.sharedPrivilege) {
    if (shareConfiguration.sharedPrivilege !== "read" && shareConfiguration.sharedPrivilege !== "write") {
      return false;
    }
  }
  return true;
};
